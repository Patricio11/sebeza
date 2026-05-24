# SEBENZA  NATIONAL TALENT PLATFORM ROADMAP (v1.0)
**Project:** Sebenza *(working name)*  South African Talent-Intelligence Platform
**Strategy:** "The trustworthy, real-time layer for South African work."
**Goal:** A fast, accessible, POPIA-compliant platform that matches talent by skill + location,
keeps employment data *fresh*, and exposes employment analytics the state can't currently see.

> **Tone rule (non-negotiable in product copy):** Never name the incumbent national registry in
> user-facing copy. Never compare. Sebenza stands on its own merits.

**Companion docs:** `TO_START_EVERY_SESSION.md` (always-on context + rules) · `UX_UI_SPEC.md` (design system, Phase 1 screen-by-screen, typed mock-data layer, expanded Phases 2–6). Read all three together.

---

## 🎯 EXECUTIVE SUMMARY

Sebenza is a national talent-intelligence platform for South Africa. The existing national
talent registry is mandated and free but suffers from stale, unreliable data. We do not rebuild
that registry  we win on **data quality, usability, and analytics.** The system has three surfaces:

- **Public / Job-Seeker:** create a verified-ish profile, keep a *live* employment status, get found.
- **Employer / Recruiter:** search talent by skill + location + status, shortlist, contact, log hires.
- **Government / Policy:** real-time employment analytics, skills-gap signals, exportable insight.

### Core Domain Rules
| Rule | Description |
|------|-------------|
| **No-Flash** | Must work on a low-end Android over 3G. Performance + accessibility beat aesthetics. |
| **Location-Not-Nationality** | Filter by residence/work + skill. Nationality is shown, never a gate. |
| **POPIA-First** | Consent, encryption, audit log, erasure built in from day one. |
| **Redaction** | ID numbers / docs / contact never in public or search payloads. |
| **Verification-Honesty** | Never show "Verified" for self-reported data. Default `unverified`. |
| **Status-Freshness** | Employment status is time-aware; stale = down-ranked + nudged. |
| **Placement-Truth** | A hire counts in analytics only when confirmed via the platform. |

### Roles
`seeker` · `employer` · `admin`

---

## 🧱 PHASE 0: FOUNDATIONS & COMPLIANCE SPINE ✅ *(done 2026-05-21)*
*Goal: A correct skeleton with POPIA infrastructure present before any real PII exists.*

### Task 0.1: Project Skeleton
- [x] Next.js 16 (App Router, **no `src`**), TypeScript strict, ESLint/Prettier.
- [x] Tailwind v4 + shadcn/ui base; Lucide icons; design tokens (trust palette, high-contrast).
- [x] Folder layout:
  ```
  app/[locale]/   # next-intl locale routing → route groups: (public) (seeker) (employer) (admin)
  messages/       # i18n catalogs: en.json, zu.json, xh.json, af.json …
  components/     # ui/ + feature components
  db/             # drizzle schema, client, query fns, migrations
  lib/            # auth, validation (zod), storage (r2), search, crypto, audit
  emails/         # react-email templates
  ```
- [x] Neon project + Drizzle client + drizzle-kit migrations wired. **Confirm Neon region & document data residency (likely EU → POPIA cross-border note).** *(client + schema scaffolded; live Neon connection pending Phase 4)*
- [x] **i18n seam:** next-intl with `app/[locale]/…` routing + locale detection. All UI text in message catalogs from commit one (no hardcoded strings). Base locale `en`; Tier 1 catalogs scaffolded (see Phase 10).

### Task 0.2: POPIA Infrastructure (build NOW)
- [x] `consents` table + consent-capture util (versioned, purpose-specified). *(schema + lib/consent state machine; UI lives in Phase 1.5 / Phase 2)*
- [x] `audit_log` table + `logAccess()` helper invoked on every PII read/export. *(ring-buffer impl + admin viewer wired; persistent table in Phase 4)*
- [x] Field-level encryption util (`lib/crypto`) for ID numbers; AES-GCM; key via env/KMS.
- [x] Soft-delete convention (`deletedAt`) + erasure job stub (right to deletion).
- [x] Role-based access guard (`lib/auth/guard.ts`)  least privilege.

### Task 0.3: Design System
- [x] Trust-forward tokens: calm palette, AA contrast, large tap targets, system fonts (no heavy webfont). *(Fraunces + Hanken Grotesk subset; warm institutional palette; tokens in `app/globals.css` via `@theme`)*
- [x] Reusable: `VerificationBadge`, `StatusChip` (with freshness), `ProfileCompleteness`, `EmptyState`, `Toast`. *(plus `TalentRosterItem`, `StatCard`, `DataSpine`, `Skeleton`)*
- [x] **No-Flash budget:** define a performance budget (JS < ~150KB on key routes, no blocking media). *(documented in `CLAUDE.md`; enforced in Phase 10 audit)*

---

## 🔎 PHASE 1: THE PUBLIC FACE & SEARCH ✅ *(done 2026-05-21)*
*Goal: The core "search chefs in Cape Town" experience. Production-grade, mock data first.*
> **Full screen-by-screen UX, design system, signature components, and the typed mock-data layer live in `UX_UI_SPEC.md`. The tasks below are the checklist; that doc is the detail.**

### Task 1.1: Landing Page
- [x] Clear value prop: "Find skilled people near you. Get found for the work you do."
- [x] One prominent search bar (profession + location). No 3D, no hero video.
- [x] Trust strip: verification, POPIA compliance, (future) government partnership. *(live freshness dossier + national pulse strip)*
- [x] Dual CTA: "Find talent" (employer) / "Create your profile" (seeker). *(plus government split panel)*

### Task 1.2: The Search Experience (core USP)
- [x] Search input: profession/skill (autocomplete from taxonomy) + location (province → city).
- [x] Filters: skill, location, employment status, seniority, verification level, nationality (optional).
- [x] Results list: name, profession, city, top skills, **status chip with freshness**, verification badge, completeness.
- [x] Ranking: text relevance × status confidence × completeness × (citizen highlight, per rules). *(in `lib/mock/helpers.rankProfiles`; mirrors Phase 4 SQL)*
- [x] **Redaction enforced:** no ID numbers, no documents, no raw contact in results payload.
- [x] Mobile-first results; skeleton loading; data-light pagination.

### Task 1.3: Public Profile View
- [x] Read-only profile: headline, skills, experience, qualifications (titles + verification state only).
- [x] Documents/contact gated behind verified-employer + consent + audit log. *("Recorded access" locked panels render in place)*
- [x] "Report profile" affordance (moderation feed).

---

## 🧭 PHASE 1.5: AUTH UI + ROLE DASHBOARDS (mock-driven) ✅ *(core done 2026-05-21 · Career compass 2026-05-21 · Student mode 2026-05-22 · search/gov/SAQA wire-up deferred to Phases 4/6/8 as scheduled)*
*Goal: Make Phase 1 a complete walk-through of all three user roles before Phase 2 wires real auth. Every screen is built on the `dataProvider` seam; Phase 2 swaps in Better Auth + real consent persistence without changing these UIs.*

> Phase 1.5 brings forward the **UI layer** of Phases 2, 3, 5 and 7 so the platform demos end-to-end as the three-role product it is. The data/auth wiring stays in those later phases.

### Task 1.5.1: Auth surfaces (UI only; Better Auth wires in Phase 2)
- [x] `/sign-in`  single entry for all roles (seeker / employer / admin) with role chip selector. 2FA notice for employer + admin.
- [x] `/sign-up`  role chooser: **Job seeker** (consumer) vs **Employer / recruiter** (org). Admin sign-up notice: issued by Sebenza, not self-registered.
- [x] `/sign-up/seeker`  3-step onboarding: identity basics → consent capture → first profile fields. Resumable; ID number marked encrypted-on-save.
- [x] `/sign-up/employer`  registers an `organization (unverified)`; explains the verification gate up front; flags 2FA mandatory.
- [x] `/verify-email` + `/forgot-password`  UI stubs ready for Resend wire-up in Phase 8.
- [x] Update `SiteHeader` to expose Sign in / Get started; demo-mode notice everywhere auth touches.

