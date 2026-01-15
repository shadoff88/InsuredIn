import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
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

    // Verify client belongs to this broker
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("broker_id", brokerUser.broker_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get policies for this client
    const { data: policies, error } = await supabase
      .from("policies")
      .select(`
        id,
        policy_number,
        insurer,
        policy_type,
        status,
        period_start,
        period_end,
        packages!inner (
          client_id
        )
      `)
      .eq("broker_id", brokerUser.broker_id)
      .eq("packages.client_id", clientId)
      .order("policy_number");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ policies });
  } catch (error) {
    console.error("Get client policies error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
