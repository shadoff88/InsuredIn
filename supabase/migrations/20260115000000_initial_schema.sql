-- InsuredIn Database Schema
-- Version: 1.0
-- Description: Initial schema for the InsuredIn insurance broker client portal

-- ==================================================
-- CORE TABLES: Brokers & Authentication
-- ==================================================

-- Brokers (brokerage companies)
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broker branding (white-label config)
CREATE TABLE broker_branding (
  broker_id UUID PRIMARY KEY REFERENCES brokers(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  secondary_color TEXT DEFAULT '#1E40AF',
  subdomain TEXT UNIQUE,
  support_email TEXT,
  support_phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broker users (staff members)
CREATE TABLE broker_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  sso_provider TEXT,
  sso_external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, email)
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  synced_from TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, client_number),
  UNIQUE(broker_id, email)
);

CREATE INDEX idx_clients_client_number ON clients(client_number);
CREATE INDEX idx_clients_external ON clients(external_id, synced_from);

-- Client users (link Supabase auth to clients)
CREATE TABLE client_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  auth_provider TEXT,
  external_id TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client invites
CREATE TABLE client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================
-- POLICIES & COVERAGE
-- ==================================================

-- Packages (top-level grouping of policies for a client)
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL,
  insurer TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sum_insured DECIMAL(12,2),
  premium_annual DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  synced_from TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, policy_number)
);

CREATE INDEX idx_policies_period_end ON policies(period_end);
CREATE INDEX idx_policies_external ON policies(external_id, synced_from);

-- Risk items (properties, vehicles, etc.)
CREATE TABLE risk_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_description TEXT,
  address TEXT,
  occupancy TEXT,
  make_model TEXT,
  registration TEXT,
  year INTEGER,
  sum_insured DECIMAL(12,2),
  excess_standard DECIMAL(10,2),
  excess_natural_disaster DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Premium breakdowns (NZ-specific transparency)
CREATE TABLE premium_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  base_premium DECIMAL(10,2) NOT NULL,
  natural_hazard_loading DECIMAL(10,2) DEFAULT 0,
  natural_hazard_zone TEXT,
  claims_adjustment DECIMAL(10,2) DEFAULT 0,
  voluntary_excess_discount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (
    base_premium + natural_hazard_loading + claims_adjustment + voluntary_excess_discount
  ) STORED,
  gst DECIMAL(10,2) GENERATED ALWAYS AS (
    (base_premium + natural_hazard_loading + claims_adjustment + voluntary_excess_discount) * 0.15
  ) STORED,
  fire_service_levy DECIMAL(10,2) DEFAULT 20,
  total DECIMAL(10,2) GENERATED ALWAYS AS (
    (base_premium + natural_hazard_loading + claims_adjustment + voluntary_excess_discount) * 1.15 + 20
  ) STORED,
  previous_year_total DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================
-- EMAIL DOCUMENT PROCESSING
-- ==================================================

-- Email inboxes (broker's BCC address config)
CREATE TABLE email_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  email_address TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, email_address)
);

-- Email processing transactions (every BCC creates one)
CREATE TABLE email_processing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  inbox_id UUID NOT NULL REFERENCES email_inboxes(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  extracted_client_number TEXT,
  extracted_policy_number TEXT,
  extracted_document_type TEXT,
  ai_confidence JSONB,
  ai_overall_confidence DECIMAL(3,2),
  suggested_client_id UUID REFERENCES clients(id),
  suggested_policy_id UUID REFERENCES policies(id),
  match_confidence DECIMAL(3,2),
  reviewed_by_user_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  broker_approved BOOLEAN,
  final_client_id UUID REFERENCES clients(id),
  final_policy_id UUID REFERENCES policies(id),
  final_document_type TEXT,
  ai_suggestion_correct BOOLEAN,
  broker_correction_reason TEXT,
  created_document_ids UUID[],
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_transactions_broker ON email_processing_transactions(broker_id);
CREATE INDEX idx_email_transactions_status ON email_processing_transactions(status);
CREATE INDEX idx_email_transactions_received ON email_processing_transactions(received_at DESC);

-- Email attachments
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES email_processing_transactions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_transaction ON email_attachments(transaction_id);

-- ==================================================
-- DOCUMENTS
-- ==================================================

-- Documents (policy schedules, invoices, certificates, etc.)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  size_bytes BIGINT,
  uploaded_by_transaction_id UUID REFERENCES email_processing_transactions(id),
  uploaded_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_policy ON documents(policy_id);
CREATE INDEX idx_documents_type ON documents(document_type);

-- ==================================================
-- INVOICES
-- ==================================================

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id),
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_outstanding DECIMAL(10,2) GENERATED ALWAYS AS (amount_total - amount_paid) STORED,
  status TEXT DEFAULT 'unpaid',
  document_id UUID REFERENCES documents(id),
  synced_from TEXT,
  external_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, invoice_number)
);

