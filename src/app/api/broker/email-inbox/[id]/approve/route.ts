import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const approveSchema = z.object({
  approved: z.boolean(),
  clientId: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
  documentType: z.string().optional(),
  correctionReason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = approveSchema.parse(body);

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get broker user
    const { data: brokerUser } = await supabase
      .from("broker_users")
      .select("broker_id")
      .eq("user_id", user.id)
      .single();

    if (!brokerUser) {
      return NextResponse.json({ error: "Not a broker user" }, { status: 403 });
    }

    // Get transaction
    const { data: transaction } = await supabase
      .from("email_processing_transactions")
      .select("*, email_attachments(*)")
      .eq("id", id)
      .eq("broker_id", brokerUser.broker_id)
      .single();

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (validated.approved) {
      // Require client and policy for approval
      const finalClientId = validated.clientId || transaction.suggested_client_id;
      const finalPolicyId = validated.policyId || transaction.suggested_policy_id;
      const finalDocType = validated.documentType || transaction.extracted_document_type;

      if (!finalClientId || !finalPolicyId) {
        return NextResponse.json(
          { error: "Client and policy must be selected for approval" },
          { status: 400 }
        );
      }

      // Determine if AI suggestion was correct
      const aiSuggestionCorrect =
        finalClientId === transaction.suggested_client_id &&
        finalPolicyId === transaction.suggested_policy_id &&
        finalDocType === transaction.extracted_document_type;

      // Create document records for each attachment
      const documentIds: string[] = [];
      for (const attachment of transaction.email_attachments || []) {
        const { data: doc, error: docError } = await supabase
          .from("documents")
          .insert({
            broker_id: brokerUser.broker_id,
            policy_id: finalPolicyId,
            document_type: finalDocType || "other",
            file_name: attachment.filename,
            storage_url: attachment.storage_url,
            mime_type: attachment.mime_type,
            size_bytes: attachment.size_bytes,
            uploaded_by_transaction_id: id,
            uploaded_by_user_id: user.id,
          })
          .select("id")
          .single();

        if (doc) {
          documentIds.push(doc.id);
        }
        if (docError) {
          console.error("Error creating document:", docError);
        }
      }

      // Update transaction
      const { error: updateError } = await supabase
        .from("email_processing_transactions")
        .update({
          status: "approved",
          broker_approved: true,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
          final_client_id: finalClientId,
          final_policy_id: finalPolicyId,
          final_document_type: finalDocType,
          ai_suggestion_correct: aiSuggestionCorrect,
          broker_correction_reason: validated.correctionReason,
          created_document_ids: documentIds,
          processed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        broker_id: brokerUser.broker_id,
        user_id: user.id,
        user_type: "broker",
        action: "approve",
        entity_type: "email_processing_transaction",
        entity_id: id,
        changes: {
          final_client_id: finalClientId,
          final_policy_id: finalPolicyId,
          ai_suggestion_correct: aiSuggestionCorrect,
          documents_created: documentIds.length,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Document approved and published",
        documentsCreated: documentIds.length,
      });
    } else {
      // Rejection
      const { error: updateError } = await supabase
        .from("email_processing_transactions")
        .update({
          status: "rejected",
          broker_approved: false,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
          broker_correction_reason: validated.correctionReason || "Rejected by broker",
          processed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        broker_id: brokerUser.broker_id,
        user_id: user.id,
        user_type: "broker",
        action: "reject",
        entity_type: "email_processing_transaction",
        entity_id: id,
        changes: { reason: validated.correctionReason },
      });

      return NextResponse.json({
        success: true,
        message: "Document rejected",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Approve transaction error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
