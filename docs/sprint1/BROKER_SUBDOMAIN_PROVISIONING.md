# Broker Subdomain Email Provisioning Guide

## Overview

InsuredIn uses broker-specific subdomains for email routing:

**Format:** `{brokerid}@{brokerage}.insuredin.app`

**Examples:**
- `documents@smithbrokers.insuredin.app`
- `john@aucklandins.insuredin.app`
- `policies@wellingtonbrokers.insuredin.app`

---

## Provisioning Approach Decision

### ❌ Option 1: Automatic API Provisioning

**Why This Doesn't Work:**

Cloudflare Email Routing API **does NOT support automatic subdomain provisioning**. Based on research:

1. Subdomains must be manually added in Cloudflare Dashboard
2. Each subdomain requires separate DNS MX records
3. No API endpoint exists for programmatic subdomain creation
4. Cloudflare's Email Routing API only supports:
   - Creating custom addresses (e.g., `user@example.com`)
   - Creating routing rules
   - Managing destination addresses
   - **NOT subdomain management**

**Source:** Cloudflare Email Routing API Documentation & Community Forums

---

### ✅ Option 2: Wildcard DNS + Email Worker Routing (RECOMMENDED)

**How It Works:**

1. **One-Time Setup:** Create wildcard DNS records for `*.insuredin.app`
2. **Email Worker Logic:** Route emails based on subdomain dynamically
3. **Database Lookup:** Verify broker exists before processing
4. **No Manual Steps:** Brokers onboard instantly via InsuredIn dashboard

**Advantages:**
- ✅ Fully automated (no Cloudflare dashboard access needed)
- ✅ Instant broker onboarding
- ✅ Scales to unlimited brokers
- ✅ No DNS changes per broker
- ✅ Secure (database verification)

**Disadvantages:**
- ⚠️ All emails hit same Email Worker (need efficient routing)
- ⚠️ Must validate broker exists in database (security critical)

---

## Implementation Architecture

### DNS Setup (One-Time)

```
Type: MX
Name: *
Value: route1.mx.cloudflare.net (priority 10)
       route2.mx.cloudflare.net (priority 20)
       route3.mx.cloudflare.net (priority 30)
TTL: Auto
Proxy: N/A (MX records not proxied)

Type: TXT
Name: *
Value: v=spf1 include:_spf.mx.cloudflare.net ~all
TTL: Auto
```

**Result:** All emails to `*@*.insuredin.app` are routed to Cloudflare Email Routing.

---

### Email Worker Routing Logic

The Email Worker extracts the subdomain and validates against the database:

```javascript
export default {
  async email(message, env, ctx) {
    // Extract subdomain from recipient email
    // Format: {brokerid}@{subdomain}.insuredin.app
    const match = message.to.match(/^([^@]+)@([^.]+)\.insuredin\.app$/);
    
    if (!match) {
      console.error('Invalid email format:', message.to);
      message.setReject('Invalid email address format');
      return;
    }
    
    const [_, brokerid, subdomain] = match;
    
    // Validate subdomain exists in database (via webhook)
    // The Next.js webhook will do the actual database lookup
    
    // Forward to webhook with subdomain info
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'X-Broker-Subdomain': subdomain,
        'X-Broker-ID': brokerid,
        'X-Recipient-Email': message.to,
        // ... authentication headers
      },
      body: rawEmail,
    });
  }
};
```

---

### Next.js Webhook Validation

The webhook validates the broker subdomain against the database:

```typescript
// In /api/webhooks/email-inbound
const brokerSubdomain = request.headers.get('x-broker-subdomain');

// Lookup broker by subdomain
const { data: broker, error } = await supabase
  .from('broker_branding')
  .select('broker_id, subdomain, inbox_id')
  .eq('subdomain', brokerSubdomain)
  .single();

if (error || !broker) {
  // Subdomain doesn't exist - reject email
  return NextResponse.json(
    { error: 'Broker not found' },
    { status: 404 }
  );
}

// Continue processing with broker.broker_id
```

---

## Broker Onboarding Flow

### 1. Broker Signs Up

```typescript
// POST /api/broker/register
{
  "email": "admin@smithbrokers.co.nz",
  "password": "securepass123",
  "companyName": "Smith Brokers Ltd",
  "desiredSubdomain": "smithbrokers" // Broker chooses
}
```

### 2. System Validates Subdomain

```typescript
// Check subdomain availability
const { data: existing } = await supabase
  .from('broker_branding')
  .select('subdomain')
  .eq('subdomain', 'smithbrokers')
  .single();

if (existing) {
  return { error: 'Subdomain already taken' };
}

// Validate subdomain format
const isValid = /^[a-z0-9-]{3,30}$/.test('smithbrokers');
if (!isValid) {
  return { error: 'Invalid subdomain format' };
}
```

**Subdomain Rules:**
- Length: 3-30 characters
- Characters: lowercase letters, numbers, hyphens only
- No leading/trailing hyphens
- No consecutive hyphens
- Must be unique across all brokers

### 3. Create Broker Record

