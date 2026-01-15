-- InsuredIn Seed Data
-- Version: 1.1
-- Description: Sample data for development and testing
-- Note: All UUIDs use valid hexadecimal characters only (0-9, a-f)

-- ==================================================
-- BROKERS
-- ==================================================

INSERT INTO brokers (id, company_name, email) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Auckland Brokerage Ltd', 'admin@aucklandbrokerage.co.nz'),
  ('a2000000-0000-0000-0000-000000000002', 'Wellington Insurance Services', 'info@wellingtoninsurance.co.nz');

-- ==================================================
-- BROKER BRANDING
-- ==================================================

INSERT INTO broker_branding (broker_id, logo_url, primary_color, secondary_color, subdomain, support_email, support_phone) VALUES
  ('a1000000-0000-0000-0000-000000000001', NULL, '#2563EB', '#1E40AF', 'auckland', 'support@aucklandbrokerage.co.nz', '+64 9 123 4567'),
  ('a2000000-0000-0000-0000-000000000002', NULL, '#059669', '#047857', 'wellington', 'help@wellingtoninsurance.co.nz', '+64 4 987 6543');

-- ==================================================
-- CLIENTS (Auckland Brokerage)
-- ==================================================

INSERT INTO clients (id, broker_id, client_number, full_name, email, phone, address, synced_from) VALUES
  ('b1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'AKL-12345', 'John Smith', 'john.smith@example.com', '+64 21 111 2222', '16 Deerness Crescent, Algies Bay, Auckland', 'manual'),
  ('b1100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'AKL-12346', 'Sarah Johnson', 'sarah.johnson@example.com', '+64 21 333 4444', '45 Queen Street, Auckland CBD', 'manual'),
  ('b1100000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'AKL-12347', 'Michael Brown', 'michael.brown@example.com', '+64 21 555 6666', '78 Parnell Road, Parnell, Auckland', 'manual'),
  ('b1100000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'AKL-12348', 'Emma Wilson', 'emma.wilson@example.com', '+64 21 777 8888', '123 Ponsonby Road, Ponsonby, Auckland', 'manual'),
  ('b1100000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'AKL-12349', 'James Taylor', 'james.taylor@example.com', '+64 21 999 0000', '56 Shortland Street, Auckland CBD', 'manual');

-- ==================================================
-- CLIENTS (Wellington Insurance)
-- ==================================================

INSERT INTO clients (id, broker_id, client_number, full_name, email, phone, address, synced_from) VALUES
  ('b2100000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'WLG-20001', 'Olivia Davis', 'olivia.davis@example.com', '+64 22 111 2222', '10 Lambton Quay, Wellington CBD', 'manual'),
  ('b2100000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'WLG-20002', 'William Anderson', 'william.anderson@example.com', '+64 22 333 4444', '25 Cuba Street, Te Aro, Wellington', 'manual'),
  ('b2100000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000002', 'WLG-20003', 'Charlotte Thomas', 'charlotte.thomas@example.com', '+64 22 555 6666', '88 Willis Street, Wellington', 'manual'),
  ('b2100000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'WLG-20004', 'Benjamin Martin', 'benjamin.martin@example.com', '+64 22 777 8888', '15 Courtenay Place, Wellington', 'manual'),
  ('b2100000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000002', 'WLG-20005', 'Mia Thompson', 'mia.thompson@example.com', '+64 22 999 0000', '42 Victoria Street, Wellington', 'manual');

-- ==================================================
-- PACKAGES & POLICIES (Auckland Brokerage - John Smith)
-- ==================================================

INSERT INTO packages (id, broker_id, client_id, package_name) VALUES
  ('c1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000001', 'Home & Contents Package');

INSERT INTO policies (id, broker_id, package_id, policy_number, insurer, policy_type, period_start, period_end, sum_insured, premium_annual, status) VALUES
  ('d0010001-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000001', 'DPK-5719028', 'Vero Insurance', 'home', '2025-09-01', '2026-09-01', 2582674.00, 4850.00, 'active');

INSERT INTO risk_items (id, policy_id, item_type, item_description, address, occupancy, sum_insured, excess_standard, excess_natural_disaster) VALUES
  ('e0100001-0000-0000-0000-000000000001', 'd0010001-0000-0000-0000-000000000001', 'property', 'Primary Residence', '16 Deerness Crescent, Algies Bay, Auckland', 'owner_occupied', 1031000.00, 400.00, 5000.00),
  ('e0100001-0000-0000-0000-000000000002', 'd0010001-0000-0000-0000-000000000001', 'property', 'Investment Property', '4 Northumberland Ave, North Shore, Auckland', 'rental', 1551674.00, 500.00, 5000.00);

INSERT INTO premium_breakdowns (id, policy_id, base_premium, natural_hazard_loading, natural_hazard_zone, claims_adjustment, voluntary_excess_discount, fire_service_levy, previous_year_total) VALUES
  ('f0100001-0000-0000-0000-000000000001', 'd0010001-0000-0000-0000-000000000001', 3600.00, 800.00, 'Zone 3', 0.00, -200.00, 20.00, 4510.00);

-- ==================================================
-- PACKAGES & POLICIES (Auckland Brokerage - Sarah Johnson)
-- ==================================================

INSERT INTO packages (id, broker_id, client_id, package_name) VALUES
  ('c1100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000002', 'Motor Insurance Package');

INSERT INTO policies (id, broker_id, package_id, policy_number, insurer, policy_type, period_start, period_end, sum_insured, premium_annual, status) VALUES
  ('d0010002-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002', 'MOT-2025-8876', 'AA Insurance', 'motor', '2025-06-15', '2026-06-15', 45000.00, 1250.00, 'active');

INSERT INTO risk_items (id, policy_id, item_type, item_description, make_model, registration, year, sum_insured, excess_standard) VALUES
  ('e0100002-0000-0000-0000-000000000001', 'd0010002-0000-0000-0000-000000000001', 'vehicle', '2022 Toyota RAV4', 'Toyota RAV4 GXL Hybrid', 'ABC123', 2022, 45000.00, 500.00);

-- ==================================================
-- EMAIL INBOXES
-- ==================================================

INSERT INTO email_inboxes (id, broker_id, email_address, status) VALUES
  ('e1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'documents@auckland.insuredin.app', 'active'),
  ('e1200000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'documents@wellington.insuredin.app', 'active');

-- ==================================================
-- SAMPLE EMAIL PROCESSING TRANSACTIONS
-- ==================================================

INSERT INTO email_processing_transactions (id, broker_id, inbox_id, from_email, to_email, subject, status, extracted_client_number, extracted_policy_number, extracted_document_type, ai_confidence, ai_overall_confidence, suggested_client_id, suggested_policy_id, match_confidence) VALUES
  ('f1100001-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000001', 'underwriting@vero.co.nz', 'documents@auckland.insuredin.app', 'Policy Schedule - DPK-5719028', 'awaiting_review', 'AKL-12345', 'DPK-5719028', 'policy_schedule', '{"client_number": 0.95, "policy_number": 0.98, "document_type": 0.99}', 0.97, 'b1100000-0000-0000-0000-000000000001', 'd0010001-0000-0000-0000-000000000001', 0.96),
  ('f1100002-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000001', 'renewals@aainsurance.co.nz', 'documents@auckland.insuredin.app', 'Renewal Notice - MOT-2025-8876', 'pending', NULL, 'MOT-2025-8876', 'renewal_notice', '{"client_number": 0, "policy_number": 0.92, "document_type": 0.95}', 0.62, NULL, 'd0010002-0000-0000-0000-000000000001', 0.85);

-- ==================================================
-- SAMPLE INVOICES
-- ==================================================

INSERT INTO invoices (id, broker_id, client_id, policy_id, invoice_number, issue_date, due_date, amount_total, amount_paid, status) VALUES
  ('a0010001-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000001', 'd0010001-0000-0000-0000-000000000001', 'INV-2026-0042', '2026-01-01', '2026-01-28', 4850.00, 0.00, 'unpaid'),
  ('a0010002-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000002', 'd0010002-0000-0000-0000-000000000001', 'INV-2026-0038', '2026-01-05', '2026-02-05', 1250.00, 0.00, 'unpaid');

-- ==================================================
-- SAMPLE CLAIMS
-- ==================================================

INSERT INTO claims (id, broker_id, client_id, policy_id, claim_number, incident_type, incident_date, incident_description, status) VALUES
  ('aa010001-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000002', 'd0010002-0000-0000-0000-000000000001', 'CLM-2026-00123', 'vehicle_damage', '2026-01-10', 'Rear-ended at traffic light on Queen Street. Minor damage to rear bumper.', 'submitted');

INSERT INTO claim_timeline_events (id, claim_id, event_type, event_description, status_changed_to) VALUES
  ('ab010001-0000-0000-0000-000000000001', 'aa010001-0000-0000-0000-000000000001', 'submitted', 'Claim lodged via client portal', 'submitted');
