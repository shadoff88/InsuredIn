-- InsuredIn RLS Policies
-- Version: 1.0
-- Description: Row-Level Security policies for broker and client data isolation

-- ==================================================
-- ENABLE RLS ON ALL TABLES
-- ==================================================

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reminder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- HELPER FUNCTIONS
-- ==================================================

-- Get broker_id for current authenticated broker user
CREATE OR REPLACE FUNCTION get_broker_id_for_user()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT broker_id FROM broker_users WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get client_id for current authenticated client user
CREATE OR REPLACE FUNCTION get_client_id_for_user()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT client_id FROM client_users WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get broker_id for current authenticated client (via their client record)
CREATE OR REPLACE FUNCTION get_broker_id_for_client_user()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT c.broker_id
    FROM clients c
    JOIN client_users cu ON cu.client_id = c.id
    WHERE cu.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a broker user
CREATE OR REPLACE FUNCTION is_broker_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM broker_users WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a client user
CREATE OR REPLACE FUNCTION is_client_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_users WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- BROKER POLICIES
-- ==================================================

-- Brokers: Broker users can read their own broker
CREATE POLICY "broker_users_read_own_broker" ON brokers
  FOR SELECT
  USING (id = get_broker_id_for_user());

-- Broker branding: Broker users can manage their own branding
CREATE POLICY "broker_users_manage_own_branding" ON broker_branding
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Broker users: Broker users can read their broker's staff
CREATE POLICY "broker_users_read_own_staff" ON broker_users
  FOR SELECT
  USING (broker_id = get_broker_id_for_user());

