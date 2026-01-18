# Cloudflare Email Worker Setup Guide

## Overview

InsuredIn uses Cloudflare Email Routing to receive BCC'd emails containing insurance documents. This guide covers setting up email forwarding to process documents automatically.

**Architecture:** Email → Cloudflare Email Routing → Webhook → Next.js API → R2 Storage → Supabase

---

## Prerequisites

- Cloudflare account with domain configured
- Cloudflare R2 bucket set up (see TASK-000A)
- Vercel deployment with environment variables configured
- Domain for email routing (e.g., `insuredin.app`)

---

## Implementation Approach

We use the **Webhook Approach** instead of Cloudflare Workers for simpler maintenance and deployment.

### Why Webhook Instead of Worker?

- ✅ Simpler deployment (no separate Worker to manage)
- ✅ Easier debugging (logs in Vercel)
- ✅ Direct access to Supabase and R2 utilities
- ✅ Faster iteration (deployed with Next.js app)
- ⚠️ Slightly higher latency (negligible for email processing)

---

## Setup Steps

### 1. Configure Cloudflare Email Routing

1. **Navigate to Email Routing in Cloudflare Dashboard**
   - Go to your domain (e.g., `insuredin.app`)
   - Click **Email** → **Email Routing**
   - Click **Get Started** if not yet enabled

2. **Enable Email Routing**
   - Follow the wizard to configure DNS records
   - Cloudflare will add MX and TXT records automatically
   - Verify DNS propagation (usually takes <5 minutes)

3. **Create Catch-All Rule**
   - Go to **Routing Rules** tab
   - Click **Create address**
   - Configure:
     - **Custom address:** `documents@*` (catches all subdomains)
     - **Action:** Send to a Worker
     - **Destination:** Custom Webhook
     - **Webhook URL:** `https://insuredin.vercel.app/api/webhooks/email-inbound`
   - Click **Save**

### 2. Configure Broker-Specific Email Addresses

Each broker gets a unique email address in one of two formats:

#### Format 1: Broker ID (UUID)
```
documents@broker-{broker_id}.insuredin.app
```

Example:
```
documents@broker-abc123-def456-gh7890.insuredin.app
```

#### Format 2: Subdomain
```
documents@{subdomain}.insuredin.app
```

Example:
```
documents@smithbrokers.insuredin.app
```

The webhook will:
- Extract broker ID from Format 1 directly
- Look up broker ID from `broker_branding.subdomain` for Format 2

### 3. Test Email Flow

#### Send Test Email

```bash
# Replace with actual broker email
TO_EMAIL="documents@broker-{broker-id}.insuredin.app"

# Send test email with PDF attachment
echo "This is a test policy schedule" | mail -s "Policy Schedule - Test Client" \
  -a /path/to/test-policy.pdf \
  $TO_EMAIL
```

#### Verify Processing

1. Check Vercel logs for webhook processing:
   ```bash
   vercel logs --follow
   ```

2. Check Supabase `email_processing_transactions` table:
   ```sql
   SELECT id, from_email, subject, status, received_at
   FROM email_processing_transactions
   ORDER BY received_at DESC
   LIMIT 10;
   ```

3. Check R2 bucket for uploaded attachments

4. Check broker email inbox UI:
   - Navigate to `/broker/email-inbox`
   - Should see transaction in "Awaiting Review" status

---

## Alternative: Manual Upload

For brokers without email forwarding set up, use the **Manual Upload** feature:

1. Navigate to **Broker → Email Inbox**
2. Click **Upload Document** button
3. Fill in:
   - **From Email:** Who sent the document
   - **Subject:** Email subject / description
   - **Attachments:** Select PDF files
4. Click **Upload & Process**

This creates the same `email_processing_transaction` record as email forwarding.

---

## Email Formats Supported

### PDF Attachments Only

The webhook filters to PDF attachments only. Other file types are ignored.

**Supported:**
- `.pdf` files
- MIME type: `application/pdf`

**Ignored:**
- `.doc`, `.docx` (Microsoft Word)
- `.xls`, `.xlsx` (Excel)
- Images (`.jpg`, `.png`)
- Plain text email body

---

## Broker Instructions

### For Insurers to BCC

Provide this email address to your clients' insurers:

```
documents@{your-subdomain}.insuredin.app
```

**Example Email Template:**

```
Hi [Insurer],

Please BCC all policy documents for our clients to:

documents@smithbrokers.insuredin.app

This will automatically upload documents to our client portal.

Documents will include:
- Policy schedules
- Renewal notices
- Invoices
- Certificates of insurance
- Policy wordings

Thank you!
```

