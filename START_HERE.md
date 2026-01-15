# 🚀 InsuredIn - START HERE

**Complete Documentation Package for Claude Code Development**

---

## 📦 What's in This Package

This is a **complete, production-ready specification** for InsuredIn MVP development by AI agents (Claude Code).

**Key Deliverable:** White-labeled client portal for NZ insurance brokers with AI-powered email document processing.

---

## 🎯 Quick Start (5 Minutes)

### Step 1: Read Core Documents (Priority Order)
1. **README.md** (5 min) - Project overview, tech stack, getting started
2. **docs/1_PROJECT_SPECIFICATION.md** (20 min) - Complete feature requirements
3. **docs/5_AGENT_COORDINATION.md** (10 min) - How AI agents work together
4. **docs/6_DEVELOPMENT_ROADMAP.md** (10 min) - 12-week sprint plan

### Step 2: Set Up Development Environment
```bash
# Clone repository
git clone https://github.com/yourusername/insuredin.git
cd insuredin

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your keys:
# - Supabase URL + keys
# - Cloudflare R2 credentials
# - Anthropic API key
# - Resend API key

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Step 3: Begin Week 1 Development
See `docs/6_DEVELOPMENT_ROADMAP.md` → Week 1-2 tasks

---

## 📚 Complete Documentation Index

### Core Documents (READ FIRST)
- **README.md** - Project overview
- **1_PROJECT_SPECIFICATION.md** - Feature requirements (755 lines)
- **5_AGENT_COORDINATION.md** - AI agent workflow (492 lines)
- **6_DEVELOPMENT_ROADMAP.md** - 12-week plan (411 lines)

### Technical References
- **2_DATABASE_SCHEMA.md** - All tables, RLS policies (680 lines)
- **3_API_SPECIFICATION.md** - API endpoints (TBD - create during development)
- **4_UI_UX_SPECIFICATION.md** - Components, screens (TBD - create during development)
- **7_INTEGRATION_GUIDE.md** - Folio/Insight APIs (Phase 2)

---

## 🎯 MVP Scope (12 Weeks)

### Core Features:
✅ **Email BCC Document Processing** (Weeks 3-4)
  - Broker BCCs policy emails
  - AI extracts metadata (Claude API)
  - Broker reviews on mobile
  - Client sees document instantly

✅ **Client Portal** (Weeks 5-6)
  - View policies + documents 24/7
  - Premium breakdown (NZ-specific)
  - Natural Hazards panel (NZ-specific)
  - Lodge claims with photos

✅ **NZ Compliance** (Weeks 7-8)
  - CoFI: IFSO complaints pathway
  - Privacy Act: Download My Data
  - Email auto-reminders

✅ **White-Label** (Week 11)
  - Broker's logo + colors
  - Custom subdomain
  - Usage analytics

---

## 🤖 Agentic AI Development

This project uses **specialized AI agents** (Claude Code) working in coordination:

**Agent Team:**
1. **Overseer** - Coordination, daily standups, risk management
2. **Planning** - Architecture, API specs
3. **Database** - Schema, RLS, migrations
4. **Backend** - API routes, Claude integration, email processing
5. **Frontend** - React components, mobile-first UI
6. **AI/ML** - Prompt engineering, confidence scoring
7. **Testing** - Unit, integration, E2E, security tests
8. **DevOps** - CI/CD, deployment, monitoring

**Communication Protocol:**
- Daily standup at 9 AM NZT (Overseer posts)
- Agent handoffs use standardized format
- All PRs require 1 agent review
- Tag @human for critical decisions

See `docs/5_AGENT_COORDINATION.md` for complete workflow.

---

## 🏗️ Architecture Overview

```
Broker's CRM (Folio/Insight) ← Phase 2: API Sync
         ↓
InsuredIn Middleware
├─ Email BCC Processor (Cloudflare)
├─ AI Extraction (Claude 3.5 Sonnet)
├─ Broker Review (Mobile-First)
└─ Client Portal (PWA)
         ↓
