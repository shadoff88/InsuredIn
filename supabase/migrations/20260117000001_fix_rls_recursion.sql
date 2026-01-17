-- Fix infinite recursion in broker_users RLS policies
--
-- Issue: The broker_users_read_own_staff policy causes infinite recursion because it calls
-- get_broker_id_for_user() which queries broker_users, creating a circular dependency.
-- Even with SECURITY DEFINER, PostgreSQL detects the recursive policy evaluation.
--
-- Solution: Drop the problematic policy and ensure we have the correct policy in place.

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "broker_users_read_own_staff" ON broker_users;

-- Also drop the new policy in case it exists (we'll recreate it)
DROP POLICY IF EXISTS "broker_users_read_own_record" ON broker_users;

-- Create the policy that allows users to read their own record by user_id
-- This breaks the circular dependency
CREATE POLICY "broker_users_read_own_record" ON broker_users
  FOR SELECT
  USING (user_id = auth.uid());
