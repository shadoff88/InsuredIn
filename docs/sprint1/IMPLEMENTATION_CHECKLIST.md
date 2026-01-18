# Email Webhook Security Implementation Checklist

## For Claude Code Agent

This checklist provides step-by-step instructions for implementing secure email webhook processing with HMAC authentication and subdomain routing.

---

## Phase 1: Email Worker Security (Cloudflare)

### Files to Deploy

1. **email-worker.js** (Updated with HMAC + subdomain extraction)
2. **wrangler.toml** (Worker configuration)

### Deployment Steps

```bash
# 1. Install Wrangler CLI (if not installed)
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Generate webhook secret (save this!)
openssl rand -hex 32
# Output example: 8f7a9d2e1c5b4f3a7e9d2c1b5f4a3e8d9c2b1f5a4e3d8c7b1f9a5e4d3c2b1f8a

# 4. Set webhook secret in Cloudflare Worker
wrangler secret put WEBHOOK_SECRET
# Paste the generated secret when prompted

# 5. Deploy worker
wrangler deploy

# Expected output:
# ✨ Deployed insuredin-email-worker
# 📡 https://insuredin-email-worker.your-account.workers.dev
```

### Cloudflare Dashboard Configuration

1. **Enable Email Routing:**
   - Go to Cloudflare Dashboard → `insuredin.app`
   - Navigate to **Email** → **Email Routing**
   - Click **Get Started** and follow wizard

2. **Add Wildcard DNS Records:**
   - Go to **DNS** → **Records**
   - Add MX records:
     ```
     Type: MX, Name: *, Value: route1.mx.cloudflare.net (Priority 10)
     Type: MX, Name: *, Value: route2.mx.cloudflare.net (Priority 20)
     Type: MX, Name: *, Value: route3.mx.cloudflare.net (Priority 30)
     ```
   - Add SPF record:
     ```
     Type: TXT, Name: *, Value: v=spf1 include:_spf.mx.cloudflare.net ~all
     ```

3. **Configure Catch-All Rule:**
   - Go to **Email** → **Email Routing** → **Routing Rules**
   - Enable **Catch-all address**
   - Action: **Send to a Worker**
   - Worker: Select `insuredin-email-worker`
   - Click **Save**

---

## Phase 2: Next.js Webhook Endpoint

### Files to Create

#### 1. `src/lib/security/webhook-auth.ts`

```typescript
/**
 * Webhook Authentication Utilities
 * 
 * Provides HMAC signature verification for webhook security.
 */

interface VerifySignatureParams {
  signature: string;
  timestamp: string;
  body: ArrayBuffer;
  secret: string;
}

/**
 * Verify HMAC-SHA256 signature from Cloudflare Email Worker
 */
export async function verifyWebhookSignature({
  signature,
  timestamp,
  body,
  secret,
}: VerifySignatureParams): Promise<boolean> {
  try {
    // Generate expected signature
    const expectedSignature = await generateHMAC(secret, body, timestamp);
    
    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(signature, expectedSignature);
    
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Generate HMAC-SHA256 signature
 */
async function generateHMAC(
  secret: string,
  body: ArrayBuffer,
  timestamp: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // Import secret as CryptoKey
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Create payload: timestamp + body
  const payload = timestamp + new Uint8Array(body).toString();
  
  // Sign the payload
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  // Convert to hex string
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison
 * Prevents timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
```

#### 2. `src/app/api/webhooks/email-inbound/route.ts`

**Implementation Steps:**

