import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { brokerRegisterSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  // Log env vars (first few chars only for security)
  const secretKey = process.env.SUPABASE_SECRET_API;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("ENV CHECK - SUPABASE_SECRET_API exists:", !!secretKey, secretKey?.substring(0, 15));
  console.log("ENV CHECK - SUPABASE_SERVICE_ROLE_KEY exists:", !!serviceKey, serviceKey?.substring(0, 15));

  try {
    const body = await request.json();
    const validated = brokerRegisterSchema.parse(body);
    console.log("Step 1: Validation passed for:", validated.email);

    // Use admin client to bypass RLS for registration
    let supabase;
    try {
      supabase = createAdminClient();
      console.log("Step 2: Admin client created successfully");
    } catch (adminError) {
      console.error("Failed to create admin client:", adminError);
      return NextResponse.json(
        { error: "Server configuration error - admin client" },
        { status: 500 }
      );
    }

    // Create auth user
    console.log("Step 3: Creating auth user...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth user creation failed:", authError);
      return NextResponse.json(
        { error: `Auth error: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.error("No user returned from createUser");
      return NextResponse.json(
        { error: "Failed to create user - no user returned" },
        { status: 500 }
      );
    }
    console.log("Step 4: Auth user created:", authData.user.id);

    // Create broker record
    console.log("Step 5: Creating broker record...");
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .insert({
        company_name: validated.companyName,
        email: validated.email,
      })
      .select()
      .single();

    if (brokerError) {
      console.error("Broker insert error:", JSON.stringify(brokerError));
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Broker creation failed: ${brokerError.message} (code: ${brokerError.code})` },
        { status: 500 }
      );
    }
    console.log("Step 6: Broker created:", broker.id);

    // Create broker_user record
    console.log("Step 7: Creating broker_user record...");
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
      console.error("Broker user insert error:", JSON.stringify(brokerUserError));
      await supabase.from("brokers").delete().eq("id", broker.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Broker user creation failed: ${brokerUserError.message}` },
        { status: 500 }
      );
    }
    console.log("Step 8: Broker user created");

    // Create default branding
    await supabase.from("broker_branding").insert({
      broker_id: broker.id,
    });
    console.log("Step 9: Registration complete!");

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
    console.error("Broker registration unexpected error:", error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
