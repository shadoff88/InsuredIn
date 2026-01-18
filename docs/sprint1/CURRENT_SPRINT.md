# InsuredIn Current Sprint

## Sprint: Week 5-6 — Client Portal Core
**Sprint Goal:** Client can view all policies, documents, and unpaid invoices

**Start Date:** 2026-01-16  
**End Date:** 2026-01-29  
**Status:** 🟡 In Progress

---

## Priority 0: Unblock Previous Sprint

These tasks must be completed first — they unblock both the Email BCC hero feature (Week 3-4) and document downloads (Week 5-6).

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| TASK-000A | Cloudflare R2 bucket setup | 🔴 Not Started | DevOps | Required for document storage |
| TASK-000B | Cloudflare Email Worker deployment | 🔴 Not Started | DevOps | Required for BCC processing |

**Sprint Strategy:** Complete TASK-000A and TASK-000B in Days 1-2, then proceed with Client Portal tasks.

---

## Sprint Tasks

### TASK-000A: Cloudflare R2 Bucket Setup
**Agent Role:** DevOps Agent  
**Priority:** P0 (BLOCKER)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 2 hours

**Description:**  
Set up Cloudflare R2 bucket for document storage. This unblocks both the Email BCC processing (Week 3-4) and client document downloads (Week 5-6).

**Acceptance Criteria:**
- [ ] R2 bucket created in Cloudflare dashboard (name: `insuredin-documents`)
- [ ] CORS policy configured to allow requests from app domain
- [ ] Public access disabled (signed URLs only)
- [ ] Environment variables added to Vercel:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - `CLOUDFLARE_R2_BUCKET_NAME`
- [ ] R2 client utility created in codebase
- [ ] Upload function tested (upload PDF, retrieve signed URL)
- [ ] Delete function implemented (for cleanup)

**Files to Create:**
```
src/lib/storage/r2-client.ts
src/lib/storage/upload-document.ts
src/lib/storage/get-signed-url.ts
tests/integration/r2-upload.test.ts
```

**R2 Client Implementation:**
```typescript
// src/lib/storage/r2-client.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});
```

**CORS Policy for R2:**
```json
[
  {
    "AllowedOrigins": [
      "https://insuredin.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

**Dependencies:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Verification:**
- [ ] Can upload a test PDF via API
- [ ] Can generate signed URL that allows download
- [ ] Signed URL expires after configured time (default: 1 hour)
- [ ] Unauthorised access to bucket is blocked

---

### TASK-000B: Cloudflare Email Worker Deployment
**Agent Role:** DevOps Agent  
**Priority:** P0 (BLOCKER)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 3-4 hours

**Description:**  
Deploy Cloudflare Email Worker to receive BCC emails and trigger document processing. This completes the Email BCC hero feature from Week 3-4.

**Acceptance Criteria:**
- [ ] Email Routing enabled in Cloudflare dashboard
- [ ] Custom email address configured: `documents@[subdomain].insuredin.app`
- [ ] Email Worker script deployed
- [ ] Worker extracts attachments and saves to R2
- [ ] Worker creates `email_processing_transactions` record in Supabase
- [ ] Worker triggers AI extraction (or queues for processing)
- [ ] Environment variables configured in Cloudflare:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `R2_BUCKET_NAME`
- [ ] Error handling: Invalid emails logged, not crash worker
- [ ] Test email sent and processed successfully

**Files to Create:**
```
workers/email-processor/
├── src/
│   ├── index.ts          (main worker entry)
│   ├── email-parser.ts   (parse email, extract attachments)
│   ├── r2-upload.ts      (save attachments to R2)
│   └── supabase.ts       (create transaction record)
├── wrangler.toml         (Cloudflare config)
├── package.json
└── tsconfig.json
```

**Worker Entry Point:**
```typescript
// workers/email-processor/src/index.ts
import { EmailMessage } from '@cloudflare/workers-types';

export default {
  async email(message: EmailMessage, env: Env): Promise<void> {
    try {
      // 1. Parse email
      const { from, to, subject, attachments } = await parseEmail(message);
      
      // 2. Determine broker from 'to' address
      const brokerId = await getBrokerIdFromEmail(to, env);
      if (!brokerId) {
        console.log(`Unknown recipient: ${to}`);
        return;
      }
      
      // 3. Save attachments to R2
      const savedAttachments = await saveAttachmentsToR2(
        attachments, 
        brokerId, 
        env
      );
      
      // 4. Create email_processing_transaction record
      const transactionId = await createTransaction({
        brokerId,
        fromEmail: from,
        toEmail: to,
        subject,
        attachments: savedAttachments,
        status: 'pending',
      }, env);
      
      // 5. Trigger AI extraction (async)
      await env.AI_EXTRACTION_QUEUE.send({ transactionId });
      
      console.log(`Processed email: ${transactionId}`);
    } catch (error) {
      console.error('Email processing failed:', error);
      // Don't throw - prevents email bounce
    }
  },
};
```

**Wrangler Configuration:**
```toml
# workers/email-processor/wrangler.toml
name = "insuredin-email-processor"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[r2_buckets]]
binding = "DOCUMENTS_BUCKET"
bucket_name = "insuredin-documents"