### Task 1.5.2: Seeker dashboard (full workspace, not a tile)
- [x] `/dashboard` shell with sidebar (desktop) + bottom tab bar (mobile); Civic Editorial chrome. *(role-themed accent strip on sidebar)*
- [x] `/dashboard` overview  completeness arc, Talent Pulse confirm, search-rank position card, recommended next steps, viewers, contacts, link to public profile.
- [x] `/dashboard/profile`  full profile editor (identity, professional, skills picker with proficiency, location, headline, bio). ID number field present with "Encrypted on save" badge; never echoed back.
- [x] `/dashboard/experience`  CRUD list with start/end dates, "Current" toggle.
- [x] `/dashboard/qualifications`  uploads with verification status, partner-handled verification copy.
- [x] `/dashboard/activity`  your own audit-log view (who viewed, who contacted, what was revealed, what was downloaded).
- [x] `/dashboard/privacy`  active consents list with revoke; data-export request; erasure request (soft-delete + 30-day grace).
- [x] `/dashboard/account`  email, password, 2FA (optional for seekers), session management, sign out.
- [x] `/dashboard/grow`  **Career compass.** Demand-driven skill recommendations, projected rank delta if learned (e.g. *"Add 2 skills → move from #4 to #2 in Software Developer · Gauteng"*), SA-grounded learning paths (SETA learnerships, TVET, INDLELA, SAQA-recognised programmes, free options first), adjacent-profession overlap. Anchored on the same `analytics.demandBySkill` that powers `/insights` so the Phase 6 skills-gap engine plugs straight in. **This is the wedge feature for retention on the seeker side: the platform that *also tells you what to learn next.*** *(Glance card also rendered on `/dashboard` overview for visibility.)*
- [x] **Student mode**  when a seeker's profile carries an academic record (in-progress NQF qualification at a recognised SA institution), the platform shifts gear:
  - [x] **Academic data captured** at sign-up step 3 (collapsible "I'm currently a student" toggle reveals institution / programme / NQF level / current year / expected graduation / NSFAS / internship-and-graduate intent) and in the profile editor (Studies section renders only when `academic` exists, always with a *Verification handled by* note  never a default-verified label).
  - [x] **Public profile** shows *"Currently studying [programme] at [institution]"* honestly with an explicit verification chip, NQF band, year of study, graduation countdown, NSFAS flag, and the seeker's opt-in to internships / graduate programmes.
  - [x] **Career compass  Student lane.** Sits on top of the demand-driven recommendations when academic data is present: *"Bridge your degree to the market"* hero with graduation countdown, recommended electives **inside the seeker's programme** mapped to province-level demand signal, real SA internships + graduate programmes (PwC SAICA, Deloitte, SARS, Discovery, Standard Bank, Yoco, MICT SETA, Stats SA) with public sector listed first, *"Where graduates from your programme go"* destinations table aggregated from confirmed placements, and supplementary free learning to plug the gaps every graduate has.
  - [x] **Honesty rules carried through.** Verification state is never inflated; programme eligibility is shown openly so we don't waste people's time; SAQA-recognised programmes carry an explicit SAQA chip; the destinations table is aggregated, never per-person; the mock implementation matches the Phase 4 + Phase 6 interface exactly so the swap is a data plug.
  - [ ] **Search side-effect (Phase 4):** employer filter for "open to internships / graduate programmes"  strictly opt-in by the seeker, never default. *(Schema fields present; UI filter wires in Phase 4 alongside the DB-backed search.)*
  - [ ] **Government wedge (Phase 6):** materialise the *demand-vs-curriculum* dataset by programme + institution + province from `searchEvents × profiles.academic`. *(Mock shape lives in `lib/mock/academic.ts`; Phase 6 plugs the query layer in.)*
  - [ ] **Verification (Phase 8):** SAQA + institution partnership to flip `academic.verification` from self-reported to authoritative.

### Task 1.5.3: Employer dashboard (full workspace)
- [x] `/employer` shell with sidebar; persistent org-verification banner if unverified.
- [x] `/employer` overview  KPIs (saved searches, talent pools, contact reveals this month, confirmed placements), recent matches with placement nudge.
- [x] `/employer/saved-searches`  CRUD, last-run timestamp, "{n} new matches" badge.
- [x] `/employer/shortlists`  talent pools with member counts, internal share (no PII export).
- [x] `/employer/placements`  every hire confirmed on Sebenza; form to log a new placement; salary band kept private.
- [x] `/employer/organisation`  registered details, verification state, "Submit for verification" CTA (pluggable KYC slot  Phase 8).
- [x] `/employer/team`  invite colleagues; per-member workspace role (Owner / Recruiter / Viewer); each access audit-logged separately.
- [x] `/employer/account`  2FA mandatory state, sessions, sign out.

### Task 1.5.4: Admin dashboard (full workspace)
- [x] `/admin` shell with sidebar; 2FA-required eyebrow on every page.
- [x] `/admin` overview  KPI strip (pending verifications, open reports, new users 7d, audit events 24h), active queue counts, recent admin actions.
- [x] `/admin/verifications`  tabs for qualifications + organisations; approve / reject (with reason) / view evidence.
- [x] `/admin/moderation`  reported profile queue with reason codes; suspend / restore / close-no-action.
- [x] `/admin/taxonomy`  tabbed reference-data editor (professions, skills, provinces, cities)  controlled vocab only.
- [x] `/admin/audit-log`  filterable PII-access ledger; CSV export (audit-logged).
- [x] `/admin/users`  search by handle/email/role; account actions (suspend/restore/erase) audit-logged.
- [x] `/admin/settings`  feature flags, freshness band thresholds, ranking weights.

### Task 1.5.5: Wiring + verification
- [x] All routes use route-group layouts so Phase 2's `requireRole()` guard slots in via middleware/proxy with no UI churn. *(route groups `(auth)` / `(seeker)` / `(employer)` / `(admin)` are in place)*
- [x] Sidebar nav strings + all new flows captured in `messages/en.json`; `zu/xh/af.json` keep deepMerge fallback.
- [x] `npm run build` clean (typecheck + lint + static generation for all new routes × 4 locales).
- [x] Smoke-test every new route returns 200 under `next start`. *(33 routes verified 2026-05-21)*

---

## 🔐 PHASE 2: IDENTITY, AUTH & CONSENT ✅ *(done 2026-05-22)*
*Goal: Real accounts, roles, and lawful consent. See `docs/completed/PHASE_2_COMPLETE.md`.*

### Task 2.1: Better Auth Setup
- [x] Better Auth 1.6.11 + Drizzle adapter; email+password + email verification + forgot/reset password.
- [x] Role model (`seeker | employer | admin`) + Server-Action sign-in that **routes by `app_user.role`** (no role chip on the sign-in page  credentials identify the user).
- [x] Session-based `requireRole()` / `requireOrgVerified()` guards via `proxy.ts` on the `(seeker)` / `(employer)` / `(admin)` route groups.
- [x] 2FA **enforcement deferred to Phase 7.** Phase 2 does not build `/setup-2fa` or `/verify-2fa`.

### Task 2.2: Sign-Up Flows
- [x] **Seeker sign-up:** identity basics + **explicit consent capture** before profile becomes searchable. National ID encrypted on save via `lib/crypto.encryptField`.
- [x] **Employer sign-up:** creates an `organization` (status `unverified`); cannot view PII until verified.
- [x] Email verification (mandatory before sign-in works) + welcome email.
- [x] Forgot-password → `/reset-password?token=…` new-password flow.
- [x] Sign-out Server Action + buttons on every account page.

### Task 2.3: Consent & Privacy UX
- [x] Granular consent screen (searchability, contact, document sharing) → `consents`. Persisted; live state read on `/dashboard/privacy`.
- [x] Account → Privacy: view/revoke consent (revoke + regrant Server Actions, audit-logged). *Data export + erasure UI shipped in Phase 1.5; the backend action wires in Phase 8 alongside the cron pruner.*

### Task 2.4: Email transport (env-driven)
- [x] `lib/email/send.ts` abstraction: `EMAIL_TRANSPORT=mailtrap` (dev  captured sandbox) or `EMAIL_TRANSPORT=resend` (prod). Console transport as a fallback when no transport is set.
- [x] `nodemailer` for Mailtrap SMTP; `resend` SDK for production sends.
- [x] Better Auth's `sendVerificationEmail` / `sendResetPassword` callbacks wired to `send()`.

### Task 2.5: Audit-log persistence
- [x] `lib/audit.logAccess()` writes to `audit_log` table (keeps the ring buffer as a tail).
- [x] `/admin/audit-log` + `/admin` overview KPI both read from the table.

---

## 👤 PHASE 3: THE TALENT PROFILE ✅ *(done 2026-05-22)*
*Goal: Rich, trustworthy profiles with a live, time-aware employment status. See `docs/completed/PHASE_3_COMPLETE.md`.*

