import { createClient } from "@supabase/supabase-js";

// Admin client uses service role/secret key to bypass RLS
// Only use this for server-side operations that need elevated privileges
// like user registration, admin operations, etc.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Support both new (SUPABASE_SECRET_API) and legacy (SUPABASE_SERVICE_ROLE_KEY) key names
  const serviceRoleKey = process.env.SUPABASE_SECRET_API || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SECRET_API or SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