-- Broker users: Admins can manage staff
CREATE POLICY "broker_admins_manage_staff" ON broker_users
  FOR ALL
  USING (
    broker_id = get_broker_id_for_user()
    AND EXISTS (
      SELECT 1 FROM broker_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Clients: Broker users can manage their clients
CREATE POLICY "broker_users_manage_clients" ON clients
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Client invites: Broker users can manage invites
CREATE POLICY "broker_users_manage_invites" ON client_invites
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Packages: Broker users can manage packages
CREATE POLICY "broker_users_manage_packages" ON packages
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Policies: Broker users can manage policies
CREATE POLICY "broker_users_manage_policies" ON policies
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Risk items: Broker users can manage risk items
CREATE POLICY "broker_users_manage_risk_items" ON risk_items
  FOR ALL
  USING (
    policy_id IN (
      SELECT id FROM policies WHERE broker_id = get_broker_id_for_user()
    )
  );

-- Premium breakdowns: Broker users can manage
CREATE POLICY "broker_users_manage_premium_breakdowns" ON premium_breakdowns
  FOR ALL
  USING (
    policy_id IN (
      SELECT id FROM policies WHERE broker_id = get_broker_id_for_user()
    )
  );

-- Email inboxes: Broker users can manage
CREATE POLICY "broker_users_manage_email_inboxes" ON email_inboxes
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Email processing transactions: Broker users can manage
CREATE POLICY "broker_users_manage_email_transactions" ON email_processing_transactions
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Email attachments: Broker users can manage
CREATE POLICY "broker_users_manage_email_attachments" ON email_attachments
  FOR ALL
  USING (
    transaction_id IN (
      SELECT id FROM email_processing_transactions WHERE broker_id = get_broker_id_for_user()
    )
  );

-- Documents: Broker users can manage
CREATE POLICY "broker_users_manage_documents" ON documents
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Invoices: Broker users can manage
CREATE POLICY "broker_users_manage_invoices" ON invoices
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Claims: Broker users can manage
CREATE POLICY "broker_users_manage_claims" ON claims
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Claim timeline: Broker users can manage
CREATE POLICY "broker_users_manage_claim_timeline" ON claim_timeline_events
  FOR ALL
  USING (
    claim_id IN (
      SELECT id FROM claims WHERE broker_id = get_broker_id_for_user()
    )
  );

-- Form config: Broker users can manage
CREATE POLICY "broker_users_manage_form_config" ON form_provider_config
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Form mappings: Broker users can manage
CREATE POLICY "broker_users_manage_form_mappings" ON form_mappings
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Service requests: Broker users can manage
CREATE POLICY "broker_users_manage_service_requests" ON service_requests
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Email reminders: Broker users can manage
CREATE POLICY "broker_users_manage_email_reminders" ON email_reminder_config
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Email send log: Broker users can read
CREATE POLICY "broker_users_read_email_log" ON email_send_log
  FOR SELECT
  USING (broker_id = get_broker_id_for_user());

-- Usage analytics: Broker users can read
CREATE POLICY "broker_users_read_analytics" ON client_usage_analytics
  FOR SELECT
  USING (broker_id = get_broker_id_for_user());

-- Policy usage: Broker users can read
CREATE POLICY "broker_users_read_policy_usage" ON policy_usage_summary
  FOR SELECT
  USING (
    policy_id IN (
      SELECT id FROM policies WHERE broker_id = get_broker_id_for_user()
    )
  );

-- Complaints: Broker users can manage
CREATE POLICY "broker_users_manage_complaints" ON complaints
  FOR ALL
  USING (broker_id = get_broker_id_for_user());

-- Audit logs: Broker users can read their broker's logs
CREATE POLICY "broker_users_read_audit_logs" ON audit_logs
  FOR SELECT
  USING (broker_id = get_broker_id_for_user());

-- ==================================================
-- CLIENT POLICIES
-- ==================================================

-- Broker branding: Clients can read their broker's branding
CREATE POLICY "clients_read_broker_branding" ON broker_branding
  FOR SELECT
  USING (broker_id = get_broker_id_for_client_user());

-- Clients: Clients can read their own record
CREATE POLICY "clients_read_own_record" ON clients
  FOR SELECT
  USING (id = get_client_id_for_user());

-- Client users: Clients can read their own user record
CREATE POLICY "clients_read_own_user" ON client_users
  FOR SELECT
  USING (user_id = auth.uid());

-- Packages: Clients can read their own packages
CREATE POLICY "clients_read_own_packages" ON packages
  FOR SELECT
  USING (client_id = get_client_id_for_user());

-- Policies: Clients can read their own policies
CREATE POLICY "clients_read_own_policies" ON policies
  FOR SELECT
  USING (
    package_id IN (
      SELECT id FROM packages WHERE client_id = get_client_id_for_user()
    )
  );

-- Risk items: Clients can read their own risk items
CREATE POLICY "clients_read_own_risk_items" ON risk_items
  FOR SELECT
  USING (
    policy_id IN (
      SELECT p.id FROM policies p
      JOIN packages pkg ON p.package_id = pkg.id
      WHERE pkg.client_id = get_client_id_for_user()
    )
  );

-- Premium breakdowns: Clients can read their own
CREATE POLICY "clients_read_own_premium_breakdowns" ON premium_breakdowns
  FOR SELECT
  USING (
    policy_id IN (
      SELECT p.id FROM policies p
      JOIN packages pkg ON p.package_id = pkg.id
      WHERE pkg.client_id = get_client_id_for_user()
    )
  );

-- Documents: Clients can read their own documents
CREATE POLICY "clients_read_own_documents" ON documents
  FOR SELECT
  USING (
    policy_id IN (
      SELECT p.id FROM policies p
      JOIN packages pkg ON p.package_id = pkg.id
      WHERE pkg.client_id = get_client_id_for_user()
    )
  );

-- Invoices: Clients can read their own invoices
CREATE POLICY "clients_read_own_invoices" ON invoices
  FOR SELECT
  USING (client_id = get_client_id_for_user());

-- Claims: Clients can read and create their own claims
CREATE POLICY "clients_read_own_claims" ON claims
  FOR SELECT
  USING (client_id = get_client_id_for_user());

CREATE POLICY "clients_create_claims" ON claims
  FOR INSERT
  WITH CHECK (client_id = get_client_id_for_user());

-- Claim timeline: Clients can read their own
CREATE POLICY "clients_read_own_claim_timeline" ON claim_timeline_events
  FOR SELECT
  USING (
    claim_id IN (
      SELECT id FROM claims WHERE client_id = get_client_id_for_user()
    )
  );

-- Service requests: Clients can read and create
CREATE POLICY "clients_read_own_service_requests" ON service_requests
  FOR SELECT
  USING (client_id = get_client_id_for_user());

CREATE POLICY "clients_create_service_requests" ON service_requests
  FOR INSERT
  WITH CHECK (client_id = get_client_id_for_user());

-- Complaints: Clients can read and create
CREATE POLICY "clients_read_own_complaints" ON complaints
  FOR SELECT
  USING (client_id = get_client_id_for_user());

CREATE POLICY "clients_create_complaints" ON complaints
  FOR INSERT
  WITH CHECK (client_id = get_client_id_for_user());

-- ==================================================
-- PUBLIC POLICIES (for invite validation)
-- ==================================================

-- Client invites: Allow reading for invite validation (by invite code)
CREATE POLICY "public_validate_invite" ON client_invites
  FOR SELECT
  USING (
    accepted_at IS NULL
    AND expires_at > NOW()
  );

-- Allow inserting audit logs
CREATE POLICY "allow_insert_audit_logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);
