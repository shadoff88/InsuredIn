# 5. Agent Coordination & Development Workflow

## Agentic AI Development Approach

This project is designed for development by specialized AI agents working in coordination using Claude Code.

---

## Agent Team Structure

### 1. **Overseer Agent** (Coordination & Risk Management)
**Responsibilities:**
- Daily standups (9 AM NZT)
- Sprint planning & tracking
- Inter-agent coordination
- Risk identification & mitigation
- Escalate blockers to human

**Daily Standup Format:**
```
Date: 2026-01-15
Sprint: Week 3 (Email BCC Processing)

COMPLETED YESTERDAY:
- Database Agent: Email processing tables deployed
- Backend Agent: Cloudflare Email Worker configured

WORKING ON TODAY:
- Backend Agent: Claude API integration for extraction
- Frontend Agent: Broker review UI (mobile-first)

BLOCKERS:
- Need Anthropic API key (tag @human)

RISKS:
- AI extraction accuracy unknown until we test real PDFs
```

---

### 2. **Planning Agent** (Architecture & Design)
**Responsibilities:**
- System design decisions
- API specifications
- OpenAPI schema generation
- Database modeling validation
- Risk assessment

**Deliverables:**
- Architecture diagrams (Mermaid)
- API specs (OpenAPI 3.0)
- Sequence diagrams
- Risk register

---

### 3. **Database Agent** (Data Layer)
**Responsibilities:**
- Schema design & migrations
- RLS policy implementation
- Index optimization
- Query performance testing
- Seed data generation

**Key Files:**
- `supabase/migrations/*.sql`
- `supabase/seed.sql`

**Daily Tasks:**
- Create migration for new features
- Test RLS policies (no data leaks)
- Optimize slow queries (>500ms)

---

### 4. **Backend Agent** (API & Business Logic)
**Responsibilities:**
- API route implementation (Next.js)
- Business logic services
- Claude API integration
- Email processing (Cloudflare Worker)
- Background jobs (BullMQ or similar)

**Key Files:**
- `src/app/api/**/*.ts`
- `src/lib/services/**/*.ts`
- `src/lib/integrations/claude.ts`
- `workers/email-processor.ts`

**Code Standards:**
```typescript
// ALWAYS use TypeScript
// ALWAYS validate input with Zod
// ALWAYS handle errors with try/catch
// ALWAYS log to audit_logs

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    
    // Business logic here
    
    await logAudit({
      action: 'create',
      entityType: 'policy',
      userId: user.id
    });
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      { error: error.message },
      { status: error instanceof ZodError ? 400 : 500 }
    );
  }
}
```

---

### 5. **Frontend Agent** (UI/UX Implementation)
**Responsibilities:**
- Component development (React + shadcn/ui)
- Page implementation (Next.js App Router)
- Mobile-first responsive design
- Accessibility (WCAG 2.1 AA)
- State management (React hooks)

**Key Files:**
- `src/components/**/*.tsx`
- `src/app/(broker)/**/*.tsx` (broker interface)
- `src/app/(client)/**/*.tsx` (client portal)
- `src/styles/globals.css`

**Component Standards:**
```typescript
// ALWAYS mobile-first
// ALWAYS use shadcn/ui primitives
// ALWAYS add ARIA labels
// ALWAYS test with keyboard navigation

import { Button } from '@/components/ui/button';

export function PolicyCard({ policy }: Props) {
  return (
    <article 
      className="card" 
      aria-label={`Policy ${policy.policyNumber}`}
    >
      <h2>{policy.insurer}</h2>
      <p>{policy.policyType}</p>
      
      <Button 
        onClick={handleView}
        aria-label={`View details for policy ${policy.policyNumber}`}
      >
        View Details
      </Button>
    </article>
  );
}
```

---

### 6. **AI/ML Agent** (Intelligence Layer)
**Responsibilities:**
- Prompt engineering for document extraction
- Confidence scoring algorithms
- Learning model implementation
- Accuracy monitoring & improvement

