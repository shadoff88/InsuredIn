import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrokerUser } from "@/lib/services/auth";
import { z } from "zod";

const createClientSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  clientNumber: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function GET() {
  try {
    const brokerUser = await getBrokerUser();

    if (!brokerUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all clients
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, full_name, client_number, email, phone")
      .eq("broker_id", brokerUser.broker_id)
      .order("full_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Get clients error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const brokerUser = await getBrokerUser();

    if (!brokerUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = createClientSchema.parse(body);

    const supabase = await createClient();

    // Check if email already exists for this broker
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("broker_id", brokerUser.broker_id)
      .eq("email", validated.email)
      .single();

    if (existingClient) {
      return NextResponse.json(
        { error: "A client with this email already exists" },
        { status: 400 }
      );
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        broker_id: brokerUser.broker_id,
        full_name: validated.fullName,
        email: validated.email,
        client_number: validated.clientNumber || null,
        phone: validated.phone || null,
        address: validated.address || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      broker_id: brokerUser.broker_id,
      user_id: brokerUser.user_id,
      user_type: "broker",
      action: "create",
      entity_type: "client",
      entity_id: client.id,
      details: { fullName: validated.fullName, email: validated.email },
    });

    return NextResponse.json({
      success: true,
      client,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Create client error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