# Email routing
[[email_triggers]]
addresses = ["documents@*.insuredin.app"]
```

**Cloudflare Dashboard Steps:**
1. Go to Email > Email Routing
2. Enable Email Routing for domain
3. Create catch-all rule → Route to Worker
4. Deploy worker via `wrangler deploy`

**Alternative (Simpler MVP):**
If Email Worker is complex, implement webhook-based approach:
- Use Cloudflare Email Routing to forward to a webhook endpoint
- Create `/api/webhooks/email-inbound` to receive forwarded emails
- Process in Next.js API route instead of Worker

**Verification:**
- [ ] Send test email to `documents@test.insuredin.app`
- [ ] Attachment appears in R2 bucket
- [ ] Record created in `email_processing_transactions` table
- [ ] Status shows "pending" initially
- [ ] AI extraction triggered (check logs)

---

### TASK-001: Client Dashboard
**Agent Role:** Frontend Agent  
**Priority:** P0 (Critical)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 4 hours

**Description:**  
Build the main client dashboard with summary cards and quick actions.

**Acceptance Criteria:**
- [ ] Summary card: Active policies count + total coverage
- [ ] Summary card: Unpaid invoices with total amount due
- [ ] Summary card: Recent documents (last 5)
- [ ] Quick action buttons: Request Change, Lodge Claim, Contact Broker
- [ ] Mobile-first layout (375px breakpoint first)
- [ ] Bottom tab navigation (Dashboard, Policies, Documents, Claims, Profile)
- [ ] Loads in <2s on mobile LTE
- [ ] Skeleton loading states while data fetches

**Files to Create/Modify:**
```
src/app/(client)/dashboard/page.tsx
src/components/client/dashboard-summary-card.tsx
src/components/client/recent-documents-list.tsx
src/components/client/quick-actions.tsx
src/components/client/bottom-nav.tsx
```

**API Dependencies:**
- GET /api/client/dashboard (new - aggregated data)

**Design Reference:**
```
┌─────────────────────────────────┐
│  Welcome, John Smith            │
├─────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────┐ │
│ │ 3       │ │ $850 due        │ │
│ │ Active  │ │ in 14 days      │ │
│ │ Policies│ │ [View →]        │ │
│ └─────────┘ └─────────────────┘ │
├─────────────────────────────────┤
│ Recent Documents                │
│ • Policy Schedule (2 days ago)  │
│ • Invoice (5 days ago)          │
│ [View All →]                    │
├─────────────────────────────────┤
│ [📝 Request] [🛡️ Claim] [💬 Contact] │
├─────────────────────────────────┤
│ 🏠   📋   📄   🛡️   👤          │
│ Home Policies Docs Claims Profile│
└─────────────────────────────────┘
```

---

### TASK-002: Client Dashboard API
**Agent Role:** Backend Agent  
**Priority:** P0 (Critical)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 2 hours

**Description:**  
Create aggregated API endpoint for client dashboard data.

**Acceptance Criteria:**
- [ ] GET /api/client/dashboard returns aggregated data
- [ ] Includes: policy count, total coverage, unpaid invoice total, recent docs
- [ ] RLS enforced (client sees only their data)
- [ ] Response <500ms (p95)
- [ ] Proper error handling with try/catch
- [ ] TypeScript types for response

**Response Schema:**
```typescript
interface DashboardResponse {
  client: {
    id: string;
    fullName: string;
  };
  policies: {
    activeCount: number;
    totalCoverage: number;
  };
  invoices: {
    unpaidCount: number;
    totalDue: number;
    nextDueDate: string | null;
  };
  recentDocuments: Array<{
    id: string;
    fileName: string;
    documentType: string;
    createdAt: string;
    policyNumber: string;
  }>;
}
```

**Files to Create:**
```
src/app/api/client/dashboard/route.ts
src/lib/types/client-dashboard.ts
```

---

### TASK-003: Policy List View
**Agent Role:** Frontend Agent  
**Priority:** P0 (Critical)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 3 hours

**Description:**  
Build the policy list page showing all client policies.

**Acceptance Criteria:**
- [ ] Display policy cards with: insurer logo, policy type, status badge, period
- [ ] Filter tabs: All, Active, Expired
- [ ] Search by policy number or insurer
- [ ] Tap card → navigate to policy detail
- [ ] Empty state if no policies
- [ ] Mobile-optimised (cards stack vertically)
- [ ] Keyboard accessible (Tab navigation)

**Files to Create/Modify:**
```
src/app/(client)/policies/page.tsx
src/components/client/policy-card.tsx
src/components/client/policy-filters.tsx
```

**API Dependencies:**
- GET /api/client/policies (may exist, verify)

---

### TASK-004: Policy List API
**Agent Role:** Backend Agent  
**Priority:** P0 (Critical)  
**Status:** 🟡 Verify Existing  
**Estimated Effort:** 1-2 hours

**Description:**  
Verify or create API endpoint for client policy list.

**Acceptance Criteria:**
- [ ] GET /api/client/policies returns all client policies
- [ ] Include: policy_number, insurer, policy_type, status, period_start, period_end, sum_insured, premium_annual
- [ ] Filter by status query param (?status=active)
- [ ] RLS enforced
- [ ] Response <500ms

**Files to Create/Verify:**
```
src/app/api/client/policies/route.ts
```

---

### TASK-005: Policy Detail View
**Agent Role:** Frontend Agent  
**Priority:** P0 (Critical)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 5 hours

**Description:**  
Build comprehensive policy detail page with NZ-specific features.

**Acceptance Criteria:**
- [ ] Overview section: insurer, period, premium, sum insured, status badge
- [ ] Risk items accordion (properties/vehicles with individual details)
- [ ] Premium breakdown panel (NZ-specific transparency)
- [ ] Natural Hazards panel (NZ-specific education)
- [ ] Documents list with download buttons
- [ ] Action buttons: Lodge Claim, Request Change
- [ ] Breadcrumb navigation (Policies > Policy Detail)
- [ ] Mobile-optimised layout

**Files to Create:**
```
src/app/(client)/policies/[id]/page.tsx
src/components/client/policy-overview.tsx
src/components/client/risk-items-accordion.tsx
src/components/client/premium-breakdown.tsx
src/components/client/natural-hazards-panel.tsx
src/components/client/policy-documents-list.tsx
```

**API Dependencies:**
- GET /api/client/policies/[id] (with full details)

---

### TASK-006: Policy Detail API
**Agent Role:** Backend Agent  
**Priority:** P0 (Critical)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 2 hours

**Description:**  
Create API endpoint for full policy details including risk items and premium breakdown.

**Acceptance Criteria:**
- [ ] GET /api/client/policies/[id] returns complete policy data
- [ ] Include: policy details, risk_items, premium_breakdown, documents
- [ ] RLS enforced (client can only access their policies)
- [ ] 404 if policy not found or not owned by client
- [ ] Response <500ms

**Response includes:**
```typescript
interface PolicyDetailResponse {
  policy: Policy;
  riskItems: RiskItem[];
  premiumBreakdown: PremiumBreakdown | null;
  documents: Document[];
}
```

**Files to Create:**
```
src/app/api/client/policies/[id]/route.ts
```

---

### TASK-007: Document Library
**Agent Role:** Frontend Agent  
**Priority:** P1 (High)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 3 hours

**Description:**  
Build document library page with filtering and PDF viewing.

**Acceptance Criteria:**
- [ ] List all client documents grouped by policy
- [ ] Filter by document type (Policy Schedule, Invoice, Certificate, etc.)
- [ ] Search by filename
- [ ] PDF viewer modal (in-app, mobile-optimised)
- [ ] Download button for each document
- [ ] Show upload date and file size
- [ ] Empty state if no documents

**Files to Create:**
```
src/app/(client)/documents/page.tsx
src/components/client/document-list.tsx
src/components/client/document-filters.tsx
src/components/client/pdf-viewer-modal.tsx
```

**API Dependencies:**
- GET /api/client/documents

---

### TASK-008: Documents API
**Agent Role:** Backend Agent  
**Priority:** P1 (High)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 2 hours

**Description:**  
Create API endpoint for client document list with filtering.

**Acceptance Criteria:**
- [ ] GET /api/client/documents returns all client documents
- [ ] Filter by document_type query param
- [ ] Filter by policy_id query param
- [ ] Include: filename, document_type, storage_url, size_bytes, created_at, policy info
- [ ] RLS enforced
- [ ] Signed URLs for R2 document access (or proxy endpoint)

**Files to Create:**
```
src/app/api/client/documents/route.ts
src/app/api/client/documents/[id]/download/route.ts (signed URL generation)
```

---

### TASK-009: Unpaid Invoices Widget & Page
**Agent Role:** Frontend Agent  
**Priority:** P1 (High)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 2 hours

**Description:**  
Build invoice display showing unpaid amounts and due dates.

**Acceptance Criteria:**
- [ ] Dashboard widget showing total due and next due date
- [ ] Full invoices page with all invoices
- [ ] Status badges: Unpaid (yellow), Overdue (red), Paid (green)
- [ ] Days until due / days overdue display
- [ ] Link to invoice PDF
- [ ] "Pay Now" button (links to broker contact for MVP)

**Files to Create:**
```
src/app/(client)/invoices/page.tsx
src/components/client/invoice-card.tsx
src/components/client/invoices-widget.tsx
```

**API Dependencies:**
- GET /api/client/invoices

---

### TASK-010: Invoices API
**Agent Role:** Backend Agent  
**Priority:** P1 (High)  
**Status:** 🔴 Not Started  
**Estimated Effort:** 1.5 hours

**Description:**  
Create API endpoint for client invoices.

**Acceptance Criteria:**
- [ ] GET /api/client/invoices returns all client invoices
- [ ] Filter by status query param (?status=unpaid)
- [ ] Include computed fields: amount_outstanding, days_until_due
- [ ] RLS enforced
- [ ] Response <500ms

**Files to Create:**
```
src/app/api/client/invoices/route.ts
```

---

## Sprint Schedule

| Day | Focus | Tasks |
|-----|-------|-------|
| **Day 1** | **Unblock: R2 Storage** | TASK-000A |
| **Day 2** | **Unblock: Email Worker** | TASK-000B |
| Day 3 | Backend APIs | TASK-002, TASK-004, TASK-006 |
| Day 4-5 | Dashboard & Policy List | TASK-001, TASK-003 |
| Day 6-7 | Policy Detail (complex) | TASK-005 |
| Day 8 | Documents | TASK-007, TASK-008 |
| Day 9-10 | Invoices + Polish | TASK-009, TASK-010, bug fixes |

**Note:** If TASK-000A/B take longer, Client Portal UI work can proceed with mock data.

---

## Definition of Done (All Tasks)

**Functionality:**
- [ ] Works on mobile (375px width)
- [ ] Works on desktop (1920px width)
- [ ] Error states handled
- [ ] Loading states shown

**Code Quality:**
- [ ] TypeScript strict mode (no `any`)
- [ ] Zod validation on API inputs
- [ ] try/catch on all async operations

**Accessibility:**
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] 4.5:1 contrast ratio

**Testing:**
- [ ] Unit tests for utilities
- [ ] API route tests
- [ ] Manual mobile device test

---

## Session Primer for Claude Code

Copy and paste this at the start of your Claude Code session:

```
I'm working on InsuredIn - a white-labelled client portal for NZ insurance brokers.