### Task 3.1: Profile CRUD
- [x] Personal: display name, location (province/city), nationality, ID number (**encrypted on save, never displayed back**  SA Luhn-validated).
- [x] Professional: profession, seniority, bio.
- [x] Skills: multi-select from controlled taxonomy + self-rated proficiency; replace-on-save transaction.
- [x] Experience: add / edit / delete; inline form with date-order validation.

### Task 3.2: Qualifications & Documents
- [x] Upload certificates to **Supabase Storage** (private bucket, signed URLs, service-role key server-only).
- [x] Each qualification: title, institution, awarded year, `verification_status` (default `unverified`; flips to `pending` on document upload).
- [x] Content-type + size limits + **magic-byte sniff** (don't trust browser's claimed type); per-user rate limit (5 / 10 min, in-memory; Upstash in Phase 9); every PII path audit-logged.
- [x] Profile photo upload with client-side resize to 512 px (canvas + JPEG re-encode)  keeps payloads tiny on metered data.

### Task 3.3: Employment Status Engine (the differentiator)
- [x] `status` enum + `statusConfirmedAt` (already in schema since Phase 0).
- [x] Freshness/confidence derivation in `lib/status.ts`  `fresh < 30d`, `ageing < 90d`, `stale ≥ 90d`; confidence weights 1.0 / 0.6 / 0.25.
- [x] Re-confirmation nudge surfaced as a **dashboard banner** (yellow ageing, red stale); inline "Yes, still accurate" button hits `reconfirmStatus`.
- [ ] **Email-cron nudge for ageing/stale statuses → Phase 8** alongside the email comms hardening (the banner is enough for the in-dashboard surface).
- [ ] **Stale statuses down-ranked in search + flagged low-confidence in analytics → Phase 4** (the engine ships in Phase 3; the search-side wire-up is part of the Postgres FTS work).

---

## ⚙️ PHASE 4: THE DATA ENGINE (Backend & Schema) ✅ *(done 2026-05-22)*
*Goal: The schema, search engine, and integrity logic everything else stands on. See `docs/completed/PHASE_4_COMPLETE.md`.*

### Task 4.1: Drizzle Schema
- [x] Auth tables (Better Auth  Phase 2) + app `userRole`.
- [x] `profiles`, `skills`, `profileSkills`, `experiences`, `qualifications`.
- [x] `organizations`, `organization_members`, `placements`, `searchEvents`.
- [x] POPIA: `consents`, `auditLog`. Taxonomy: `provinces`, `cities`, `professions`, `institutions`.
- [x] Enums: `employmentStatus`, `verificationStatus`, `userRole`, `consentPurpose`, `consentState`, `institutionKind`, `organizationMemberRole`.
- [x] Indices (Phase 4 migration `0001_phase4_search.sql`): GIN on `search_vector`; GIN trigram on profession + taxonomy labels + city; btree on province / city / status / verification / deleted_at.

### Task 4.2: Search Engine (Postgres FTS + pg_trgm)
- [x] Materialised `tsvector` via trigger over `profession + seniority + bio + city + province + aggregated skill labels` with weighted setweight() priorities.
- [x] `pg_trgm` extension enabled; `websearch_to_tsquery` for free-text queries; trigram for typo tolerance.
- [x] Ranking SQL: `ts_rank_cd × sebenza_freshness_confidence × (0.5 + 0.5 × completeness) × citizen_boost`. `sebenza_freshness_confidence(timestamp)` is a SQL function so ranking + Phase 6 analytics share one source of truth with `lib/status.ts`.
- [x] Strict select-list redaction at the query layer  `national_id_enc`, `full_surname`, `search_vector`, `email`, `document_storage_key`, `deleted_at` NEVER selected on a public read.
- [x] `dataProvider` swap: `dbProvider` is now the default; mock fallback kept for off-DB dev.
- [x] Photo URLs minted as short-lived signed Supabase URLs at the provider boundary (raw key stays server-side).
- [x] `/insights` adopts `revalidate = 300` ISR so aggregates refresh every 5 min without rebuild.

### Task 4.3: Integrity & Server Actions
- [x] Typed query functions in `db/queries/*` (no raw queries in components).
- [x] Server Actions for all mutations (Phase 2 + 3); Zod validation on every input.
- [x] `logAccess()` enforced on every PII read/export path (Phase 2 + 3 + 4).
- [x] `search_events` row written on every search (skills-gap signal Phase 6 builds on).

---

## 🏢 PHASE 5: THE EMPLOYER PORTAL ✅ *(done 2026-05-23)*
*Goal: Employers find, shortlist, contact talent, and  critically  log hires. See `docs/completed/PHASE_5_COMPLETE.md`.*

### Task 5.1: Organization Accounts & KYC Slot
- [x] Org profile with `verification_status` (Phase 1.5 schema; live read in Phase 5).
- [x] Only `orgVerified` employers can reveal contact / documents (audit-logged each time via `verifyOrgVerified` guard).
- [ ] Pluggable third-party KYC adapter → Phase 8 (today admin flips the flag manually).

### Task 5.2: Search, Shortlist, Contact
- [x] Saved searches + shortlists (talent pools)  per-org CRUD, `searchSnapshot ≠ result-set` (only count + lastRunAt stored).
- [x] Contact reveal flow  three-lock gate (verified org × consent × audit). `revealContact` returns `{ email, city, consentVersion, revealedAt }`; cached on dossier reload.
- [x] Document download flow  separate audit kind, 60s signed Supabase URL, gated on `document_sharing` consent.
- [ ] Resend notification to seeker on contact reveal → Phase 8.

### Task 5.3: Placement Confirmation (analytics fuel)
- [x] "Mark as hired" flow → writes `placements` (profile, org, role, city, date, salary band private).
- [x] **30-day reveal gate**  placement requires a prior `profile.contact.reveal` audit row from this org for this profile within the last 30 days (Placement-Truth Rule made enforceable).
- [x] On placement → `/insights` ISR triggers recompute next visit (5-min window).
- [ ] Seeker notification "Discovery Bank logged you as hired  update your status?" → Phase 8 with Resend.

---

## 📊 PHASE 6: THE ANALYTICS & POLICY DASHBOARD
*Goal: The government wedge  real-time workforce visibility. See `docs/completed/PHASE_6_COMPLETE.md`.* ✅ **(done 2026-05-23)**

### Task 6.1: Employment Analytics
- [x] Counts / trends by skill, profession, location, status  **freshness-weighted** via `sebenza_freshness_confidence`.
- [x] Time series of registrations + confirmed placements (5-month window).
- [x] **Province × profession supply heatmap** on `/insights`  dynamic top-N matrix with intensity scaling; cells without data shown blank. Honest, mobile-friendly, no heavy map libs.
- [x] **Freshness-band tiles** (Fresh / Ageing / Stale)  the "data you can trust" honesty bar made concrete.