```typescript
// Create broker
const { data: broker } = await supabase
  .from('brokers')
  .insert({
    company_name: 'Smith Brokers Ltd',
    contact_email: 'admin@smithbrokers.co.nz',
  })
  .select()
  .single();

// Create branding (includes subdomain)
const { data: branding } = await supabase
  .from('broker_branding')
  .insert({
    broker_id: broker.id,
    subdomain: 'smithbrokers',
    primary_color: '#2563EB',
    secondary_color: '#1E40AF',
  })
  .select()
  .single();

// Create email inbox
const { data: inbox } = await supabase
  .from('email_inboxes')
  .insert({
    broker_id: broker.id,
    inbox_email: `documents@smithbrokers.insuredin.app`,
    is_active: true,
  })
  .select()
  .single();
```

### 4. Broker Sees Email Address

```
✅ Your broker portal is ready!

Portal URL: https://smithbrokers.insuredin.app
Email Address: documents@smithbrokers.insuredin.app

To process policy documents automatically:
1. Ask insurers to BCC: documents@smithbrokers.insuredin.app
2. Or forward emails to: documents@smithbrokers.insuredin.app
3. Review and approve in your broker dashboard

No DNS setup required - your email address is active immediately!
```

---

## Security Considerations

### 1. Subdomain Validation (Critical)

**Threat:** Attacker sends email to fake subdomain (e.g., `evil@fakebroker.insuredin.app`)

**Mitigation:**
```typescript
// In webhook handler
const broker = await supabase
  .from('broker_branding')
  .select('broker_id')
  .eq('subdomain', brokerSubdomain)
  .single();

if (!broker) {
  // Log potential attack
  console.error('SECURITY: Email to non-existent subdomain', {
    subdomain: brokerSubdomain,
    senderEmail,
    timestamp: new Date().toISOString(),
  });
  
  // Reject email (no processing)
  return NextResponse.json(
    { error: 'Broker not found' },
    { status: 404 }
  );
}
```

### 2. Rate Limiting Per Subdomain

```typescript
// Limit: 100 emails per subdomain per hour
const { count } = await supabase
  .from('email_processing_transactions')
  .select('id', { count: 'exact', head: true })
  .eq('broker_id', broker.id)
  .gte('received_at', oneHourAgo);

if (count >= 100) {
  console.error('SECURITY: Rate limit exceeded', {
    broker_id: broker.id,
    subdomain: brokerSubdomain,
  });
  
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

### 3. Subdomain Reservation

**Prevent abuse:**

```typescript
// Reserved subdomains (cannot be used by brokers)
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'app', 'mail', 'email',
  'staging', 'dev', 'test', 'demo', 'sandbox',
  'support', 'help', 'docs', 'blog', 'status',
  'cloudflare', 'vercel', 'insuredin', 'system',
];

function isSubdomainReserved(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase());
}
```

---

## Database Schema

### broker_branding Table

```sql
CREATE TABLE broker_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  subdomain TEXT UNIQUE NOT NULL, -- e.g., 'smithbrokers'
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  secondary_color TEXT DEFAULT '#1E40AF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9-]{3,30}$'),
  CONSTRAINT subdomain_no_leading_hyphen CHECK (subdomain !~ '^-'),
  CONSTRAINT subdomain_no_trailing_hyphen CHECK (subdomain !~ '-$')
);

-- Index for fast lookups
CREATE INDEX idx_broker_branding_subdomain ON broker_branding(subdomain);

-- RLS Policy: Brokers can only see their own branding
CREATE POLICY "broker_own_branding" ON broker_branding
  FOR ALL
  USING (
    broker_id IN (
      SELECT broker_id FROM broker_users WHERE user_id = auth.uid()
    )
  );
```

### email_inboxes Table

```sql
CREATE TABLE email_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  inbox_email TEXT UNIQUE NOT NULL, -- Full email: documents@smithbrokers.insuredin.app
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT email_format CHECK (inbox_email ~ '^[^@]+@[^@]+\.insuredin\.app$')
);

-- Index for webhook lookups
CREATE INDEX idx_email_inboxes_broker ON email_inboxes(broker_id);
```

---

## Cloudflare Dashboard Setup (One-Time)

### Step 1: Enable Email Routing

1. Log in to Cloudflare Dashboard
2. Select domain: `insuredin.app`
3. Go to **Email** → **Email Routing**
4. Click **Get Started**
5. Follow wizard to add MX records

### Step 2: Add Wildcard DNS

1. Go to **DNS** → **Records**
2. Click **Add Record**

**MX Records:**
```
Type: MX
Name: *
Priority: 10
Mail server: route1.mx.cloudflare.net

Type: MX
Name: *
Priority: 20
Mail server: route2.mx.cloudflare.net

