# InsuredIn - Client Portal for Insurance Brokers

**AI-Powered Document Processing + White-Labeled Client Portal**

---

## 🎯 Project Overview

InsuredIn is a white-labeled client portal for insurance brokers that empowers clients with 24/7 policy access while reducing broker workload through AI-powered email document processing.

### Core Features:
- 📧 **Email BCC Document Processing** - Broker BCCs policy emails, AI extracts data, broker reviews, client sees document instantly
- 👥 **Client Portal** - Clients view policies, download documents, lodge claims, request changes
- 🏷️ **White-Labeled** - Each brokerage's brand (logo, colors, domain)
- 🇳🇿 **NZ-Specific Compliance** - Premium transparency, Natural Hazards Act 2024, CoFI
- 📱 **Mobile-First** - Works beautifully on phones for both brokers and clients
- 🔗 **Integration-Ready** - Phase 2: Sync with Folio CRM & Steadfast Insight

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│   Broker's Existing CRM (Folio/Insight) │
│   (Phase 2: API Integration)            │
└──────────────┬──────────────────────────┘
               │
               │ API Sync (Phase 2)
               │
┌──────────────▼──────────────────────────┐
│        INSUREDIN MIDDLEWARE             │
│                                         │
│  • Email BCC Processor (Cloudflare)    │
│  • AI Extraction (Claude API)          │
│  • Broker Review Interface             │
│  • Client Authentication               │
└──────────────┬──────────────────────────┘
               │
               │ Client-Facing Only
               │
┌──────────────▼──────────────────────────┐
│       CLIENT PORTAL (PWA)               │
│                                         │
│  • Dashboard (policies, docs, claims)  │
│  • Premium Breakdown (NZ)              │
│  • Natural Hazards Panel (NZ)          │
│  • Claims & Service Requests           │
└─────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Hook Form + Zod validation

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL + Auth + Storage)
- Cloudflare R2 (document storage)
- Cloudflare Email Routing (BCC processing)

**AI/ML:**
- Claude 3.5 Sonnet API (document extraction)
- Learning model for accuracy improvement

**Email:**
- Resend (via Supabase Edge Functions)

**Deployment:**
- Vercel (frontend + API)
- Supabase Cloud (database)
- Cloudflare (storage + email)

---

## 📋 Project Structure

```
insuredin/
├── docs/
│   ├── 1_PROJECT_SPECIFICATION.md          # Complete technical spec
│   ├── 2_DATABASE_SCHEMA.md                # All tables, RLS policies, indexes
│   ├── 3_API_SPECIFICATION.md              # All endpoints documented
│   ├── 4_UI_UX_SPECIFICATION.md            # Component library, screens
│   ├── 5_AGENT_COORDINATION.md             # AI agent team structure
│   ├── 6_DEVELOPMENT_ROADMAP.md            # 12-week sprint plan
│   └── 7_INTEGRATION_GUIDE.md              # Folio/Insight API integration
│
├── src/
│   ├── app/                                # Next.js App Router
│   ├── components/                         # React components
│   ├── lib/                                # Utilities, services, types
│   └── styles/                             # Global styles
│
├── supabase/
│   ├── migrations/                         # Database migrations
│   └── seed.sql                            # Sample data
│
├── tests/
│   ├── unit/                               # Jest unit tests
│   ├── integration/                        # API integration tests
│   └── e2e/                                # Playwright E2E tests
│
└── README.md                               # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Cloudflare account
- Anthropic API key (Claude)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/insuredin.git
cd insuredin
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=insuredin-documents

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Email (Resend)
RESEND_API_KEY=your_resend_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Set up database:**
```bash
# Run migrations
npm run db:migrate

# Seed sample data (optional)
npm run db:seed
```

5. **Run development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🤖 Agentic AI Development Approach

This project is designed for development by specialized AI agents working in coordination:

### Agent Team Structure:

**1. Overseer Agent** (Coordination)
- Daily standups at 9 AM NZT
- Sprint planning & tracking
- Risk management
- Inter-agent communication

**2. Planning Agent** (Architecture)
- System design decisions
- API specifications
- Database modeling
- Risk assessment

**3. Database Agent** (Data Layer)
- Schema design & migrations
- RLS policy implementation
- Query optimization
- Data integrity

**4. Backend Agent** (API & Business Logic)
- API route implementation
- Business logic services
- AI integration (Claude API)
- Email processing

**5. Frontend Agent** (UI/UX)
- Component development
- Page implementation
- Responsive design
- Accessibility (WCAG 2.1 AA)

**6. AI/ML Agent** (Intelligence)
- Prompt engineering for document extraction
- Confidence scoring
- Learning model implementation
- Accuracy monitoring

**7. Testing Agents** (Quality)
- Unit tests (Jest)
- Integration tests (API)
- E2E tests (Playwright)
- Security testing (OWASP)

**8. DevOps Agent** (Infrastructure)
- CI/CD pipelines (GitHub Actions)
- Deployment automation
- Monitoring setup
- Backup & recovery

### Agent Communication Protocol:

```
Daily Standup (9 AM NZT):
• What did I complete yesterday?
• What will I work on today?
• Any blockers?