1. **Add Authentication Check** (at start of POST handler):
```typescript
// 1. SECURITY: Verify webhook signature
const signature = request.headers.get('x-webhook-signature');
const timestamp = request.headers.get('x-webhook-timestamp');

if (!signature || !timestamp) {
  return NextResponse.json(
    { error: 'Missing authentication headers' },
    { status: 401 }
  );
}

// Read raw body for signature verification
const rawBody = await request.arrayBuffer();

const isValid = await verifyWebhookSignature({
  signature,
  timestamp,
  body: rawBody,
  secret: process.env.WEBHOOK_SECRET!,
});

if (!isValid) {
  console.error('SECURITY: Invalid webhook signature', {
    timestamp,
    ipAddress: request.headers.get('x-forwarded-for'),
  });
  
  return NextResponse.json(
    { error: 'Invalid signature' },
    { status: 401 }
  );
}
```

2. **Add Timestamp Validation** (prevent replay attacks):
```typescript
// 2. SECURITY: Validate timestamp
const requestTime = parseInt(timestamp);
const currentTime = Date.now();
const timeDiff = Math.abs(currentTime - requestTime);

// Reject requests older than 5 minutes
if (timeDiff > 5 * 60 * 1000) {
  console.error('SECURITY: Request timestamp too old', {
    timeDiff,
    timestamp,
  });
  
  return NextResponse.json(
    { error: 'Request expired' },
    { status: 401 }
  );
}
```

3. **Add Subdomain Validation**:
```typescript
// 3. SECURITY: Extract and validate broker subdomain
const brokerSubdomain = request.headers.get('x-broker-subdomain');
const recipientEmail = request.headers.get('x-recipient-email');
const senderEmail = request.headers.get('x-sender-email');

if (!brokerSubdomain || !recipientEmail) {
  return NextResponse.json(
    { error: 'Missing broker information' },
    { status: 400 }
  );
}

// Validate broker exists
const { data: brokerBranding, error: brokerError } = await supabase
  .from('broker_branding')
  .select('broker_id, subdomain, inbox_id')
  .eq('subdomain', brokerSubdomain)
  .single();

if (brokerError || !brokerBranding) {
  console.error('SECURITY: Email to non-existent subdomain', {
    subdomain: brokerSubdomain,
    senderEmail,
    timestamp: new Date().toISOString(),
  });
  
  return NextResponse.json(
    { error: 'Broker not found' },
    { status: 404 }
  );
}

const brokerId = brokerBranding.broker_id;
```

4. **Add Rate Limiting**:
```typescript
// 4. SECURITY: Rate limiting (100 emails per broker per hour)
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const { count, error: countError } = await supabase
  .from('email_processing_transactions')
  .select('id', { count: 'exact', head: true })
  .eq('broker_id', brokerId)
  .gte('received_at', oneHourAgo);

if (countError) {
  console.error('Rate limit check error:', countError);
  // Fail open (allow request) to avoid blocking legitimate emails
}

if ((count || 0) >= 100) {
  console.error('SECURITY: Rate limit exceeded', {
    broker_id: brokerId,
    subdomain: brokerSubdomain,
    emailCount: count,
  });
  
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

### Environment Variables

Add to Vercel environment variables:

```bash
# Generate same secret as Cloudflare Worker
WEBHOOK_SECRET=8f7a9d2e1c5b4f3a7e9d2c1b5f4a3e8d9c2b1f5a4e3d8c7b1f9a5e4d3c2b1f8a

# Existing variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** Use the **exact same secret** in both Cloudflare Worker and Vercel.

---

## Phase 3: Database Schema Updates

### Update broker_branding Table

```sql
-- Add subdomain column if not exists
ALTER TABLE broker_branding 
ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Add constraints
ALTER TABLE broker_branding
ADD CONSTRAINT subdomain_format 
CHECK (subdomain ~ '^[a-z0-9-]{3,30}$');

ALTER TABLE broker_branding
ADD CONSTRAINT subdomain_no_leading_hyphen 
CHECK (subdomain !~ '^-');

ALTER TABLE broker_branding
ADD CONSTRAINT subdomain_no_trailing_hyphen 
CHECK (subdomain !~ '-$');

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_broker_branding_subdomain 
ON broker_branding(subdomain);

-- Update existing brokers with default subdomains (if needed)
UPDATE broker_branding 
SET subdomain = LOWER(REGEXP_REPLACE(
  (SELECT company_name FROM brokers WHERE id = broker_branding.broker_id),
  '[^a-z0-9]', '', 'g'
))
WHERE subdomain IS NULL;
```

