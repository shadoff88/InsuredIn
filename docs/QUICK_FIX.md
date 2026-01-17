# Quick Fix - Apply Migration Immediately

**UPDATED:** This fix now includes resolving the infinite recursion issue.

## Option 1: Supabase Dashboard (Easiest - 30 seconds)

1. Go to https://supabase.com/dashboard
2. Click your project
3. Click **SQL Editor** (left sidebar)
4. Click **New query**
5. Paste this SQL:
```sql
-- Drop ALL policies that cause infinite recursion
DROP POLICY IF EXISTS "broker_users_read_own_staff" ON broker_users;
DROP POLICY IF EXISTS "broker_admins_manage_staff" ON broker_users;
DROP POLICY IF EXISTS "broker_users_read_own_record" ON broker_users;

-- Create the policy that allows users to read their own record by user_id
-- This breaks the circular dependency and allows authentication to work
CREATE POLICY "broker_users_read_own_record" ON broker_users
  FOR SELECT
  USING (user_id = auth.uid());
```
6. Click **Run** ✅

**That's it!** Clear your browser cookies and try logging in again.

---

## Option 2: Via Command Line (If you have credentials)

Run this command with your Supabase credentials:

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
export NEXT_PUBLIC_SUPABASE_URL="https://qzogtivatsytnruhdccd.supabase.co"

npx tsx apply-migration-now.ts
```

Get your service role key from: Supabase Dashboard > Settings > API > `service_role` (secret)

---

## Option 3: Via curl (Direct HTTP request)

```bash
curl -X POST "https://qzogtivatsytnruhdccd.supabase.co/rest/v1/rpc/exec" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "sql": "CREATE POLICY IF NOT EXISTS \"broker_users_read_own_record\" ON broker_users FOR SELECT USING (user_id = auth.uid());"
  }'
```

---

## After Applying

1. **Clear cookies** for insuredin.vercel.app (in browser DevTools)
2. Go to https://insuredin.vercel.app/broker/login
3. Log in with your broker account
4. You should now **stay on the dashboard**! 🎉

---

## Why This Works

The issue was a circular dependency:
- Dashboard needs to query `broker_users` table
- RLS policy blocks it unless you already have a `broker_id`
- But to get `broker_id`, you need to query `broker_users` ⭕ (circular!)

The new policy allows direct lookup by `user_id`, breaking the circle.

---

**Need help?** The easiest option is #1 (Supabase Dashboard SQL Editor) - takes 30 seconds!
