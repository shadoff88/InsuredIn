import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientRegisterSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = clientRegisterSchema.parse(body);

    const supabase = await createClient();

    // Validate invite code
    const { data: invite, error: inviteError } = await supabase
      .from("client_invites")
      .select("*, clients(*)")
      .eq("invite_code", validated.inviteCode)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite code" },
        { status: 400 }
      );
    }

    // Create auth user with client's email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.clients.email,
      password: validated.password,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // Create client_user record
    const { error: clientUserError } = await supabase
      .from("client_users")
      .insert({
        user_id: authData.user.id,
        client_id: invite.client_id,
        auth_provider: "password",
      });

    if (clientUserError) {
      return NextResponse.json(
        { error: clientUserError.message },
        { status: 500 }
      );
    }

    // Mark invite as accepted
    await supabase
      .from("client_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Log the registration
    await supabase.from("audit_logs").insert({
      broker_id: invite.broker_id,
      user_id: authData.user.id,
      user_type: "client",
      action: "register",
      entity_type: "client_user",
      entity_id: invite.client_id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      client: {
        id: invite.client_id,
        fullName: invite.clients.full_name,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Client registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