CREATE INDEX idx_invoices_client_status ON invoices(client_id, status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('unpaid', 'partial');

-- ==================================================
-- CLAIMS
-- ==================================================

-- Claims
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  claim_number TEXT UNIQUE NOT NULL,
  incident_type TEXT NOT NULL,
  incident_date DATE NOT NULL,
  incident_description TEXT,
  status TEXT DEFAULT 'submitted',
  photo_urls TEXT[],
  synced_to TEXT,
  external_task_id TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_client ON claims(client_id);
CREATE INDEX idx_claims_status ON claims(status);

-- Claim timeline events
CREATE TABLE claim_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT,
  status_changed_to TEXT,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claim_timeline_claim ON claim_timeline_events(claim_id);

-- ==================================================
-- FORMS & SERVICE REQUESTS
-- ==================================================

-- Form provider configuration
CREATE TABLE form_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  api_key TEXT,
  api_secret TEXT,
  webhook_secret TEXT,
  config_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, provider)
);

-- Form mappings (which form for which request type)
CREATE TABLE form_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_form_id TEXT NOT NULL,
  field_mappings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, form_type)
);

-- Service requests (from JotForm/FormsByAir submissions)
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  policy_id UUID REFERENCES policies(id),
  request_type TEXT NOT NULL,
  request_status TEXT DEFAULT 'submitted',
  form_provider TEXT,
  form_submission_id TEXT,
  form_data JSONB,
  request_title TEXT,
  request_description TEXT,
  urgency TEXT,
  synced_to TEXT,
  external_task_id TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_requests_broker ON service_requests(broker_id);
CREATE INDEX idx_service_requests_status ON service_requests(request_status);

-- ==================================================
-- EMAIL NOTIFICATIONS & REMINDERS
-- ==================================================

-- Email reminder configuration
CREATE TABLE email_reminder_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  days_before INT,
  days_after INT,
  repeat_enabled BOOLEAN DEFAULT false,
  repeat_interval_days INT,
  email_subject TEXT,
  email_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, reminder_type)
);

-- Email send log (audit trail)
CREATE TABLE email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES brokers(id),
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT,
  email_type TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent',
  error_message TEXT
);

CREATE INDEX idx_email_log_to ON email_send_log(to_email, sent_at DESC);

-- ==================================================
-- USAGE ANALYTICS
-- ==================================================

-- Client usage analytics (event tracking)
CREATE TABLE client_usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_id UUID,
  event_type TEXT NOT NULL,
  policy_id UUID REFERENCES policies(id),
  document_id UUID REFERENCES documents(id),
  claim_id UUID REFERENCES claims(id),
  request_id UUID REFERENCES service_requests(id),
  user_agent TEXT,
  ip_address INET,
  page_url TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_analytics_client ON client_usage_analytics(client_id, occurred_at DESC);
CREATE INDEX idx_usage_analytics_event ON client_usage_analytics(event_type);

-- Policy usage summary (aggregated)
CREATE TABLE policy_usage_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  total_document_downloads INTEGER DEFAULT 0,
  total_claims INTEGER DEFAULT 0,
  total_service_requests INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  last_claim_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(policy_id)
);

-- ==================================================
-- COMPLIANCE
-- ==================================================

-- Complaints (CoFI compliance)
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  complaint_type TEXT,
  complaint_description TEXT,
  status TEXT DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Audit logs (all write operations)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES brokers(id),
  user_id UUID REFERENCES auth.users(id),
  user_type TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
