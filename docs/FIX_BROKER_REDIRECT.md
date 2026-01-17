# Fix for Broker Dashboard Redirect Issue

## Problem

Freshly registered brokers get stuck on the login page (`/broker/login`) after successful registration and authentication. The Supabase auth cookies are set correctly, but the dashboard redirects back to login.

## Root Cause

**Circular Dependency in RLS Policy**

The `broker_users` table has a Row Level Security (RLS) policy with a circular dependency:

1. The policy `"broker_users_read_own_staff"` checks: `broker_id = get_broker_id_for_user()`
2. The function `get_broker_id_for_user()` queries: `SELECT broker_id FROM broker_users WHERE user_id = auth.uid()`
3. To query `broker_users`, the RLS policy must pass
4. But the policy needs `get_broker_id_for_user()` to run
5. Which needs to query `broker_users` → **circular dependency!**

This means when `getBrokerUser()` in `src/lib/services/auth.ts` tries to query the broker_users table, it returns `null` because RLS blocks the query. The dashboard then redirects to login because there's no brokerUser.

## Solution

Add a new RLS policy that allows users to directly read their own `broker_users` record by `user_id`, breaking the circular dependency:

```sql
CREATE POLICY "broker_users_read_own_record" ON broker_users
  FOR SELECT
  USING (user_id = auth.uid());
```

This allows the initial lookup to succeed. The existing `"broker_users_read_own_staff"` policy remains for viewing other broker staff members.

## How to Apply the Fix

### Option 1: Via Supabase SQL Editor (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Paste the following SQL:

```sql
-- Fix circular dependency in broker_users RLS policy
CREATE POLICY IF NOT EXISTS "broker_users_read_own_record" ON broker_users
  FOR SELECT
  USING (user_id = auth.uid());
```

6. Click **Run** to execute
7. Verify success - you should see "Success. No rows returned"

### Option 2: Via Supabase CLI

If you have Supabase CLI installed and configured:

```bash
supabase db push
```

This will apply the migration file: `supabase/migrations/20260117000000_fix_broker_users_rls.sql`

### Option 3: Via API Route (Temporary)

The code includes a temporary API route that provides instructions. Visit:

```
https://insuredin.vercel.app/api/admin/apply-migration
```

This will display the SQL and instructions. **Note:** This route doesn't automatically apply the migration for security reasons.

## Testing the Fix

After applying the migration:

1. Clear your browser cookies for insuredin.vercel.app
2. Navigate to `https://insuredin.vercel.app/broker/login`
3. Log in with the broker credentials:
   - Email: (the email from broker_users table)
   - Password: (the password used during registration)
4. You should be redirected to `/broker/dashboard` and stay there
5. Refresh the page - you should remain on the dashboard

## Verification

To verify the broker user can now be queried, you can check the Supabase logs or run this query in the SQL Editor (as the authenticated user):

```sql
SELECT * FROM broker_users WHERE user_id = auth.uid();
```

This should now return the broker_users record for the logged-in user.

## Cleanup

After successfully applying the migration and verifying the fix works:

1. Delete the temporary API route: `src/app/api/admin/apply-migration/route.ts`
2. Delete this document: `FIX_BROKER_REDIRECT.md`
3. Optionally delete: `scripts/apply-migrations.ts` (or keep for future migrations)

## Files Modified

- `supabase/migrations/20260117000000_fix_broker_users_rls.sql` - The migration file
- `scripts/apply-migrations.ts` - Helper script for applying migrations
- `src/app/api/admin/apply-migration/route.ts` - Temporary API route (delete after use)
