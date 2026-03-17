# PRD: AquaticPro — WordPress Plugin → Vercel Standalone App Migration

**Version:** 1.0  
**Date:** March 16, 2026  
**Author:** Swimming Ideas, LLC  
**Status:** Draft  
**Current Plugin Version:** 13.2.7

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Current Architecture Audit](#3-current-architecture-audit)
4. [Target Architecture](#4-target-architecture)
5. [Technology Stack Decision](#5-technology-stack-decision)
6. [Migration Phases](#6-migration-phases)
7. [Phase 0 — Project Scaffolding](#phase-0--project-scaffolding)
8. [Phase 1 — Database Schema Migration](#phase-1--database-schema-migration)
9. [Phase 2 — Authentication & Authorization](#phase-2--authentication--authorization)
10. [Phase 3 — Core API Routes](#phase-3--core-api-routes)
11. [Phase 4 — Frontend API Layer Refactor](#phase-4--frontend-api-layer-refactor)
12. [Phase 5 — Infrastructure Services](#phase-5--infrastructure-services)
13. [Phase 6 — Remaining Modules](#phase-6--remaining-modules)
14. [Phase 7 — Data Migration & Cutover](#phase-7--data-migration--cutover)
15. [API Route Inventory](#api-route-inventory)
16. [Database Table Inventory](#database-table-inventory)
17. [WordPress Dependency Map](#wordpress-dependency-map)
18. [Risk Register](#risk-register)
19. [Effort Estimates](#effort-estimates)
20. [Success Criteria](#success-criteria)

---

## 1. Executive Summary

AquaticPro is a professional aquatic staff development platform currently deployed as a WordPress plugin. It comprises:

- **~1.5 MB of PHP backend code** across 35+ files
- **~446 REST API endpoints** across 21 route files and 4 namespaces
- **65 custom database tables** + 12 Custom Post Types + 3 taxonomies
- **A React 18 SPA frontend** built with Vite, Tailwind CSS, Excalidraw, BlockNote, DnD Kit, Framer Motion, and jsPDF
- **16 feature modules**: Mentorship, Professional Growth, Daily Logs, TaskDeck (Kanban), Awesome Awards, Seasonal Returns & Pay, Mileage Reimbursement, Certificates, LMS/Courses, Whiteboard Lessons, Assigned Learning, New Hires, Email Composer, FOIA Export, Lesson Management (swim lessons), and Dashboard

This PRD defines the plan to migrate AquaticPro to a standalone **Next.js application hosted on Vercel**, backed by **Supabase** (PostgreSQL + Auth + Storage), with **Prisma** ORM, **Resend** for email, and **Upstash Redis** for caching.

---

## 2. Goals & Non-Goals

### Goals

| # | Goal | Rationale |
|---|------|-----------|
| G1 | **Decouple from WordPress** | Eliminate dependency on WP core, WP hosting, PHP runtime, and WP plugin ecosystem |
| G2 | **Deploy on Vercel** | Leverage serverless functions, edge network, automatic CI/CD, preview deployments |
| G3 | **Feature parity** | Every feature in v13.2.7 must work identically in the new app |
| G4 | **Zero data loss** | All production data (users, goals, logs, tasks, etc.) must be migrated |
| G5 | **Improved DX** | TypeScript end-to-end, type-safe API layer, modern tooling |
| G6 | **Preserve the React frontend** | Minimize frontend rewrites — the SPA is already framework-agnostic |
| G7 | **Incremental migration** | Modules can be migrated one at a time; WP and Vercel can run in parallel during transition |

### Non-Goals

| # | Non-Goal |
|---|----------|
| N1 | Redesigning the UI (keep existing React components) |
| N2 | Changing the business logic of any module |
| N3 | Supporting multi-tenancy (this is a single-org app) |
| N4 | Building a mobile app |
| N5 | Migrating the Bento Media Grid shortcode (can remain a standalone embed or be ported later) |
| N6 | Re-implementing the Legacy Import module (one-time migration tool, already done) |

---

## 3. Current Architecture Audit

### 3.1 Backend (PHP / WordPress)

```
mentorship-platform.php          — Plugin bootstrap, CPT registration, DB migrations, WP hooks
includes/
├── admin-settings.php           — WP admin pages, LearnDash config (91K)
├── admin-lesson-setup.php       — Lesson mgmt admin (30K)
├── admin-promotion-setup.php    — Promotion admin (22K)
├── security-helpers.php         — Rate limiting, PII filtering, audit log (34K)
├── api-routes.php               — Core: users, mentors, requests, goals, meetings, updates, portfolio, admin (183K)
├── api-routes-professional-growth.php — Job roles, audits, drills, evaluations, team mgmt (373K)
├── api-routes-seasonal-returns.php    — Pay config, seasons, invites, retention (113K)
├── api-routes-taskdeck.php      — Kanban boards, lists, cards, comments, checklists (109K)
├── api-routes-awesome-awards.php — Award periods, nominations, voting, winners (84K)
├── api-routes-daily-logs.php    — Time slots, permissions, log CRUD, reactions (16K)
├── api-callbacks-daily-logs.php — Daily log endpoint implementations (76K)
├── api-routes-mileage.php       — Mileage entries, locations, budget accounts, reports (59K)
├── api-routes-foia-export.php   — Compliance data export (59K)
├── api-routes-lms.php           — Courses, lessons, sections, quizzes, progress (70K)
├── api-routes-whiteboard.php    — Excalidraw lessons, quizzes, questions (51K)
├── api-routes-lms-assignments.php — Assign lessons to users/roles (38K)
├── api-routes-lms-auto-assign.php — Rules-based course auto-assignment (45K)
├── api-routes-certificates.php  — Cert types, records, role requirements (35K)
├── api-routes-email-composer.php — Compose/send HTML emails (27K)
├── api-routes-new-hires.php     — Applications, approval, LOI (21K)
├── api-routes-dashboard.php     — Settings, weather proxy, action buttons (19K)
├── api-routes-lesson-exports.php — CSV exports (19K)
├── api-routes-goal-changes.php  — Real-time polling (8K)
├── api-routes-legacy-import.php — Pods migration (4K)
├── class-taskdeck.php           — TaskDeck core + tables (16K)
├── class-awesome-awards.php     — Awards core + permissions (24K)
├── class-seasonal-returns.php   — Pay calcs, token validation (71K)
├── class-new-hires.php          — New hires + LOI generation (51K)
├── class-certificates.php       — Cert tracking + tables (29K)
├── class-legacy-import.php      — Pods migration logic (40K)
├── class-daily-logs-webhook.php — n8n weekly export (14K)
├── class-lms-migration.php      — Course ZIP export/import (47K)
├── class-bento-media-grid.php   — Standalone shortcode (23K)
└── lesson-management/
    ├── cpt-registration.php     — 5 CPTs + 3 taxonomies (39K)
    ├── rest-api.php             — Swim lesson REST API (81K)
    ├── email-handler.php        — Lesson email notifications (20K)
    └── api-routes-aquaticpro.php — Public roster, share links (41K)
```

### 3.2 Frontend (React SPA)

```
src/
├── index.tsx                    — App entry point, mounts into <div id="root">
├── App.tsx                      — Router, auth context, module wrappers
├── components/                  — Shared UI components
├── pages/                       — Feature pages (lazy-loaded)
│   ├── AdminPanel/
│   ├── AwardsHub/
│   ├── CareerDevelopment/
│   ├── CertificatesPage/
│   ├── CampOrganizer/
│   ├── DailyLogDashboard/
│   ├── Dashboard/
│   ├── EmailComposer/
│   ├── FOIAExport/
│   ├── LegacyImport/
│   ├── NewHireManager/
│   ├── SeasonalReturns/
│   ├── TaskDeck/
│   ├── UserManagement/
│   ├── WhiteboardLessons/
│   └── ...
├── hooks/                       — Custom React hooks
├── utils/                       — API client, helpers
└── types/                       — TypeScript interfaces
```

**Key frontend libraries (all portable to Next.js):**
- React 18, React DOM
- Tailwind CSS 3
- `@excalidraw/excalidraw` — Whiteboard lessons
- `@blocknote/react` + `@tiptap` — Rich text editor
- `@dnd-kit/*` — Drag-and-drop (TaskDeck, reordering)
- `framer-motion` — Animations
- `jspdf` — PDF generation
- `react-grid-layout` — Dashboard grid
- `react-icons` — Icon library

**WordPress coupling in frontend:**
- `window.mentorshipPlatformData.nonce` — WP REST nonce for auth headers
- `window.mentorshipPlatformData.restUrl` — Base URL for API calls (e.g., `/wp-json/mentorship-platform/v1/`)
- `window.mentorshipPlatformData.userId` — Current user ID
- `window.mentorshipPlatformData.isAdmin` — Admin flag
- `window.mentorshipPlatformData.enabledModules` — Feature flags

### 3.3 Authentication & Authorization (Current)

| Layer | WordPress Mechanism |
|-------|-------------------|
| Transport auth | Cookie-based sessions + `X-WP-Nonce` header |
| Identity | `get_current_user_id()`, WP user table |
| Role system | Custom 6-tier hierarchy in `pg_job_roles` table |
| User → role mapping | `pg_user_job_assignments` (many-to-many) |
| Permission resolution | Per-module permission tables, aggregated via MAX across user's roles |
| Admin override | `mp_is_plugin_admin()` = WP admin OR Tier 6+ |
| Module gating | `get_option('aquaticpro_enable_*')` flags |
| Public endpoints | `'permission_callback' => '__return_true'` |
| LearnDash gate | Optional group-based platform access |
| Member/Visitor | `is_member` + `is_archived` flags |

### 3.4 WordPress Dependencies to Replace

| WP Feature | Usage Count | Replacement |
|------------|------------|-------------|
| `register_rest_route()` | ~446 calls | Next.js API routes |
| `get_current_user_id()` | ~200+ | Supabase Auth session |
| `$wpdb->get_results()` / `->insert()` / etc. | ~500+ | Prisma ORM |
| `get_post_meta()` / `update_post_meta()` | ~100+ | Database columns |
| `get_option()` / `update_option()` | ~45 keys | Settings table + env vars |
| `wp_mail()` | ~15 call sites | Resend API |
| `wp_handle_upload()` | ~5 call sites | Supabase Storage / UploadThing |
| `wp_remote_get()` | ~3 call sites | Native `fetch()` |
| WP Cron (3 jobs) | 3 | Vercel Cron |
| WP Transients | ~20 call sites | Upstash Redis |
| `register_post_type()` | 12 CPTs | Database tables |
| `register_taxonomy()` | 3 | Lookup/join tables |
| `dbDelta()` | ~40 call sites | Prisma migrations |
| LearnDash functions | ~5 call sites | Custom group system or remove |

---

## 4. Target Architecture

```
┌──────────────────────────────────────────────────────┐
│                      VERCEL                          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │           Next.js App (App Router)             │  │
│  │                                                │  │
│  │  ┌──────────┐  ┌──────────────────────────┐   │  │
│  │  │  React   │  │  API Routes (Route        │   │  │
│  │  │  Pages   │  │  Handlers) — 446 endpoints│   │  │
│  │  │  (SPA)   │  │                           │   │  │
│  │  └──────────┘  └─────────┬────────────────┘   │  │
│  │                          │                     │  │
│  │            ┌─────────────┼─────────────┐       │  │
│  │            │             │             │       │  │
│  │     ┌──────▼──┐   ┌─────▼───┐   ┌─────▼───┐  │  │
│  │     │ Prisma  │   │  Auth   │   │ Middle- │  │  │
│  │     │  ORM    │   │  Layer  │   │  ware   │  │  │
│  │     └────┬────┘   └────┬────┘   └─────────┘  │  │
│  └──────────┼─────────────┼──────────────────────┘  │
│             │             │                          │
│  ┌──────────┼─────────────┼──────────────────────┐  │
│  │   Vercel Cron Jobs (3 scheduled tasks)        │  │
│  └──────────┼─────────────┼──────────────────────┘  │
└─────────────┼─────────────┼──────────────────────────┘
              │             │
    ┌─────────▼─────────────▼─────────────────┐
    │            SUPABASE                      │
    │  ┌──────────┐ ┌────────┐ ┌───────────┐  │
    │  │PostgreSQL│ │  Auth  │ │  Storage   │  │
    │  │ (65 tbl) │ │ (JWT)  │ │ (uploads)  │  │
    │  └──────────┘ └────────┘ └───────────┘  │
    └──────────────────────────────────────────┘

    ┌───────────────┐  ┌──────────────┐  ┌───────────┐
    │  Upstash Redis│  │  Resend      │  │  n8n      │
    │  (cache)      │  │  (email)     │  │  (webhook)│
    └───────────────┘  └──────────────┘  └───────────┘
```

---

## 5. Technology Stack Decision

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Framework** | Next.js 15 (App Router) | API routes + React pages in one project; Vercel-native |
| **Language** | TypeScript | End-to-end type safety |
| **Database** | Supabase (PostgreSQL) | Managed, free tier, includes Auth + Storage + Realtime |
| **ORM** | Prisma | Type-safe queries, migration system, schema-first |
| **Authentication** | Supabase Auth | JWT sessions, supports email/password + SSO, RLS-ready |
| **File Storage** | Supabase Storage | Integrated with auth, policies, CDN |
| **Email** | Resend | Clean API, React email templates, Vercel-native |
| **Caching** | Upstash Redis | Serverless Redis, Vercel integration, REST API |
| **Cron Jobs** | Vercel Cron | Native `vercel.json` cron config, triggers API routes |
| **Hosting** | Vercel | Serverless, edge network, preview deploys, CI/CD |
| **Weather/Geo** | Native `fetch()` | Direct API calls from serverless functions |
| **PDF Gen** | Keep `jspdf` (client) | Already works in React; no server PDF needed |

---

## 6. Migration Phases

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6 ──► Phase 7
Scaffold    Database    Auth &      Core API    Frontend    Infra       Remaining   Data
Project     Schema      Roles       Routes      Refactor    Services    Modules     Migration
(1-2 wk)    (2-3 wk)   (2-3 wk)   (6-10 wk)  (2-3 wk)   (1-2 wk)   (3-4 wk)   (1-2 wk)
```

**Total estimated effort: 18–30 weeks (1 developer)**

Each phase has clear entry/exit criteria and can be validated independently.

---

## Phase 0 — Project Scaffolding

**Duration:** 1–2 weeks  
**Entry criteria:** PRD approved  
**Exit criteria:** Project builds, deploys to Vercel, has working health-check endpoint

### Tasks

- [ ] **0.1** Initialize Next.js 15 project with App Router and TypeScript
- [ ] **0.2** Configure Tailwind CSS 3 (port `tailwind.config.js` from current project)
- [ ] **0.3** Set up Prisma with Supabase PostgreSQL connection
- [ ] **0.4** Set up Supabase project (database, auth, storage buckets)
- [ ] **0.5** Set up Upstash Redis account and connection
- [ ] **0.6** Set up Resend account and verify sending domain
- [ ] **0.7** Configure Vercel project with environment variables
- [ ] **0.8** Set up Vercel Cron stub routes in `vercel.json`
- [ ] **0.9** Create project directory structure:

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (public)/
│   ├── apply/page.tsx           — New hire application
│   ├── return/[token]/page.tsx  — Seasonal return form
│   └── swimmer/[token]/page.tsx — Public swimmer progress
├── (app)/
│   ├── layout.tsx               — Authenticated layout shell
│   ├── dashboard/page.tsx
│   ├── mentorship/
│   ├── goals/
│   ├── daily-logs/
│   ├── career/
│   ├── taskdeck/
│   ├── awards/
│   ├── seasonal-returns/
│   ├── mileage/
│   ├── certificates/
│   ├── courses/
│   ├── whiteboard/
│   ├── email-composer/
│   ├── new-hires/
│   ├── lessons/
│   ├── foia-export/
│   └── admin/
├── api/
│   ├── auth/
│   ├── users/
│   ├── mentorship/
│   ├── goals/
│   ├── daily-logs/
│   ├── professional-growth/
│   ├── taskdeck/
│   ├── awesome-awards/
│   ├── seasonal-returns/
│   ├── mileage/
│   ├── certificates/
│   ├── courses/
│   ├── whiteboard/
│   ├── lms-assignments/
│   ├── lms-auto-assign/
│   ├── email-composer/
│   ├── new-hires/
│   ├── lessons/
│   ├── lesson-exports/
│   ├── foia-export/
│   ├── dashboard/
│   └── cron/
│       ├── process-email-queue/route.ts
│       ├── refresh-caches/route.ts
│       └── weekly-webhook/route.ts
lib/
├── prisma/
│   └── schema.prisma
├── auth/
│   ├── session.ts
│   ├── permissions.ts
│   └── middleware.ts
├── email/
│   └── send.ts
├── cache/
│   └── redis.ts
├── storage/
│   └── upload.ts
└── utils/
    ├── api-helpers.ts
    └── constants.ts
```

- [ ] **0.10** Port existing React components into `app/(app)/` pages (keep existing code, just restructure imports)
- [ ] **0.11** Create shared API client (`lib/api-client.ts`) that replaces `window.mentorshipPlatformData` references
- [ ] **0.12** Deploy stub to Vercel, verify health check at `/api/health`

### Deliverable
A deployable Next.js skeleton on Vercel with Supabase connected, Prisma configured, and the React frontend rendering (with API calls stubbed/mocked).

---

## Phase 1 — Database Schema Migration

**Duration:** 2–3 weeks  
**Entry criteria:** Phase 0 complete, Supabase project active  
**Exit criteria:** All 65 tables + CPT-equivalent tables created in PostgreSQL via Prisma migrations

### Tasks

- [ ] **1.1** Translate all 65 custom MySQL tables to Prisma schema models (see [Database Table Inventory](#database-table-inventory))
- [ ] **1.2** Convert 12 Custom Post Types to dedicated Prisma models:

| WP CPT | Prisma Model | Key Fields |
|--------|-------------|------------|
| `mp_request` | `MentorshipRequest` | requester_id, receiver_id, status, message, created_at |
| `mp_goal` | `Goal` | title, description, status, mentorship_id, due_date, portfolio_visible |
| `mp_initiative` | `Initiative` | title, description, goal_id, status, assigned_to |
| `mp_task` | `Task` | title, description, goal_id, initiative_id, status, due_date |
| `mp_meeting` | `Meeting` | title, date, notes, mentorship_id, attendees |
| `mp_update` | `Update` | content, goal_id, author_id, created_at |
| `mp_daily_log` | `DailyLog` | content, author_id, date, time_slot_id, location |
| `lm-swimmer` | `Swimmer` | name, guardian_name, guardian_email, notes |
| `lm-level` | `Level` | name, description, sort_order, color |
| `lm-skill` | `Skill` | name, description, level_id, sort_order |
| `lm-group` | `Group` | name, instructor_ids, level_id, camp, schedule |
| `lm-evaluation` | `Evaluation` | swimmer_id, group_id, skills_json, notes, date |

- [ ] **1.3** Convert 3 taxonomies to lookup tables:

| WP Taxonomy | Prisma Model |
|-------------|-------------|
| `lm_camp` | `Camp` (id, name, slug) + `GroupCamp` join |
| `lm_animal` | `Animal` (id, name, slug) + `GroupAnimal` join |
| `lm_lesson_type` | `LessonType` (id, name, slug) + `GroupLessonType` join |

- [ ] **1.4** Convert ~45 `wp_options` keys to an `AppSettings` table:

| Category | Keys |
|----------|------|
| Module toggles | `aquaticpro_enable_professional_growth`, `aquaticpro_enable_lesson_management`, `aquaticpro_enable_taskdeck`, `aquaticpro_enable_awesome_awards`, `aquaticpro_enable_seasonal_returns`, `aquaticpro_enable_mileage`, `aquaticpro_enable_certificates`, `aquaticpro_enable_lms`, `aquaticpro_enable_whiteboard`, `aquaticpro_enable_new_hires`, `aquaticpro_enable_email_composer`, `aquaticpro_enable_foia_export` |
| Table versions | All `*_table_version` keys |
| Dashboard | Weather API key, zip code, dashboard settings JSON |
| Seasonal Returns | LOI settings, templates, retention config |
| LearnDash | `aquaticpro_learndash_groups` |
| New Hires | Positions config, notification settings |

- [ ] **1.5** Map WordPress `wp_users` + `wp_usermeta` to a `User` Prisma model:

```prisma
model User {
  id             Int       @id @default(autoincrement())
  email          String    @unique
  displayName    String
  firstName      String?
  lastName       String?
  avatarUrl      String?
  phone          String?
  bio            String?
  isMember       Boolean   @default(true)
  isArchived     Boolean   @default(false)
  isWpAdmin      Boolean   @default(false)
  supabaseUid    String    @unique  // Links to Supabase Auth user
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  // Relations
  jobAssignments  UserJobAssignment[]
  mentorshipsSent MentorshipRequest[] @relation("requester")
  mentorshipsReceived MentorshipRequest[] @relation("receiver")
  goals           Goal[]
  dailyLogs       DailyLog[]
  // ... etc
}
```

- [ ] **1.6** Run `prisma migrate dev` to create all tables
- [ ] **1.7** Verify schema with a test seed script
- [ ] **1.8** Document all field mappings (WP meta key → Prisma field)

### Deliverable
Complete Prisma schema with all ~80 models, migrations applied to Supabase PostgreSQL, seed script passing.

---

## Phase 2 — Authentication & Authorization

**Duration:** 2–3 weeks  
**Entry criteria:** Phase 1 complete (User model exists)  
**Exit criteria:** Users can log in, tier-based permissions resolve correctly, all permission middleware working

### Tasks

- [ ] **2.1** Configure Supabase Auth (email/password provider)
- [ ] **2.2** Create login/register pages with Supabase client
- [ ] **2.3** Build session middleware (`lib/auth/session.ts`):
  - Extract Supabase JWT from cookies/headers
  - Resolve `User` record from `supabaseUid`
  - Attach user + permissions to request context
- [ ] **2.4** Build the tier-based permission system (`lib/auth/permissions.ts`):

```typescript
// Replaces mp_is_plugin_admin(), tier checks, per-module permission resolution
interface UserPermissions {
  isAdmin: boolean;           // WP admin OR Tier 6+
  tier: number;               // Max tier across all job role assignments (1-6)
  jobRoles: JobRole[];        // All assigned roles
  modules: {
    dailyLogs: DailyLogPermissions;
    scanAudits: ScanAuditPermissions;
    livedrills: LiveDrillPermissions;
    inservice: InservicePermissions;
    cashierAudits: CashierAuditPermissions;
    taskdeck: TaskDeckPermissions;
    reports: ReportsPermissions;
    instructorEvals: InstructorEvalPermissions;
    lessonManagement: LessonMgmtPermissions;
    awesomeAwards: AwesomeAwardsPermissions;
    seasonalReturns: SeasonalReturnsPermissions;
    certificates: CertificatePermissions;
    // ... per-module permission objects
  };
}

async function resolvePermissions(userId: number): Promise<UserPermissions>;
```

- [ ] **2.5** Create permission guard functions for each endpoint pattern:

| WP Permission Callback | New Guard Function |
|------------------------|-------------------|
| `is_user_logged_in` | `requireAuth()` |
| `current_user_can('manage_options')` | `requireAdmin()` |
| `mentorship_platform_check_access_permission` | `requireMember()` |
| `mp_is_plugin_admin()` | `requirePluginAdmin()` (admin OR tier 6+) |
| `mp_check_tier_5_permission` | `requireTier(5)` |
| `aquaticpro_aa_can_manage_periods` | `requireModulePermission('awesomeAwards', 'can_manage_periods')` |
| ... (per-module) | `requireModulePermission(module, permission)` |

- [ ] **2.6** Create Next.js middleware for auth (redirect unauthenticated users)
- [ ] **2.7** Build member/visitor/archived status checks
- [ ] **2.8** Build LearnDash group replacement (or remove if not needed)
- [ ] **2.9** Test: create test users at each tier, verify all permission paths

### Deliverable
Working login flow, JWT session management, tier-based permission resolution matching WordPress behavior.

---

## Phase 3 — Core API Routes

**Duration:** 6–10 weeks  
**Entry criteria:** Phase 2 complete (auth + permissions working)  
**Exit criteria:** All 446 endpoints reimplemented and returning correct data shapes

This is the largest phase. Convert each module's endpoints from PHP/WordPress to Next.js API routes with Prisma.

### Module Priority Order

Modules are ordered by dependency (earlier modules are depended on by later ones):

| Priority | Module | Endpoints | WP File | Estimated Effort |
|----------|--------|-----------|---------|-----------------|
| **P0** | **Users & Admin** | 38 | `api-routes.php` | 1.5 weeks |
| **P0** | **Professional Growth (Job Roles only)** | 15 | `api-routes-professional-growth.php` (partial) | 1 week |
| **P1** | **Dashboard** | 8 | `api-routes-dashboard.php` | 0.5 weeks |
| **P1** | **Daily Logs** | 28 | `api-routes-daily-logs.php` + `api-callbacks-daily-logs.php` | 1.5 weeks |
| **P1** | **Professional Growth (remaining)** | 65 | `api-routes-professional-growth.php` | 2 weeks |
| **P2** | **TaskDeck** | 37 | `api-routes-taskdeck.php` | 1.5 weeks |
| **P2** | **Awesome Awards** | 31 | `api-routes-awesome-awards.php` | 1 week |
| **P2** | **Seasonal Returns & Pay** | 51 | `api-routes-seasonal-returns.php` | 2 weeks |
| **P3** | **LMS Courses** | 28 | `api-routes-lms.php` | 1.5 weeks |
| **P3** | **Whiteboard Lessons** | 24 | `api-routes-whiteboard.php` | 1 week |
| **P3** | **LMS Assignments** | 9 | `api-routes-lms-assignments.php` | 0.5 weeks |
| **P3** | **LMS Auto-Assign** | 11 | `api-routes-lms-auto-assign.php` | 0.5 weeks |
| **P4** | **Certificates** | 20 | `api-routes-certificates.php` | 1 week |
| **P4** | **Mileage** | 24 | `api-routes-mileage.php` | 1 week |
| **P4** | **New Hires** | 19 | `api-routes-new-hires.php` | 1 week |
| **P4** | **Email Composer** | 10 | `api-routes-email-composer.php` | 0.5 weeks |
| **P5** | **Lesson Management** | 40 | `lesson-management/rest-api.php` + `api-routes-aquaticpro.php` | 2 weeks |
| **P5** | **Lesson Exports** | 8 | `api-routes-lesson-exports.php` | 0.5 weeks |
| **P5** | **FOIA Export** | 4 | `api-routes-foia-export.php` | 0.5 weeks |
| **P5** | **Goal Changes** | 1 | `api-routes-goal-changes.php` | 0.25 weeks |

### Conversion Pattern (for each endpoint)

Each WP `register_rest_route()` becomes a Next.js route handler:

**WordPress (PHP):**
```php
register_rest_route('mentorship-platform/v1', '/goals', [
    'methods' => 'POST',
    'callback' => 'mentorship_platform_create_goal',
    'permission_callback' => 'mentorship_platform_check_access_permission',
]);

function mentorship_platform_create_goal($request) {
    $user_id = get_current_user_id();
    $title = sanitize_text_field($request->get_param('title'));
    // ... $wpdb queries ...
    return new WP_REST_Response($data, 201);
}
```

**Next.js (TypeScript):**
```typescript
// app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await requireMember(req);
  const { title, description, mentorshipId, dueDate } = await req.json();
  
  const goal = await prisma.goal.create({
    data: {
      title,
      description,
      mentorshipId,
      dueDate,
      authorId: user.id,
    },
  });
  
  return NextResponse.json(goal, { status: 201 });
}
```

### Tasks per Module

For each module listed above:
- [ ] Create API route files in `app/api/{module}/`
- [ ] Translate all `$wpdb` queries to Prisma calls
- [ ] Translate all `sanitize_text_field()` / `absint()` to Zod validation schemas
- [ ] Wire up permission guards from Phase 2
- [ ] Write integration tests comparing response shapes
- [ ] Verify against the original endpoint's expected payload

### Deliverable
All 446 API routes implemented, returning data shapes matching the WordPress API.

---

## Phase 4 — Frontend API Layer Refactor

**Duration:** 2–3 weeks  
**Entry criteria:** Phase 3 in progress (core modules done)  
**Exit criteria:** React SPA fetches from Next.js API routes instead of WP REST API

### Tasks

- [ ] **4.1** Create a centralized API client (`lib/api-client.ts`):

```typescript
// Replaces all window.mentorshipPlatformData references
const apiClient = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Supabase session cookie
    });
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  },
  
  async post<T>(path: string, body: unknown): Promise<T> { /* ... */ },
  async put<T>(path: string, body: unknown): Promise<T> { /* ... */ },
  async delete<T>(path: string): Promise<T> { /* ... */ },
};
```

- [ ] **4.2** Search-and-replace all fetch calls that reference `mentorshipPlatformData.restUrl`:
  - Replace `/wp-json/mentorship-platform/v1/` → `/api/`
  - Replace `/wp-json/aquaticpro/v1/` → `/api/`
  - Replace `/wp-json/lm/v1/` → `/api/lessons/`
  - Replace `/wp-json/mentorship/v1/` → `/api/whiteboard/`
- [ ] **4.3** Remove all `X-WP-Nonce` header additions (Supabase uses cookies/JWT)
- [ ] **4.4** Remove `window.mentorshipPlatformData` references:

| Old Reference | New Source |
|---------------|-----------|
| `mentorshipPlatformData.nonce` | Removed (Supabase cookie auth) |
| `mentorshipPlatformData.restUrl` | `process.env.NEXT_PUBLIC_API_URL` |
| `mentorshipPlatformData.userId` | Supabase `useUser()` hook |
| `mentorshipPlatformData.isAdmin` | `usePermissions()` hook |
| `mentorshipPlatformData.enabledModules` | `/api/settings` endpoint |
| `mentorshipPlatformData.pluginUrl` | `process.env.NEXT_PUBLIC_APP_URL` |
| `mentorshipPlatformData.userMeta.*` | `/api/users/me` endpoint |

- [ ] **4.5** Create `useAuth()` and `usePermissions()` React hooks using Supabase client
- [ ] **4.6** Update all file upload components to use Supabase Storage
- [ ] **4.7** Test each page/feature to verify data loads correctly from new API

### Deliverable
React frontend fully wired to Next.js API routes; no WordPress references remaining.

---

## Phase 5 — Infrastructure Services

**Duration:** 1–2 weeks  
**Entry criteria:** Phase 3 core modules done  
**Exit criteria:** Email, cron, file uploads, caching all working

### Tasks

- [ ] **5.1** **Email Service** — Replace `wp_mail()` with Resend:

```typescript
// lib/email/send.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  return resend.emails.send({
    from: 'AquaticPro <notifications@yourdomain.com>',
    ...options,
  });
}
```

Email call sites to update:
  - [ ] Seasonal return invites/follow-ups
  - [ ] Awesome Awards winner notifications
  - [ ] LMS assignment notifications/reminders
  - [ ] Email Composer (admin-composed emails)
  - [ ] New hire application notifications
  - [ ] Lesson Management email handler
  - [ ] Email queue processor

- [ ] **5.2** **Cron Jobs** — Configure in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-email-queue",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/refresh-caches",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/weekly-webhook",
      "schedule": "0 4 * * 5"
    }
  ]
}
```

  - [ ] Email queue processor (every 15 min)
  - [ ] SRM pay cache + in-service hours cache refresh (every 6 hours)
  - [ ] n8n daily logs webhook (Fridays at 4 AM)

- [ ] **5.3** **File Storage** — Replace WP Media Library:
  - [ ] Create Supabase Storage buckets: `avatars`, `attachments`, `certificates`, `lesson-files`
  - [ ] Build upload API route (`/api/upload`)
  - [ ] Configure storage policies (authenticated uploads, public read for avatars)
  - [ ] Update TaskDeck attachment endpoints
  - [ ] Update certificate file upload
  - [ ] Update lesson content file uploads

- [ ] **5.4** **Caching** — Replace WP Transients with Upstash Redis:

```typescript
// lib/cache/redis.ts
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export async function cacheGet<T>(key: string): Promise<T | null> {
  return redis.get(key);
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number) {
  if (ttlSeconds) return redis.setex(key, ttlSeconds, value);
  return redis.set(key, value);
}

export async function cacheDelete(key: string) {
  return redis.del(key);
}
```

Cache sites to update:
  - [ ] Job roles list (transient: 1 hour)
  - [ ] Time slots list (transient: 1 hour)
  - [ ] User directory index
  - [ ] SRM pay rate cache
  - [ ] In-service hours cache
  - [ ] Lesson Management cached data (swimmers, levels, skills, groups)

- [ ] **5.5** **Weather/Geo Proxy** — Replace `wp_remote_get()`:
  - [ ] `/api/dashboard/weather` → direct `fetch()` to OpenWeatherMap
  - [ ] Google Geocoding → direct `fetch()` to Google Maps API

### Deliverable
All infrastructure services operational: emails send, crons fire, files upload, caches work.

---

## Phase 6 — Remaining Modules

**Duration:** 3–4 weeks  
**Entry criteria:** Phases 3–5 substantially complete  
**Exit criteria:** Full feature parity with WordPress plugin v13.2.7

### Tasks

- [ ] **6.1** Security helpers migration:
  - [ ] Rate limiting → Upstash ratelimit (`@upstash/ratelimit`)
  - [ ] PII filtering → Port PHP logic to TypeScript utility
  - [ ] Audit logging → Database table + Prisma writes

- [ ] **6.2** WP Admin settings pages → Next.js admin panel:
  - [ ] Module enable/disable toggles
  - [ ] LearnDash group config → custom group config (or remove)
  - [ ] Dashboard settings
  - [ ] All settings currently in WP admin

- [ ] **6.3** Bento Media Grid (optional):
  - [ ] Port standalone shortcode to a Next.js page/component
  - [ ] Or keep as embedded iframe

- [ ] **6.4** Legacy Import module:
  - [ ] Skip (non-goal per N6) or port as admin-only tool

- [ ] **6.5** Course export/import (ZIP-based):
  - [ ] Port `class-lms-migration.php` to serverless function
  - [ ] Use Supabase Storage for temp ZIP files

- [ ] **6.6** PDF generation:
  - [ ] Mileage reports (currently `jspdf` client-side) — no change needed
  - [ ] LOI generation for new hires — port PHP PDF logic to client-side `jspdf` or server-side `@react-pdf/renderer`

- [ ] **6.7** Public-facing pages (no auth required):
  - [ ] New hire application form (`/apply`)
  - [ ] Seasonal return form (`/return/[token]`)
  - [ ] Public swimmer progress (`/swimmer/[token]`)
  - [ ] Portfolio directory + individual portfolios

- [ ] **6.8** Real-time features:
  - [ ] Goal changes polling → Consider upgrading to Supabase Realtime subscriptions
  - [ ] Camp organizer locking → Supabase Realtime or polling

- [ ] **6.9** Comprehensive testing pass:
  - [ ] Test every module as admin user
  - [ ] Test every module as each tier level (1-6)
  - [ ] Test public endpoints (no auth)
  - [ ] Test edge cases: archived users, visitors, multi-role users

### Deliverable
Complete feature parity verified. All modules working in the new architecture.

---

## Phase 7 — Data Migration & Cutover

**Duration:** 1–2 weeks  
**Entry criteria:** Phase 6 complete, full feature parity confirmed  
**Exit criteria:** Production data migrated, old WP plugin deactivated, Vercel app is primary

### Tasks

- [ ] **7.1** Build data migration scripts:

```
WordPress MySQL → Supabase PostgreSQL

Scripts needed:
├── migrate-users.ts            — wp_users + wp_usermeta → User table + Supabase Auth
├── migrate-cpts.ts             — All 12 CPTs + meta → dedicated tables
├── migrate-taxonomies.ts       — Terms → lookup tables
├── migrate-custom-tables.ts    — Direct table-to-table (65 tables)
├── migrate-options.ts          — wp_options → AppSettings
├── migrate-media.ts            — WP uploads → Supabase Storage
└── verify-migration.ts         — Count checks, spot checks, data integrity
```

- [ ] **7.2** Run migration against a staging copy of production data
- [ ] **7.3** Verify data integrity:
  - [ ] User count matches
  - [ ] Row counts match for every table
  - [ ] Spot-check 10 records per table for data accuracy
  - [ ] File attachments accessible
  - [ ] All user passwords work (re-create via Supabase Auth invite flow)
- [ ] **7.4** Plan cutover sequence:
  1. Put WP site in maintenance mode
  2. Run final migration (delta since staging migration)
  3. Update DNS / configure Vercel custom domain
  4. Send password reset emails to all users (Supabase Auth)
  5. Switch traffic to Vercel
  6. Monitor for 48 hours
  7. Deactivate WP plugin
- [ ] **7.5** Create rollback plan (keep WP site available for 30 days)
- [ ] **7.6** Execute cutover
- [ ] **7.7** Post-migration monitoring and bug fixes

### Deliverable
Production app running on Vercel with all data migrated and users onboarded.

---

## API Route Inventory

Complete inventory of all 446 endpoints to be migrated, grouped by module:

| Module | File(s) | Endpoints | Namespaces |
|--------|---------|-----------|------------|
| Core Mentorship (Users, Mentors, Requests, Goals, Meetings, Updates, Portfolio, Admin) | `api-routes.php` | 38 | `mentorship-platform/v1` |
| Professional Growth (Job Roles, Criteria, Progress, In-Service, Scan Audits, Cashier Audits, Live Drills, Instructor Evals, Team, Reports, Locations) | `api-routes-professional-growth.php` | 80 | `mentorship-platform/v1` |
| Seasonal Returns & Pay (Pay Config, Seasons, Employees, Invites, Templates, Retention, Longevity, Work Years) | `api-routes-seasonal-returns.php` | 51 | `mentorship-platform/v1` |
| Lesson Management Core (Groups, Swimmers, Levels, Skills, Evaluations, Lock System, Camp Organizer) | `lesson-management/rest-api.php` | 27 | `lm/v1` |
| TaskDeck / Kanban (Decks, Lists, Cards, Comments, Checklists, Attachments, Activity) | `api-routes-taskdeck.php` | 37 | `mentorship-platform/v1` |
| Awesome Awards (Periods, Categories, Nominations, Voting, Winners, Permissions) | `api-routes-awesome-awards.php` | 31 | `mentorship-platform/v1` |
| Daily Logs (Time Slots, Permissions, Logs, Reactions, Import) | `api-routes-daily-logs.php` + `api-callbacks-daily-logs.php` | 28 | `mentorship-platform/v1` |
| LMS Courses (Courses, Lessons, Sections, Progress, Categories, Import/Export) | `api-routes-lms.php` | 28 | `aquaticpro/v1` |
| Mileage Reimbursement (Settings, Locations, Budget Accounts, Entries, Reports) | `api-routes-mileage.php` | 24 | `mentorship-platform/v1` |
| Whiteboard Lessons (Sections, Whiteboards, Quizzes, Questions, Progress) | `api-routes-whiteboard.php` | 24 | `mentorship/v1` |
| Certificates (Types, Records, Role Requirements, Permissions, Alerts) | `api-routes-certificates.php` | 20 | `mentorship-platform/v1` |
| New Hires (Application, Status, LOI, Positions, Bulk Archive) | `api-routes-new-hires.php` | 19 | `mentorship-platform/v1` |
| Lesson Management (AquaticPro) (Rosters, Share Links, Email Settings) | `lesson-management/api-routes-aquaticpro.php` | 13 | `mentorship-platform/v1` |
| LMS Auto-Assign (Rules, Course Assignments, Sync) | `api-routes-lms-auto-assign.php` | 11 | `aquaticpro/v1` |
| Email Composer (Send, Templates, History, Recipients) | `api-routes-email-composer.php` | 10 | `mentorship-platform/v1` |
| LMS Assignments (Assignment Campaigns, Send, Remind, Progress) | `api-routes-lms-assignments.php` | 9 | `aquaticpro/v1` |
| Dashboard (Settings, Weather, Action Buttons) | `api-routes-dashboard.php` | 8 | `mentorship-platform/v1` |
| Lesson Exports (CSV: Groups, Swimmers, Evaluations, Levels, Skills) | `api-routes-lesson-exports.php` | 8 | `mentorship-platform/v1` |
| Legacy Import (Summary, Sample, Run, Rollback) | `api-routes-legacy-import.php` | 5 | `mentorship-platform/v1` |
| FOIA Export (Users, Record Types, Preview, Download) | `api-routes-foia-export.php` | 4 | `mentorship-platform/v1` |
| Goal Changes (Polling) | `api-routes-goal-changes.php` | 1 | `mentorship-platform/v1` |
| **TOTAL** | **21 files** | **~446** | **4 namespaces** |

---

## Database Table Inventory

### Custom Tables (65)

**Core Platform**
| # | Table | Module |
|---|-------|--------|
| 1 | `mp_time_slots` | Daily Logs |
| 2 | `mp_daily_log_permissions` | Daily Logs |
| 3 | `mp_daily_log_reactions` | Daily Logs (legacy) |
| 4 | `mp_comment_reactions` | Daily Logs (legacy) |
| 5 | `aqp_unified_reactions` | Unified reactions |
| 6 | `aqp_dashboard_action_buttons` | Dashboard |

**Professional Growth (16 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 7 | `pg_job_roles` | Job role definitions with tier levels |
| 8 | `pg_user_job_assignments` | User→role mappings |
| 9 | `pg_scan_audit_permissions` | Scan audit role permissions |
| 10 | `pg_live_drill_permissions` | Live drill role permissions |
| 11 | `pg_inservice_permissions` | In-service training role permissions |
| 12 | `pg_cashier_audit_permissions` | Cashier audit role permissions |
| 13 | `pg_taskdeck_permissions` | TaskDeck role permissions |
| 14 | `pg_reports_permissions` | Reports role permissions |
| 15 | `pg_instructor_evaluation_permissions` | Instructor eval role permissions |
| 16 | `pg_lesson_management_permissions` | Lesson mgmt role permissions |
| 17 | `pg_inservice_logs` | In-service training logs |
| 18 | `pg_inservice_attendees` | Training attendance records |
| 19 | `pg_inservice_cache` | Pre-calculated monthly hours cache |
| 20 | `pg_promotion_criteria` | Promotion criteria definitions |
| 21 | `pg_user_criterion_progress` | User promotion progress |
| 22 | `pg_criterion_activities` | Progress activity log |

**Audit Tables**
| # | Table | Purpose |
|---|-------|---------|
| 23 | `pg_scan_audits` | Scan audit records |
| 24 | `pg_cashier_audits` | Cashier audit records |
| 25 | `pg_live_drills` | Live drill records |
| 26 | `pg_instructor_evaluations` | Instructor evaluation records |
| 27 | `pg_locations` | Location definitions |

**TaskDeck (7 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 28 | `aqp_taskdecks` | Kanban boards |
| 29 | `aqp_tasklists` | Board columns/lists |
| 30 | `aqp_taskcards` | Cards |
| 31 | `aqp_card_comments` | Card comments |
| 32 | `aqp_card_attachments` | Card file attachments |
| 33 | `aqp_card_checklists` | Card checklist items |
| 34 | `aqp_activity_log` | Card activity log |

**Awesome Awards (7 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 35 | `awesome_awards_periods` | Award periods |
| 36 | `awesome_awards_categories` | Categories per period |
| 37 | `awesome_awards_nominations` | Nominations |
| 38 | `awesome_awards_votes` | Votes |
| 39 | `awesome_awards_announcements_seen` | Winner announcement tracking |
| 40 | `awesome_awards_permissions` | Role-based permissions |
| 41 | `awesome_awards_taskdeck_cards` | TaskDeck integration |

**Seasonal Returns & Pay (10 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 42 | `srm_pay_config` | Pay rates |
| 43 | `srm_seasons` | Season definitions |
| 44 | `srm_employee_seasons` | Employee return status |
| 45 | `srm_email_templates` | Return invite templates |
| 46 | `srm_email_log` | Email send tracking |
| 47 | `srm_retention_stats` | Retention statistics |
| 48 | `srm_permissions` | Role-based permissions |
| 49 | `srm_longevity_rates` | Longevity bonus rates |
| 50 | `srm_employee_work_years` | Work history |
| 51 | `srm_pay_cache` | Pre-calculated pay cache |

**LMS / Learning (8 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 52 | `aquaticpro_courses` | Courses |
| 53 | `aquaticpro_lessons` | Lessons |
| 54 | `aquaticpro_lesson_sections` | Course sections |
| 55 | `aquaticpro_learning_assignments` | Assignment campaigns |
| 56 | `aquaticpro_learning_assignment_users` | Per-user assignments |
| 57 | `aquaticpro_email_queue` | Batch email queue |
| 58 | `aquaticpro_course_auto_assign_rules` | Auto-assign rules |
| 59 | `aquaticpro_course_assignments` | Course assignments |

**Whiteboard Lessons (5 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 60 | `mp_wb_lesson_sections` | Section definitions |
| 61 | `mp_wb_whiteboards` | Excalidraw JSON data |
| 62 | `mp_wb_quizzes` | Quiz definitions |
| 63 | `mp_wb_quiz_questions` | Quiz questions |
| 64 | `mp_wb_progress` | User progress |

**Certificates (4 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 65 | `aquaticpro_certificate_types` | Cert type definitions |
| 66 | `aquaticpro_user_certificates` | User cert records |
| 67 | `aquaticpro_cert_role_requirements` | Role→cert requirements |
| 68 | `aquaticpro_cert_permissions` | Role permissions |

**Email Composer (2 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 69 | `aquaticpro_email_composer_templates` | Saved templates |
| 70 | `aquaticpro_email_composer_log` | Send log |

**Mileage Reimbursement (5 tables)**
| # | Table | Purpose |
|---|-------|---------|
| 71 | `mp_mileage_settings` | Module settings |
| 72 | `mp_mileage_locations` | Preset locations |
| 73 | `mp_mileage_budget_accounts` | Budget accounts |
| 74 | `mp_mileage_entries` | Entries |
| 75 | `mp_mileage_entry_stops` | Multi-stop route data |

**New Hires (1 table)**
| # | Table | Purpose |
|---|-------|---------|
| 76 | `aquaticpro_new_hires` | Applications |

**Security (1 table)**
| # | Table | Purpose |
|---|-------|---------|
| 77 | `mp_audit_log` | Security audit log |

### Custom Post Types → New Tables (12)
| # | CPT Slug | New Table Name |
|---|----------|---------------|
| 78 | `mp_request` | `mentorship_requests` |
| 79 | `mp_goal` | `goals` |
| 80 | `mp_initiative` | `initiatives` |
| 81 | `mp_task` | `tasks` |
| 82 | `mp_meeting` | `meetings` |
| 83 | `mp_update` | `updates` |
| 84 | `mp_daily_log` | `daily_logs` |
| 85 | `lm-swimmer` | `swimmers` |
| 86 | `lm-level` | `levels` |
| 87 | `lm-skill` | `skills` |
| 88 | `lm-group` | `groups` |
| 89 | `lm-evaluation` | `evaluations` |

### Taxonomy → New Tables (3)
| # | Taxonomy | New Table |
|---|----------|-----------|
| 90 | `lm_camp` | `camps` + `group_camps` |
| 91 | `lm_animal` | `animals` + `group_animals` |
| 92 | `lm_lesson_type` | `lesson_types` + `group_lesson_types` |

### Users + Settings
| # | WP Source | New Table |
|---|-----------|-----------|
| 93 | `wp_users` + `wp_usermeta` | `users` |
| 94 | `wp_options` (45 keys) | `app_settings` |

**Total new PostgreSQL tables: ~100**

---

## WordPress Dependency Map

Every WordPress function/API used and its replacement:

| WP Function/Feature | Usage | Replacement |
|---------------------|-------|-------------|
| `register_rest_route()` | 446 routes | Next.js route handlers (`app/api/`) |
| `get_current_user_id()` | ~200+ | Supabase `auth.getUser()` → User lookup |
| `$wpdb->get_results()` | ~300+ | `prisma.model.findMany()` |
| `$wpdb->insert()` | ~100+ | `prisma.model.create()` |
| `$wpdb->update()` | ~100+ | `prisma.model.update()` |
| `$wpdb->delete()` | ~50+ | `prisma.model.delete()` |
| `$wpdb->prepare()` | ~200+ | Prisma parameterized queries (built-in) |
| `get_post_meta()` | ~80+ | Direct column access via Prisma |
| `update_post_meta()` | ~50+ | `prisma.model.update()` |
| `get_option()` | ~45 keys | `prisma.appSettings.findUnique()` |
| `update_option()` | ~20 keys | `prisma.appSettings.upsert()` |
| `wp_mail()` | ~15 sites | `resend.emails.send()` |
| `wp_handle_upload()` | ~5 sites | Supabase Storage `upload()` |
| `wp_insert_attachment()` | ~3 sites | Supabase Storage + DB record |
| `wp_remote_get()` | ~3 sites | Native `fetch()` |
| `set_transient()` / `get_transient()` | ~20 sites | Upstash Redis `set()` / `get()` |
| `register_post_type()` | 12 CPTs | Prisma models |
| `register_taxonomy()` | 3 | Prisma models + join tables |
| `wp_schedule_event()` | 3 cron jobs | Vercel Cron (`vercel.json`) |
| `sanitize_text_field()` | ~100+ | Zod schema validation |
| `absint()` | ~50+ | Zod `z.number().int().positive()` |
| `wp_kses_post()` | ~20+ | DOMPurify (client) or `sanitize-html` (server) |
| `is_user_logged_in()` | ~50 | `requireAuth()` middleware |
| `current_user_can('manage_options')` | ~20 | `requireAdmin()` middleware |
| `WP_REST_Response` | ~300+ | `NextResponse.json()` |
| `WP_Error` | ~100+ | `NextResponse.json(error, { status })` |
| `dbDelta()` | ~40 | Prisma migrations |
| `add_action()` / `add_filter()` | ~30 | Direct function calls / middleware |
| `wp_enqueue_script()` / `wp_enqueue_style()` | ~10 | Next.js built-in bundling |
| `wp_localize_script()` | 1 | Environment variables + API calls |
| `wp_create_nonce()` | 1 | Supabase JWT (automatic) |
| `do_shortcode()` | 2 | React components / Next.js pages |
| LearnDash functions | ~5 | Custom group system or remove |

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **Data migration errors** — mismatch between WP and PostgreSQL data types/encoding | High | Run migration against staging data first; automated verification script |
| R2 | **User password migration** — WP uses `phpass` hashing, Supabase uses `bcrypt` | High | Can't migrate passwords directly. Use Supabase "Magic Link" or "Invite" flow to re-onboard all users with password reset |
| R3 | **Vercel function timeout** — serverless functions have 10s timeout (hobby) / 60s (pro) | Medium | Optimize heavy queries; move long-running operations (FOIA export, bulk operations) to background jobs or streaming responses |
| R4 | **Missing business logic** — subtle PHP behaviors may be lost in translation | Medium | Side-by-side comparison of API responses; comprehensive integration tests |
| R5 | **LearnDash dependency** — if active users depend on LD group access | Low | Build equivalent group system or confirm LD integration can be dropped |
| R6 | **File storage migration** — WP uploads may have complex directory structures | Medium | Flatten to Supabase Storage buckets with UUID filenames; maintain a redirect map |
| R7 | **Third-party API rate limits** — OpenWeatherMap, Google Geocoding | Low | Same limits apply; add caching with Upstash |
| R8 | **Concurrent development** — if WP plugin continues to receive updates during migration | Medium | Feature-freeze the WP plugin during Phase 7 cutover |
| R9 | **Cost** — Supabase, Vercel Pro, Upstash, Resend monthly costs | Low | All have generous free tiers; Pro tiers are ~$25-50/mo combined |
| R10 | **Bundle size** — Next.js serverless functions have 50MB limit | Low | Use dynamic imports for heavy libs (Excalidraw); keep route handlers lean |

---

## Effort Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 — Project Scaffolding | 1–2 weeks | None |
| Phase 1 — Database Schema | 2–3 weeks | Phase 0 |
| Phase 2 — Auth & Roles | 2–3 weeks | Phase 1 |
| Phase 3 — Core API Routes | 6–10 weeks | Phase 2 |
| Phase 4 — Frontend Refactor | 2–3 weeks | Phase 3 (partial) |
| Phase 5 — Infrastructure | 1–2 weeks | Phase 3 (partial) |
| Phase 6 — Remaining Modules | 3–4 weeks | Phases 3-5 |
| Phase 7 — Data Migration | 1–2 weeks | Phase 6 |
| **TOTAL** | **18–30 weeks** | (1 developer) |

**Note:** Phases 3, 4, and 5 can be parallelized after the first few P0 modules are complete in Phase 3.

---

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| SC1 | All 446 API endpoints return identical data shapes | Automated response comparison tests |
| SC2 | All 100+ database tables created with correct schema | Prisma migration + seed verification |
| SC3 | All user accounts migrated with working login | User count match + login test per tier |
| SC4 | All file attachments accessible | File count match + random sample verification |
| SC5 | All 3 cron jobs executing on schedule | Vercel Cron logs + email queue processing verification |
| SC6 | Page load performance equal or better | Lighthouse scores ≥ current |
| SC7 | No WP references in codebase | `grep -r "wordpress\|wp_\|wpdb\|mentorshipPlatformData" src/` returns zero |
| SC8 | Zero data loss | Row count verification for every table |
| SC9 | All permission levels working correctly | Manual test matrix: 6 tiers × 16 modules |
| SC10 | Public endpoints work without auth | Test: new hire form, seasonal return form, swimmer progress, portfolio |

---

## Appendix A — Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Database (Prisma)
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Resend (Email)
RESEND_API_KEY=re_xxxxx

# External APIs
OPENWEATHERMAP_API_KEY=xxxxx
GOOGLE_GEOCODING_API_KEY=xxxxx

# n8n Webhook
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/daily-logs

# App
NEXT_PUBLIC_APP_URL=https://aquaticpro.vercel.app
CRON_SECRET=xxxxx  # Verify cron requests are from Vercel
```

---

## Appendix B — URL Mapping

| WordPress URL Pattern | Next.js URL |
|----------------------|-------------|
| `/wp-json/mentorship-platform/v1/*` | `/api/*` |
| `/wp-json/aquaticpro/v1/*` | `/api/*` |
| `/wp-json/lm/v1/*` | `/api/lessons/*` |
| `/wp-json/mentorship/v1/*` | `/api/whiteboard/*` |
| `/?page=aquaticpro` (WP shortcode page) | `/` (Next.js root) |
| Plugin admin settings | `/admin/settings` |

---

*End of PRD*
