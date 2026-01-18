# Email Webhook Security Implementation Guide

## Overview

This document provides security improvements for the InsuredIn email processing pipeline, specifically securing the communication between Cloudflare Email Worker and Next.js webhook endpoint.

**Architecture:** Cloudflare Email Worker → Next.js `/api/webhooks/email-inbound` → AI Processing

---

## Security Threats & Mitigations

### 🚨 Current Vulnerability: Unauthenticated Webhook

**Problem:** Any attacker who discovers your webhook URL can POST malicious emails.

**Attack Scenarios:**
1. **Spam Flood:** Overwhelm system with fake emails
2. **Resource Exhaustion:** Trigger expensive Claude API calls
3. **Data Poisoning:** Inject malicious PDFs to corrupt AI training data
4. **Cost Attack:** Generate thousands of API calls ($$$)

**Solution:** Implement webhook authentication with HMAC signatures.

---

## Security Implementation

### 1. Webhook Secret Authentication

**Setup in Cloudflare Worker:**

```bash
# Generate a strong random secret
openssl rand -hex 32
# Output: 8f7a9d2e1c5b4f3a7e9d2c1b5f4a3e8d9c2b1f5a4e3d8c7b1f9a5e4d3c2b1f8a

# Set in Cloudflare Worker
wrangler secret put WEBHOOK_SECRET
# Paste the generated secret when prompted
```

**Set in Next.js Environment:**

```bash
# In Vercel, add environment variable:
# WEBHOOK_SECRET=8f7a9d2e1c5b4f3a7e9d2c1b5f4a3e8d9c2b1f5a4e3d8c7b1f9a5e4d3c2b1f8a
```

### 2. HMAC Signature Implementation

**Benefits of HMAC:**
- ✅ Verifies request authenticity
- ✅ Prevents replay attacks (with timestamp)
- ✅ Cannot be forged without secret
- ✅ Industry standard (GitHub, Stripe, etc.)

**Algorithm:** HMAC-SHA256

---

## Code Implementation

### Updated Cloudflare Email Worker

**File:** `email-worker.js`

```javascript
/**
 * Cloudflare Email Worker with HMAC Authentication
 * 
 * Receives emails via Cloudflare Email Routing and forwards them
 * to the Next.js webhook endpoint with HMAC signature for security.
 */

export default {
  async email(message, env, ctx) {
    const WEBHOOK_URL = 'https://insuredin.vercel.app/api/webhooks/email-inbound';
    
    try {
      // Get the raw email content
      const rawEmail = await streamToArrayBuffer(message.raw);
      
      // Generate timestamp (prevents replay attacks)
      const timestamp = Date.now().toString();
      
      // Generate HMAC signature
      const signature = await generateHMAC(
        env.WEBHOOK_SECRET,
        rawEmail,
        timestamp
      );
      
      // Extract broker information from recipient email
      const brokerInfo = extractBrokerFromEmail(message.to);
      
      // Forward to webhook with authentication headers
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'message/rfc822',
          'X-Cloudflare-Worker': 'email-forwarder',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Broker-Subdomain': brokerInfo.subdomain,
          'X-Recipient-Email': message.to,
          'X-Sender-Email': message.from,
        },
        body: rawEmail,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Webhook error:', response.status, errorText);
        // Reject the email so sender gets bounce notification
        message.setReject(`Webhook processing failed: ${response.status}`);
      } else {
        const result = await response.json();
        console.log('Email processed successfully:', {
          transactionId: result.transactionId,
          broker: brokerInfo.subdomain,
        });
      }

    } catch (error) {
      console.error('Error processing email:', error);
      message.setReject(`Processing error: ${error.message}`);
    }
  }
};

/**
 * Generate HMAC-SHA256 signature
 */
async function generateHMAC(secret, body, timestamp) {
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
 * Extract broker subdomain from email address
 * Format: {brokerid}@{brokerage}.insuredin.app
 * 
 * Examples:
 * - john@smithbrokers.insuredin.app → { subdomain: 'smithbrokers', brokerid: 'john' }
 * - documents@aucklandins.insuredin.app → { subdomain: 'aucklandins', brokerid: 'documents' }
 */
function extractBrokerFromEmail(toEmail) {
  const match = toEmail.match(/^([^@]+)@([^.]+)\.insuredin\.app$/);
  
  if (!match) {
    throw new Error(`Invalid email format: ${toEmail}`);
  }
  
  return {
    brokerid: match[1],      // e.g., "john" or "documents"
    subdomain: match[2],     // e.g., "smithbrokers"
    fullEmail: toEmail,
  };
}

/**
 * Convert ReadableStream to ArrayBuffer
 */
async function streamToArrayBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  // Concatenate all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result.buffer;
}
```

---

## Next.js Webhook Security Implementation

**File:** `src/app/api/webhooks/email-inbound/route.ts`

