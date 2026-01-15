import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_API!;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get user and refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/broker/login") ||
    request.nextUrl.pathname.startsWith("/broker/register") ||
    request.nextUrl.pathname.startsWith("/client/login") ||
    request.nextUrl.pathname.startsWith("/client/register") ||
    request.nextUrl.pathname.startsWith("/invite");

  const isBrokerRoute = request.nextUrl.pathname.startsWith("/broker");
  const isClientRoute = request.nextUrl.pathname.startsWith("/client");

  // If no user and trying to access protected route, redirect to login
  if (!user && !isAuthRoute) {
    if (isBrokerRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/broker/login";
      return NextResponse.redirect(url);
    }
    if (isClientRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/client/login";
      return NextResponse.redirect(url);
    }
  }

  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    // Check user type and redirect accordingly
    const url = request.nextUrl.clone();
    if (request.nextUrl.pathname.startsWith("/broker")) {
      url.pathname = "/broker/dashboard";
    } else {
      url.pathname = "/client/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
