# 1. Project Specification

## Project Overview

**InsuredIn** is a white-labeled client portal for insurance brokers that integrates with existing broker CRM systems (Folio, Steadfast Insight). The core innovation is AI-powered email document processing that allows brokers to BCC policy documents to an email address, where AI extracts metadata, the broker reviews for accuracy, and clients immediately see documents in their portal.

**Primary Goal:** Reduce broker workload by 10+ hours/month while empowering clients with 24/7 policy access.

---

## Core Value Proposition

### For Brokers:
- **Time Savings:** BCC email → AI processes → 10-second review → Client access (vs. 3-minute manual upload)
- **Compliance:** Broker always reviews AI extractions (audit trail, legal responsibility)
- **Mobile-First:** Review documents on phone during commute
- **No Workflow Change:** Just add BCC to existing emails

### For Clients:
- **24/7 Access:** View policies, documents, lodge claims anytime
- **Transparency:** Full premium breakdown (NZ-specific)
- **Self-Service:** Download documents, request changes, track claims without calling broker

---

## Architecture

### System Components

```
Broker CRM (Folio/Insight) ← Phase 2: API Sync
         ↓
InsuredIn Middleware
├─ Email BCC Processor (Cloudflare Email Routing)
├─ AI Extraction Engine (Claude 3.5 Sonnet)
├─ Broker Review Interface (Mobile-First)
└─ Client Authentication & Portal
         ↓
Client Portal (PWA)
├─ Dashboard (Policies, Documents, Claims)
├─ Premium Breakdown (NZ Compliance)
├─ Natural Hazards Panel (NZ Compliance)
├─ Claims Lodgement
└─ Service Requests (JotForm Integration)
```

---

## User Roles & Permissions

### 1. Broker User
**Access:** Broker interface only

**Can:**
- Review AI-extracted documents (approve/reject)
- Upload documents manually
- Configure white-label branding
- Configure email inbox settings
- View client portal analytics
- Configure form integrations (JotForm, FormsByAir)
- Preview client view

**Cannot:**
- Access other brokers' data (RLS enforced)
- Bypass review workflow (all extractions require approval)

---

