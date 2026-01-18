# Branch-Based Architecture Proposal

**Date:** 2026-01-18
**Status:** DRAFT - AWAITING APPROVAL
**Purpose:** Define subdomain + branch-based onboarding flow

---

## Business Requirements

### Key Insights
1. **Brokerages can have multiple branches** (e.g., Smith Insurance Auckland, Smith Insurance Wellington)
2. **Branches are separate business entities** - they compete for clients
3. **Branches must have data isolation** - Branch A cannot see Branch B's data
4. **Brokers within same branch can share data** - with admin permission during onboarding
5. **Each branch needs its own subdomain** for email routing

---

## Current Problems

### Problem 1: Duplicate Data Collection
**Current Flow:**
```
Step 1: /broker/register
- Ask for email
- Ask for company name
- Ask for broker name

Step 2: /broker/complete-registration
- Ask for company name AGAIN
- Ask for full name AGAIN
```

This makes sense for first broker but is confusing for subsequent brokers.

### Problem 2: No Branch Concept
**Current Schema:**
```
brokers (company level)
├── broker_users (all users see all data)
└── broker_branding (one subdomain per company)
```

**Issue:** If "Smith Insurance" has 3 branches, they'd need:
- 3 separate broker accounts (loses company connection)
- OR 1 broker with all users seeing all data (no isolation)

### Problem 3: No Data Isolation
All clients, policies, and emails are linked to `broker_id`, so all users in the same brokerage see everything.

---

## Proposed Solution: Branch-Based Architecture

### Option A: Branch as Primary Entity (Recommended)

**Treat each branch as a separate broker, with optional parent company linkage.**

#### Database Schema Changes

```sql
-- 1. Add branch support to existing brokers table
ALTER TABLE brokers
ADD COLUMN branch_name TEXT,
ADD COLUMN parent_broker_id UUID REFERENCES brokers(id),
ADD COLUMN is_parent BOOLEAN DEFAULT false;

-- Index for parent lookups
CREATE INDEX idx_brokers_parent ON brokers(parent_broker_id);

-- 2. Add constraint to broker_branding subdomain
ALTER TABLE broker_branding
ADD CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9-]{3,30}$'),
ADD CONSTRAINT subdomain_required CHECK (subdomain IS NOT NULL);

-- Make subdomain NOT NULL after adding constraint
UPDATE broker_branding SET subdomain = 'temp-' || gen_random_uuid()::text WHERE subdomain IS NULL;
ALTER TABLE broker_branding ALTER COLUMN subdomain SET NOT NULL;

-- 3. Update email_inboxes to ensure subdomain-based routing
-- (Already exists, no changes needed)

-- 4. All existing data tables already use broker_id, so isolation works automatically
-- clients, policies, email_processing_transactions all link to broker_id (which is branch-level)
```

#### Data Model Example

```
Smith Insurance (Parent Company)
├── Smith Insurance Auckland (broker_id: uuid-1, subdomain: smithauckland)
│   ├── documents@smithauckland.insuredin.app
│   ├── Broker User: John (admin)
│   ├── Broker User: Mary (staff)
│   └── Clients: Client A, Client B
│
├── Smith Insurance Wellington (broker_id: uuid-2, subdomain: smithwellington)
│   ├── documents@smithwellington.insuredin.app
│   ├── Broker User: Sarah (admin)
│   └── Clients: Client C, Client D
│
└── Smith Insurance Christchurch (broker_id: uuid-3, subdomain: smithchurch)
    ├── documents@smithchurch.insuredin.app
    ├── Broker User: Tom (admin)
    └── Clients: Client E
```

**Data Isolation:**
- Each branch is a separate `broker` record
- All data (clients, policies, emails) linked to `broker_id` (branch-level)
- John in Auckland cannot see Sarah's clients in Wellington (different broker_id)
- John and Mary in Auckland CAN see each other's clients (same broker_id, admin grants permission)

---

### Option B: Separate Branches Table

**Create a new `branches` table and link everything to branches instead of brokers.**

#### Database Schema Changes

```sql
-- 1. Create branches table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9-]{3,30}$')
);

CREATE INDEX idx_branches_broker ON branches(broker_id);
CREATE INDEX idx_branches_subdomain ON branches(subdomain);

-- 2. Move broker_branding to branches
ALTER TABLE broker_branding
ADD COLUMN branch_id UUID REFERENCES branches(id);

-- 3. Update ALL data tables to use branch_id instead of broker_id
ALTER TABLE broker_users ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE clients ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE email_processing_transactions ADD COLUMN branch_id UUID REFERENCES branches(id);
-- ... and many more tables

-- 4. Migrate existing data
-- Create default branch for each broker
-- Update all foreign keys
```

**Pros:**
- Cleaner separation between company and branch
- Corporate-level reporting easier (roll up by broker_id)

