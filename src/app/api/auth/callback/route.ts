import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/broker/dashboard";
  const userType = searchParams.get("type") || "broker";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(new URL(`/${userType}/login?error=auth_failed`, appUrl));
    }

    if (session?.user) {
      // Check if user exists in broker_users or client_users
      const adminClient = createAdminClient();
      const userId = session.user.id;

      if (userType === "broker") {
        const { data: existingBrokerUser } = await adminClient
          .from("broker_users")
          .select("id, broker_id")
          .eq("user_id", userId)
          .single();

        if (!existingBrokerUser) {
          // New broker user signing up with Google - redirect to complete registration
          return NextResponse.redirect(
            new URL(`/broker/complete-registration?provider=google`, appUrl)
          );
        }
      } else if (userType === "client") {
        const { data: existingClientUser } = await adminClient
          .from("client_users")
          .select("id, client_id")
          .eq("user_id", userId)
          .single();

        if (!existingClientUser) {
          // Client must use invite link
          return NextResponse.redirect(
            new URL(`/login?error=no_account`, appUrl)
          );
        }
      }

      // Existing user, redirect to dashboard
      return NextResponse.redirect(new URL(redirectTo, appUrl));
    }
  }

  // No code, redirect to login
  return NextResponse.redirect(new URL(`/${userType}/login`, appUrl));
}
