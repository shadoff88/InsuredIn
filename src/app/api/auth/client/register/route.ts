import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientRegisterSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = clientRegisterSchema.parse(body);

    // Use admin client to bypass RLS for registration
    const supabase = createAdminClient();

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientData = invite.clients as any;

    // Create auth user with client's email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: clientData.email,
      password: validated.password,
      email_confirm: true,
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
      await supabase.auth.admin.deleteUser(authData.user.id);
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
        fullName: clientData.full_name,
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
