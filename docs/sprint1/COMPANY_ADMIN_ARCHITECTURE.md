# Company Admin Architecture - Solution Design

**Date:** 2026-01-18
**Status:** DRAFT - SOLUTION ARCHITECTURE REVIEW
**Architect Review:** Addressing company ownership and admin transfer concerns

---

## Problem Statement

**User Concern:**
> "If Branch as Broker requires parent broker, what happens when that person leaves the brokerage? Who grants access to subsequent brokers? Company admin rights should exist and be transferable."

**Root Issue:**
Original proposal conflated two concepts:
1. **Company** (legal entity: "Smith Insurance")
2. **Branch** (location/division: "Smith Insurance Auckland")

This created unclear ownership and no admin transfer mechanism.

---

## Solution: Three-Tier Architecture

### Conceptual Model

```
Company (Legal Entity)
├── Company Admins (1+ people, transferable)
│   └── Can manage all branches
├── Branch 1 (Location/Division)
│   ├── Branch Admins (manage this branch)
│   └── Staff (work in this branch)
└── Branch 2
    ├── Branch Admins
    └── Staff
```

### Data Model

```sql
-- Tier 1: Companies (Legal Entities)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tier 2: Branches (Divisions/Locations)
-- Rename existing "brokers" to "branches" conceptually
-- OR keep "brokers" table name but treat as branches
ALTER TABLE brokers
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
ADD COLUMN branch_name TEXT,
ADD COLUMN is_main_branch BOOLEAN DEFAULT false;

-- Each branch has its own subdomain for email routing
-- broker_branding.subdomain already exists and links to broker_id (branch)

-- Tier 3: Users with Hierarchical Roles
ALTER TABLE broker_users
ADD COLUMN company_role TEXT DEFAULT 'staff',
  -- Values: 'company_admin', 'branch_admin', 'staff'
ADD COLUMN can_see_all_branch_clients BOOLEAN DEFAULT false,
  -- Flag to allow seeing all clients in their branch
ADD COLUMN can_see_own_clients_only BOOLEAN DEFAULT true;
  -- Default: users see only their own clients

-- Index for fast company lookups
CREATE INDEX idx_brokers_company ON brokers(company_id);
CREATE INDEX idx_broker_users_company_role ON broker_users(company_role);
```

---

## Admin Hierarchy & Permissions

### Role: Company Admin (`company_role = 'company_admin'`)

**Permissions:**
- ✅ Create new branches for the company
- ✅ Invite brokers to any branch
- ✅ Promote/demote branch admins
- ✅ Transfer company admin rights to another user
- ✅ View all branches (read-only by default)
- ✅ Generate branch access codes
- ✅ Approve join requests
- ❌ Cannot see client data by default (privacy)
- ⚠️ Can request InsuredIn support for cross-branch access if needed

**Use Cases:**
- Managing director of "Smith Insurance"
- Can create "Auckland", "Wellington", "Christchurch" branches
- Can invite branch managers
- Can transfer ownership if they leave

### Role: Branch Admin (`company_role = 'branch_admin'`)

**Permissions:**
- ✅ Invite brokers to their branch only
- ✅ Approve join requests for their branch
- ✅ Grant/revoke "see all branch clients" permission to staff
- ✅ Manage branch settings (branding, email)
- ✅ See all branch clients (by default)
- ❌ Cannot create new branches
- ❌ Cannot access other branches
- ❌ Cannot promote to company admin

**Use Cases:**
- Branch manager for "Smith Insurance Auckland"
- Manages brokers in Auckland office
- No access to Wellington branch data

### Role: Staff (`company_role = 'staff'`)

**Permissions:**
- ✅ See own clients (by default)
- ✅ See all branch clients if `can_see_all_branch_clients = true`
- ❌ Cannot invite users
- ❌ Cannot change permissions
- ❌ Cannot access other branches

**Use Cases:**
- Insurance broker working in Auckland branch
- Can switch view: "My Clients" / "All Branch Clients" (if granted)

---

## Comparison: Option A vs Option C

### Option A: Branch as Broker (Original)

```
brokers table
├── parent_broker_id (points to another broker)
├── branch_name
└── is_parent (boolean)

Issues:
❌ No clear company entity
❌ "Parent broker" is confusing (is it a company or branch?)
❌ Admin rights tied to first registrant
❌ No way to transfer ownership
❌ Company name duplicated per branch
```

