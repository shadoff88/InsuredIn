/**
 * Migration Application Script
 *
 * This script applies pending SQL migrations to the Supabase database.
 * It requires SUPABASE_SERVICE_ROLE_KEY to be set in environment variables.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your-key npx tsx scripts/apply-migrations.ts <migration-file>
 *
 * Example:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/apply-migrations.ts supabase/migrations/20260117000000_fix_broker_users_rls.sql
 */

import { createAdminClient } from "../src/lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

async function applyMigration(migrationPath: string) {
  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`Reading migration file: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log("Connecting to Supabase...");
  const supabase = createAdminClient();

  console.log("Applying migration...");
  console.log("---");
  console.log(sql);
  console.log("---");

  // Execute the SQL using the admin client
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });

  if (error) {
    console.error("Error applying migration:", error);

    // Try alternative method using REST API directly
    console.log("\nTrying alternative method...");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY || "",
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
          },
          body: JSON.stringify({ sql_query: sql }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log("Migration applied successfully using alternative method!");
    } catch (altError) {
      console.error("Alternative method also failed:", altError);
      console.error("\n=== MANUAL APPLICATION REQUIRED ===");
      console.error("Please apply this migration manually in the Supabase SQL Editor:");
      console.error("\n1. Go to your Supabase Dashboard");
      console.error("2. Navigate to SQL Editor");
      console.error("3. Paste and run the SQL above");
      process.exit(1);
    }
  } else {
    console.log("Migration applied successfully!");
  }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error("Usage: npx tsx scripts/apply-migrations.ts <migration-file>");
  console.error("Example: npx tsx scripts/apply-migrations.ts supabase/migrations/20260117000000_fix_broker_users_rls.sql");
  process.exit(1);
}

applyMigration(migrationFile).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
