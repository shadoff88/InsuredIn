# Email Worker Implementation Checklist

## Overview

Complete checklist for implementing TASK-000B (Email Worker) with webhook security.

**Sprint:** Week 5-6 (Client Portal Core)
**Priority:** P0 (BLOCKER)
**Status:** ✅ Complete
**Date:** 2026-01-18

---

## Phase 1: Infrastructure Setup

### Cloudflare Configuration

- [x] **Domain Configuration**
  - [x] Add insuredin.app to Cloudflare
  - [x] Configure DNS records
  - [x] Enable Email Routing
  - [x] Verify MX records propagated

- [x] **Email Worker Setup**
  - [x] Create Cloudflare Worker for email processing
  - [x] Configure email routing to trigger Worker
  - [x] Set up Worker environment variables (`WEBHOOK_SECRET`, `WEBHOOK_URL`)
  - [x] Deploy Worker to production
  - [x] Test Worker receives emails

### Vercel Configuration

- [x] **Environment Variables**
  - [x] Add `WEBHOOK_SECRET` (matches Cloudflare Worker)
  - [x] Add `CLOUDFLARE_ACCOUNT_ID`
  - [x] Add `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - [x] Add `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - [x] Add `CLOUDFLARE_R2_BUCKET_NAME`
  - [x] Verify all variables in Production, Preview, Development

### Supabase Configuration

- [x] **Database Tables**
  - [x] `email_inboxes` table exists
  - [x] `email_processing_transactions` table exists
  - [x] `email_attachments` table exists
  - [x] Indexes created on broker_id, status, received_at
  - [x] RLS policies configured for broker isolation

- [x] **Database Schema Verification**
  ```sql
  -- Verify tables exist
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('email_inboxes', 'email_processing_transactions', 'email_attachments');

  -- Verify RLS enabled
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename LIKE 'email%';
  ```

---

## Phase 2: Code Implementation

### Backend Implementation

- [x] **Webhook Signature Verification**
  - [x] Create `src/lib/webhooks/verify-signature.ts`
    - [x] `verifyWebhookSignature()` function
    - [x] `generateHMAC()` helper
    - [x] `timingSafeEqual()` constant-time comparison
    - [x] Timestamp validation (5-minute window)
  - [x] Export utility functions

- [x] **Email Webhook Endpoint**
  - [x] Update `src/app/api/webhooks/email-inbound/route.ts`
    - [x] Add signature verification before processing
    - [x] Validate required headers (`X-Webhook-Signature`, `X-Webhook-Timestamp`)
    - [x] Extract broker UID from recipient email
    - [x] Lookup broker in database
    - [x] Parse email with `mailparser`
    - [x] Filter PDF attachments
    - [x] Upload to R2 storage
    - [x] Create transaction and attachment records
    - [x] Return 401 for invalid signatures
    - [x] Return 400 for missing headers
    - [x] Log verification failures

- [x] **Email Parser Updates**
  - [x] Update `src/lib/email/parse-email.ts`
    - [x] Add `extractBrokerUidFromEmail()` function
    - [x] Support format: `{broker_uid}@{subdomain}.insuredin.app`
    - [x] Return broker UID for database lookup

- [x] **Manual Upload Endpoint**
  - [x] `src/app/api/broker/email-inbox/manual-upload/route.ts`
    - [x] Accept multipart/form-data
    - [x] Upload files to R2
    - [x] Create transaction records
    - [x] No signature verification needed (authenticated user)

### Frontend Implementation

- [x] **Manual Upload UI**
  - [x] Create `src/components/broker/manual-upload-dialog.tsx`
    - [x] File upload input
    - [x] From email and subject fields
    - [x] Multi-file support
    - [x] Upload progress feedback
    - [x] Error handling

  - [x] Update `src/app/(broker)/broker/email-inbox/page.tsx`
    - [x] Add "Upload Document" button
    - [x] Integrate ManualUploadDialog
    - [x] Refresh transaction list after upload

### Type Definitions

- [x] **Storage Types**
  - [x] `src/lib/types/storage.ts`
    - [x] `UploadOptions` interface
    - [x] `UploadResult` interface
    - [x] `SignedUrlOptions` interface

---

## Phase 3: Testing

### Developer Testing (Unit/Integration)

- [x] **TypeScript Compilation**
  ```bash
  npm run type-check
  # Expected: No errors
  ```

- [x] **ESLint**
  ```bash
  npm run lint
  # Expected: No warnings or errors
  ```

- [x] **R2 Storage Tests**
  ```bash
  npm test -- r2-storage.test.ts
  # Expected: Skipped when no credentials (CI)
  # Expected: Pass when credentials available (local)
  ```

