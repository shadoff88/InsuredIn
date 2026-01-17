-- Fix infinite recursion in broker_users RLS policies
--
-- Issue: The broker_users_read_own_staff policy causes infinite recursion because it calls
-- get_broker_id_for_user() which queries broker_users, creating a circular dependency.
-- Even with SECURITY DEFINER, PostgreSQL detects the recursive policy evaluation.
--
-- Solution: Drop the problematic policy and rely only on the direct user_id check.
-- The broker_users_read_own_record policy (created in previous migration) is sufficient
-- for authentication and viewing one's own record.
--
-- Note: This means broker admins won't be able to view other staff members for now.
-- We can add that functionality later using a different approach (e.g., admin API routes).

DROP POLICY IF EXISTS "broker_users_read_own_staff" ON broker_users;
