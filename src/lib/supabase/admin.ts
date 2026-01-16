import { createClient } from "@supabase/supabase-js";

// Admin client uses service role/secret key to bypass RLS
// Only use this for server-side operations that need elevated privileges
// like user registration, admin operations, etc.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  // Support various key names from different Supabase/Vercel integrations
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_API ||
    process.env.SUPABASE_SECRET_KEY ||  // Vercel integration creates this
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error("Admin client: No service role key found. Checked SUPABASE_SECRET_API and SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("SUPABASE_SECRET_API or SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  // Log which key type is being used (first 10 chars only for security)
  const keyPrefix = serviceRoleKey.substring(0, 10);
  console.log(`Admin client: Using key starting with "${keyPrefix}..."`);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
