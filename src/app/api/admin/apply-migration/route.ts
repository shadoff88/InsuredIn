/**
 * Temporary API route to apply the broker_users RLS fix migration
 * DELETE THIS FILE after migration is applied
 *
 * To use: Navigate to /api/admin/apply-migration in your browser
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // The SQL to fix the circular dependency in broker_users RLS
    const sql = `
      -- Fix circular dependency in broker_users RLS policy
      -- Add policy that allows users to read their own broker_users record by user_id
      CREATE POLICY IF NOT EXISTS "broker_users_read_own_record" ON broker_users
        FOR SELECT
        USING (user_id = auth.uid());
    `;

    console.log("Applying migration to fix broker_users RLS...");

    // Apply the migration by executing raw SQL
    // Note: Supabase admin client doesn't have a direct .sql() method,
    // so we'll use the REST API directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_API!;

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    // Alternative: Try using Supabase SQL endpoint
    const postgrestResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "params=single-object",
      },
      body: JSON.stringify({
        query: sql,
      }),
    });

    // Since the above might not work, let's try using the auth admin client
    // which we know works, to create a session and then execute the SQL
    const { data: adminUser, error: adminError } = await supabase.auth.admin.listUsers();

    if (adminError) {
      throw new Error(`Admin client not working: ${adminError.message}`);
    }

    // If we got here, admin client works, but we need to execute raw SQL
    // The best approach is to use the Supabase SQL editor or apply via migration
    return NextResponse.json({
      success: false,
      message: "Please apply the migration manually in Supabase SQL Editor",
      instructions: [
        "1. Go to your Supabase Dashboard (https://supabase.com/dashboard)",
        "2. Select your project",
        "3. Click on 'SQL Editor' in the left sidebar",
        "4. Click 'New query'",
        "5. Paste the following SQL:",
        "",
        sql,
        "",
        "6. Click 'Run' to execute",
        "7. After successful execution, delete the file: src/app/api/admin/apply-migration/route.ts",
      ],
      sql,
      debug: {
        adminClientWorks: !adminError,
        supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      },
    });
  } catch (error) {
    console.error("Error in migration route:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        instructions: [
          "Please apply the migration manually in Supabase SQL Editor:",
          "1. Go to https://supabase.com/dashboard",
          "2. Navigate to SQL Editor",
          "3. Run the SQL from: supabase/migrations/20260117000000_fix_broker_users_rls.sql",
        ],
      },
      { status: 500 }
    );
  }
}