**Key Files:**
- `src/lib/ai/extract-document.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/learning-feedback.ts`

**Extraction Prompt Template:**
```typescript
const EXTRACTION_PROMPT = `
This PDF was sent via email with subject: "${emailSubject}"

Extract the following to help match this document to a client and policy:

1. Client Number (HIGHEST PRIORITY):
   Look for: "Client No:", "Client Number:", "Client Ref:", "Account No:"
   Examples: "CL-12345", "AKL-9876", "C00789"

2. Policy Number:
   Look for: "Policy Number:", "Pol No:", "Policy Ref:"
   Examples: "DPK 5719028", "POL-ABC123"

3. Document Type:
   Determine if this is:
   - policy_schedule (coverage summary)
   - policy_wording (full terms)
   - invoice (payment due)
   - certificate (proof of insurance)
   - renewal_notice

Return JSON with confidence scores (0.0 - 1.0):
{
  "client_number": {"value": "AKL-12345", "confidence": 0.95},
  "policy_number": {"value": "DPK 5719028", "confidence": 0.98},
  "document_type": {"value": "policy_schedule", "confidence": 0.99}
}

If field not found, set value to null and confidence to 0.
`;
```

---

### 7. **Testing Agent** (Quality Assurance)
**Responsibilities:**
- Unit tests (Jest)
- Integration tests (API routes)
- E2E tests (Playwright)
- Accessibility tests (axe)
- Security tests (OWASP)

**Test Structure:**
```
tests/
├── unit/
│   ├── services/extract-document.test.ts
│   └── utils/confidence-score.test.ts
├── integration/
│   ├── api/broker/email-inbox.test.ts
│   └── api/client/policies.test.ts
└── e2e/
    ├── broker-review-flow.spec.ts
    └── client-portal-flow.spec.ts
```

**Example E2E Test:**
```typescript
// tests/e2e/broker-review-flow.spec.ts
import { test, expect } from '@playwright/test';

test('broker can review AI extraction on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  // Login as broker
  await page.goto('/broker/login');
  await page.fill('[name=email]', 'broker@test.com');
  await page.fill('[name=password]', 'testpass');
  await page.click('button[type=submit]');
  
  // Navigate to email inbox
  await page.click('[aria-label="Email Inbox"]');
  
  // Should see pending review
  await expect(page.locator('text=Awaiting Review')).toBeVisible();
  
  // Click review
  await page.click('text=Review Now');
  
  // Should see split view
  await expect(page.locator('[aria-label="PDF Preview"]')).toBeVisible();
  await expect(page.locator('[aria-label="AI Extraction"]')).toBeVisible();
  
  // Approve
  await page.click('button:has-text("Approve & Publish")');
  
  // Should see success message
  await expect(page.locator('text=Document Published')).toBeVisible();
});
```

---

### 8. **DevOps Agent** (Infrastructure & Deployment)
**Responsibilities:**
- CI/CD pipelines (GitHub Actions)
- Environment configuration
- Deployment automation
- Monitoring setup (Sentry, Vercel Analytics)
- Backup & recovery

**GitHub Actions Workflow:**
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run test:e2e
      
  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## Communication Protocol

### Daily Standup (9 AM NZT)
Overseer posts in project thread:
```
🌅 DAILY STANDUP - Week 3, Day 2

YESTERDAY:
✅ Database: Email tables deployed
✅ Backend: Cloudflare Worker configured
⏳ Frontend: Broker review UI (50% done)

TODAY:
• Backend: Claude API integration
• Frontend: Complete review UI
• Testing: Write unit tests for extraction

BLOCKERS:
• Need Anthropic API key (@human)

NEXT 24H GOALS:
• AI extraction working end-to-end
• Broker can review on mobile
```

---

### Agent Handoff Format
When one agent needs another:

