# Email Webhook Security Implementation

## Overview

This document describes the security implementation for the Cloudflare Email Worker webhook endpoint that processes BCC'd insurance documents.

**Status:** ✅ Implemented
**Date:** 2026-01-18
**Environment Variables Required:** `WEBHOOK_SECRET`

---

## Threat Model

### Threats Mitigated

1. **Unauthorized Webhook Calls**
   - Attacker sends fake emails to trigger processing
   - Attacker floods webhook with spam requests
   - **Mitigation:** HMAC signature verification

2. **Replay Attacks**
   - Attacker captures valid request and replays it
   - **Mitigation:** Timestamp validation (5-minute window)

3. **Man-in-the-Middle**
   - Attacker intercepts and modifies webhook payload
   - **Mitigation:** HTTPS + HMAC signature

### Threats NOT Mitigated (Future Work)

- Email sender spoofing (requires SPF/DKIM verification)
- Malicious PDF content (requires antivirus scanning)
- Rate limiting / DDoS (requires Cloudflare rate limiting)

---

## Email Address Format

Each broker gets a unique email address:

```
{broker_uid}@{brokerage_name}.insuredin.app
```

**Examples:**
```
broker-abc123@smithinsurance.insuredin.app
broker-xyz789@jonesbrokerage.insuredin.app
```

**Format Breakdown:**
- `{broker_uid}`: Unique broker identifier from database (UUID)
- `{brokerage_name}`: Subdomain for the brokerage
- `insuredin.app`: Base domain

**Database Lookup:**
1. Extract `broker_uid` from email (before @)
2. Query `brokers` table where `id = broker_uid`
3. Validate broker exists and is active

---

## HMAC Signature Verification

### Algorithm: HMAC-SHA256

**Signature Generation (Cloudflare Worker):**

```typescript
const timestamp = Date.now().toString();
const payload = timestamp + rawEmailBody;
const signature = await generateHMAC(WEBHOOK_SECRET, payload);

// Send to webhook
await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
  },
  body: rawEmailBody,
});
```

**Signature Verification (Next.js Webhook):**

```typescript
const signature = request.headers.get('X-Webhook-Signature');
const timestamp = request.headers.get('X-Webhook-Timestamp');
const body = await request.arrayBuffer();

const isValid = await verifyWebhookSignature({
  signature,
  timestamp,
  body,
  secret: process.env.WEBHOOK_SECRET,
});

if (!isValid) {
  return Response.json({ error: 'Invalid signature' }, { status: 401 });
}
```

### Signature Format

- **Header:** `X-Webhook-Signature`
- **Value:** Hex-encoded HMAC-SHA256 hash
- **Length:** 64 characters (256 bits)

### Timestamp Validation

- **Header:** `X-Webhook-Timestamp`
- **Value:** Unix timestamp in milliseconds
- **Window:** ±5 minutes (300,000 ms)
- **Purpose:** Prevent replay attacks

---

## Implementation Details

### Files Modified

1. **`src/lib/webhooks/verify-signature.ts`** (NEW)
   - HMAC signature generation
   - Signature verification
   - Timestamp validation
   - Constant-time comparison

2. **`src/app/api/webhooks/email-inbound/route.ts`** (UPDATED)
   - Signature verification before processing
   - Broker UID extraction from email
   - Error logging for failed verifications

3. **`src/lib/email/parse-email.ts`** (UPDATED)
   - New function: `extractBrokerUidFromEmail()`
   - Format: `{broker_uid}@{subdomain}.insuredin.app`

### Environment Variables

**Vercel Environment Variables:**

```bash
WEBHOOK_SECRET=<random-secret-key>
```

**Generate Secret:**
```bash
openssl rand -hex 32
# Example: a1b2c3d4e5f6...
```

**Set in Vercel:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add: `WEBHOOK_SECRET` = `<your-secret-key>`
3. Scope: Production, Preview, Development
4. Save and redeploy

---

## Security Best Practices

### Secret Management

- ✅ Store `WEBHOOK_SECRET` in Vercel environment variables
- ✅ Use different secrets for dev/staging/production
- ✅ Rotate secret every 90 days
- ✅ Never commit secret to git
- ❌ Don't log the secret value

### Signature Verification

- ✅ Verify signature BEFORE processing email
- ✅ Use constant-time comparison to prevent timing attacks
- ✅ Validate timestamp to prevent replay attacks
- ✅ Reject requests with missing headers
- ✅ Log failed verification attempts

