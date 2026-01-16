import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    const supabase = await createClient();

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Use admin client to verify user is a broker (bypasses RLS)
    const adminClient = createAdminClient();
    const { data: brokerUser, error: brokerError } = await adminClient
      .from("broker_users")
      .select("*, brokers(*)")
      .eq("user_id", authData.user.id)
      .single();

    if (brokerError || !brokerUser) {
      // Sign out if not a broker user
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account is not registered as a broker" },
        { status: 403 }
      );
    }

    // Update last login
    await adminClient.from("audit_logs").insert({
      broker_id: brokerUser.broker_id,
      user_id: authData.user.id,
      user_type: "broker",
      action: "login",
      entity_type: "broker_user",
      entity_id: brokerUser.id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName: brokerUser.full_name,
        role: brokerUser.role,
      },
      broker: {
        id: brokerUser.broker_id,
        companyName: brokerUser.brokers.company_name,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Broker login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