Type: MX
Name: *
Priority: 30
Mail server: route3.mx.cloudflare.net
```

**SPF Record:**
```
Type: TXT
Name: *
Content: v=spf1 include:_spf.mx.cloudflare.net ~all
```

### Step 3: Configure Catch-All Rule

1. Go to **Email** → **Email Routing** → **Routing Rules**
2. Enable **Catch-all address**
3. Action: **Send to a Worker**
4. Worker: Select `insuredin-email-worker`
5. Click **Save**

**Result:** All emails to `*@*.insuredin.app` route through the Email Worker.

---

## Testing Subdomain Routing

### Test Case 1: Valid Broker Subdomain

```bash
# Create test broker in database
INSERT INTO brokers (id, company_name) 
VALUES ('test-broker-id', 'Test Brokers Ltd');

INSERT INTO broker_branding (broker_id, subdomain) 
VALUES ('test-broker-id', 'testbroker');

INSERT INTO email_inboxes (broker_id, inbox_email) 
VALUES ('test-broker-id', 'documents@testbroker.insuredin.app');

# Send test email
echo "Test policy document" | mail -s "Test Policy" \
  -a test-policy.pdf \
  documents@testbroker.insuredin.app

# Expected: Email processed successfully
```

### Test Case 2: Invalid Broker Subdomain

```bash
# Send email to non-existent subdomain
echo "Test" | mail -s "Test" \
  documents@nonexistent.insuredin.app

# Expected: 404 Broker not found (logged as security event)
```

### Test Case 3: Multiple Brokers

```bash
# Create two brokers
INSERT INTO broker_branding (subdomain) VALUES ('broker1'), ('broker2');

# Send emails to both
mail documents@broker1.insuredin.app
mail documents@broker2.insuredin.app

# Expected: Both processed independently, correct broker_id assigned
```

---

## Monitoring & Alerts

### Key Metrics

1. **Invalid Subdomain Attempts**
   - Alert: >10 per hour
   - Indicates potential attack or misconfiguration

2. **Email Processing by Subdomain**
   - Track emails per broker
   - Identify high-volume brokers

3. **Database Lookup Performance**
   - Alert: >100ms p95
   - Optimise with indexes/caching

### Vercel Logs

```bash
# Failed subdomain lookups
vercel logs --follow | grep "SECURITY: Email to non-existent subdomain"

# Successful processing by broker
vercel logs --follow | grep "Email processed successfully" | grep "smithbrokers"
```

---

## Broker Dashboard Features

### Subdomain Management UI

```typescript
// /broker/settings/email

<Card>
  <CardHeader>
    <CardTitle>Email Routing</CardTitle>
  </CardHeader>
  <CardContent>
    <div>
      <Label>Your Email Address</Label>
      <div className="flex gap-2">
        <Input 
          value="documents@smithbrokers.insuredin.app" 
          readOnly 
        />
        <Button variant="outline">
          <Copy className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        BCC or forward policy documents to this address for automatic processing.
      </p>
    </div>
    
    <div className="mt-4">
      <Label>Custom Email Addresses</Label>
      <p className="text-sm text-muted-foreground mb-2">
        Coming soon: Create multiple email addresses (e.g., invoices@, claims@)
      </p>
    </div>
    
    <div className="mt-4">
      <Button variant="outline">
        View Email Instructions →
      </Button>
    </div>
  </CardContent>
</Card>
```

---

## Future Enhancements

- [ ] Support multiple email addresses per broker (e.g., `invoices@`, `claims@`)
- [ ] Allow broker to change subdomain (with redirect from old)
- [ ] Custom domains (e.g., `documents@portal.smithbrokers.co.nz`)
- [ ] Email aliases (e.g., `docs@` → `documents@`)
- [ ] Subdomain analytics dashboard
- [ ] Automatic subdomain suggestions if desired one is taken

---

## Comparison: Manual vs Wildcard Approach

| Feature | Manual Provisioning | Wildcard + Worker (Our Choice) |
|---------|-------------------|--------------------------------|
| Setup Time | ~5 minutes per broker | One-time (10 minutes total) |
| Broker Onboarding | Manual Cloudflare access | Instant (via InsuredIn UI) |
| Scalability | Limited (manual work) | Unlimited (automated) |
| Security | Per-subdomain isolation | Database validation required |
| Maintenance | High (per broker) | Low (one worker) |
| Cost | $0 | $0 |
| DNS Changes | Per broker | One-time wildcard |
| **Recommendation** | ❌ Not suitable | ✅ Optimal for MVP |

---

## Production Checklist

Before enabling subdomain email routing:

- [ ] Set up wildcard DNS records (`*.insuredin.app`)
- [ ] Deploy Email Worker with subdomain extraction
- [ ] Configure catch-all rule pointing to worker
- [ ] Add subdomain validation in webhook
- [ ] Implement rate limiting per subdomain
- [ ] Reserve system subdomains (www, api, admin, etc.)
- [ ] Test with multiple broker subdomains
- [ ] Set up monitoring alerts
- [ ] Document broker onboarding process
- [ ] Create broker email instructions template

---

**Status:** Ready for implementation  
**Complexity:** Medium  
**Implementation Time:** 6-8 hours  
**Testing Time:** 2-3 hours  
**Maintenance:** Low

---

**Last Updated:** January 2026  
**Next Review:** After MVP launch