Handoff Format:
• Task: [What needs to be done]
• Context: [Background info]
• Acceptance Criteria: [Definition of done]
• Dependencies: [Other agents needed]
• Files: [Relevant file paths]
```

**See `docs/5_AGENT_COORDINATION.md` for complete agent workflow.**

---

## 📚 Documentation

All documentation is in the `docs/` folder:

1. **PROJECT_SPECIFICATION.md** - Complete feature requirements, user stories, success criteria
2. **DATABASE_SCHEMA.md** - All tables, fields, relationships, RLS policies, indexes
3. **API_SPECIFICATION.md** - RESTful endpoints, request/response formats, authentication
4. **UI_UX_SPECIFICATION.md** - Component library, page layouts, mobile-first design
5. **AGENT_COORDINATION.md** - AI agent roles, communication, development workflow
6. **DEVELOPMENT_ROADMAP.md** - 12-week sprint plan with weekly deliverables
7. **INTEGRATION_GUIDE.md** - Folio/Steadfast Insight API integration (Phase 2)

---

## 🔐 Security & Compliance

**Authentication:**
- Supabase Auth (email/password + OAuth)
- SSO-ready (Azure AD, Okta - Phase 2)
- Row-Level Security (RLS) for data isolation

**Data Privacy:**
- NZ Privacy Act 2020 compliant
- "Download My Data" feature (Principle 6)
- Audit logging for all actions

**Compliance:**
- CoFI (Conduct of Financial Institutions) ready
- IFSO complaints pathway
- Natural Hazards Insurance Act 2024 support
- WCAG 2.1 AA accessibility

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all

# Test coverage
npm run test:coverage
```

**Target Coverage:**
- Unit: 80%+ coverage
- Integration: All API routes tested
- E2E: Critical user flows tested
- Accessibility: 100% WCAG 2.1 AA compliance

---

## 🚢 Deployment

### Staging
```bash
git push origin develop
# Auto-deploys to staging.insuredin.app via Vercel
```

### Production
```bash
git push origin main
# Requires manual approval in Vercel
```

**Environments:**
- Development: `localhost:3000`
- Staging: `staging.insuredin.app`
- Production: `app.insuredin.app`

---

## 📈 Monitoring & Analytics

**Application Monitoring:**
- Vercel Analytics (performance)
- Sentry (error tracking)
- Supabase Logs (database)

**Business Metrics:**
- Documents processed per week
- AI extraction accuracy (target: 90%+)
- Broker review time (target: <30 sec)
- Client portal adoption rate (target: 80%+)

---

## 🛣️ Roadmap

### MVP (Weeks 1-12)
- ✅ Email BCC document processing
- ✅ Client portal (policies, documents, claims)
- ✅ Broker review interface (mobile-first)
- ✅ White-label branding
- ✅ NZ compliance features
- ✅ Email notifications + auto-reminders

### Phase 2 (Months 4-6)
- 🔄 Folio CRM integration (API sync)
- 🔄 Steadfast Insight integration (API sync)
- 🔄 SSO (Azure AD, Okta)
- 🔄 Advanced analytics dashboard
- 🔄 FormsByAir support

### Phase 3 (Months 7-12)
- 🔮 In-app messaging
- 🔮 Push notifications (PWA)
- 🔮 Advanced claims tracking
- 🔮 Certificate auto-generation
- 🔮 Multi-language (Māori)

---

## 🤝 Contributing

This is a private repository. For development guidelines, see `docs/5_AGENT_COORDINATION.md`.

**Development Workflow:**
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes + write tests
3. Run tests: `npm run test:all`
4. Commit: `git commit -m "feat: your feature"`
5. Push: `git push origin feature/your-feature`
6. Create Pull Request (requires 1 agent review)

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🆘 Support

**For Development Issues:**
- Check `docs/` folder for detailed specifications
- Review agent coordination protocol
- Tag @human in PR for critical decisions

**For Technical Questions:**
- Database: See `docs/2_DATABASE_SCHEMA.md`
- API: See `docs/3_API_SPECIFICATION.md`
- UI/UX: See `docs/4_UI_UX_SPECIFICATION.md`

---

## 🎯 Success Criteria (MVP Launch)

**Broker Metrics:**
- [ ] 500+ documents processed via BCC
- [ ] 90%+ AI extraction accuracy
- [ ] <30 seconds average review time
- [ ] 10+ hours/month saved per broker

**Client Metrics:**
- [ ] 80%+ client adoption rate
- [ ] 60%+ mobile usage
- [ ] 50%+ reduction in phone calls to broker

**Technical Metrics:**
- [ ] 99.9% uptime
- [ ] <2s page load (mobile LTE)
- [ ] 100% WCAG 2.1 AA compliance
- [ ] Zero critical security vulnerabilities

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** 🚧 In Development (MVP Phase)