```
HANDOFF: Backend → Frontend

TASK: Build broker review UI for email extraction
CONTEXT: 
- Backend API ready: GET /api/broker/email-inbox/:id
- Returns: { pdfUrl, aiExtraction, suggestedMatches }
- Broker must approve/reject

ACCEPTANCE CRITERIA:
✅ Mobile-first split view (PDF | Form)
✅ AI suggestions pre-filled in dropdowns
✅ Approve button calls: POST /api/broker/email-inbox/:id/approve
✅ Keyboard accessible
✅ Loads in <1 second

FILES:
- src/app/(broker)/email-inbox/[id]/page.tsx
- src/components/broker/extraction-review-form.tsx

DEPENDENCIES:
- shadcn/ui components installed
- PDF viewer component ready

QUESTIONS:
- Should PDF be full-screen or thumbnail? → Mobile: thumbnail, desktop: split
```

---

### Code Review Protocol
All PRs require 1 agent review:

```
PR #42: Implement broker review UI

REVIEWER: Frontend Agent
CODE QUALITY: ✅ Good
- TypeScript strict mode enabled
- No any types used
- Error boundaries present

ACCESSIBILITY: ⚠️ Issues Found
- Missing ARIA labels on approve button
- Keyboard navigation doesn't reach dropdown

MOBILE: ✅ Good
- Responsive breakpoints correct
- Touch targets 48x48px

TESTS: ❌ Missing
- No unit tests for ExtractionReviewForm
- No E2E test for approve flow

VERDICT: Request Changes
Please add:
1. ARIA labels
2. Unit tests
3. E2E test

Then re-request review.
```

---

## Risk Management

### Risk Register
Overseer maintains and updates:

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| AI extraction <90% accurate | Medium | High | Week 11 pilot testing with real PDFs, defer if <70% | AI/ML Agent |
| Mobile UX poor on small screens | Low | Medium | Weekly mobile testing on real devices | Frontend Agent |
| RLS policies allow data leaks | Low | Critical | Automated RLS bypass tests in CI | Database Agent |
| Cloudflare Email Worker downtime | Low | High | Fallback: queue emails, process when back up | Backend Agent |
| Anthropic API rate limits | Medium | Medium | Implement exponential backoff + retry | Backend Agent |

---

## Development Principles

1. **Mobile-First:** Start with 375px width, enhance for desktop
2. **Accessibility-First:** WCAG 2.1 AA from day 1, not retrofit
3. **Test-Driven:** Write tests before or alongside code
4. **Type-Safe:** TypeScript strict mode, no `any`
5. **Error-Handled:** Every API call in try/catch
6. **Logged:** Audit trail for all writes
7. **Reviewed:** All code reviewed by another agent
8. **Documented:** README for every complex module

---

## Success Criteria Checklist

Before marking feature complete:

**Functionality:**
- [ ] Works on mobile (375px width)
- [ ] Works on desktop (1920px width)
- [ ] Works on tablet (768px width)
- [ ] Error states handled
- [ ] Loading states shown

**Performance:**
- [ ] Page loads <2s on mobile LTE
- [ ] API response <500ms (p95)
- [ ] Lighthouse score >90

**Accessibility:**
- [ ] Keyboard navigation works
- [ ] Screen reader tested (NVDA)
- [ ] ARIA labels present
- [ ] Focus indicators visible
- [ ] 4.5:1 contrast ratio

**Testing:**
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests pass
- [ ] E2E test covers happy path
- [ ] Tested on real mobile device

**Security:**
- [ ] Input validated (Zod)
- [ ] RLS policies enforced
- [ ] No SQL injection possible
- [ ] OWASP scan clean

**Documentation:**
- [ ] Code comments present
- [ ] API endpoint documented
- [ ] README updated
- [ ] Changelog entry added

---

**Version:** 1.0  
**Last Updated:** January 2026
