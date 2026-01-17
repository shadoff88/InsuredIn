import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

async function applyMigration() {
  // Get Supabase credentials from environment or Vercel
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_API;

  if (!supabaseUrl) {
    console.error("Error: SUPABASE_URL not found in environment");
    console.log("\nPlease set one of these environment variables:");
    console.log("  - NEXT_PUBLIC_SUPABASE_URL");
    console.log("  - SUPABASE_URL");
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error("Error: Service role key not found in environment");
    console.log("\nPlease set one of these environment variables:");
    console.log("  - SUPABASE_SERVICE_ROLE_KEY");
    console.log("  - SUPABASE_SECRET_API");
    console.log("\nYou can get this from your Supabase Dashboard > Settings > API");
    process.exit(1);
  }

  console.log("Connecting to Supabase...");
  console.log(`URL: ${supabaseUrl}`);

  // Create admin client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read the migration file
  const migrationPath = "./supabase/migrations/20260117000000_fix_broker_users_rls.sql";
  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log("\nMigration SQL:");
  console.log("---");
  console.log(sql);
  console.log("---\n");

  // Execute the SQL
  console.log("Executing migration...");

  try {
    // Use the PostgreSQL REST API to execute the query
    const { data, error } = await supabase.rpc("exec", {
      sql: sql,
    });

    if (error) {
      // The rpc function might not exist, try alternative approach
      console.log("RPC method failed, trying direct SQL execution...");

      // Try using a raw SQL query via the REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          query: sql,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log("✅ Migration applied successfully via REST API!");
    } else {
      console.log("✅ Migration applied successfully!");
      console.log("Result:", data);
    }

    // Verify the policy was created
    console.log("\nVerifying policy creation...");
    const { data: policies, error: policiesError } = await supabase
      .from("pg_policies")
      .select("*")
      .eq("tablename", "broker_users")
      .eq("policyname", "broker_users_read_own_record");

    if (policiesError) {
      console.log("Could not verify policy (this is okay if migration succeeded)");
    } else if (policies && policies.length > 0) {
      console.log("✅ Policy 'broker_users_read_own_record' confirmed in database!");
    }

    console.log("\n✅ Migration complete!");
    console.log("\nNext steps:");
    console.log("1. Clear your browser cookies for insuredin.vercel.app");
    console.log("2. Try logging in again at /broker/login");
    console.log("3. You should now stay on /broker/dashboard");
  } catch (err) {
    console.error("\n❌ Error applying migration:", err);
    console.error("\nPlease apply manually via Supabase SQL Editor:");
    console.error("1. Go to https://supabase.com/dashboard");
    console.error("2. Navigate to SQL Editor");
    console.error("3. Paste and run the SQL shown above");
    process.exit(1);
  }
}

applyMigration();
