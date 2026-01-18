import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseEmail, extractBrokerIdFromEmail, filterPdfAttachments } from "@/lib/email/parse-email";
import { uploadDocument } from "@/lib/storage";

/**
 * Webhook endpoint for Cloudflare Email Routing
 * Receives forwarded emails and processes them
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw email content
    const rawEmail = await request.text();

    if (!rawEmail) {
      return NextResponse.json({ error: "No email content" }, { status: 400 });
    }

    // Parse email
    const parsed = await parseEmail(rawEmail);
    console.log(`Processing email from ${parsed.from}, subject: ${parsed.subject}`);

    // Extract broker ID from destination email
    const toEmail = parsed.to[0] || '';
    const brokerIdentifier = extractBrokerIdFromEmail(toEmail);

    if (!brokerIdentifier) {
      console.error(`Could not extract broker from email: ${toEmail}`);
      return NextResponse.json(
        { error: "Invalid destination email" },
        { status: 400 }
      );
    }

    // Create Supabase client (admin mode for webhook)
    const supabase = await createClient();

    // Look up broker by ID or subdomain
    let brokerId: string;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brokerIdentifier);

    if (isUuid) {
      brokerId = brokerIdentifier;
    } else {
      // Look up by subdomain
      const { data: branding } = await supabase
        .from("broker_branding")
        .select("broker_id")
        .eq("subdomain", brokerIdentifier)
        .single();

      if (!branding) {
        console.error(`Broker not found for subdomain: ${brokerIdentifier}`);
        return NextResponse.json(
          { error: "Broker not found" },
          { status: 404 }
        );
      }

      brokerId = branding.broker_id;
    }

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

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "email-inbound-webhook",
    timestamp: new Date().toISOString(),
  });
}