### Task 6.2: Skills-Gap Intelligence
- [x] `skillsGapQuery` derives demand from `searchEvents`: searches vs matches vs freshness-weighted matches, signed gap, optional province scope. Top-20 table on `/insights` with red/green bars per row.
- [x] Career compass on `/dashboard/grow` + `/dashboard` overview wires to live demand via `db/queries/career-compass.ts` (skills the seeker doesn't have + peer-pattern recommendations + skill-overlap adjacent professions).

### Task 6.3: Exports & Policy Reporting
- [x] CSV export  real Server Action streaming multi-section CSV (status / skills-gap / heatmap / freshness / trend) with section headers.
- [x] Aggregation only  never expose individual PII; column-list redaction enforced everywhere.
- [x] Every export writes an `analytics.export` audit row with `scope + rowCount + generatedAt`.
- [x] 10k-row cap with friendly fail message pointing at the Phase 8 "email me the file" flow for bigger slices.

### Task 6.4: Search filter polish
- [x] `openToInternships` + `openToGraduateProgrammes` checkboxes on `/search`  strictly opt-in by the seeker, never default. Wired via `EXISTS (academic_profiles)` in `searchProfilesQuery`.

### Deferred to Phase 9 perf pass
- [ ] Materialised views (`mv_demand_by_profession`, `mv_supply_heatmap`) with concurrent refresh  sub-10ms regular queries hold at current scale.

---

## 📈 PHASE 6.5: ANALYTICS POLISH + REAL SEEKER RANK ✅ *(done 2026-05-23)*
*Goal: Side-phase between Phase 6 and Phase 7  fix the audit findings + ship the architectural adds that materially upgrade the wedge. See `docs/completed/PHASE_6_5_COMPLETE.md`.*

### Tier 1  Real fixes
- [x] CSV formula-injection guard (OWASP  cells starting with `=+-@\t\r` get a `'` prefix; was a real security issue).
- [x] CSV line endings `\n` → `\r\n` (Windows Excel was garbling imports).
- [x] Skills-gap join: exact-match → partial-match-both-ways with FILTER + UNION, plus an "orphan demand" row class for terms that don't map to any profession (was systematically undercounting real demand).
- [x] Heatmap intensity now uses `color-mix(in srgb, var(--color-brand) …)` instead of hardcoded RGB  design-system drift fixed.

### Tier 2  Architectural adds
- [x] **`skill_gap_snapshots`** table (migration 0003)  time-series capture of top-N gaps. Nightly Phase 8 cron will own it; admin-triggerable now.
- [x] **`captureSkillGapSnapshot` + `skillsGapTrendQuery`**  week-over-week delta arrows on `/insights` skills-gap table (fallback to "" when no prior snapshot yet).
- [x] **`rankInPoolQuery`**  real `DENSE_RANK() OVER (...)` against the (profession × province) pool with projected rank using a +6 completeness boost per skill. Replaces the hardcoded `currentRank: 0` the compass used.
- [x] **`skillDemandQuery`**  skill-level granularity (joins against `skills.label` not `professions`). Surfaces "Cybersecurity" gaps that don't map to a profession.
- [x] **Heatmap drill-down**  every cell links to `/search?q=<profession>&province=<slug>`. Trapped data unlocked.

### Tier 3  Strategic adds (queued for Phase 9)
- [ ] PDF report export (print-CSS, no extra dep)  see `docs/PHASE_9_PLAN.md` §A.1
- [ ] Sebenza Labour Market Index (LMI)  single weekly headline number  §A.2
- [ ] `/gov` route group with new `gov` role  §A.3
- [ ] City-level breakdown  §A.4
- [ ] Holt's linear forecast layer  §A.5

---

## 🛡️ PHASE 7: ADMIN, MODERATION & NOTIFICATIONS ✅ 2026-05-23
*Goal: Keep the database trustworthy + every visible affordance does what it says. Shipped 2026-05-23 across four commits. Companion docs: `docs/completed/PHASE_7_PLAN.md` + `docs/completed/PHASE_7_COMPLETE.md`.*

### Task 7.1: Admin Shell & Auth ✅
- [x] `/admin` route group; admin-only guard via `verifyAdmin()` (shipped Phase 3 security audit).
- [x] `/admin` overview KPIs live via `adminOverviewCounts()` (pending verifications, open reports, new users 7d, audit events 24h, suspended users).
- [x] `/admin/users`: real DB join `app_user × profiles × organization_members × organizations`; search + role + status filters; `suspendUser` / `restoreUser` / `eraseUser` actions wired (erase is soft-delete with Phase 8 cron for the 30-day grace).

### Task 7.2: 2FA enforcement ✅
- [x] Better Auth `twoFactor` plugin wired ahead of `nextCookies` in the plugin chain.
- [x] `/setup-2fa` ships QR + otpauth URI + verify-code field + 10 backup codes shown once with copy-all helper.
- [x] `/verify-2fa` ships TOTP (default) and backup-code modes via toggle.
- [x] `app_user.two_factor_enabled` flag + forced-setup gate in `verifyRole` / `verifyAdmin`. Seekers exempt (No-Flash Rule). Gate itself gated on `feature_flag_2fa_enforced` platform setting for staged rollout.
- [x] Forced setup applies on next sign-in for any employer/admin without enrolment.
- [x] Real "Configure 2FA" panel on /dashboard/account, /employer/account, /admin/account (replaces the dead stub from the Phase 5 audit). Admin escape hatch `reset2faForUser({ userId, reason })` surfaced as "Reset 2FA" in `/admin/users` row actions.

### Task 7.3: Verification & Moderation Queue ✅
- [x] `lib/admin/verifications.ts`  `approveQualification` / `rejectQualification` / `approveOrganisation` / `rejectOrganisation`. Every flip audit-logs with `meta.reason` AND fires the matching `qualification.verified|rejected` / `org.verified|rejected` notification.
- [x] `lib/admin/moderation.ts`  `reports` table + `flagProfile` (called from public `/p/[handle]` Report button, anonymous-safe), `suspendUser`, `restoreUser`, `closeReport`. `app_user.suspended_at` + suspended-user sign-in bounce ("Your account is suspended: <reason>").
- [x] Organisation verification workflow (KYC adapter remains Phase 8).

### Task 7.4: Taxonomy & Reference Data ✅
- [x] `lib/admin/taxonomy.ts`  `addSkill`, `addProfession`, `addCity`, `removeSkill`, `removeProfession`, `removeCity`. Slug uniqueness enforced at PK + referential check refuses removal of anything still in use.
- [x] `/admin/taxonomy` Add row form (label + slug + province for cities) and per-row Remove button via a unified `<TaxonomyManager />` client island.
- [x] Sign-up profession dropdown reads from DB via `getProfessions()` (cached 5 min), with fallback to mock constants for brand-new DBs.

### Task 7.5: Audit-Log Viewer ✅
- [x] Reads from `audit_log` table (shipped Phase 2).
- [x] Filter form (kind + actor) wired as a real GET  URL state survives reload + share; kind validated against the catalog union.
- [x] "Export CSV" hits `/api/admin/audit-log/export` which streams RFC-4180 CSV (≤10k rows, OWASP injection guard, UTF-8 BOM); each export writes its own `analytics.export` audit row.

### Task 7.6: In-app notifications ✅
- [x] `notifications` table + 3 indices (user/at, unread partial, user/kind/at for dedupe lookups) + `app_user.notification_prefs` JSONB.
- [x] `lib/notifications/server.ts`  `createNotification` honours user prefs + dedupes inside the catalog window + swallows write failures so audits are never blocked. Plus `notifyOrgMembers` + `notifyAllAdmins` fan-out helpers.
- [x] `lib/notifications/query.ts`  `listForUser({ limit, before })` cursor pagination + cached `unreadCount` + `getMyNotificationPrefs`.
- [x] `lib/notifications/actions.ts`  `markRead`, `markAllRead`, `updateNotificationPref`, `loadOlderNotifications` Server Actions.
- [x] `<NotificationBell />` mounted in `DashboardShell` (desktop masthead + mobile top strip). **Revised re-check #9:** no polling  every notification fires from a specific Server Action that revalidates the relevant surfaces; navigation refreshes the bell naturally. Trade-off: idle-page-stare users wait for next nav.
- [x] Shared `<NotificationsList />` at `/dashboard/notifications`, `/employer/notifications`, `/admin/notifications` with 20-row pages + "Load older" cursor.
- [x] All 4 Phase-5 trigger points wired: `revealContact` → `contact.revealed`; `downloadQualification` → `document.downloaded`; `markAsHired` → `placement.confirmed`; dossier render → `profile.viewed` (24h dedupe per `orgId`).
- [x] All 7 Phase-7 admin trigger points wired (qualification approved/rejected → seeker, org approved/rejected → all org members, user suspended/restored → affected user, report filed → all admins).
- [x] Notification preferences panel on /dashboard/account + /employer/account + /admin/account (in-app toggles persist via JSONB; email column disabled with Phase-8 pill).
- [x] POPIA: meta JSONB carries only display context (org name, role title); no surveillance kinds; suspended users' rows queue for restore.

### Task 7.7: Platform settings persistence ✅
- [x] `platform_settings` table (key/value JSONB store) + 8 seeded defaults (freshness band days, 3 ranking weights, 3 feature flags).
- [x] `lib/admin/settings.ts`  cached `getSetting` (React `cache()` per render) + `getAllSettings`. Write side in `lib/admin/settings-actions.ts` (`updateSetting` with cross-field validation: ageing days must exceed fresh days).
- [x] `/admin/settings` per-row save with audit-logged prior + new values. `/insights` consumes `freshness_band_days_fresh|ageing` so admin tuning surfaces on next render.

### Task 7.8: Public-surface polish (Tier 2 audit carryover) ✅
- [x] Landing: `Intl.DateTimeFormat(locale, { month: "long" }).format(new Date())`  no more hardcoded "May".
- [x] `/search`: dead "Load more" replaced with honest end-state ("Showing the top N of M  refine filters" / "Showing all N matches").
- [x] `/p/[handle]`: Report button writes a real `reports` row via `flagProfile`; "Request contact" + "Save to pool" route to `/sign-in?next=/employer/dossier/<handle>` for unauth, straight to dossier for employer/admin, with an honest explainer for signed-in seekers.
- [x] Seed: 2 sample open reports against `amara-o` (anonymous spam) and `sipho-k` (`naledi-k` → fake_identity) for the moderation queue demo. Saved-search + shortlist seed remains a Phase 8 nice-to-have.

---

## 🎓 PHASE 7.5: WORK-AVAILABILITY + LONGITUDINAL OUTCOMES ✅ 2026-05-23
*Side-phase between Phase 7 and Phase 8, mirroring the Phase 6.5 pattern. Shipped 2026-05-23. Companion docs: `docs/completed/PHASE_7_5_PLAN.md` + `docs/completed/PHASE_7_5_COMPLETE.md`.*

### Task 7.5.1: Work-availability dimension (schema + model) ✅
- [x] `work_availability_kind` pgEnum + `profiles.work_availability` array column + GIN index
- [x] Drizzle schema + migration `0007_phase7_5_work_availability.sql`
- [x] `dataProvider` interface + dbProvider + mock parity; redaction-safe (publicly readable  it's the point)

### Task 7.5.2: Surfacing work-availability (UI + search) ✅
- [x] `/dashboard/profile` `<WorkAvailabilityEditor>` checkbox group with optimistic toggles
- [x] `/sign-up/seeker` student branch toggle ("Available for work while I study") + the same checkbox set
- [x] `/p/[handle]` chip row in the trust dossier + `<TalentRosterItem>` compact indicator next to status
- [x] `/search` multi-select filter via `&&` array containment in `searchProfilesQuery`; URL state `?availableFor=…`

### Task 7.5.3: Dedicated consent purpose for outcomes research ✅
- [x] `consentPurpose` enum extended with `outcomes_research` via isolated migration `0008_phase7_5_outcomes_consent.sql` (`ALTER TYPE … ADD VALUE IF NOT EXISTS`)
- [x] Optional + default-off + **non-degrading**  documented at the enum site + the privacy page copy
- [x] `/dashboard/privacy` row + clear "what is/isn't shared" explainer in English; Tier-1 languages land in Phase 10
- [x] Versioned in `consents`; revoke/regrant audit-logged through the existing actions

### Task 7.5.5: Placement-logging completeness ✅
- [x] `placement_source` enum + column on `placements` (`employer_confirmed` default, `seeker_reported` softer signal) + partial index on the confirmed path
- [x] **Honesty rule** implemented: `confirmedHiresThisMonth` + trend chart + 7.5.4 outcomes dataset all filter on `source = 'employer_confirmed'`; seeker_reported is excluded from official aggregates
- [x] Seeker self-report flow (`<SelfReportPlacementCard>` + `selfReportPlacement` action) on the dashboard when `status === "employed"`; audit-logged as `placement.self_report`
- [x] **Incentive Lever C chosen** (2026-05-23): contextual "Did you hire?" nudge on the employer dossier at day ≥ 21 of the 30-day window when no placement is logged. New `lib/employer/placement-nudge.ts` + `<PlacementNudgeBanner>`. Lever A (analytics value-exchange via the employer hiring funnel) deferred to Phase 9; Lever B (verified-status gating) rejected  conflates KYC with behaviour

### Task 7.5.4: Longitudinal education-to-employment analytics ✅
- [x] Cohort dimensions only (`programme × institution × province × graduation_year`); never a per-person timeline
- [x] Metrics: cohort size · employer-confirmed placements · placement rate · median time-to-hire (PG `percentile_cont`) · top destination profession (PG `mode()`)
- [x] **Hard k-anonymity floor**: cells below `outcomes_min_cohort_size` (default 10, range 5–200, tunable from `/admin/settings`) are dropped
- [x] **Complementary suppression** across both row + column groups so small cells can't be derived from totals
- [x] Consented-only: source restricted to profiles with `outcomes_research` granted via INNER JOIN
- [x] Surfaced on `/insights` (slots cleanly into Phase 9's `/gov` route group later)
- [x] CSV export at `/api/insights/outcomes/export` reuses `outcomesQuery()` so the suppression filter is structurally identical (no bypass)
- [x] `outcome_snapshots` cron  query is ready; nightly snapshot table + cron are a Phase 8 wire-up

### Task 7.5.6: Wiring, verification, doc convention ✅
- [x] All new strings in `messages/en.json`; `zu/xh/af` keep the deepMerge fallback (Phase 10 ships full translation, including the consent copy from 7.5.3)
- [x] Compliance assertions in `lib/analytics/outcomes-compliance.ts` (no cohort below floor / unconsented never appears / seeker_reported excluded / work_availability values in enum). Exposed via admin-only `/api/admin/outcomes-compliance`; wired into the Phase 11.4 test runner later
- [x] Seed: workAvailability backfill for the 8 seeded profiles; `outcomes_research` grants for 3 named seekers; **12-person synthetic Wits BSc CS cohort** with 3 employer-confirmed Discovery Bank placements so the /insights outcomes section renders a real row out of the box
- [x] `docs/completed/PHASE_7_5_COMPLETE.md` written; `docs/completed/PHASE_7_5_PLAN.md` moved + boxes ticked; this ROADMAP header ✅; `TO_START_EVERY_SESSION.md` Current State refreshed; committed as `Phase 7.5 complete + Phase 8 opens`

---

## 🔗 PHASE 8: VERIFICATION & INTEGRATIONS ✅ 2026-05-23
*Shipped 2026-05-23. KYC + SAQA adapters ship behind admin-controlled platform flags so they remain dormant until partnerships are confirmed. Companion docs: `docs/completed/PHASE_8_PLAN.md` + `docs/completed/PHASE_8_COMPLETE.md`.*

### Task 8.1: Third-Party KYC (gated) ✅
- [x] `IdentityVerifier` interface + `MockIdentityVerifier` + provider env-switch resolved via `resolveIdentityVerifier()` (gated on `feature_flag_kyc_provider`, default OFF  admin flips after partnership confirmation).
- [x] Admin escape hatch `adminVerifyIdManually` for the off-flag world; seeker self-service via `<KycPanel>` on `/dashboard/profile` with all three states (no-ID / not-verified / verified).
- [x] Audit kinds `kyc.verify` + `kyc.revoke` record provider name so admins can tell a SaaS verify from a manual one.

### Task 8.2: Government Hooks (gated) ✅
- [x] `qualification_kyc_jobs` queue + `qualification_kyc_status` enum + `/api/cron/saqa-worker` (claims up to 10 jobs per run, rate-limited per SAQA NLRD constraints).
- [x] `approveQualification` branches on `feature_flag_saqa_worker`: OFF (default) flips directly (Phase 7 behaviour); ON enqueues. Real HTTP call to SAQA is a one-function swap when partnership lands.
- [x] **Force approve** override on `/admin/verifications` qualification rows (only visible when the flag is on), audit-logged as `verification.approve.manual_override`. Latest SAQA job status surfaces as a coloured pill.

### Task 8.3: Email & Comms ✅
- [x] Per-kind Resend templates for the 9 catalog kinds with `defaultEmail: true (Phase 8)`. Shared `lib/email/templates/shell.ts` lifts the brand chrome.
- [x] Email dispatch tail in `createNotification`: rate-limited 1/kind/60 s via `app_user.notification_email_last_sent_at`; gated on `feature_flag_email_notifications` + per-user pref.
- [x] Prefs UI email column flips live when the master flag is on; per-user defaults stay `false` (opt-in).

### Task 8.4: Cron jobs (`/api/cron/*` routes, all `CRON_SECRET`-guarded) ✅
- [x] `/api/cron/hard-delete-erased`  soft-deleted users past 30 days; audit-logs `account.hard_delete` BEFORE the DELETE
- [x] `/api/cron/status-stale-warning`  fires `status.stale.warning` when `status_confirmed_at` crosses ageing band, idempotent via `status_stale_last_sent_at`
- [x] `/api/cron/saved-search-matches`  re-runs each saved search, hashes the result set, fires `saved_search.new_matches` to org members on hash change
- [x] `/api/cron/skill-gap-snapshot`  wraps Phase 6.5's `captureSkillGapSnapshot()`
- [x] `/api/cron/outcome-snapshots`  Phase 7.5.4 hand-off; writes one row per visible cohort to `outcome_snapshots`
- [x] `/api/cron/saqa-worker`  gated (no-ops when `feature_flag_saqa_worker` is off)

### Task 8.5: Misc polish (audit follow-ups) ✅
- [x] `/dashboard/profile`  read-only email field surfaced from the auth session
- [x] `/api/dashboard/data-export`  POPIA §23 streamed JSON dump of every row referencing the user; national ID stays as ciphertext
- [x] `<SelfEraseForm>` on `/dashboard/privacy`  POPIA §24 self-service erase with type-`ERASE`-to-confirm gate; soft-deletes then signs out

---

## 🔒 PHASE 9: TRUST, SECURITY & POPIA HARDENING ✅ 2026-05-23 (with documented deferrals)
*Shipped 2026-05-23. Companion docs: `docs/completed/PHASE_9_PLAN.md` + `docs/completed/PHASE_9_COMPLETE.md`. Every third-party service (Sentry, Upstash, KYC SaaS, SAQA NLRD, Resend domain auth) is **dormant by default**  the system runs end-to-end with zero paid credentials. AWS Cape Town migration deferred until partnership confirms; turnkey runbook at `docs/AWS_MIGRATION_RUNBOOK.md`.*

### Task 9.1: POPIA + privacy ✅
- [x] `/privacy`  12-section POPIA-aligned Privacy Policy, plain language
- [x] `/paia`  PAIA manual (Section 51 of Act 2 of 2000) with records inventory + access procedure + IO contact
- [x] Cookie consent banner (essential always-on + analytics opt-in, default OFF) mounted in root locale layout; server-resolved choice (no flash)
- [x] `docs/popia/INFORMATION_OFFICER.md` + `DPIA.md` + `BREACH_RESPONSE.md` + `RETENTION_POLICY.md` + `ENCRYPTION_INVENTORY.md` (with key-rotation runbook)

### Task 9.2: Security headers + observability skeleton ✅
- [x] CSP + HSTS + Permissions-Policy + X-Frame-Options + COOP + Referrer-Policy applied in `proxy.ts`
- [x] Sentry skeleton (`lib/sentry/init.ts`)  env-gated on `SENTRY_DSN`; `beforeSend` PII scrubber + auth-header strip; lazy-imports `@sentry/nextjs` so the dep is not taken until DSN is provided
- [x] Rate limiter library (`lib/rate-limit/`, in-memory + Upstash-ready) shipped but **dormant by default**  DPIA R8 records the decision (pre-emptive limits trade legitimate-user friction for theoretical defence; re-enable when abuse is observed)

### Task 9.3: Polish ✅
- [x] `loading.tsx` per route group (seeker / employer / admin / gov / public)
- [x] `app/robots.ts` + `app/sitemap.ts` (per-locale alternates, consented + non-deleted profiles only) + OpenGraph / Twitter / canonical on `/p/[handle]`

### Task 9.4: Strategic adds (government pitch) ✅
- [x] Sebenza Labour Market Index  `lib/analytics/lmi.ts` + `lmi_snapshots` + `/api/lmi` JSON + LMI badge on landing pulse strip + nightly `/api/cron/lmi-snapshot`
- [x] `/gov` route group + new `gov` role in `user_role` enum (migration `0011`) + `verifyGov()` in DAL + proxy update
- [x] `/gov` overview · provinces index · per-province deep dive · municipalities (honest "coming soon" gated on k=10) · exports · account
- [x] PDF report export  `/insights/print` print-CSS route + `<PrintActions />` + "Print to PDF" link on `/insights`

### Task 9.5: AWS Cape Town `af-south-1` (DEFERRED  partnership-gated)
- [ ] **Skipped.** Turnkey runbook at `docs/AWS_MIGRATION_RUNBOOK.md` (RDS provisioning + KMS at-rest + multi-AZ + PITR + Vercel env swap + `db/client.ts` driver swap + `pg_dump | pg_restore` cutover + Neon read-only rollback). ~4-hour cutover with **zero remaining POPIA work** to do on migration day  all compliance surfaces already shipped against the current DB.

### Task 9.6: Deferred to launch-scale (conditions documented)
- [ ] **Materialised views** for analytics queries  only worth doing at 50k+ profiles / 100k+ search_events
- [ ] **Holt's linear forecast** on `/gov/forecast`  needs 12+ weekly snapshots; Phase 8 cron is now capturing them
- [ ] **External pen-test**  separate engagement; before commercial launch
- [ ] **Nonce-based CSP** (drop `'unsafe-inline'` from `script-src`)  hardening pass before public launch

---

## 🌐 PHASE 9.7: NATIONALITY ANALYTICS & LOCAL-HIRING INTELLIGENCE ✅ 2026-05-24
*Side-phase between Phase 9 and Phase 10. Mirrors the 6.5 / 7.5 pattern (analytics enrichment on shipped infra; must not muddy the public-launch phase). Numbered 9.7 to avoid colliding with `Task 9.5` (AWS migration, deferred) + `Task 9.6` (launch-scale deferrals) above. Companion docs: `docs/completed/PHASE_9_7_PLAN.md` + `docs/completed/PHASE_9_7_COMPLETE.md` + `docs/popia/DPIA.md` (R9 added with this phase).*

**Strategic frame:** turn nationality from a *search filter* (already shipped, unchanged) into a *governed policy lens*. Anti-xenophobia tool by construction  shows where SA citizens can fill demand AND where a genuine local shortage means foreign nationals are filling a real gap. **Reframed 2026-05-24** (per operator review): no specific regulatory-mandate or racial-framing claims in user-facing copy  Sebenza is policy intelligence, not a regulatory enforcement tool. Structural defences (suppression, dormant-by-default, oversight log) all preserved; only the legal-claim copy changed. See DPIA R9 + `docs/completed/PHASE_9_7_COMPLETE.md` reframing section.

### Task 9.7.1: Reusable suppression utility (test-first refactor)
- [x] Unit-test fixtures against existing inlined outcomes path, then extract `lib/analytics/suppress.ts` (`suppress(rows, { dims, countKey, k })` with k-floor + complementary suppression). Zero behaviour change  outcomes-compliance route still passes.

### Task 9.7.2: Nationality dimension on market analytics (`/gov`, `/insights`)
- [x] 2-class `nationality_class` derivation (`sa_citizen` / `foreign_national`)  never raw country in analytics. Optional split on supply / placement-rate / time-to-hire / status-mix views, all suppressed (k=10), freshness-weighted, hardened-CSV-exported.

### Task 9.7.3: Skills-Shortage Justification Index (centerpiece)
- [x] Explicit, plain-language classifier (`Genuine local shortage` / `Local supply available` / `Indeterminate`) driven by three thresholds, all tunable from `/admin/settings`: `lmi_demand_floor` (1.0 = 10 distinct employer-searches/30d), `lmi_local_supply_threshold` (0.5), `lmi_foreign_fill_floor` (0.5). Formula published verbatim on `/gov`. Per-cell `demand_score / local_supply_ratio / foreign_fill_share` surfaced in tooltips. Demand weighted by `DISTINCT actor_org_id` (not raw event count)  closes the demand-inflation vector.

### Task 9.7.4: Local-Hiring Opportunity Map
- [x] `/gov` heatmap of `Local supply available` cells with drill-down to `/search?q=…&province=…`. ESA §8 framing in legend ("where §8 has practical force").

### Task 9.7.5: Employer self-view ("Your hiring on Sebenza")
- [x] Their-org-only placement mix card on the employer dashboard. EEA §1 + ESA §8 framing copy. Engine + UI build; final wording held until counsel sign-off on DPIA R9.

### Task 9.7.6: Governed per-employer compliance lookup (`gov` only, ships dormant)
- [x] Behind `feature_flag_employer_mix_lookup` (default OFF). Exact-match input only (full org name OR CIPC reg number, string equality)  no autocomplete, no browse, no leaderboard. `employer_mix_min_placements` floor (default 5). Purpose-bound: actor + employer + reason + timestamp logged as `gov.employer_mix.lookup`. ESA §8 evidence-aid framing.

### Task 9.7.7: Sensitive-query oversight log (`/admin`)
- [x] All `gov.employer_mix.lookup` + nationality-split export events surfaced + filterable + CSV-exportable for the watchers' watchers. Trust rationale: powerful lens is safe *because* its use is itself observable.

### Task 9.7.8: Scheduled LMI / nationality brief (kept in scope)
- [x] `/gov/brief` print-CSS page composing LMI headline + shortage/opportunity highlights + suppressed nationality dimension. Cron-to-PDF distribution = optional extension.

### Task 9.7.9: Wiring, verification, doc convention
- [x] Five compliance assertions extended (no cell below k anywhere · no ranked-employer endpoint · no per-employer split below floor · every gov lookup carries a reason · **no raw country in any list/aggregate response**  structural defence against country-level regressions). `npm run build` clean; seed includes mixed-nationality cohort. On ship: `PHASE_9_7_COMPLETE.md`, tick this header ✅ + date, refresh Current State, commit `Phase 9.7 complete + Phase 10 opens`.

**Open dependencies before any public-facing copy ships:**
- DPIA R9 counsel review on the EEA §1 / ESA §8 framing  blocks 9.7.5 copy + 9.7.6 activation. 9.7.1–9.7.4 (market views) can ship in parallel; they carry no per-employer surface and no legal-claim copy.

---

## 🧷 PHASE 9.8: VACANCIES & DEMAND-DRIVEN MATCHING ✅ (shipped 2026-05-24)
*Side-phase between Phase 9.7 and Phase 10. Mirrors the 6.5 / 7.5 / 9.7 pattern (capability enrichment on shipped infra; must not muddy the public-launch phase). Companion docs: `docs/PHASE_9_8_PLAN.md` (open questions Q1Q4 + senior-review push-back items D1D8 all closed same-day) + `docs/popia/DPIA.md`.*

**Strategic frame:** turn Sebenza from ad-hoc search-and-contact into a structured demand-driven matching system. **Not a job board** (the comparison table at the top of the plan doc is the whole product call): vacancies are *org-private*; employers reverse-match against the talent base and *invite specific people*; seekers accept / decline / decline-with-reason. The decline-reason data is the labour-market intelligence no job board has  it tells government *why* roles go unfilled (salary-driven gap vs supply-driven gap are different policy signals), and it's the data that unblocks 9.7.3's "Local shortage" classifications on real (not seeded) data.

**§CRITICAL design correction recorded in plan:** the originating voice-chat proposed a per-vacancy "South African only" invite gate. **Not building it**  direct contradiction of Rule 2 (Location-Not-Nationality) + Rule 3 (Citizen-Visibility) + the DPIA R9 mitigation shipped six days earlier in 9.7. Honest version: highlight + rank SA citizens via existing `citizen_boost`, show an honest supply line ("N SA citizens · M candidates match this vacancy"), but **no endpoint blocks invite by `nationality_class`**. Compliance assertion (c) catches regressions.

### Task 9.8.1: Vacancy schema + lifecycle ✅ 2026-05-24
- [x] `vacancies` table (id, org, created_by, title, profession, province/city, skills, seniority, salary_band PRIVATE, description, documents_required, status enum, invite_expiry_days, timestamps); `vacancy_status` enum [draft/open/closed/filled]; privacy invariant (no field on any non-org-member surface); `/employer/vacancies` list/create/edit/close respecting `orgMemberRole` (Owner+Recruiter create+invite, Viewer read-only). Mobile-first (360px wide forms). Migration `0015_phase9_8_vacancies.sql` applied to Neon. Eight `vacancy.*` audit kinds reserved (three in use: `.create`, `.update`, `.status.change`). New `Vacancies` entry in `EMPLOYER_NAV` (Briefcase icon) sits between Saved searches and Talent pools. Commit `1803676`.

### Task 9.8.2: Reverse-matching ("Find matches") ✅ 2026-05-24
- [x] `matchVacancyCandidates(vacancy)` composes via `searchProfilesQuery` (Phase 4 ranking SQL  one source of truth, no parallel matcher). New `countMatchesByCitizenship()` mirrors the WHERE-clause assembly exactly and emits `COUNT(*) FILTER (...)` buckets for the honest-supply line *"N SA citizens · M candidates match this vacancy"* (D6 wording  no LIMIT, so it's the true total across the platform, independent of the SEARCH_LIMIT-capped ranked view). Match page at `/employer/vacancies/[id]/match` reuses `<TalentRosterItem>` with the existing `citizen_boost` for highlighting (§CRITICAL respected  no new gate); sticky honest-supply header stays visible while scrolling on mobile. Find-matches CTA on the vacancy detail page is visible to all roles. All Phase 5 redaction preserved by construction (TalentRosterItem is the same component `/search` uses).

### Task 9.8.3: Consent purpose `vacancy_matching` ✅ 2026-05-24
- [x] `consentPurpose` += `vacancy_matching` via additive migration `0016` (same pattern as `0008` for `outcomes_research`). Default-off, non-degrading: a seeker who hasn't granted is still searchable/contactable exactly as today; they just don't receive vacancy invites. `/dashboard/privacy` and seeker sign-up step 2 both render the consent toggle (mobile-first tap-to-expand `<details>` on phones, always-visible paragraph on `md+`) with the verbatim D8 source text  single English source for the Tier-1 human translation (deepMerge fallback covers zu/xh/af stubs until pro translation lands). New `lib/consent/check.ts` ships `hasConsent()` + `hasVacancyMatchingConsent()` server-only helpers  the 9.8.4 invite action calls these at its boundary; structural ban on invites without current consent is asserted by compliance check (b) in 9.8.8. 22/22 tests · typecheck · build all clean.

### Task 9.8.4: Invite flow (employer  seeker) ✅ 2026-05-24
- [x] `vacancy_invitations` table shipped via migration `0017` with state enum [invited/accepted/accepted_with_notice/declined/reconsidering/withdrawn/expired], `expires_at` computed at send time from `vacancy.invite_expiry_days` per D2, decline_reason enum + 200-char note. UNIQUE on (vacancy_id, profile_id) for dedup. `bulkInviteToVacancy` Server Action splits selections through four gates (profile-not-found  profile-deleted  already-invited  consent gate via `hasVacancyMatchingConsent`); soft UX message *"N invites sent · M not eligible to receive an invite right now"* (D5 verbatim); per-seeker reason genuinely never reaches the client, only the audit log (admin oversight). Withdraw action transitions `invited` rows to `withdrawn` + notifies the seeker + audits as `vacancy.invite.withdraw`.
- [x] `/api/cron/vacancy-invite-expiry` shipped, guarded by `isAuthorizedCron(request)` (Bearer `CRON_SECRET`); idempotent conditional state flip + two notifications (`vacancy.invite.expired` seeker / `vacancy.invite.unanswered` employer via `notifyOrgMembers`); cron-only helper lives in non-`"use server"` `lib/employer/invitations-cron.ts` so it can't accidentally become a Server Action invokable by a client. Audit-logged as `vacancy.invite.expire`. Mobile-first bulk-invite modal (bottom-sheet on phones, centred on `md+`) + sticky action bar with select-all/clear chips. Viewers see the redacted talent pool with no interactive invite affordances.

### Task 9.8.5: Accept / decline-with-reason ✅ 2026-05-24
- [x] `lib/seeker/invitations.ts` ships four Server Actions (accept / accept_with_notice / decline / reconsider) wrapping a shared `respond()` engine that enforces ownership + expected-state + DB-conditional-update guards (concurrent flips can't race past). `accepted_with_notice` (D1, `notice_period_months` 112) is a yes everywhere  9.8.8 check (e) asserts it's excluded from "declined/unfilled". Decline picker is a bottom-sheet on mobile / centred modal on `md+` with six reasons, optional 200-char note (live char counter + POPIA reminder per D3, audit-meta flagged `seekerAuthoredFreeText: true` for the PII downstream contract), Other requires a note. Reconsider (only valid from `declined`) fires `vacancy.reconsider` notification (distinct kind so the employer's bell shows it apart from a normal response); accept/decline fire `vacancy.response`. Seeker surfaces shipped at `/dashboard/invitations` (list, active vs closed sections) + `/dashboard/invitations/[id]` (detail with state-aware `InvitationResponseIsland`)  the 9.8.4 invite notification's link is now an action-ready landing page. New `Vacancy invites` entry in `SEEKER_NAV` (Inbox icon). 22/22 tests · typecheck · build all clean.

### Task 9.8.6: Vacancy outcome  placement linkage ✅ 2026-05-24
- [x] Existing Phase 5 `markAsHired()` Server Action extended (not rebuilt) with optional `vacancyId` field; cross-org / stale ids silently nulled at the action boundary. `placement.confirm` audit-log meta carries the link. Source stays hard-coded `employer_confirmed`  Placement-Truth + 7.5.5 honesty rule inherited unchanged. FK `.references(...)` added to Drizzle schema so it mirrors the DB-level constraint already shipped in migration `0015` (no new migration). New `<VacancyPlacementsPanel>` on the vacancy detail page surfaces per-accepted-invitee "Log this hire" CTAs that deep-link to `/employer/dossier/[handle]?vacancyId=<id>#mark-as-hired` (the dossier resolves the title server-side + the MarkAsHiredCard banner *"Linking this hire to vacancy: <Title>"* confirms the link). When status=`filled` + no placements logged, the panel renders with an accent-coloured prominent prompt (the plan's "mark filled → prompt to log placement" requirement). Cardinality 1 vacancy : 0..N placements (an employer might hire multiple chefs from one posting), 1 placement : 0..1 vacancy. New read helper `getPlacementsForVacancy(vacancyId)` with double org-scoping (vacancy + placement). Mobile-first cards + ≥40px tap targets. 22/22 tests · typecheck · build all clean.

### Task 9.8.7: "Why roles go unfilled" analytics ✅ 2026-05-24
- [x] New aggregate query `declineReasonAggregateQuery({ orgId? })` over `vacancy_invitations` rows in `state='declined'` (the D1 / accept-with-notice = yes rule baked into WHERE), grouped by (profession_slug × province_slug × reason). Freshness-weighted via `sebenza_freshness_confidence(responded_at)`  recent declines dominate. Two callers, one function: pass `orgId` for employer-private view; omit for cross-market with `suppress()` engine (k=10 from `outcomes_min_cohort_size` + complementary passes on the reason + province axes). New `<DeclineReasonsCard>` (mobile-first horizontal bars, mirrors the 9.7 nationality-card idiom; the card reads its own `data.orgScoped` flag to switch wording). Shipped on `/employer/vacancies` (employer-private, no suppression  the recruiter's own org data) and on `/gov/shortage` (cross-market, suppressed) below the Justification Index. CSV export at `/api/gov/decline-reasons/export` reuses `csvFromRows()` + `csvDisposition()`  no way to bypass k-floor from this route; audit-logged as `analytics.export`. Card carries a cross-reference footer to the Justification Index so a salary-driven gap reads differently from a supply-driven one. No new migration. 22/22 tests · typecheck · build all clean.

### Task 9.8.8: Wiring, verification, doc convention
- [ ] Six compliance assertions extended: (a) no vacancy field on public/seeker/cross-org surface · (b) invite impossible without current consent · (c) **no nationality-based invite gate** · (d) decline-reason cells suppressed · (e) `accepted_with_notice` excluded from "unfilled" stats · (f) decline-note flagged as PII in exports. Seed: 12 vacancies + invites across SA + foreign-national profiles + one of each response state. On ship: `PHASE_9_8_COMPLETE.md`, tick this header ✅ + date, refresh Current State, commit `Phase 9.8 complete + Phase 10 opens`.

**Out of scope (explicit guardrails):** no public vacancy listing / "apply" button / seeker-side browsing (that's a job board) · no nationality-as-gate on invites · no `legal_eligibility_note` field (not even scaffolded, per D4) · salary-band stays private · no in-app interview scheduling / messaging build-out (reuses Phase 5 dossier flow) · public/employer search unchanged.

---

## ♿ PHASE 10: ACCESSIBILITY, PERFORMANCE & LOW-BANDWIDTH
*Goal: Genuinely usable for the people the platform exists to serve.*

- [ ] WCAG 2.2 AA audit (contrast, keyboard, screen-reader labels, focus order).
- [ ] Performance budget enforced; Lighthouse on throttled 3G / low-end device profile.
- [ ] Image discipline (responsive, lazy, tiny); minimal JS on public + search routes.
- [ ] Offline-tolerant where sensible (cached recent results); graceful degradation.
- [ ] **Localization rollout (next-intl):**
  - **Tier 1 (launch):** English (base), isiZulu (`zu`), isiXhosa (`xh`), Afrikaans (`af`).
  - **Tier 2 (fast follow):** Sepedi (`nso`), Setswana (`tn`), Sesotho (`st`)  Sotho-Tswana cluster → ~90% home-language coverage.
  - **Tier 3 (full official compliance):** siSwati (`ss`), Tshivenda (`ve`), Xitsonga (`ts`), isiNdebele (`nr`).
  - ICU message format for plurals/noun-class agreement; locale-aware date/number formatting.
  - **Consent / POPIA / legal copy: professional human translation only  never machine-translated.**
  - Verify display + body fonts cover required diacritics (esp. Tshivenda: ṅ ḓ ṱ ḽ ṋ). Subset per locale.
  - Persistent language switcher; remember choice per user; detect from `Accept-Language` on first visit.
  - Budget for ~30% text expansion (isiXhosa/Afrikaans run longer)  no fixed-width labels.

---

## 🧪 PHASE 11: TESTING & QA
*Goal: Production-ready and trustworthy.*

### Task 11.1: Unit
- [ ] Status-freshness/confidence logic. Search ranking. Encryption round-trip. Consent state machine.

### Task 11.2: Integration
- [ ] Sign-up → consent → searchable. Employer reveal → audit-log written. Placement → analytics update.

### Task 11.3: E2E (Playwright)
- [ ] Seeker: sign up → build profile → appear in search.
- [ ] Employer: verify org → search → shortlist → contact → log hire.
- [ ] Privacy: request export; request erasure; verify redaction.

### Task 11.4: Compliance Tests
- [ ] Assert no PII (ID/docs/contact) ever appears in public/search responses.
- [ ] Assert every PII access writes an audit-log row.

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Launch
- [ ] Seed data: provinces, cities, profession & skill taxonomy.
- [ ] Encryption keys + env secrets configured (KMS).
- [ ] Email templates configured (Resend).
- [ ] Error tracking (Sentry); privacy-respecting analytics (self-host/PostHog with PII off).
- [ ] Privacy Policy + PAIA manual live; consent flows verified.
- [ ] Neon region/data-residency documented; backups automated.

### Launch
- [ ] Monitoring + alerting; rate limits active.
- [ ] Audit-log retention policy set.
- [ ] Incident runbook (data-breach response per POPIA timelines).

### Post-Launch
- [ ] User feedback loop; status-freshness metrics watched.
- [ ] Dependency/security updates scheduled.
- [ ] Government pitch from a position of real data + traction.

---

## 📝 APPENDIX: DOMAIN DATA REFERENCE

### Provinces (seed)
Eastern Cape · Free State · Gauteng · KwaZulu-Natal · Limpopo · Mpumalanga · Northern Cape · North West · Western Cape

### Official Languages (i18n locales)
| Tier | Language | Locale | Notes |
|------|----------|--------|-------|
| Base | English | `en` | Default / working language |
| 1 | isiZulu | `zu` | Largest home language |
| 1 | isiXhosa | `xh` | |
| 1 | Afrikaans | `af` | |
| 2 | Sepedi (Northern Sotho) | `nso` | |
| 2 | Setswana | `tn` | |
| 2 | Sesotho | `st` | |
| 3 | siSwati | `ss` | |
| 3 | Tshivenda | `ve` | Needs extended diacritics |
| 3 | Xitsonga | `ts` | |
| 3 | isiNdebele | `nr` | |

### Enums
```ts
employmentStatus = ["employed", "unemployed", "self_employed", "studying", "open_to_work"]
verificationStatus = ["unverified", "pending", "verified", "rejected"]
userRole = ["seeker", "employer", "admin"]
```

### Status Freshness Bands (tune later)
| Band | Age of `statusConfirmedAt` | Effect |
|------|-----------------------------|--------|
| Fresh | < 30 days | Full weight in search + analytics |
| Ageing | 30–90 days | Slight down-rank; nudge sent |
| Stale | ≥ 90 days | Down-ranked; flagged low-confidence; strong nudge |

### Redaction Matrix (what each viewer sees)
| Field | Public/Search | Verified Employer (post-consent) | Admin |
|-------|---------------|----------------------------------|-------|
| Name, profession, city, skills, status, badges | ✅ | ✅ | ✅ |
| ID number | ❌ | ❌ (never) | 🔒 audited, encrypted |
| Documents / certificates | ❌ | ✅ (audited) | ✅ (audited) |
| Contact details | ❌ | ✅ (audited) | ✅ (audited) |

### Profession Taxonomy (seed examples  extend)
Chef · Software Developer (Frontend / Backend / Full-stack) · Help Desk / IT Support · Call-Centre Agent ·
HR Practitioner · Electrician · Plumber · Accountant · Nurse · Driver · Boilermaker · Welder · Teacher

---

*Last Updated: 2026-05-23*
*Version: 1.9  Phase 6.5 polish shipped (CSV injection guard + CRLF + partial-match skills-gap + heatmap CSS var + skill_gap_snapshots time-series + rankInPoolQuery + skillDemandQuery + clickable heatmap + Δ deltas)  see `docs/completed/PHASE_6_5_COMPLETE.md`. Strategic adds queued for Phase 9 (PDF / LMI / `/gov` / city / forecast)  see `docs/PHASE_9_PLAN.md`. Phase 7 (admin + 2FA + notifications) opens next  `docs/PHASE_7_PLAN.md`.*
*Working name: Sebenza (replace with chosen brand)*