**Cons:**
- MASSIVE migration effort (update ~15 tables)
- Breaking change to entire codebase
- All existing queries need updating
- Risk of data integrity issues

---

## Recommendation: Option A (Branch as Broker)

**Rationale:**
1. ✅ **Minimal database changes** - just add 3 columns to `brokers` table
2. ✅ **No breaking changes** - existing code continues to work
3. ✅ **Data isolation works automatically** - already using broker_id everywhere
4. ✅ **Fast to implement** - registration flow + settings page only
5. ✅ **Future-proof** - can add parent company features later

**Trade-off:**
- Slightly less clean conceptually (broker = branch)
- Company-level reporting requires joining on parent_broker_id

---

## Proposed User Flows

### Flow 1: First Broker Registration (New Company)

```
1. /broker/register
   ↓
   User provides:
   - Email
   - Password

2. Email verification

3. /broker/complete-registration
   ↓
   User provides:
   - Company Name: "Smith Insurance"
   - Branch Name: "Auckland" (optional - defaults to "Main Office")
   - Your Full Name: "John Smith"
   - Subdomain: "smithauckland" (auto-suggested from company + branch)

   Show preview:
   📧 Your email inbox will be: documents@smithauckland.insuredin.app

   ↓

4. Creates:
   - broker record (company_name: "Smith Insurance", branch_name: "Auckland", is_parent: true)
   - broker_branding (subdomain: "smithauckland")
   - broker_users (user: John, role: admin)
   - email_inboxes (documents@smithauckland.insuredin.app)
```

### Flow 2: Additional Broker (Same Branch)

```
1. /broker/register
   ↓
   User provides:
   - Email: sarah@smithinsurance.co.nz
   - Password

2. Email verification

3. /broker/complete-registration
   ↓
   System detects: Email domain matches existing broker

   Show:
   "We found an existing company: Smith Insurance (Auckland)"

   User chooses:
   ○ Join existing branch: "Smith Insurance Auckland"
   ○ Create new branch

   If "Join existing":
   - Enter access code (provided by admin)
   - OR send join request to admin

   ↓

4. Creates:
   - broker_users (links to existing broker_id, role: staff, requires_approval: true)

5. Admin notification:
   - "Sarah wants to join Smith Insurance Auckland"
   - Admin can approve/reject
   - Admin sets data access level (own clients only / all clients)
```

### Flow 3: New Branch (Same Company)

```
1. /broker/register
   ↓
   User provides:
   - Email: tom@smithinsurance.co.nz
   - Password

2. Email verification

3. /broker/complete-registration
   ↓
   System detects: Email domain matches existing broker

   Show:
   "We found an existing company: Smith Insurance"

   User chooses:
   ○ Join existing branch: "Auckland"
   ○ Create new branch ✓ (selected)

   User provides:
   - Branch Name: "Wellington"
   - Your Full Name: "Tom Brown"
   - Subdomain: "smithwellington" (auto-suggested)

   Show preview:
   📧 Your email inbox will be: documents@smithwellington.insuredin.app

   ↓

4. Creates:
   - broker record (company_name: "Smith Insurance", branch_name: "Wellington", parent_broker_id: uuid-1)
   - broker_branding (subdomain: "smithwellington")
   - broker_users (user: Tom, role: admin)
   - email_inboxes (documents@smithwellington.insuredin.app)
```

---

## Subdomain Rules

### Format Validation
```typescript
const subdomainSchema = z.string()
  .min(3, "Subdomain must be at least 3 characters")
  .max(30, "Subdomain must be at most 30 characters")
  .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
  .regex(/^[a-z0-9]/, "Must start with letter or number")
  .regex(/[a-z0-9]$/, "Must end with letter or number")
  .refine(val => !RESERVED_SUBDOMAINS.includes(val), "This subdomain is reserved");
```

### Reserved Subdomains
```typescript
const RESERVED_SUBDOMAINS = [
  // System
  'www', 'api', 'admin', 'app', 'portal', 'dashboard',

  // Email
  'mail', 'email', 'smtp', 'imap', 'webmail', 'documents',

  // Common
  'test', 'staging', 'dev', 'demo', 'beta', 'alpha',

  // Security
  'security', 'support', 'help', 'abuse', 'noreply', 'no-reply',

  // Cloudflare
  'cloudflare', 'workers', 'pages',

  // InsuredIn
  'insuredin', 'insured-in', 'insurance',
];
```

### Auto-Suggestion Logic
```typescript
function suggestSubdomain(companyName: string, branchName?: string): string {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .substring(0, 20); // Max 20 chars for base

  if (branchName && branchName !== 'Main Office') {
    const branch = branchName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 10);
    return `${base}${branch}`;
  }

  return base;
}

// Examples:
// "Smith Insurance" + "Auckland" → "smithauckland"
// "ABC Brokers Ltd" + "Wellington" → "abcbrokerswellington"
// "Jones & Co" + "" → "jonesco"
```