PROJECT CONTEXT:
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (PostgreSQL + Auth)
- Cloudflare R2 (document storage) + Email Workers (BCC processing)
- Deployed at: https://insuredin.vercel.app

KEY DOCUMENTATION:
- docs/1_PROJECT_SPECIFICATION.md (features)
- docs/2_DATABASE_SCHEMA.md (database tables)
- docs/5_AGENT_COORDINATION.md (development standards)
- docs/6_DEVELOPMENT_ROADMAP.md (sprint plan)
- CURRENT_SPRINT.md (this sprint's tasks)

CURRENT SPRINT: Week 5-6 (Client Portal Core)
SPRINT GOAL: Unblock infrastructure, then build client portal

PRIORITY ORDER:
1. TASK-000A: Cloudflare R2 bucket setup (BLOCKER)
2. TASK-000B: Cloudflare Email Worker deployment (BLOCKER)
3. Then proceed with Client Portal tasks (TASK-001 onwards)

DEVELOPMENT PRINCIPLES:
1. Mobile-first (375px width first, then enhance for desktop)
2. TypeScript strict mode, no `any` types
3. All API calls wrapped in try/catch
4. RLS enforced on all Supabase queries
5. WCAG 2.1 AA accessibility (ARIA labels, keyboard nav, 4.5:1 contrast)
6. Use shadcn/ui components
7. 48x48px minimum touch targets

TODAY I WANT TO WORK ON: TASK-000A (Cloudflare R2 Bucket Setup)

Please read CURRENT_SPRINT.md for full task details, then implement following the acceptance criteria.
```

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| R2 not configured (documents won't download) | High | High | Use placeholder/mock data until BLOCK-001 resolved |
| Client auth flow untested | Medium | High | Test invite → register → login flow early |
| Premium breakdown data missing | Medium | Medium | Seed realistic NZ premium data |
| Mobile performance issues | Low | Medium | Test on real device mid-sprint |

---

## Notes for Overseer

**Handoff from Week 3-4:**
- Broker email inbox UI complete
- API routes for email processing complete
- Client-facing work starts now

**Key Decisions Needed:**
1. Confirm R2 bucket setup timeline (blocks document downloads)
2. Decide: Should "Pay Now" link to Stripe or broker contact for MVP?
3. Confirm: Natural Hazards panel content approved?

---

**Generated by:** Overseer Agent (Claude.ai)  
**Date:** 2026-01-17  
**Next Update:** After Day 2 standup
