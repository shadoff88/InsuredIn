import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseEmail, filterPdfAttachments } from "@/lib/email/parse-email";
import { uploadDocument } from "@/lib/storage";
import { verifyWebhookSignature } from "@/lib/webhooks/verify-signature";

/**
 * Webhook endpoint for Cloudflare Email Worker
 * Receives forwarded emails from Cloudflare and processes them
 *
 * Security:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (±5 minutes)
 * - Subdomain-based broker validation
 * - Rate limiting (100 emails/hour per broker)
 *
 * @see docs/sprint1/EMAIL_WEBHOOK_SECURITY.md
 */
export async function POST(request: NextRequest) {
  try {
    // 1. SECURITY: Extract and validate authentication headers
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');

    if (!signature || !timestamp) {
      console.warn('SECURITY: Missing authentication headers', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    // Read raw email as ArrayBuffer for signature verification
    const bodyArrayBuffer = await request.arrayBuffer();

    if (bodyArrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: "No email content" }, { status: 400 });
    }

    // Verify webhook secret is configured
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET environment variable not configured');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 2. SECURITY: Verify HMAC signature
    const isValidSignature = await verifyWebhookSignature({
      signature,
      timestamp,
      body: bodyArrayBuffer,
      secret: webhookSecret,
    });

    if (!isValidSignature) {
      console.error('SECURITY: Invalid webhook signature', {
        timestamp,
        signaturePrefix: signature.substring(0, 8),
        ipAddress: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 3. SECURITY: Validate timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);

    // Reject requests older than 5 minutes
    if (timeDiff > 5 * 60 * 1000) {
      console.error('SECURITY: Request timestamp too old', {
        timeDiff,
        timestamp,
        ipAddress: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { error: "Request expired" },
        { status: 401 }
      );
    }

    // 4. SECURITY: Extract and validate broker subdomain
    const brokerSubdomain = request.headers.get('x-broker-subdomain');
    const recipientEmail = request.headers.get('x-recipient-email');
    const senderEmail = request.headers.get('x-sender-email');

    if (!brokerSubdomain || !recipientEmail) {
      console.warn('Missing broker information headers', {
        hasBrokerSubdomain: !!brokerSubdomain,
        hasRecipientEmail: !!recipientEmail,
      });
      return NextResponse.json(
        { error: "Missing broker information" },
        { status: 400 }
      );
    }

    // Create Supabase client (service role for webhook)
    const supabase = await createClient();

    // Validate broker exists via subdomain lookup
    const { data: brokerBranding, error: brokerError } = await supabase
      .from("broker_branding")
      .select("broker_id, subdomain")
      .eq("subdomain", brokerSubdomain)
      .single();

    if (brokerError || !brokerBranding) {
      console.error('SECURITY: Email to non-existent subdomain', {
        subdomain: brokerSubdomain,
        senderEmail,
        recipientEmail,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Broker not found" },
        { status: 404 }
      );
    }

    const brokerId = brokerBranding.broker_id;

    // 5. SECURITY: Rate limiting (100 emails per broker per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await supabase
      .from("email_processing_transactions")
      .select("id", { count: "exact", head: true })
      .eq("broker_id", brokerId)
      .gte("received_at", oneHourAgo);

    if (countError) {
      console.error('Rate limit check error:', countError);
      // Fail open (allow request) to avoid blocking legitimate emails
    }

    if ((count || 0) >= 100) {
      console.error('SECURITY: Rate limit exceeded', {
        broker_id: brokerId,
        subdomain: brokerSubdomain,
        emailCount: count,
        senderEmail,
      });
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // Convert ArrayBuffer to string for email parsing
    const rawEmail = new TextDecoder().decode(bodyArrayBuffer);

    // Parse email
    const parsed = await parseEmail(rawEmail);
    console.log(`Processing email from ${parsed.from}, subject: ${parsed.subject}`);

    const toEmail = recipientEmail;

    // Get or create email inbox
    let { data: inbox } = await supabase
      .from("email_inboxes")
      .select("id")
      .eq("broker_id", brokerId)
      .eq("email_address", toEmail)
      .single();

    if (!inbox) {
      const { data: newInbox, error: inboxError } = await supabase
        .from("email_inboxes")
        .insert({
          broker_id: brokerId,
          email_address: toEmail,
          status: "active",
        })
        .select("id")
        .single();

      if (inboxError || !newInbox) {
        console.error("Failed to create inbox:", inboxError);
        return NextResponse.json(
          { error: "Failed to create inbox" },
          { status: 500 }
        );
      }

      inbox = newInbox;
    }

    // Filter to PDF attachments only
    const pdfAttachments = filterPdfAttachments(parsed.attachments);

    if (pdfAttachments.length === 0) {
      console.log("No PDF attachments found, skipping");
      return NextResponse.json({
        success: true,
        message: "No PDF attachments to process",
      });
    }

    // Create email processing transaction
    const { data: transaction, error: transactionError } = await supabase
      .from("email_processing_transactions")
      .insert({
        broker_id: brokerId,
        inbox_id: inbox.id,
        from_email: parsed.from,
        to_email: toEmail,
        subject: parsed.subject,
        received_at: parsed.receivedAt.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (transactionError || !transaction) {
      console.error("Transaction creation error:", transactionError);
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    // Upload attachments to R2
    const uploadPromises = pdfAttachments.map(async (att) => {
      try {
        const uploadResult = await uploadDocument({
          file: att.content,
          filename: att.filename,
          mimeType: att.mimeType,
          brokerId,
          folder: "attachments",
        });

        // Create attachment record
        const { error: attachmentError } = await supabase
          .from("email_attachments")
          .insert({
            transaction_id: transaction.id,
            filename: att.filename,
            mime_type: att.mimeType,
            size_bytes: att.size,
            storage_url: uploadResult.storageKey,
          });

        if (attachmentError) {
          console.error("Attachment record error:", attachmentError);
        }

        return uploadResult;
      } catch (error) {
        console.error(`Failed to upload ${att.filename}:`, error);
        throw error;
      }
    });

    await Promise.all(uploadPromises);

    // Update status to awaiting_review
    // TODO: Trigger AI extraction here in the future
    await supabase
      .from("email_processing_transactions")
      .update({
        status: "awaiting_review",
        processed_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    console.log(`Successfully processed ${pdfAttachments.length} PDF(s) for transaction ${transaction.id}`);

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      attachmentsProcessed: pdfAttachments.length,
    });
  } catch (error) {
    console.error("Email webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 * Returns webhook status and timestamp
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "email-inbound-webhook",
    version: "3.0",
    security: "HMAC-SHA256 + subdomain routing + rate limiting",
    timestamp: new Date().toISOString(),
  });
}
