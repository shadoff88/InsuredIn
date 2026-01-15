import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get transaction with all related data
    const { data: transaction, error } = await supabase
      .from("email_processing_transactions")
      .select(`
        *,
        clients:suggested_client_id (
          id,
          full_name,
          client_number,
          email
        ),
        policies:suggested_policy_id (
          id,
          policy_number,
          insurer,
          policy_type,
          period_start,
          period_end
        ),
        final_clients:final_client_id (
          id,
          full_name,
          client_number
        ),
        final_policies:final_policy_id (
          id,
          policy_number,
          insurer
        ),
        email_attachments (
          id,
          filename,
          mime_type,
          size_bytes,
          storage_url
        )
      `)
      .eq("id", id)
      .eq("broker_id", brokerUser.broker_id)
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Get transaction error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