### 2. Client User
**Access:** Client portal only (their brokerage's white-labeled subdomain)

**Can:**
- View their policies
- Download documents
- Lodge claims (with photos)
- Submit service requests (via JotForm)
- View unpaid invoices
- Update profile
- Download their data (Privacy Act compliance)

**Cannot:**
- See other clients' data (RLS enforced)
- Access broker interface
- Upload documents (broker-controlled)

---

## Core Features

### 1. Email BCC Document Processing ⭐ HERO FEATURE

**Workflow:**
```
1. Insurer emails policy schedule to broker@brokerage.com
2. Broker forwards/BCCs to: documents@portal.brokername.com
3. Cloudflare Email Worker receives email
4. Attachments saved to R2 storage
5. Background job: Claude AI extracts metadata
   • client_number (priority 1)
   • policy_number
   • document_type
   • Confidence scoring per field
6. System suggests client + policy match
7. Status: "Awaiting Broker Review"
8. Broker receives email notification
9. Broker reviews on mobile/desktop (split-view: PDF | AI suggestions)
10. Broker approves OR corrects + approves
11. Document published to client portal
12. Client receives email notification
13. Learning feedback tracked (was AI correct?)
```

**Why Broker Review is Mandatory:**
- **Legal:** Broker liable for incorrect info shown to client
- **Compliance:** Audit trail required (who approved, when, what changed)
- **Accuracy:** AI 90% accurate today, broker catches 10% errors
- **Learning:** Broker corrections improve AI prompts over time

**Technical Implementation:**
- Cloudflare Email Routing (free tier)
- Claude 3.5 Sonnet API for extraction
- PostgreSQL stores extraction results + broker decisions
- Learning model: Track AI accuracy, identify patterns in errors

---

### 2. Broker Review Interface (Mobile-First)

**Mobile View:**
```
[PDF Thumbnail - Tap to view full]

AI EXTRACTED:
✓ Client: John Smith (AKL-12345)  95% confident
  [Change ▼]

✓ Policy: DPK 5719028  98% confident
  [Change ▼]

✓ Document Type: Policy Schedule  99% confident
  [Change ▼]

[View Full PDF]

[❌ Reject] [✅ Approve & Publish]
```

**Desktop View:**
```
Split-screen:
LEFT: PDF preview (zoomable)
RIGHT: AI extraction form (editable dropdowns)

[❌ Reject] [✅ Approve & Publish]
```

**Key Features:**
- Responds in <1 second (PDF thumbnails cached)
- Touch-optimized (48x48px targets)
- Keyboard accessible (Tab navigation)
- Works offline (PWA - queues approval for sync)

---

### 3. Client Portal

#### Dashboard
```
Welcome, John Smith

[Active Policies Card]
3 policies | $2.5M coverage
[View All →]

[Unpaid Invoices Card]
$850 due in 14 days
[View Details →]

[Recent Documents]
• Policy Schedule (2 days ago)
• Invoice (5 days ago)
[View All →]

[Quick Actions]
[📝 Request Change] [🛡️ Lodge Claim] [💬 Contact Broker]
```

#### Policy Detail
```
🏠 Residential Home Insurance
Policy #DPK 5719028 | ● Active

OVERVIEW
Insurer: Vero Insurance
Period: 01 Sep 2025 - 01 Sep 2026
Premium: $4,850/year
Sum Insured: $2,582,674

[View Premium Breakdown →]

PROPERTIES COVERED (2)
▼ 16 Deerness Cr, Algies Bay
  Sum Insured: $1,031,000
  Excess: $400 base / $5,000 natural disaster

▼ 4 Northumberland Ave, North Shore
  Sum Insured: $1,551,674
  Excess: $500 base / $5,000 natural disaster

DOCUMENTS (5)
📄 Policy Schedule (15 Dec 2025)
📄 Policy Wording (15 Dec 2025)
📄 Certificate of Currency (15 Dec 2025)
📄 Invoice (01 Dec 2025)
📄 Renewal Notice (15 Nov 2025)

[Lodge Claim] [Request Change]
```

---

### 4. Premium Breakdown (NZ-Specific) 🇳🇿

**Transparency Feature:**
```
💰 PREMIUM BREAKDOWN

Base Premium:              $3,600
Natural Hazard Loading:    $800 (Zone 3)
  ℹ️ Why this charge? Your property is in Natural
     Hazards Commission Zone 3 (higher earthquake risk)

Claims History Adjustment: $0
  ℹ️ No claims in past 3 years ✓

Voluntary Excess Discount: -$200
────────────────────────────────
Subtotal:                  $4,200
GST (15%):                 $630
Fire Service Levy:         $20
────────────────────────────────
TOTAL:                     $4,850

📊 Change from last year: +8% (+$340)
    Main reason: Natural hazard re-rating (+$300)
```

**Why This Matters:**
- NO other NZ broker portal shows this level of detail
- Clients understand why premiums increase
- Reduces "why did my premium go up?" phone calls
- CoFI compliance (transparent pricing)

---

### 5. Natural Hazards Panel (NZ-Specific) 🇳🇿

**Education Feature:**
```
⚠️ NATURAL HAZARDS COVERAGE
   Toka Tū Ake / Natural Hazards Commission

Your property is automatically covered for:
✅ Earthquake damage
✅ Natural landslip
✅ Volcanic eruption
✅ Tsunami
✅ Storm and flood (limited land cover)

💰 HOW EXCESSES WORK:
NHC Excess:    $500 (government, fixed)
Your Excess:   $5,000 (your insurer)

Example: Earthquake damages your home
You pay: $500 (NHC) + $5,000 (insurer) = $5,500 total

[🔗 Visit Natural Hazards Portal]
[📄 Download Coverage Guide]
```

**Why This Matters:**
- Natural Hazards Insurance Act 2024 compliance
- Clients confused about dual-excess system
- Reduces misunderstandings during claims

---

### 6. Claims Lodgement

**Client Flow (Mobile-Optimized):**
```
STEP 1: Select Policy
Which policy is this claim for?
○ Residential Home (DPK 5719028)
● Motor Insurance (POL-98765)

[Next]

STEP 2: Incident Details
Incident Type: [Dropdown: Vehicle Damage ▼]
Date: [Date Picker: 10/01/2026]
Description: [Text Area]

STEP 3: Photos
[Upload up to 10 photos]
[📷 Take Photo] [📁 Choose Files]

• photo1.jpg (2.3 MB) [Remove]
• photo2.jpg (1.8 MB) [Remove]

[Submit Claim]

CONFIRMATION:
✅ Claim Lodged

Claim #CLM-2026-00123
Status: Submitted

Your broker has been notified and will review
within 1 business day.

[Track Claim] [Back to Dashboard]
```

**Broker Receives Email:**
```
Subject: 🛡️ Claim Lodged: John Smith - Motor Insurance

Client: John Smith (AKL-12345)
Policy: Motor Insurance (POL-98765)

Incident Type: Vehicle Damage
Date: 10 Jan 2026
Description: Rear-ended at traffic light

Photos: 3 attached

View full details: https://portal.brokername.com/broker/claims/abc123

To update status, reply to this email with:
BCC: claims@portal.brokername.com
Subject: Status: In Progress (or Completed, Rejected)
```

**Why Email-Based for MVP:**
- Broker workflow unchanged (uses existing email)
- No CRM integration needed yet
- Fast to implement (12 weeks vs. 24 weeks)
- Phase 2: Auto-sync to Folio/Insight

---

### 7. Service Requests (JotForm Integration)

**Client Flow:**
```
REQUEST ENDORSEMENT

Step 1: Select Policy
Which policy needs updating?
● Motor Insurance (POL-98765)

[Next]

Step 2: Complete Form
[JOTFORM IFRAME EMBEDDED]

What type of change?
[Dropdown: Add driver ▼]

Driver Name: [Input]
Driver DOB: [Date Picker]
License Number: [Input]
Effective Date: [Date Picker]

[Submit Request]

CONFIRMATION:
✅ Request Submitted

Request #REQ-2026-00142
Status: Submitted

Your broker will review within 1 business day.

[Track Request] [Submit Another]
```

**JotForm Configuration (Broker Settings):**
```
SETTINGS > FORMS

Form Provider: [JotForm ▼]
               • JotForm
               • FormsByAir (coming soon)

Endorsement Requests
Form ID: [230567890123456] [Test Form]
Status: ● Active

New Policy Requests
Form ID: [230987654321098] [Test Form]
Status: ● Active

[Save Changes]
```

**Why JotForm for MVP:**
- No custom form builder needed (saves 3 weeks)
- Brokers can customize forms themselves
- Easy to add FormsByAir later (webhook abstraction layer)

---

### 8. Invoices Management

**Database Structure:**
```sql
invoices
├─ invoice_number (TEXT)
├─ issue_date (DATE)
├─ due_date (DATE)
├─ amount_total (DECIMAL)
├─ amount_paid (DECIMAL)
├─ amount_outstanding (COMPUTED)
├─ status (TEXT: unpaid, partial, paid, overdue)
└─ synced_from (TEXT: folio, insight, manual)
```

**Client Dashboard Widget:**
```
UNPAID INVOICES
Total Due: $850.00

⚠️ Due in 14 days
INV-2026-0042
Motor Insurance
$450.00 due Jan 28
[View Invoice] [Pay Now →]

Due in 22 days
INV-2026-0038
Residential Home
$400.00 due Feb 5
[View Invoice] [Pay Now →]
```

**Auto-Reminders (Configurable):**
```
SETTINGS > EMAIL NOTIFICATIONS

[ ✓ ] Invoice Due Reminder
      Send: 7 days before due date
      Subject: [Customize...]

[ ✓ ] Invoice Overdue Reminder
      Send: 3 days after due date
      Repeat: Every 7 days until paid
      Subject: [Customize...]

[Save Changes]
```

**Phase 2: Folio Debtor API:**
- Daily sync: Invoice status from Folio → InsuredIn
- Auto-update amounts paid
- Stop reminders when invoice paid in Folio

---

### 9. White-Label Branding

**Broker Configuration:**
```
SETTINGS > WHITE-LABEL

Company Logo
[Upload PNG/SVG (max 500KB)]
Current: [logo.png preview]

Brand Colors
Primary Color:   [#2563EB] [Color Picker]
Secondary Color: [#1E40AF] [Color Picker]

Custom Domain (Phase 2)
Subdomain: [brokerco].insuredin.app
Custom Domain: [portal.brokerco.nz] (coming soon)

Support Contact
Email: [support@brokerco.nz]
Phone: [+64 21 123 4567]

[Save Changes] [Preview Client Portal →]
```

**Dynamic Theming:**
```typescript
// Fetch branding by subdomain
const branding = await getBrandingByDomain(req.headers.host);

// Apply CSS variables
document.documentElement.style.setProperty('--primary', branding.primaryColor);
document.documentElement.style.setProperty('--secondary', branding.secondaryColor);
```

---

### 10. Compliance Features (NZ-Specific)

#### IFSO Complaints Pathway (CoFI)
```
/help/complaints

MAKING A COMPLAINT

Step 1: Contact Your Broker
Email: support@brokerco.nz
Phone: +64 21 123 4567
Expected response: 5 business days

Step 2: Escalate to Insurer
If not resolved, contact:
[Insurer Name]
Email: complaints@insurer.co.nz
Expected response: 10 business days

Step 3: Insurance & Financial Services Ombudsman
If still not resolved:
Website: www.ifso.nz
Phone: 0800 888 202
Email: info@ifso.nz

IFSO is a free, independent dispute resolution service.
```

#### Download My Data (Privacy Act Principle 6)
```
/profile/download-data

DOWNLOAD YOUR DATA

Export all your information:
[ ✓ ] Personal details
[ ✓ ] Policies
[ ✓ ] Documents
[ ✓ ] Claims history
[ ✓ ] Service requests
[ ✓ ] Login history

Format: [JSON ▼] CSV | PDF

[Generate Export]

This may take up to 60 seconds.
You'll receive a download link via email.
```

---

## Authentication & Authorization

### Broker Authentication

**MVP: Email + Password**
```typescript
// Login flow
POST /api/auth/broker/login
{
  email: "jane@brokerco.nz",
  password: "securepass123"
}

Response:
{
  token: "eyJhbGc...",
  user: {
    id: "uuid",
    brokerId: "uuid",
    email: "jane@brokerco.nz",
    role: "broker"
  }
}
```

**Phase 2: SSO (NextAuth.js)**
```typescript
// Azure AD / Entra ID
providers: [
  AzureADProvider({
    clientId: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    tenantId: process.env.AZURE_AD_TENANT_ID
  })
]

// Also support: Okta, Google Workspace, SAML 2.0
```

---

### Client Authentication

**Option 1: Invite Code + Password**
```typescript
// Broker invites client
POST /api/broker/clients/:id/invite
Response: { inviteCode: "abc123def456" }

// Client registers
GET /register?code=abc123def456
POST /api/auth/client/register
{
  inviteCode: "abc123def456",
  password: "clientpass123"
}
```

**Option 2: Federated Auth (Google, Apple, Facebook)**
```typescript
// Client clicks "Sign in with Google"
GET /api/auth/client/google
  → Redirects to Google OAuth
  → Returns with email: john@example.com

// System checks if email exists in clients table
const client = await db.clients.findOne({ email: "john@example.com" });

if (client) {
  // Link account, login
} else {
  // Error: "Please contact your broker for access"
}
```

**Security:**
- Client cannot self-register without invite code OR existing email in database
- Prevents unauthorized access

---

### Row-Level Security (RLS)

**Broker Isolation:**
```sql
-- Brokers can only see their own clients
CREATE POLICY "broker_own_clients" ON clients
  FOR ALL
  USING (
    broker_id IN (
      SELECT broker_id FROM broker_users WHERE user_id = auth.uid()
    )
  );
```

**Client Isolation:**
```sql
-- Clients can only see their own data
CREATE POLICY "client_own_policies" ON policies
  FOR SELECT
  USING (
    package_id IN (
      SELECT id FROM packages WHERE client_id IN (
        SELECT client_id FROM client_users WHERE user_id = auth.uid()
      )
    )
  );
```

---

## Non-Functional Requirements

### Performance
- **Page Load:** <2 seconds on mobile LTE
- **API Response:** <500ms (p95)
- **Email Processing:** <30 seconds from BCC to "ready for review"
- **Lighthouse Score:** >90/100

### Scalability
- **Concurrent Users:** 100+ without degradation
- **Documents Processed:** 1,000+ per day
- **Database:** Optimized for 10,000+ policies

### Security
- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Authentication:** JWT tokens with 7-day expiry
- **OWASP Top 10:** All vulnerabilities mitigated
- **Penetration Testing:** Before production launch

### Accessibility
- **WCAG 2.1 AA:** 100% compliance
- **Screen Reader:** Tested with NVDA, JAWS, VoiceOver
- **Keyboard Navigation:** Full support (Tab, Enter, Esc)
- **Touch Targets:** 48x48px minimum

### Reliability
- **Uptime:** 99.9% target (43 minutes downtime/month)
- **Backups:** Daily automated (Supabase + R2)
- **Disaster Recovery:** <4 hour RPO, <1 hour RTO

---

## Success Metrics

### Broker Metrics (MVP Launch):
- [ ] 500+ documents processed via BCC
- [ ] 90%+ AI extraction accuracy
- [ ] <30 seconds average broker review time
- [ ] 10+ hours/month saved per broker

### Client Metrics (MVP Launch):
- [ ] 80%+ client adoption (invited clients actually login)
- [ ] 60%+ mobile usage
- [ ] 50%+ reduction in phone calls to broker

### Technical Metrics (MVP Launch):
- [ ] 99.9% uptime
- [ ] <2s page load (mobile LTE)
- [ ] 100% WCAG 2.1 AA compliance
- [ ] Zero critical security vulnerabilities

---

## Out of Scope (MVP)

The following features are deferred to Phase 2 or later:

❌ **CRM Integration** (Folio/Insight API sync) - Phase 2  
❌ **Payments** (Stripe Connect for premium payments) - Phase 2  
❌ **In-App Messaging** (broker ↔ client chat) - Phase 2  
❌ **Push Notifications** (PWA notifications) - Phase 2  
❌ **Certificate Auto-Generation** (PDF generation) - Phase 2  
❌ **Advanced Claims** (expected settlement timeline) - Phase 2  
❌ **Multi-Language** (Māori support) - Phase 3  
❌ **Native Apps** (iOS/Android) - Phase 3  
❌ **Custom Form Builder** (JotForm sufficient for MVP)  

---

## Glossary

**BCC:** Blind Carbon Copy - Email recipient hidden from other recipients  
**CoFI:** Conduct of Financial Institutions Act (NZ legislation)  
**CRM:** Customer Relationship Management system  
**IFSO:** Insurance & Financial Services Ombudsman (NZ)  
**NHC:** Natural Hazards Commission / Toka Tū Ake  
**RLS:** Row-Level Security (PostgreSQL feature)  
**SSO:** Single Sign-On  
**WCAG:** Web Content Accessibility Guidelines  

---

**Version:** 1.0  
**Last Updated:** January 2026  
**Next Review:** After MVP Launch (Week 12)
