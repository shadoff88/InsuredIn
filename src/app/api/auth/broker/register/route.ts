import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { brokerRegisterSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = brokerRegisterSchema.parse(body);

    const supabase = await createClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validated.email,
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

    // Create broker record
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .insert({
        company_name: validated.companyName,
        email: validated.email,
      })
      .select()
      .single();

    if (brokerError) {
      return NextResponse.json(
        { error: brokerError.message },
        { status: 500 }
      );
    }

    // Create broker_user record
    const { error: brokerUserError } = await supabase
      .from("broker_users")
      .insert({
        broker_id: broker.id,
        user_id: authData.user.id,
        role: "admin",
        full_name: validated.fullName,
        email: validated.email,
      });

    if (brokerUserError) {
      return NextResponse.json(
        { error: brokerUserError.message },
        { status: 500 }
      );
    }

    // Create default branding
    await supabase.from("broker_branding").insert({
      broker_id: broker.id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      broker: {
        id: broker.id,
        companyName: broker.company_name,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Broker registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
