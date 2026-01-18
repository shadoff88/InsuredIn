import { createClient } from "@/lib/supabase/server";
import { uploadDocument } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current broker user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get broker_id from broker_users table
    const { data: brokerUser, error: brokerError } = await supabase
      .from("broker_users")
      .select("broker_id")
      .eq("user_id", user.id)
      .single();

    if (brokerError || !brokerUser) {
      return NextResponse.json({ error: "Broker not found" }, { status: 404 });
    }

    const brokerId = brokerUser.broker_id;

    // Parse multipart form data
    const formData = await request.formData();
    const fromEmail = formData.get("fromEmail") as string;
    const subject = formData.get("subject") as string;
    const files = formData.getAll("files") as File[];

    if (!fromEmail || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: fromEmail, subject" },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required" },
        { status: 400 }
      );
    }

    // Get or create email inbox for this broker
    let { data: inbox } = await supabase
      .from("email_inboxes")
      .select("id")
      .eq("broker_id", brokerId)
      .eq("status", "active")
      .single();

    if (!inbox) {
      // Create a default inbox for manual uploads
      const { data: newInbox, error: inboxError } = await supabase
        .from("email_inboxes")
        .insert({
          broker_id: brokerId,
          email_address: `manual-uploads@broker-${brokerId}.insuredin.app`,
          status: "active",
        })
        .select("id")
        .single();

      if (inboxError || !newInbox) {
        return NextResponse.json(
          { error: "Failed to create inbox" },
          { status: 500 }
        );
      }

      inbox = newInbox;
    }

    // Create email processing transaction
    const { data: transaction, error: transactionError } = await supabase
      .from("email_processing_transactions")
      .insert({
        broker_id: brokerId,
        inbox_id: inbox.id,
        from_email: fromEmail,
        to_email: `manual-upload@broker.insuredin.app`,
        subject,
        received_at: new Date().toISOString(),
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

    // Upload files to R2 and create attachment records
    const attachmentPromises = files.map(async (file) => {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to R2
        const uploadResult = await uploadDocument({
          file: buffer,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          brokerId,
          folder: "attachments",
        });

        // Create attachment record
        const { error: attachmentError } = await supabase
          .from("email_attachments")
          .insert({
            transaction_id: transaction.id,
            filename: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            storage_url: uploadResult.storageKey,
          });

        if (attachmentError) {
          console.error("Attachment record error:", attachmentError);
        }

        return uploadResult;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    });

    await Promise.all(attachmentPromises);

    // Update transaction status to awaiting_review (skip AI for manual uploads initially)
    await supabase
      .from("email_processing_transactions")
      .update({ status: "awaiting_review" })
      .eq("id", transaction.id);

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      message: `Uploaded ${files.length} file(s) successfully`,
    });
  } catch (error) {
    console.error("Manual upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
