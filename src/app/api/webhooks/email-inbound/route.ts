import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseEmail, extractBrokerUidFromEmail, filterPdfAttachments } from "@/lib/email/parse-email";
import { uploadDocument } from "@/lib/storage";
import { verifyWebhookSignature } from "@/lib/webhooks/verify-signature";

/**
 * Webhook endpoint for Cloudflare Email Worker
 * Receives forwarded emails from Cloudflare and processes them
 *
 * Security:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (±5 minutes)
 * - Broker UID validation
 *
 * @see docs/sprint1/EMAIL_WEBHOOK_SECURITY.md
 */
export async function POST(request: NextRequest) {
  try {
    // Extract headers
    const signature = request.headers.get('X-Webhook-Signature');
    const timestamp = request.headers.get('X-Webhook-Timestamp');

    // Validate required headers
    if (!signature || !timestamp) {
      console.warn('Missing webhook headers', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 400 }
      );
    }

    // Read raw email as ArrayBuffer for signature verification
    const bodyArrayBuffer = await request.arrayBuffer();

    if (bodyArrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: "No email content" }, { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET environment variable not configured');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const isValidSignature = await verifyWebhookSignature({
      signature,
      timestamp,
      body: bodyArrayBuffer,
      secret: webhookSecret,
    });

    if (!isValidSignature) {
      console.warn('Invalid webhook signature', {
        timestamp,
        signaturePrefix: signature.substring(0, 8),
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Convert ArrayBuffer to string for email parsing
    const rawEmail = new TextDecoder().decode(bodyArrayBuffer);

    // Parse email
    const parsed = await parseEmail(rawEmail);
    console.log(`Processing email from ${parsed.from}, subject: ${parsed.subject}`);

    // Extract broker UID from destination email
    const toEmail = parsed.to[0] || '';
    const brokerUid = extractBrokerUidFromEmail(toEmail);

    if (!brokerUid) {
      console.error(`Could not extract broker UID from email: ${toEmail}`);
      return NextResponse.json(
        { error: "Invalid destination email format" },
        { status: 400 }
      );
    }

    // Create Supabase client (service role for webhook)
    const supabase = await createClient();

    // Verify broker exists
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .select("id")
      .eq("id", brokerUid)
      .single();

    if (brokerError || !broker) {
      console.error(`Broker not found: ${brokerUid}`);
      return NextResponse.json(
        { error: "Broker not found" },
        { status: 404 }
      );
    }

    const brokerId = brokerUid;

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
    version: "2.0",
    security: "HMAC-SHA256 enabled",
    timestamp: new Date().toISOString(),
  });
}