### Option C: Companies Table (Recommended)

```
companies table (Legal Entity)
├── id
└── company_name

brokers table (Branches)
├── company_id (references companies)
├── branch_name
└── subdomain (via broker_branding)

broker_users table (People)
├── company_role (company_admin / branch_admin / staff)
├── can_see_all_branch_clients
└── can_see_own_clients_only

Advantages:
✅ Clear company ownership
✅ Multiple company admins possible
✅ Admin rights transferable
✅ Company name stored once
✅ Clear role hierarchy
✅ Solves succession problem
```

---

## User Flows with Company Admin Model

### Flow 1: First Registration (Company Admin)

```
1. User registers: john@smithinsurance.co.nz
   ↓
2. Email verification
   ↓
3. Complete Registration Form:
   ┌─────────────────────────────────────────┐
   │ Company Name: Smith Insurance           │
   │ Branch Name: Auckland (optional)        │
   │ Subdomain: smithauckland                │
   │ Your Name: John Smith                   │
   │ Your Role: ○ Company Admin ✓            │
   │            ○ Branch Admin                │
   └─────────────────────────────────────────┘

   Preview: documents@smithauckland.insuredin.app

   ↓
4. Creates:
   - companies (company_name: "Smith Insurance")
   - brokers (company_id, branch_name: "Auckland", is_main_branch: true)
   - broker_branding (subdomain: "smithauckland")
   - broker_users (user: John, company_role: "company_admin")

   Result: John is Company Admin, can create more branches
```

### Flow 2: Company Admin Creates New Branch

```
1. John (Company Admin) goes to Settings → Branches
   ↓
2. Click "Create New Branch"
   ┌─────────────────────────────────────────┐
   │ Branch Name: Wellington                 │
   │ Subdomain: smithwellington              │
   │ Branch Admin Email: sarah@smith...      │
   └─────────────────────────────────────────┘

   ↓
3. Creates:
   - brokers (company_id: same, branch_name: "Wellington")
   - broker_branding (subdomain: "smithwellington")

4. Sends invitation to Sarah with access code
   ↓
5. Sarah registers → Joins as Branch Admin for Wellington
```

### Flow 3: Branch Admin Invites Staff

```
1. Sarah (Branch Admin - Wellington) clicks "Invite Team Member"
   ↓
2. Form:
   ┌─────────────────────────────────────────┐
   │ Email: tom@smithinsurance.co.nz         │
   │ Role: ○ Branch Admin                    │
   │       ○ Staff ✓                          │
   │ Permissions:                            │
   │ ☑ Can see all Wellington clients       │
   │ ☐ Can see only own clients              │
   └─────────────────────────────────────────┘

   ↓
3. Generates access code: WEL-A7K9-2X4P
   ↓
4. Tom registers with code → Joins Wellington branch as Staff
```

### Flow 4: Admin Transfer (Succession)

```
Scenario: John (Company Admin) is leaving

Option A: Transfer to Existing User
1. John goes to Settings → Company → Admins
2. Click "Transfer Admin Rights"
3. Select: Sarah (Branch Admin - Wellington)
4. Confirm transfer
   ↓
   Result: Sarah promoted to Company Admin

Option B: Support Request
1. John left without transfer
2. Sarah contacts InsuredIn support
3. Support verifies identity (email domain, company registration)
4. Support promotes Sarah to Company Admin
   ↓
   Result: Sarah becomes Company Admin

Option C: Multiple Company Admins
1. John promotes Sarah to Company Admin
2. Both are now Company Admins
3. John leaves → Sarah remains → No disruption
   ✓ Best practice: Always have 2+ company admins
```

---

## Data Isolation & Access Control

### Branch-Level Isolation (Secure by Default)

```sql
-- Clients belong to branches
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id),  -- This is branch_id
  ...
);

-- Policies belong to branches
CREATE TABLE policies (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id),  -- This is branch_id
  ...
);

-- Row-Level Security (RLS) enforces branch isolation
CREATE POLICY "branch_isolation" ON clients
  FOR ALL
  USING (
    broker_id IN (
      SELECT broker_id FROM broker_users WHERE user_id = auth.uid()
    )
  );
```