---

## Settings Page: /broker/settings/email

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│ Email Settings                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Branch Email Address                                │
│ ┌─────────────────────────────────────────────────┐│
│ │ documents@smithauckland.insuredin.app           ││
│ │                                          [Copy] ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ ℹ️  BCC this email address when sending policy      │
│    documents to automatically process them.         │
│                                                      │
│ Subdomain                                           │
│ ┌─────────────────────────────────────────────────┐│
│ │ smithauckland                          [locked] ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ ⚠️  Subdomains cannot be changed after creation     │
│                                                      │
│ Branch Name                                         │
│ ┌─────────────────────────────────────────────────┐│
│ │ Auckland                                        ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ Company Name                                        │
│ ┌─────────────────────────────────────────────────┐│
│ │ Smith Insurance                                 ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ Email Usage (Last 30 Days)                         │
│ ┌─────────────────────────────────────────────────┐│
│ │ 47 / 100 emails per hour                        ││
│ │ ████████░░░░░░░░░░░░ 47%                        ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│                                      [Save Changes] │
└─────────────────────────────────────────────────────┘
```

### Features
- ✅ Display email address with copy button
- ✅ Show subdomain (locked after creation)
- ✅ Show branch and company name (editable)
- ✅ Show email usage stats (rate limiting info)
- ✅ Help text explaining BCC workflow

---

## Implementation Checklist

### Phase 1: Database Updates
- [ ] Add `branch_name`, `parent_broker_id`, `is_parent` columns to `brokers` table
- [ ] Add constraints to `broker_branding.subdomain`
- [ ] Create migration script
- [ ] Test migration on dev database

### Phase 2: Registration Flow
- [ ] Update `/broker/complete-registration` page
  - Add branch name field
  - Add subdomain field with validation
  - Add auto-suggestion logic
  - Add preview of email address
- [ ] Update `/api/auth/broker/complete-registration` route
  - Create broker with branch info
  - Create broker_branding with subdomain
  - Validate subdomain availability
  - Block reserved subdomains
- [ ] Create subdomain availability check API

### Phase 3: Settings Page
- [ ] Create `/broker/settings/email` page
  - Display email address with copy
  - Display subdomain (read-only)
  - Display branch/company (editable)
  - Show usage stats
- [ ] Create API routes for settings updates

### Phase 4: Multi-Branch Support (Future)
- [ ] Detect existing company by email domain
- [ ] Show "join existing" vs "create new branch" options
- [ ] Implement admin approval workflow
- [ ] Add access codes for joining branches

### Phase 5: Testing
- [ ] Test subdomain validation
- [ ] Test reserved subdomain blocking
- [ ] Test duplicate subdomain rejection
- [ ] Test email routing with new subdomains
- [ ] Test data isolation between branches

---

## Questions for Confirmation

### 1. Branch Detection Logic
When a new broker registers with `sarah@smithinsurance.co.nz`, how should we detect they might belong to existing company?

**Options:**
- A) Email domain matching (auto-detect)
- B) Manual search/invitation code
- C) Both (email domain suggestion + manual override)

**Recommended:** C (both)

### 2. Subdomain Immutability
Should subdomains be permanently locked after creation, or allow admin to change once?

**Trade-offs:**
- Immutable: Simpler, no email forwarding needed, but no flexibility
- Changeable: More flexible, but requires email forwarding setup

**Recommended:** Immutable (simpler, clearer)

### 3. Branch Name Requirement
Should branch name be required, or optional (defaulting to "Main Office")?

**Recommended:** Optional - most single-branch brokerages don't need it

### 4. Access Control within Branch
For brokers in same branch, should they:
- A) See all clients by default (admin can restrict)
- B) See only own clients by default (admin can grant access)

**Recommended:** B (privacy-first, explicit permission)

---

## Migration Path for Existing Brokers

For brokers already registered (without subdomain):

```sql
-- Force subdomain setup on next login
-- They'll see a prompt: "Please set up your email subdomain"

UPDATE broker_branding
SET subdomain = NULL
WHERE subdomain IS NULL OR subdomain = '';

-- On next login, redirect to /broker/setup-subdomain
-- One-time flow to configure subdomain
```

---

## Approval Required

Please review and confirm:

1. ✅ / ❌ Use Option A (Branch as Broker) architecture?
2. ✅ / ❌ Use proposed registration flow (3 flows)?
3. ✅ / ❌ Use proposed subdomain validation rules?
4. ✅ / ❌ Make subdomains immutable after creation?
5. ✅ / ❌ Make branch name optional (default "Main Office")?
6. ✅ / ❌ Use privacy-first access control (explicit permission)?

**Any changes or concerns?**

Once approved, I'll implement in this order:
1. Database migration
2. Registration flow updates
3. Settings page
4. Testing

---

**Status:** 🟡 AWAITING APPROVAL - DO NOT IMPLEMENT YET