### Code Structure

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '@/lib/security/webhook-auth';
import { parseEmail } from '@/lib/email/parser';
import { uploadToR2 } from '@/lib/storage/r2';
import { queueAIExtraction } from '@/lib/jobs/ai-extraction';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Email Inbound Webhook Handler
 * 
 * Security Features:
 * 1. HMAC signature verification
 * 2. Timestamp validation (prevents replay attacks)
 * 3. Rate limiting per broker
 * 4. Broker subdomain validation
 */
export async function POST(request: NextRequest) {
  try {
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
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // 2. SECURITY: Validate timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);
    
    // Reject requests older than 5 minutes
    if (timeDiff > 5 * 60 * 1000) {
      console.error('Request timestamp too old:', { timeDiff });
      return NextResponse.json(
        { error: 'Request expired' },
        { status: 401 }
      );
    }
    
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
    
    // Validate broker exists in database
    const { data: brokerBranding, error: brokerError } = await supabase
      .from('broker_branding')
      .select('broker_id, subdomain')
      .eq('subdomain', brokerSubdomain)
      .single();
    
    if (brokerError || !brokerBranding) {
      console.error('Broker not found:', brokerSubdomain);
      return NextResponse.json(
        { error: 'Broker not found' },
        { status: 404 }
      );
    }
    
    const brokerId = brokerBranding.broker_id;
    
    // 4. SECURITY: Rate limiting (100 emails per broker per hour)
    const isRateLimited = await checkRateLimit(brokerId);
    if (isRateLimited) {
      console.error('Rate limit exceeded for broker:', brokerId);
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    // 5. Parse email
    const emailData = await parseEmail(Buffer.from(rawBody));
    
    // 6. Filter to PDF attachments only
    const pdfAttachments = emailData.attachments.filter(
      att => att.contentType === 'application/pdf'
    );
    
    if (pdfAttachments.length === 0) {
      console.warn('No PDF attachments found in email');
      return NextResponse.json(
        { 
          success: false,
          message: 'No PDF attachments found',
        },
        { status: 200 }
      );
    }
    
    // 7. Create email processing transaction
    const { data: transaction, error: txError } = await supabase
      .from('email_processing_transactions')
      .insert({
        broker_id: brokerId,
        inbox_id: brokerBranding.inbox_id,
        from_email: senderEmail,
        to_email: recipientEmail,
        subject: emailData.subject,
        received_at: new Date().toISOString(),
        status: 'pending',
      })
      .select()
      .single();
    
    if (txError) {
      console.error('Failed to create transaction:', txError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }
    
    // 8. Upload attachments to R2
    const uploadedAttachments = [];
    
    for (const attachment of pdfAttachments) {
      try {
        const storageKey = `broker-${brokerId}/transaction-${transaction.id}/${attachment.filename}`;
        
        await uploadToR2({
          key: storageKey,
          body: attachment.content,
          contentType: 'application/pdf',
        });
        
        // Save attachment record
        const { data: attachmentRecord } = await supabase
          .from('email_attachments')
          .insert({
            transaction_id: transaction.id,
            filename: attachment.filename,
            mime_type: 'application/pdf',
            size_bytes: attachment.size,
            storage_url: storageKey,
          })
          .select()
          .single();
        
        uploadedAttachments.push(attachmentRecord);
        
      } catch (uploadError) {
        console.error('Failed to upload attachment:', uploadError);
        // Continue with other attachments
      }
    }
    
    // 9. Queue AI extraction job (background processing)
    await queueAIExtraction({
      transactionId: transaction.id,
      brokerId: brokerId,
      attachments: uploadedAttachments,
    });
    
    // 10. Update transaction status
    await supabase
      .from('email_processing_transactions')
      .update({ status: 'awaiting_extraction' })
      .eq('id', transaction.id);
    
    // 11. Return success
    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      attachmentsProcessed: uploadedAttachments.length,
    });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'email-inbound-webhook',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Rate limiting check
 * 
 * Limit: 100 emails per broker per hour
 */
async function checkRateLimit(brokerId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('email_processing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('broker_id', brokerId)
    .gte('received_at', oneHourAgo);
  
  if (error) {
    console.error('Rate limit check error:', error);
    return false; // Fail open (allow request)
  }
  
  return (count || 0) >= 100;
}
```

---

## Webhook Authentication Library

**File:** `src/lib/security/webhook-auth.ts`

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

---

## Additional Security Measures

### 1. IP Allowlist (Optional Layer)

Restrict webhook to Cloudflare IPs only:

```typescript
// In webhook handler
const CLOUDFLARE_IP_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  // ... full list at https://www.cloudflare.com/ips/
];

function isCloudflareIP(ip: string): boolean {
  // Check if IP is in allowed ranges
  // Use ipaddr.js or similar library
  return CLOUDFLARE_IP_RANGES.some(range => ipInRange(ip, range));
}
```

### 2. Request Size Limits

Prevent resource exhaustion:

```typescript
// In Next.js config
export const config = {
  api: {
    bodyParser: false, // We parse manually
    sizeLimit: '25mb', // Match Cloudflare email size limit
  },
};
```

### 3. Logging & Monitoring

**Log all authentication failures:**

```typescript
// Failed signature
console.error('SECURITY: Invalid webhook signature', {
  timestamp,
  brokerSubdomain,
  senderEmail,
  ipAddress: request.headers.get('x-forwarded-for'),
});

// Failed rate limit
console.error('SECURITY: Rate limit exceeded', {
  brokerId,
  emailCount: count,
  timeWindow: '1 hour',
});
```

**Set up alerts (Vercel):**
- Alert on >5 authentication failures per minute
- Alert on rate limit exceeded
- Alert on webhook errors >10% over 5 minutes

---

## Testing the Security Implementation

### 1. Test Valid Request

```bash
# Generate test signature (use same secret)
SECRET="8f7a9d2e1c5b4f3a7e9d2c1b5f4a3e8d9c2b1f5a4e3d8c7b1f9a5e4d3c2b1f8a"
TIMESTAMP=$(date +%s000)
BODY="test email body"

# Generate HMAC (use OpenSSL)
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Test webhook
curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "Content-Type: message/rfc822" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "X-Broker-Subdomain: testbroker" \
  -H "X-Recipient-Email: test@testbroker.insuredin.app" \
  -H "X-Sender-Email: sender@example.com" \
  -d "$BODY"

# Expected: 200 OK with transaction ID
```

### 2. Test Invalid Signature

```bash
curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "Content-Type: message/rfc822" \
  -H "X-Webhook-Signature: invalid_signature_here" \
  -H "X-Webhook-Timestamp: $(date +%s000)" \
  -H "X-Broker-Subdomain: testbroker" \
  -d "test body"

# Expected: 401 Unauthorized
```

### 3. Test Expired Timestamp

```bash
# Timestamp from 10 minutes ago (should fail)
OLD_TIMESTAMP=$(($(date +%s000) - 600000))

curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
  -H "X-Webhook-Timestamp: $OLD_TIMESTAMP" \
  ...

# Expected: 401 Unauthorized (Request expired)
```

### 4. Test Rate Limiting

```bash
# Send 101 emails rapidly
for i in {1..101}; do
  curl -X POST https://insuredin.vercel.app/api/webhooks/email-inbound \
    -H "X-Broker-Subdomain: testbroker" \
    ...
done

# Expected: First 100 succeed, 101st returns 429 Too Many Requests
```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Authentication Failures**
   - Alert: >5 per minute
   - Action: Investigate potential attack

2. **Rate Limit Hits**
   - Alert: Any broker hitting limit
   - Action: Investigate broker email volume

3. **Processing Time**
   - Alert: p95 >10 seconds
   - Action: Optimise R2 upload or database queries

4. **Error Rate**
   - Alert: >5% errors over 5 minutes
   - Action: Check Supabase, R2, Claude API status

### Vercel Log Queries

```bash
# Failed authentications
vercel logs --follow | grep "SECURITY: Invalid webhook signature"

# Rate limit hits
vercel logs --follow | grep "SECURITY: Rate limit exceeded"

# All webhook errors
vercel logs --follow | grep "Webhook processing error"
```

---

## Security Checklist

Before going to production:

- [ ] Generate strong random secret (32+ bytes)
- [ ] Set WEBHOOK_SECRET in Cloudflare Worker (wrangler secret put)
- [ ] Set WEBHOOK_SECRET in Vercel environment variables
- [ ] Verify HMAC signature implementation matches on both sides
- [ ] Test valid signature authentication
- [ ] Test invalid signature rejection
- [ ] Test timestamp expiry (>5 minutes old)
- [ ] Implement rate limiting (100/hour per broker)
- [ ] Set up monitoring alerts
- [ ] Document incident response procedures
- [ ] Review Cloudflare and Vercel logs regularly

---

## Incident Response

If webhook receives suspicious traffic:

1. **Immediate:** Check Vercel logs for failed authentications
2. **Identify:** Determine if attack or misconfiguration
3. **Mitigate:** 
   - Rotate WEBHOOK_SECRET if compromised
   - Add IP blocklist if needed
   - Increase rate limits temporarily
4. **Notify:** Alert team of security event
5. **Review:** Analyse logs to understand attack vector
6. **Improve:** Update security measures as needed

---

## Future Enhancements

- [ ] Add IP allowlist (Cloudflare IPs only)
- [ ] Implement jitter in retry logic
- [ ] Add webhook request deduplication
- [ ] Store failed authentication attempts in database
- [ ] Implement automatic secret rotation (90 days)
- [ ] Add Honeypot email addresses to detect spam
- [ ] Integrate with SIEM for security monitoring

---

**Status:** Ready for implementation  
**Priority:** HIGH (Security-Critical)  
**Implementation Time:** 4-6 hours  
**Testing Time:** 2 hours  
**Maintenance:** Low (monitor alerts)

---

**Last Updated:** January 2026  
**Next Review:** After production deployment
