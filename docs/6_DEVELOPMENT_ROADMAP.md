# 6. Development Roadmap (12 Weeks to MVP)

## Overview

12-week sprint plan to deliver MVP with core features:
- Email BCC document processing (AI-powered)
- Broker review interface (mobile-first)
- Client portal (policies, documents, claims)
- NZ compliance features
- White-label branding

---

## Week 1-2: Foundation

**Sprint Goal:** Project setup, database deployed, basic auth working

### Tasks:
- [ ] Next.js 14 project initialization
  - TypeScript configuration (strict mode)
  - Tailwind CSS + shadcn/ui setup
  - Folder structure (`src/app`, `src/components`, `src/lib`)

- [ ] Supabase project creation
  - PostgreSQL database
  - Authentication enabled
  - Storage bucket created

- [ ] Cloudflare setup
  - R2 bucket for documents
  - Email Routing configured (test inbox)

- [ ] Database schema deployment
  - Run all migrations from `2_DATABASE_SCHEMA.md`
  - Test RLS policies (no data leaks)
  - Seed sample data

- [ ] Basic authentication
  - Broker login/register (email + password)
  - Client invite system
  - Client registration via invite code
  - Client federated auth (Google, Apple, Facebook)

- [ ] GitHub setup
  - Repository created
  - Branch protection (require PR review)
  - GitHub Actions CI/CD (lint, test, deploy)

### Deliverable:
✅ Auth working (broker + client can register/login)
✅ Empty dashboards (just layout)
✅ CI/CD auto-deploys to staging

**Definition of Done:**
- Broker can create account, login, see empty dashboard
- Client can register via invite link, login, see empty dashboard
- All tests pass in CI
- Staging environment live

---

## Week 3-4: Email BCC Processing (HERO FEATURE)

**Sprint Goal:** Broker BCCs email → AI extracts → Broker reviews → Document published

### Tasks:
- [ ] Cloudflare Email Worker
  - Receive emails at documents@portal.brokername.com
  - Save attachments to R2
  - Create email_processing_transaction record
  - Queue background job

- [ ] Claude API integration
  - Extract: client_number, policy_number, document_type
  - Confidence scoring per field
  - Return JSON with suggestions

- [ ] Matching logic
  - Priority 1: client_number + policy_number (98% confidence)
  - Priority 2: policy_number only (85%)
  - Priority 3: client_number only (80%)
  - Save suggested_client_id, suggested_policy_id

- [ ] Broker review UI (mobile-first)
  - Email inbox list (/broker/email-inbox)
  - Review screen with split view: PDF | AI suggestions
  - Approve/reject buttons
  - Client view preview

- [ ] Learning feedback tracking
  - Save: ai_suggestion_correct (boolean)
  - Save: broker_correction_reason (text)
  - Dashboard: AI accuracy over time

- [ ] Email notifications
  - Broker: "Review required" email
  - Client: "New document available" email

### Deliverable:
✅ Complete BCC workflow functional
✅ Broker can review on phone in <30 seconds
✅ Client sees document after approval

**Success Metrics:**
- AI extraction completes in <30 seconds
- Broker review UI loads in <1 second on mobile
- 90%+ AI confidence on test PDFs

---

## Week 5-6: Client Portal Core

**Sprint Goal:** Client can view all policies + documents

### Tasks:
- [ ] Client dashboard
  - Summary cards (policies, unpaid invoices, recent docs)
  - Quick actions (request change, lodge claim)
  - Mobile-first layout, bottom tab navigation

- [ ] Policy list view
  - Cards with insurer, policy type, status
  - Filters (active, expired)
  - Search by policy number

- [ ] Policy detail view
  - Overview (insurer, period, premium, sum insured)
  - Risk items accordion (properties, vehicles)
  - Premium breakdown (NZ-specific)
  - Natural Hazards panel (NZ-specific)
  - Documents list

- [ ] Document library
  - Grouped by policy
  - Filter by document type
  - PDF viewer (in-app, mobile-optimized)
  - Download button

