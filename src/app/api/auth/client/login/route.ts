import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    // Track cookies that need to be set in the response
    const cookiesToSet: { name: string; value: string; options: object }[] = [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_API ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach((cookie) => {
            cookiesToSet.push(cookie);
          });
        },
      },
    });

    // Sign in with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Use admin client to verify user is a client (bypasses RLS)
    const adminClient = createAdminClient();
    const { data: clientUser, error: clientError } = await adminClient
      .from("client_users")
      .select("*, clients(*, brokers(*))")
      .eq("user_id", authData.user.id)
      .single();

    if (clientError || !clientUser) {
      // Sign out if not a client user
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account is not registered as a client" },
        { status: 403 }
      );
    }

    // Update last login
    await adminClient
      .from("client_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", authData.user.id);

    // Log the login
    await adminClient.from("audit_logs").insert({
      broker_id: clientUser.clients.broker_id,
      user_id: authData.user.id,
      user_type: "client",
      action: "login",
      entity_type: "client_user",
      entity_id: clientUser.client_id,
    });

    // Create response with success data
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName: clientUser.clients.full_name,
      },
      client: {
        id: clientUser.client_id,
        clientNumber: clientUser.clients.client_number,
      },
      broker: {
        companyName: clientUser.clients.brokers.company_name,
      },
    });

    // Set all cookies from the auth session on the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as object);
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Client login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
