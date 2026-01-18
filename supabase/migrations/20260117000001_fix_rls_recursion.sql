-- Fix infinite recursion in broker_users RLS policies
--
-- Issue: Multiple policies cause infinite recursion because they call
-- get_broker_id_for_user() which queries broker_users, creating a circular dependency.
-- Even with SECURITY DEFINER, PostgreSQL detects the recursive policy evaluation.
--
-- Policies causing recursion:
-- 1. broker_users_read_own_staff - uses get_broker_id_for_user()
-- 2. broker_admins_manage_staff - uses get_broker_id_for_user() AND EXISTS subquery on broker_users
--
-- Solution: Drop ALL problematic policies and create a simple policy based on user_id.

-- Drop ALL policies that cause infinite recursion
DROP POLICY IF EXISTS "broker_users_read_own_staff" ON broker_users;
DROP POLICY IF EXISTS "broker_admins_manage_staff" ON broker_users;

-- Also drop the new policy in case it exists (we'll recreate it)
DROP POLICY IF EXISTS "broker_users_read_own_record" ON broker_users;

-- Create the policy that allows users to read their own record by user_id
-- This breaks the circular dependency and allows authentication to work
CREATE POLICY "broker_users_read_own_record" ON broker_users
  FOR SELECT
  USING (user_id = auth.uid());