### Create email_inboxes Table

```sql
CREATE TABLE IF NOT EXISTS email_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  inbox_email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT email_format 
  CHECK (inbox_email ~ '^[^@]+@[^@]+\.insuredin\.app$')
);

-- Index for webhook lookups
CREATE INDEX idx_email_inboxes_broker ON email_inboxes(broker_id);

-- RLS Policy
ALTER TABLE email_inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_own_inbox" ON email_inboxes
  FOR ALL
  USING (
    broker_id IN (
      SELECT broker_id FROM broker_users WHERE user_id = auth.uid()
    )
  );
```

### Update email_processing_transactions Table

```sql
-- Add inbox_id if not exists
ALTER TABLE email_processing_transactions
ADD COLUMN IF NOT EXISTS inbox_id UUID REFERENCES email_inboxes(id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_email_transactions_inbox
ON email_processing_transactions(inbox_id);
```

---

## Phase 4: Testing

### Test 1: Valid Webhook Authentication

```bash
# Generate test signature
SECRET="8f7a9d2e1c5b4f3a7e9d2c1b5f4a3e8d9c2b1f5a4e3d8c7b1f9a5e4d3c2b1f8a"
TIMESTAMP=$(date +%s000)
BODY="test email body"

# Generate HMAC (requires OpenSSL)
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Test webhook
curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "Content-Type: message/rfc822" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "X-Broker-Subdomain: testbroker" \
  -H "X-Recipient-Email: documents@testbroker.insuredin.app" \
  -H "X-Sender-Email: test@example.com" \
  -d "$BODY"

# Expected: 200 OK or 404 (if broker doesn't exist)
```

### Test 2: Invalid Signature

```bash
curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "Content-Type: message/rfc822" \
  -H "X-Webhook-Signature: invalid_signature" \
  -H "X-Webhook-Timestamp: $(date +%s000)" \
  -H "X-Broker-Subdomain: testbroker" \
  -d "test"

# Expected: 401 Unauthorized
```

### Test 3: Expired Timestamp

```bash
# Timestamp from 10 minutes ago
OLD_TIMESTAMP=$(($(date +%s000) - 600000))

curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "X-Webhook-Timestamp: $OLD_TIMESTAMP" \
  -H "X-Webhook-Signature: any" \
  -d "test"

# Expected: 401 Unauthorized (Request expired)
```

### Test 4: End-to-End Email Flow

```bash
# 1. Create test broker in database
INSERT INTO brokers (id, company_name) 
VALUES ('test-broker-uuid', 'Test Brokers Ltd');

INSERT INTO broker_branding (broker_id, subdomain) 
VALUES ('test-broker-uuid', 'testbroker');

INSERT INTO email_inboxes (broker_id, inbox_email) 
VALUES ('test-broker-uuid', 'documents@testbroker.insuredin.app');

# 2. Send test email
echo "Test policy document content" | mail -s "Test Policy Schedule" \
  -a test-policy.pdf \
  documents@testbroker.insuredin.app

# 3. Check Cloudflare Worker logs
wrangler tail

# 4. Check Vercel logs
vercel logs --follow

# 5. Check database
SELECT * FROM email_processing_transactions 
WHERE broker_id = 'test-broker-uuid' 
ORDER BY received_at DESC LIMIT 1;

# Expected: Transaction created with status 'pending' or 'awaiting_extraction'
```

---

## Phase 5: Monitoring Setup

### Vercel Logs

Set up log monitoring for security events:

```bash
# Authentication failures
vercel logs --follow | grep "SECURITY: Invalid webhook signature"

# Rate limit hits
vercel logs --follow | grep "SECURITY: Rate limit exceeded"

# Invalid subdomains
vercel logs --follow | grep "SECURITY: Email to non-existent subdomain"
```