- [ ] Unpaid invoices widget
  - Total outstanding
  - Invoice list (amount, due date, days remaining)
  - Link to invoice PDF

### Deliverable:
✅ Client can view all policies
✅ Client can download documents
✅ Client can see unpaid invoices

**Success Metrics:**
- All screens load in <2s on mobile LTE
- 100% keyboard navigable
- Works on iPhone Safari, Android Chrome

---

## Week 7-8: NZ Compliance + Email Automation

**Sprint Goal:** CoFI + Privacy Act compliant, auto-reminders working

### Tasks:
- [ ] IFSO complaints pathway page (/help/complaints)
  - 3-step escalation (Broker → Insurer → IFSO)
  - Contact details for each step

- [ ] Download My Data feature (/profile/download-data)
  - Export all client data (JSON/CSV/PDF)
  - Email download link

- [ ] Audit logging
  - Log all writes to audit_logs table
  - Track: who, what, when, old/new values

- [ ] Email reminder configuration (broker settings)
  - Invoice due (7 days before)
  - Invoice overdue (3 days after, repeat every 7 days)
  - Policy expiring (30 days before)

- [ ] Scheduled jobs
  - Daily at 6 AM: Send auto-reminders
  - Check invoices due in 7 days → Send emails
  - Check invoices overdue → Send reminders

- [ ] WCAG 2.1 AA audit (first pass)
  - Run axe DevTools on all pages
  - Fix critical issues (contrast, ARIA labels)
  - Test with keyboard navigation

### Deliverable:
✅ CoFI compliant (IFSO pathway)
✅ Privacy Act compliant (Download My Data)
✅ Auto-reminders sending

**Success Metrics:**
- 0 critical WCAG violations
- Auto-reminders send on schedule
- Audit log captures all writes

---

## Week 9-10: Claims + Service Requests

**Sprint Goal:** Client can lodge claim with photos, submit service requests

### Tasks:
- [ ] Claims lodgement form (multi-step, mobile-first)
  - Step 1: Select policy
  - Step 2: Incident details (type, date, description)
  - Step 3: Upload photos (up to 10, R2)
  - Submit → Email broker

- [ ] Claims tracking
  - My Claims page (client view)
  - Claim detail with timeline
  - Status: submitted, in_progress, completed

- [ ] Claims email notifications
  - Broker receives: "Claim lodged" email
  - Broker replies with BCC: claims@portal.brokername.com
  - Subject: "Status: In Progress" → System parses, updates claim
  - Client receives: "Claim status updated" email

- [ ] JotForm service requests (client-facing)
  - Broker configures form IDs in settings
  - Client clicks "Request Endorsement"
  - Selects policy
  - Sees embedded JotForm
  - Submits → Webhook creates service_request record

- [ ] Service requests email notifications
  - Broker receives: "Service request" email
  - Broker replies with BCC: requests@portal.brokername.com
  - Subject: "Status: Completed" → System updates request

- [ ] My Requests page (client view)
  - List all service requests
  - Status tracking
  - View submission details

### Deliverable:
✅ Client can lodge claim with photos
✅ Client can submit service request (JotForm)
✅ Broker updates via email BCC reply

**Success Metrics:**
- Photo upload works on mobile (10 photos, 5MB each)
- Email BCC reply-to-update works 100%
- JotForm webhook triggers service_request creation

---

## Week 11: Manual Upload + Forms Config + Analytics

**Sprint Goal:** Broker tools complete, usage analytics visible

### Tasks:
- [ ] Broker manual upload
  - Drag-drop PDF interface
  - Select client + policy (or run AI extraction)
  - Client view preview
  - Approve & publish

- [ ] Forms configuration (/broker/settings/forms)
  - Select provider: JotForm, FormsByAir
  - Configure form IDs per request type
  - Test form webhook
  - View submissions

- [ ] Usage analytics tracking
  - Middleware captures: login, view_policy, download_document, submit_claim, submit_request
  - Save to client_usage_analytics table
  - Update policy_usage_summary (aggregated)