### Error Handling

- ✅ Return 401 for invalid signatures (don't expose details)
- ✅ Return 400 for missing headers
- ✅ Log verification failures for monitoring
- ❌ Don't return detailed error messages to client

---

## Testing

### Test Valid Signature

```bash
# Generate test signature
SECRET="your-webhook-secret"
TIMESTAMP=$(date +%s000)
BODY="test email content"
PAYLOAD="${TIMESTAMP}${BODY}"

# Generate HMAC (requires openssl)
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "Content-Type: text/plain" \
  -d "$BODY"
```

### Test Invalid Signature

```bash
# Should return 401
curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "X-Webhook-Signature: invalid-signature" \
  -H "X-Webhook-Timestamp: $(date +%s000)" \
  -d "test content"
```

### Test Replay Attack

```bash
# Use old timestamp (> 5 minutes ago)
OLD_TIMESTAMP=$(($(date +%s000) - 600000))

curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $OLD_TIMESTAMP" \
  -d "$BODY"
```

---

## Monitoring

### Metrics to Track

1. **Signature Verification Failures**
   - Count failed signature verifications
   - Alert if > 10 failures in 5 minutes

2. **Timestamp Out of Range**
   - Count rejected replayed requests
   - May indicate clock skew or attacks

3. **Missing Headers**
   - Count requests without signature headers
   - May indicate misconfigured worker

### Log Examples

**Successful Verification:**
```
[INFO] Webhook signature verified for broker: abc123
```

**Failed Verification:**
```
[WARN] Invalid webhook signature from IP: 1.2.3.4
```

**Replay Attack:**
```
[WARN] Webhook timestamp out of range: 1234567890 (diff: 600s)
```

---

## Cloudflare Worker Implementation

### Worker Code

```typescript
// workers/email-worker/src/index.ts
export default {
  async email(message, env) {
    try {
      // Extract broker UID from recipient
      const recipientEmail = message.to;
      const brokerUid = recipientEmail.split('@')[0];

      // Read raw email
      const rawEmail = await streamToArrayBuffer(message.raw);

      // Generate signature
      const timestamp = Date.now().toString();
      const signature = await generateHMAC(env.WEBHOOK_SECRET, rawEmail, timestamp);

      // Forward to webhook
      const response = await fetch(env.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'message/rfc822',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
        },
        body: rawEmail,
      });

      if (!response.ok) {
        console.error('Webhook failed:', await response.text());
      }

    } catch (error) {
      console.error('Email processing error:', error);
    }
  },
};

async function generateHMAC(secret, body, timestamp) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = timestamp + new Uint8Array(body).toString();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Worker Environment Variables

```toml
# wrangler.toml
[vars]
WEBHOOK_URL = "https://insuredin.vercel.app/api/webhooks/email-inbound"

# Secrets (set via wrangler)
# wrangler secret put WEBHOOK_SECRET
```

---

## Incident Response

### Invalid Signature Alert

1. Check Cloudflare Worker logs for errors
2. Verify `WEBHOOK_SECRET` matches in both Worker and Vercel
3. Check if secret was recently rotated
4. Review failed request IPs for patterns

### Replay Attack Detected

1. Review `X-Webhook-Timestamp` values
2. Check for clock skew between systems
3. Investigate source IPs
4. Consider reducing timestamp window if needed

### High Failure Rate

1. Check Cloudflare Worker deployment status
2. Verify Vercel deployment is live
3. Review recent code changes
4. Check for Cloudflare or Vercel outages

---

## Compliance

### Data Protection

- ✅ Webhook uses HTTPS (TLS 1.3)
- ✅ Email body encrypted in transit
- ✅ Signatures prevent tampering
- ✅ No email content logged (PII protection)

### Audit Trail

- ✅ Failed verifications logged
- ✅ Broker UID logged (not email content)
- ✅ Timestamp logged for replay detection
- ✅ IP address logged for security monitoring

---

## Future Enhancements

- [ ] Add rate limiting per broker UID
- [ ] Implement webhook retry logic with exponential backoff
- [ ] Add IP allowlist for Cloudflare Workers
- [ ] Implement SPF/DKIM verification
- [ ] Add antivirus scanning for PDF attachments
- [ ] Implement webhook delivery confirmation to Worker

---

**Last Updated:** 2026-01-18
**Version:** 1.0
**Author:** DevOps Agent (Claude Code)
