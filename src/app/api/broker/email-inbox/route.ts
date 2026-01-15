import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
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

    // Get filter from query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("email_processing_transactions")
      .select(`
        id,
        from_email,
        to_email,
        subject,
        received_at,
        status,
        extracted_client_number,
        extracted_policy_number,
        extracted_document_type,
        ai_overall_confidence,
        suggested_client_id,
        suggested_policy_id,
        match_confidence,
        reviewed_at,
        broker_approved,
        error_message,
        clients:suggested_client_id (
          id,
          full_name,
          client_number
        ),
        policies:suggested_policy_id (
          id,
          policy_number,
          insurer
        ),
        email_attachments (
          id,
          filename,
          mime_type,
          size_bytes
        )
      `, { count: "exact" })
      .eq("broker_id", brokerUser.broker_id)
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter
    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: transactions, count, error } = await query;

    if (error) {
      console.error("Error fetching email transactions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get counts by status
    const { data: statusCounts } = await supabase
      .from("email_processing_transactions")
      .select("status")
      .eq("broker_id", brokerUser.broker_id);

    const counts = {
      all: statusCounts?.length || 0,
      pending: statusCounts?.filter((t) => t.status === "pending").length || 0,
      awaiting_review: statusCounts?.filter((t) => t.status === "awaiting_review").length || 0,
      approved: statusCounts?.filter((t) => t.status === "approved").length || 0,
      rejected: statusCounts?.filter((t) => t.status === "rejected").length || 0,
      error: statusCounts?.filter((t) => t.status === "error").length || 0,
    };

    return NextResponse.json({
      transactions,
      total: count,
      counts,
    });
  } catch (error) {
    console.error("Email inbox error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