### What Happens After BCC?

1. Email arrives at Cloudflare Email Routing
2. Forwarded to InsuredIn webhook
3. PDFAttachments extracted and uploaded to secure R2 storage
4. Email transaction created in your inbox
5. AI extraction runs (optional, future feature)
6. **Broker reviews and approves** before publishing to client

---

## Webhook Endpoint Details

### Endpoint

```
POST https://insuredin.vercel.app/api/webhooks/email-inbound
```

### Request Format

Cloudflare Email Routing sends raw email in RFC 822 format as request body.

### Response Format

```json
{
  "success": true,
  "transactionId": "uuid",
  "attachmentsProcessed": 2
}
```

### Error Responses

```json
{
  "error": "Broker not found"
}
```

### Health Check

```
GET https://insuredin.vercel.app/api/webhooks/email-inbound
```

Returns:
```json
{
  "status": "ok",
  "service": "email-inbound-webhook",
  "timestamp": "2026-01-18T00:00:00.000Z"
}
```

---

## Database Schema

### email_processing_transactions

Created for every received email:

```sql
CREATE TABLE email_processing_transactions (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL,
  inbox_id UUID NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  received_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  -- ... AI extraction fields ...
  -- ... broker review fields ...
);
```

**Status Flow:**
1. `pending` - Email received, attachments uploading
2. `awaiting_review` - Ready for broker review
3. `approved` - Broker approved, published to client
4. `rejected` - Broker rejected, not published

### email_attachments

```sql
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_url TEXT NOT NULL, -- R2 storage key
  uploaded_at TIMESTAMPTZ
);
```

---

## Security Considerations

### Webhook Authentication

⚠️ **TODO:** Add webhook authentication to prevent unauthorized requests.

Options:
1. **HMAC signature** from Cloudflare
2. **API key** in header
3. **IP allowlist** (Cloudflare IPs only)

### Email Validation

The webhook validates:
- ✅ Broker exists in database
- ✅ Destination email matches expected format
- ✅ At least one PDF attachment present

Does NOT validate:
- Sender email address (could be spoofed)
- Email content

### Broker Review Required

All documents require **broker review and approval** before publishing to clients. This prevents:
- Spam/malicious emails
- Incorrectly matched documents
- Sensitive documents going to wrong clients

---

## Monitoring & Debugging

### Check Webhook Logs

```bash
# Vercel logs
vercel logs --follow

# Filter for webhook
vercel logs --follow | grep "email-inbound"
```

### Check Transaction Status

```sql
-- Recent transactions
SELECT id, from_email, subject, status, received_at
FROM email_processing_transactions
WHERE broker_id = 'your-broker-id'
ORDER BY received_at DESC
LIMIT 20;

-- Failed transactions
SELECT id, from_email, subject, error_message
FROM email_processing_transactions
WHERE status = 'failed'
ORDER BY received_at DESC;
```

### Check R2 Uploads

Use R2 dashboard or AWS CLI:

```bash
# List recent uploads (using AWS S3 CLI)
aws s3 ls s3://insuredin-documents/  \
  --endpoint-url https://{account-id}.r2.cloudflarestorage.com \
  --profile cloudflare-r2
```

---

## Troubleshooting

### Email Not Received

1. **Check Cloudflare Email Routing Status**
   - Dashboard → Email → Email Routing
   - Verify "Active" status
   - Check recent activity logs

2. **Verify DNS Records**
   ```bash
   dig MX insuredin.app
   # Should show Cloudflare MX records
   ```

3. **Test Webhook Directly**
   ```bash
   curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
     -H "Content-Type: text/plain" \
     -d "Test email content"
   ```

### Transaction Stuck in "Pending"

1. Check Vercel logs for errors
2. Verify R2 credentials in Vercel environment variables
3. Check Supabase connection

### PDF Not Appearing

1. Verify file is actually a PDF (MIME type)
2. Check R2 bucket permissions
3. Check `email_attachments` table for upload errors

---

## Future Enhancements

- [ ] AI extraction integration (Claude API)
- [ ] Automatic client/policy matching
- [ ] Webhook authentication
- [ ] Email sender verification
- [ ] Support for other document formats (DOC, DOCX)
- [ ] Email threading (conversations)
- [ ] Retry logic for failed uploads
- [ ] Rate limiting

---

## Status

- [x] TASK-000A: R2 Storage Setup ✅
- [x] TASK-000B: Email Webhook Implementation ✅
- [ ] AI Extraction Integration (future)
- [ ] Production email routing configuration (manual step)

---

**Last Updated:** 2026-01-18
**Author:** DevOps Agent (Claude Code)
