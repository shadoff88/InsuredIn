import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match:
     * - / (root path for OAuth callback)
     * - /broker/:path* (all broker routes)
     * - /client/:path* (all client routes)
     * - /invite (invite route)
     */
    "/",
    "/broker/:path*",
    "/client/:path*",
    "/invite",
  ],
};