**Result:**
- Auckland brokers CANNOT see Wellington clients (different broker_id)
- RLS enforces this at database level
- No code changes needed (already using broker_id everywhere)

### Client Ownership Within Branch

```sql
-- Add client ownership tracking
ALTER TABLE clients
ADD COLUMN assigned_broker_user_id UUID REFERENCES broker_users(id);

-- Default: User sees only their assigned clients
-- With permission: User sees all branch clients

-- Query for "My Clients" view
SELECT * FROM clients
WHERE broker_id = current_user_branch_id
  AND assigned_broker_user_id = current_user_id;

-- Query for "All Branch Clients" view (if permission granted)
SELECT * FROM clients
WHERE broker_id = current_user_branch_id
  AND EXISTS (
    SELECT 1 FROM broker_users
    WHERE user_id = auth.uid()
      AND can_see_all_branch_clients = true
  );
```

**UI Implementation:**

```tsx
// Dropdown in clients page
<Select value={view} onValueChange={setView}>
  <SelectItem value="my-clients">My Clients</SelectItem>
  {canSeeAllBranchClients && (
    <SelectItem value="all-branch-clients">All Branch Clients</SelectItem>
  )}
</Select>
```

---

## Migration Strategy

### Phase 1: Add Companies Support (Breaking Change Minimized)

```sql
-- Step 1: Create companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add company_id to brokers (nullable initially)
ALTER TABLE brokers
ADD COLUMN company_id UUID REFERENCES companies(id),
ADD COLUMN branch_name TEXT,
ADD COLUMN is_main_branch BOOLEAN DEFAULT true;

-- Step 3: Migrate existing brokers
-- Create company for each existing broker
INSERT INTO companies (id, company_name)
SELECT gen_random_uuid(), company_name
FROM brokers
WHERE company_id IS NULL;

-- Link brokers to companies
UPDATE brokers b
SET
  company_id = c.id,
  branch_name = 'Main Office',
  is_main_branch = true
FROM companies c
WHERE b.company_name = c.company_name
  AND b.company_id IS NULL;

-- Step 4: Make company_id NOT NULL after migration
ALTER TABLE brokers
ALTER COLUMN company_id SET NOT NULL;

-- Step 5: Add company roles to broker_users
ALTER TABLE broker_users
ADD COLUMN company_role TEXT DEFAULT 'company_admin';

-- Promote first user of each company to company_admin
UPDATE broker_users bu
SET company_role = 'company_admin'
WHERE id IN (
  SELECT DISTINCT ON (b.company_id) bu2.id
  FROM broker_users bu2
  JOIN brokers b ON bu2.broker_id = b.id
  ORDER BY b.company_id, bu2.created_at ASC
);

-- Others default to branch_admin
UPDATE broker_users
SET company_role = 'branch_admin'
WHERE company_role IS NULL;
```

### Phase 2: Add Access Control Columns

```sql
ALTER TABLE broker_users
ADD COLUMN can_see_all_branch_clients BOOLEAN DEFAULT false,
ADD COLUMN can_see_own_clients_only BOOLEAN DEFAULT true;

-- Company admins don't need client access by default (privacy)
-- Branch admins can see all branch clients
UPDATE broker_users
SET can_see_all_branch_clients = true
WHERE company_role IN ('branch_admin', 'company_admin');
```

### Phase 3: Add Client Assignment

```sql
ALTER TABLE clients
ADD COLUMN assigned_broker_user_id UUID REFERENCES broker_users(id);

-- Assign existing clients to first broker user in their branch
UPDATE clients c
SET assigned_broker_user_id = (
  SELECT id FROM broker_users
  WHERE broker_id = c.broker_id
  ORDER BY created_at ASC
  LIMIT 1
);
```

---

## Subdomain & Email Routing

### No Changes Needed to Email Webhook

```
Email: documents@smithauckland.insuredin.app
  ↓
Cloudflare Worker extracts subdomain: "smithauckland"
  ↓
Webhook looks up: broker_branding.subdomain = "smithauckland"
  ↓
Gets broker_id (which is the branch)
  ↓
Creates email_processing_transaction with broker_id
  ↓
✓ Works unchanged with new model
```

