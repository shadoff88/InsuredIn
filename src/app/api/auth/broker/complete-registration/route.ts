import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const completeRegistrationSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = completeRegistrationSchema.parse(body);

    // Get the current user from the session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Use admin client for database operations
    const adminClient = createAdminClient();

    // Check if user already has a broker account
    const { data: existingBrokerUser } = await adminClient
      .from("broker_users")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existingBrokerUser) {
      return NextResponse.json(
        { error: "You already have a broker account" },
        { status: 400 }
      );
    }

    // Create broker record
    const { data: broker, error: brokerError } = await adminClient
      .from("brokers")
      .insert({
        company_name: validated.companyName,
        email: user.email,
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
    const { error: brokerUserError } = await adminClient
      .from("broker_users")
      .insert({
        broker_id: broker.id,
        user_id: user.id,
        role: "admin",
        full_name: validated.fullName,
        email: user.email,
      });

    if (brokerUserError) {
      // Clean up on failure
      await adminClient.from("brokers").delete().eq("id", broker.id);
      return NextResponse.json(
        { error: brokerUserError.message },
        { status: 500 }
      );
    }

    // Create default branding
    await adminClient.from("broker_branding").insert({
      broker_id: broker.id,
    });

    return NextResponse.json({
      success: true,
      broker: {
        id: broker.id,
        companyName: broker.company_name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Complete registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
