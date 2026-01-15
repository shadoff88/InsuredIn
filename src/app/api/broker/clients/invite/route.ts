import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const inviteSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = inviteSchema.parse(body);

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get broker user
    const { data: brokerUser } = await supabase
      .from("broker_users")
      .select("broker_id")
      .eq("user_id", user.id)
      .single();

    if (!brokerUser) {
      return NextResponse.json(
        { error: "Not a broker user" },
        { status: 403 }
      );
    }

    // Verify client belongs to this broker
    const { data: client } = await supabase
      .from("clients")
      .select("id, email, full_name, broker_id")
      .eq("id", validated.clientId)
      .eq("broker_id", brokerUser.broker_id)
      .single();

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Check if client already has an account
    const { data: existingUser } = await supabase
      .from("client_users")
      .select("user_id")
      .eq("client_id", validated.clientId)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "Client already has an account" },
        { status: 400 }
      );
    }

    // Check for existing active invite
    const { data: existingInvite } = await supabase
      .from("client_invites")
      .select("id, invite_code, expires_at")
      .eq("client_id", validated.clientId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json({
        success: true,
        invite: {
          code: existingInvite.invite_code,
          expiresAt: existingInvite.expires_at,
          inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite?code=${existingInvite.invite_code}`,
        },
        message: "Existing invite returned",
      });
    }

    // Create new invite
    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: inviteError } = await supabase
      .from("client_invites")
      .insert({
        broker_id: brokerUser.broker_id,
        client_id: validated.clientId,
        invite_code: inviteCode,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 500 }
      );
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      broker_id: brokerUser.broker_id,
      user_id: user.id,
      user_type: "broker",
      action: "create",
      entity_type: "client_invite",
      entity_id: invite.id,
      changes: { client_id: validated.clientId, invite_code: inviteCode },
    });

    return NextResponse.json({
      success: true,
      invite: {
        code: inviteCode,
        expiresAt: invite.expires_at,
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite?code=${inviteCode}`,
      },
      client: {
        id: client.id,
        fullName: client.full_name,
        email: client.email,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Invite creation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