Clients access 24/7
```

**Technology Stack:**
- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL + Auth + Storage)
- Cloudflare R2 (documents) + Email Routing
- Claude 3.5 Sonnet API (extraction)
- shadcn/ui components
- Vercel deployment

---

## ✅ Success Criteria (MVP Launch)

**Broker Metrics:**
- [ ] 500+ documents processed via BCC
- [ ] 90%+ AI extraction accuracy
- [ ] <30 seconds average review time
- [ ] 10+ hours/month saved per broker

**Client Metrics:**
- [ ] 80%+ client adoption rate
- [ ] 60%+ mobile usage
- [ ] 50%+ reduction in phone calls

**Technical Metrics:**
- [ ] 99.9% uptime
- [ ] <2s page load (mobile LTE)
- [ ] 100% WCAG 2.1 AA compliance
- [ ] Zero critical security vulnerabilities

---

## 🚦 Development Status

**Current Phase:** Ready to Start Week 1

**Completed:**
- ✅ Complete technical specification
- ✅ Database schema designed
- ✅ Agent coordination framework
- ✅ 12-week roadmap

**Next Steps:**
1. Create GitHub repository
2. Initialize Next.js project
3. Set up Supabase + Cloudflare accounts
4. Deploy database schema
5. Begin Week 1 tasks

---

## 📝 Key Documents at a Glance

| Document | Purpose | Lines | Read Time |
|----------|---------|-------|-----------|
| README.md | Project overview | 250 | 5 min |
| 1_PROJECT_SPECIFICATION.md | Feature requirements | 755 | 20 min |
| 2_DATABASE_SCHEMA.md | Database design | 680 | 15 min |
| 5_AGENT_COORDINATION.md | AI development workflow | 492 | 10 min |
| 6_DEVELOPMENT_ROADMAP.md | 12-week sprint plan | 411 | 10 min |

**Total Documentation:** 2,588 lines, ~60 minutes to read

---

## 💡 Unique Features (Competitive Advantages)

1. **Email BCC Processing** - NO other NZ broker portal has this
   - Broker just BCCs documents@portal.com
   - AI extracts metadata in <30 seconds
   - Broker reviews on phone in 10 seconds
   - Client sees document instantly

2. **Premium Transparency** - ONLY portal showing full breakdown
   - Base premium + natural hazard loading + GST + Fire Service Levy
   - Year-over-year comparison
   - Explanation of each charge

3. **NZ Compliance Built-In**
   - Natural Hazards Act 2024 panel
   - CoFI complaints pathway (IFSO)
   - Privacy Act "Download My Data"

4. **Mobile-First for Brokers**
   - Review documents during commute
   - Approve claims from cafe
   - All features work on phone

---

## 🔐 Security & Compliance

**Authentication:**
- Supabase Auth (email/password)
- SSO-ready (Azure AD, Okta - Phase 2)
- Federated (Google, Apple, Facebook)

**Data Isolation:**
- Row-Level Security (RLS) per broker
- Client can only see own data
- All writes logged to audit_logs

**NZ Compliance:**
- CoFI ready (March 31, 2025 deadline)
- Privacy Act 2020 compliant
- Natural Hazards Insurance Act 2024
- WCAG 2.1 AA accessibility

---

## 🆘 Need Help?

**For Development Questions:**
- Check relevant docs/\* files first
- Tag @human in PR for critical decisions
- Use agent handoff format for coordination

**For Technical Issues:**
- Database: See `docs/2_DATABASE_SCHEMA.md`
- API: See `docs/3_API_SPECIFICATION.md` (TBD)
- UI: See `docs/4_UI_UX_SPECIFICATION.md` (TBD)

**For Clarifications:**
- Review `docs/1_PROJECT_SPECIFICATION.md`
- Check agent coordination protocol
- Escalate to @human if blocked

---

## 🎉 Let's Build!

You have everything needed to start:
- ✅ Complete technical spec
- ✅ Database schema
- ✅ Agent workflow
- ✅ 12-week roadmap
- ✅ Success criteria

**Next Action:** Read README.md, then begin Week 1 tasks!

---

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** 🚀 Ready for Development

**Good luck building InsuredIn!** 🎯