### QA Testing

- [ ] **Webhook Security Tests**
  - [ ] Test valid signature → 200 OK
  - [ ] Test invalid signature → 401 Unauthorized
  - [ ] Test missing signature header → 400 Bad Request
  - [ ] Test missing timestamp header → 400 Bad Request
  - [ ] Test replay attack (old timestamp) → 401 Unauthorized
  - [ ] Test future timestamp → 401 Unauthorized

- [ ] **Email Processing Tests**
  - [ ] Test email with PDF attachment → Creates transaction
  - [ ] Test email without PDF → Ignored gracefully
  - [ ] Test email with multiple PDFs → All uploaded
  - [ ] Test invalid broker UID → 404 Not Found
  - [ ] Test disabled broker → 403 Forbidden

- [ ] **Manual Upload Tests**
  - [ ] Test upload single PDF → Success
  - [ ] Test upload multiple PDFs → Success
  - [ ] Test upload without files → 400 Bad Request
  - [ ] Test upload with missing fields → 400 Bad Request
  - [ ] Test unauthorized user → 401 Unauthorized

### Integration Testing

- [ ] **End-to-End Email Flow**
  ```
  1. Send email to: broker-{uuid}@brokerage.insuredin.app
  2. Cloudflare receives email
  3. Worker generates signature
  4. Worker POSTs to webhook
  5. Webhook verifies signature
  6. Webhook parses email
  7. Webhook uploads PDF to R2
  8. Webhook creates transaction
  9. Transaction appears in broker inbox
  10. Broker can review and approve
  ```

- [ ] **Database Verification**
  ```sql
  -- Verify transaction created
  SELECT * FROM email_processing_transactions
  WHERE broker_id = '{broker-uuid}'
  ORDER BY received_at DESC LIMIT 1;

  -- Verify attachments uploaded
  SELECT * FROM email_attachments
  WHERE transaction_id = '{transaction-id}';

  -- Verify R2 storage URL
  -- Should be format: {broker_id}/attachments/{uuid}.pdf
  ```

---

## Phase 4: DevOps Checks

### Security Verification

- [ ] **Environment Variables**
  - [ ] `WEBHOOK_SECRET` set in Vercel (Production)
  - [ ] `WEBHOOK_SECRET` set in Vercel (Preview)
  - [ ] `WEBHOOK_SECRET` set in Cloudflare Worker
  - [ ] Secrets match between Vercel and Worker
  - [ ] Secrets are random (32+ characters)
  - [ ] Secrets not committed to git

- [ ] **HTTPS Configuration**
  - [ ] Webhook endpoint uses HTTPS
  - [ ] TLS certificate valid
  - [ ] Redirect HTTP to HTTPS

- [ ] **Access Control**
  - [ ] Webhook signature verification enabled
  - [ ] Manual upload requires authentication
  - [ ] RLS policies prevent cross-broker data access

### Performance Verification

- [ ] **Response Times**
  - [ ] Webhook processes email in < 5 seconds
  - [ ] R2 upload completes in < 3 seconds
  - [ ] Database writes complete in < 1 second
  - [ ] No timeout errors in Vercel logs

- [ ] **Resource Usage**
  - [ ] Webhook function stays under 1 GB memory
  - [ ] R2 bucket has sufficient storage
  - [ ] Database connections properly closed

### Monitoring Setup

- [ ] **Logging**
  - [ ] Webhook logs signature verification results
  - [ ] Failed verifications logged with IP
  - [ ] Email processing errors logged
  - [ ] R2 upload failures logged

- [ ] **Alerts** (Optional for MVP)
  - [ ] Alert on > 10 failed signature verifications in 5 minutes
  - [ ] Alert on webhook endpoint errors
  - [ ] Alert on R2 upload failures

---

## Phase 5: Documentation

### Code Documentation

- [x] **Inline Comments**
  - [x] Webhook signature verification logic
  - [x] HMAC generation algorithm
  - [x] Broker UID extraction logic
  - [x] Error handling rationale

- [x] **Documentation Files**
  - [x] `docs/sprint1/EMAIL_WEBHOOK_SECURITY.md`
  - [x] `docs/sprint1/IMPLEMENTATION_CHECKLIST.md` (this file)
  - [x] `docs/EMAIL_WORKER_SETUP.md` (updated with security)

### Operations Documentation

- [x] **Setup Guides**
  - [x] Cloudflare Email Routing setup
  - [x] Cloudflare Worker deployment
  - [x] Vercel environment variable configuration
  - [x] Testing procedures