### Vercel Alerts

Configure alerts in Vercel Dashboard:

1. **Failed Authentications:**
   - Threshold: >5 per minute
   - Query: `"SECURITY: Invalid webhook signature"`

2. **Rate Limit Exceeded:**
   - Threshold: >0 per hour
   - Query: `"SECURITY: Rate limit exceeded"`

3. **Webhook Errors:**
   - Threshold: >10% error rate over 5 minutes
   - Query: `"Webhook processing error"`

---

## Phase 6: Documentation Updates

### Update EMAIL_WORKER_SETUP.md

Add section on security:

```markdown
## Security

This implementation uses HMAC-SHA256 authentication to secure the webhook endpoint.

**Secret Management:**
- Generate: `openssl rand -hex 32`
- Set in Cloudflare: `wrangler secret put WEBHOOK_SECRET`
- Set in Vercel: Environment variable `WEBHOOK_SECRET`
- **Important:** Use the same secret in both places

**What's Protected:**
- ✅ Webhook endpoint cannot be called without valid signature
- ✅ Replay attacks prevented (5-minute timestamp window)
- ✅ Rate limiting per broker (100 emails/hour)
- ✅ Invalid brokers rejected immediately

**Security Logging:**
All authentication failures are logged with context for security auditing.
```

---

## Completion Checklist

### Cloudflare Setup
- [ ] Email Worker deployed with HMAC authentication
- [ ] WEBHOOK_SECRET set in Cloudflare Worker
- [ ] Wildcard DNS records created (`*.insuredin.app`)
- [ ] Catch-all rule configured to use worker
- [ ] Worker logs confirm emails are received

### Next.js Setup
- [ ] `webhook-auth.ts` library created
- [ ] `/api/webhooks/email-inbound` updated with security
- [ ] WEBHOOK_SECRET environment variable set in Vercel
- [ ] Signature verification working
- [ ] Timestamp validation working
- [ ] Subdomain validation working
- [ ] Rate limiting implemented

### Database Setup
- [ ] `broker_branding.subdomain` column added
- [ ] Subdomain constraints created
- [ ] `email_inboxes` table created
- [ ] Indexes created for performance
- [ ] RLS policies enabled

### Testing
- [ ] Valid webhook authentication test passes
- [ ] Invalid signature test rejects (401)
- [ ] Expired timestamp test rejects (401)
- [ ] Non-existent broker test rejects (404)
- [ ] Rate limiting test works (429 after 100 emails)
- [ ] End-to-end email flow works

### Monitoring
- [ ] Vercel log monitoring set up
- [ ] Alerts configured for security events
- [ ] Rate limit alerts configured
- [ ] Error rate alerts configured

### Documentation
- [ ] Security implementation documented
- [ ] Testing procedures documented
- [ ] Incident response procedures documented
- [ ] Broker onboarding guide updated

---

## Success Criteria

✅ **Security:**
- No emails processed without valid HMAC signature
- Zero authentication bypasses
- All security events logged

✅ **Performance:**
- Email Worker processing time: <50ms
- Webhook response time: <500ms (p95)
- Database lookups: <100ms

✅ **Reliability:**
- 99.9% successful email processing
- Zero lost emails
- All errors logged with context

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate:** Disable catch-all rule in Cloudflare (stops email processing)
2. **Investigate:** Check Vercel and Cloudflare logs
3. **Fix:** Apply fix and test in staging
4. **Redeploy:** Re-enable catch-all rule after verification

**Data Safety:** Emails are never lost - they bounce to sender if processing fails.

---

**Implementation Priority:** HIGH (Security-Critical)  
**Estimated Time:** 6-8 hours implementation + 2 hours testing  
**Dependencies:** Cloudflare account, Vercel deployment, Supabase database

**Status:** Ready for Claude Code implementation