**Why it works:**
- `brokers` table still represents branches
- Each branch has one subdomain (via broker_branding)
- Email routing unchanged
- Data isolation unchanged (uses broker_id = branch_id)

---

## User Confirmations Needed

Based on your feedback:

### ✅ Confirmed by User
1. Branch name: **Optional** (default "Main Office")
2. Subdomain: **Immutable** (only changeable via InsuredIn support)
3. Multi-branch detection: **Manual invitation/access code** (no auto-detect)
4. Access control: **See own clients by default**, with optional "All Branch Clients" view

### ❓ Awaiting Confirmation

**1. Architecture Choice**

Now that I've explained the Company Admin problem, which should I implement?

- **A) Branch as Broker** (original - has admin transfer problem)
- **C) Companies Table** (new - solves admin transfer, clear hierarchy)

**Recommendation:** C (Companies Table)

**2. Admin Roles**

Should I implement the three-tier role system?

- **Company Admin** (can manage all branches, transfer rights)
- **Branch Admin** (can manage their branch only)
- **Staff** (work in branch)

**Recommendation:** Yes

**3. First Registration Flow**

When first broker registers, should they:

```
Option 1: Auto-promoted to Company Admin
  ├─ Simpler UX
  └─ User doesn't choose role

Option 2: User chooses role during registration
  ├─ More control
  ├─ User might choose wrong role
  └─ Can confuse first-time users
```

**Recommendation:** Option 1 (auto-promote first user to Company Admin)

**4. Multiple Company Admins**

Should we allow multiple company admins simultaneously?

- **Yes** (recommended - no single point of failure)
- **No** (only one company admin at a time, must transfer)

**Recommendation:** Yes (best practice: always have 2+ admins)

**5. Company Admin Client Access**

Should Company Admins see client data by default?

```
Option A: No (privacy-first)
  ├─ Company admin manages branches/users only
  ├─ To see clients, must also be Branch Admin or Staff
  └─ Most secure

Option B: Yes (convenience)
  ├─ Company admin sees all data across all branches
  ├─ Easier for small companies
  └─ Less secure
```

**Recommendation:** Option A (privacy-first, request access if needed)

---

## Implementation Checklist (If Approved)

### Database Migration
- [ ] Create `companies` table
- [ ] Add `company_id`, `branch_name`, `is_main_branch` to `brokers`
- [ ] Add `company_role`, `can_see_all_branch_clients` to `broker_users`
- [ ] Add `assigned_broker_user_id` to `clients`
- [ ] Migrate existing data
- [ ] Create indexes

### Registration Flow
- [ ] Update complete-registration form (add branch name, subdomain)
- [ ] Create company on first registration
- [ ] Auto-promote first user to company_admin
- [ ] Generate access codes for invitations

### Settings Pages
- [ ] `/broker/settings/email` - Email address, subdomain, usage stats
- [ ] `/broker/settings/company` - Company details, admin transfers
- [ ] `/broker/settings/branches` - Create/manage branches (company admin only)
- [ ] `/broker/settings/team` - Invite users, manage permissions

### Access Control UI
- [ ] "My Clients" / "All Branch Clients" dropdown
- [ ] Permission toggle in team management
- [ ] Role badges (Company Admin, Branch Admin, Staff)

### API Routes
- [ ] Subdomain availability check
- [ ] Create branch (company admin)
- [ ] Generate invitation codes
- [ ] Transfer admin rights
- [ ] Update user permissions

---

## Questions for Final Approval

1. **Confirm Architecture C (Companies Table)?**
   - Solves your admin transfer concern
   - Clear role hierarchy
   - Multiple company admins possible

2. **Confirm Three-Tier Roles?**
   - Company Admin (manage all branches)
   - Branch Admin (manage one branch)
   - Staff (work in branch)

3. **First user auto-promoted to Company Admin?**
   - Simpler UX
   - Can promote others later

4. **Allow multiple Company Admins?**
   - Best practice for redundancy
   - No single point of failure

5. **Company Admins don't see client data by default?**
   - Privacy-first approach
   - Can be granted branch access if needed

---

**Status:** 🟡 AWAITING ARCHITECTURAL APPROVAL

Please review and confirm before I write any code!
