import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_API!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
