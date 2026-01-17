-- Fix circular dependency in broker_users RLS policy
-- Issue: Users cannot read their own broker_users record because the existing policy
-- depends on get_broker_id_for_user() which queries broker_users, creating a circular dependency

-- Add policy that allows users to read their own broker_users record by user_id
-- This breaks the circular dependency and allows the initial lookup to succeed
CREATE POLICY "broker_users_read_own_record" ON broker_users
  FOR SELECT
  USING (user_id = auth.uid());

-- The existing "broker_users_read_own_staff" policy (broker_id = get_broker_id_for_user())
-- will still work for reading other staff members in the same broker organization