- [ ] **Runbooks**
  - [ ] Incident response for failed signature verification
  - [ ] Secret rotation procedure
  - [ ] Webhook debugging guide

---

## Phase 6: Deployment

### Pre-Deployment Checklist

- [x] All tests passing locally
- [x] TypeScript compilation successful
- [x] ESLint checks passing
- [ ] QA testing completed
- [ ] Security review completed
- [x] Environment variables configured
- [x] Documentation updated

### Deployment Steps

1. [ ] **Merge to Main Branch**
   ```bash
   git checkout main
   git merge claude/setup-cloudflare-vercel-WVEbA
   ```

2. [ ] **Vercel Deployment**
   - [ ] Push to main branch triggers deployment
   - [ ] Verify deployment succeeds
   - [ ] Check Vercel logs for errors

3. [ ] **Smoke Tests**
   - [ ] Test webhook health check: GET /api/webhooks/email-inbound
   - [ ] Test manual upload in production
   - [ ] Send test email to broker address

4. [ ] **Monitoring**
   - [ ] Watch Vercel logs for 1 hour
   - [ ] Check for signature verification failures
   - [ ] Verify transactions created successfully

### Rollback Plan

If deployment fails:
1. Revert to previous git commit
2. Force push to main branch
3. Vercel will auto-deploy previous version
4. Investigate issues in staging environment

---

## Phase 7: Post-Deployment

### Verification

- [ ] **Production Testing**
  - [ ] Send real test email to broker address
  - [ ] Verify email received by Cloudflare
  - [ ] Verify Worker forwards to webhook
  - [ ] Verify webhook processes successfully
  - [ ] Verify PDF uploaded to R2
  - [ ] Verify transaction in database
  - [ ] Verify broker can see transaction in UI

- [ ] **Performance Monitoring**
  - [ ] Check webhook response times
  - [ ] Monitor R2 upload times
  - [ ] Monitor database query performance
  - [ ] Check for memory/CPU spikes

### Broker Onboarding

- [ ] **Broker Setup**
  - [ ] Assign unique email address per broker
  - [ ] Format: `{broker-uuid}@{subdomain}.insuredin.app`
  - [ ] Update `broker_branding` table with subdomain
  - [ ] Test email delivery to broker address

- [ ] **Insurer Communication**
  - [ ] Provide BCC email address to insurers
  - [ ] Send example email template
  - [ ] Document expected document types

---

## Success Criteria

### Functional Requirements

- [x] Broker can manually upload documents
- [ ] Broker receives BCC'd emails automatically
- [ ] PDFs extracted and uploaded to R2
- [ ] Transactions created in database
- [ ] Broker can review in email inbox UI
- [ ] Webhook signature verification prevents unauthorized access
- [ ] System handles multiple attachments
- [ ] System handles invalid emails gracefully

### Non-Functional Requirements

- [ ] Webhook processes emails in < 5 seconds
- [ ] No data loss (all emails processed)
- [ ] No unauthorized access (signature verification)
- [ ] No replay attacks (timestamp validation)
- [ ] Proper error logging and monitoring
- [ ] Documentation complete and accurate

---

## Known Issues / Future Work

### Current Limitations

- [ ] No AI extraction (manual broker review required)
- [ ] No antivirus scanning on PDFs
- [ ] No rate limiting per broker
- [ ] No email sender verification (SPF/DKIM)
- [ ] No automatic client/policy matching

### Future Enhancements

- [ ] Integrate Claude API for AI extraction
- [ ] Add antivirus scanning (ClamAV)
- [ ] Implement rate limiting
- [ ] Add SPF/DKIM verification
- [ ] Automatic client/policy matching
- [ ] Email threading support
- [ ] Retry logic for failed uploads

---

## Sign-Off

### Developer
- [ ] Code implemented and tested
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Ready for QA

**Name:** _________________
**Date:** _________________

### QA Tester
- [ ] All test cases executed
- [ ] No critical bugs found
- [ ] Documentation verified
- [ ] Ready for deployment

**Name:** _________________
**Date:** _________________

### DevOps
- [ ] Security review completed
- [ ] Environment variables configured
- [ ] Monitoring set up
- [ ] Ready for production

**Name:** _________________
**Date:** _________________

### Overseer
- [ ] Sprint goals met
- [ ] Acceptance criteria satisfied
- [ ] Documentation complete
- [ ] Approved for production

**Name:** _________________
**Date:** _________________

---

**Status:** 🟡 In Progress
**Last Updated:** 2026-01-18
**Version:** 1.0
