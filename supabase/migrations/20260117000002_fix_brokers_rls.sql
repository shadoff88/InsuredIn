-- Fix brokers table RLS policy to prevent circular dependency
--
-- Issue: The broker_users_read_own_broker policy uses get_broker_id_for_user()
-- which queries broker_users, creating a circular dependency when we try to
-- join broker_users with brokers.
--
-- Solution: Rewrite the policy without using the helper function.

-- Drop the problematic policy
DROP POLICY IF EXISTS "broker_users_read_own_broker" ON brokers;

-- Create a new policy that allows users to read their broker
-- without causing circular dependency
CREATE POLICY "broker_users_read_own_broker" ON brokers
  FOR SELECT
  USING (
    id IN (
      SELECT broker_id
      FROM broker_users
      WHERE user_id = auth.uid()
    )
  );