- [ ] Broker analytics dashboard
  - Widget: Pending reviews (badge count)
  - Widget: This week's stats (docs processed, reviews, client logins)
  - Policy usage tab (views, downloads, claims per policy)

- [ ] White-label configuration
  - Upload logo (PNG/SVG)
  - Set primary/secondary colors (color picker)
  - Configure support email/phone
  - Preview client portal

- [ ] Mobile responsiveness final audit
  - Test all screens on real iPhone, Android
  - Fix any layout issues
  - Ensure 48x48px touch targets

### Deliverable:
✅ Broker can upload manually
✅ Forms config working (JotForm + FormsByAir)
✅ Analytics visible in dashboard

**Success Metrics:**
- Manual upload <5 clicks
- Forms switch between providers seamlessly
- Analytics accurate (match actual events)

---

## Week 12: Testing + Launch Prep

**Sprint Goal:** Production-ready, pilot brokers onboarded

### Tasks:
- [ ] WCAG 2.1 AA audit (comprehensive)
  - Run axe on all pages (100% pass)
  - Manual keyboard testing (Tab through all screens)
  - Screen reader testing (NVDA, JAWS, VoiceOver)
  - Fix all issues

- [ ] Security testing
  - OWASP ZAP scan (no critical vulns)
  - SQL injection testing (all endpoints)
  - RLS bypass testing (automated tests in CI)
  - XSS testing

- [ ] Load testing
  - Artillery or k6
  - 100 concurrent users
  - Simulate: 50 logins, 100 API calls, 20 file uploads
  - Target: <500ms API response (p95)

- [ ] E2E test suite
  - Broker: BCC email → Review → Approve → Client sees doc
  - Client: Register → View policy → Download doc → Lodge claim
  - Broker: Manual upload → Client receives notification
  - Auto-reminder: Invoice due → Email sent

- [ ] Bug fixes (all P0/P1 issues)
  - Triage all open bugs
  - Fix critical (P0) and high (P1)
  - Defer medium/low to Phase 2

- [ ] Documentation
  - User guides with screenshots (broker + client)
  - FAQ page
  - Video walkthrough (2 min)

- [ ] Pilot broker onboarding
  - 2 brokers (1 Folio, 1 Steadfast Insight)
  - 10-20 clients per broker
  - 1 week of usage
  - Collect feedback

- [ ] Production deployment
  - Deploy to prod (manual approval in Vercel)
  - Smoke test (critical flows working)
  - Monitor logs (Sentry)

### Deliverable:
✅ MVP live in production
✅ 2 pilot brokers using system
✅ Zero critical bugs

**Launch Checklist:**
- [ ] All tests passing (unit, integration, E2E)
- [ ] WCAG 2.1 AA compliance (100%)
- [ ] Security scan clean
- [ ] Load test passed (100 concurrent users)
- [ ] Pilot brokers trained
- [ ] Monitoring enabled (Sentry, Vercel Analytics)
- [ ] Backup enabled (Supabase daily backups)
- [ ] Support email configured
- [ ] Documentation published

---

## Post-MVP (Phase 2)

**Months 4-6: CRM Integration**
- Folio API integration (bidirectional sync)
- Steadfast Insight API integration
- SSO (Azure AD, Okta)
- Advanced analytics

**Months 7-9: Advanced Features**
- In-app messaging
- Push notifications (PWA)
- Certificate auto-generation
- FormsByAir full support
- Multi-language (Māori)

**Months 10-12: Scale & Optimize**
- Performance optimization
- Mobile apps (React Native)
- Advanced claims tracking
- Steadfast acquisition prep

---

## Daily Development Flow

**9:00 AM NZT:** Overseer posts daily standup
**9:00-5:00 PM:** Agents work on assigned tasks
**5:00 PM:** Commit code, create PR, request review
**Next Day:** Address PR feedback, merge when approved

**Weekly:**
- Monday: Sprint planning (Overseer + all agents)
- Friday: Sprint review, demo to @human

**Monthly:**
- Retrospective (what went well, what to improve)
- Update roadmap based on learnings

---

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Ready for Week 1 kickoff
