# SEBENZA — NATIONAL TALENT PLATFORM ROADMAP (v1.0)
**Project:** Sebenza *(working name)* — South African Talent-Intelligence Platform
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
that registry — we win on **data quality, usability, and analytics.** The system has three surfaces:

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
- [x] Role-based access guard (`lib/auth/guard.ts`) — least privilege.

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
- [x] `/sign-in` — single entry for all roles (seeker / employer / admin) with role chip selector. 2FA notice for employer + admin.
- [x] `/sign-up` — role chooser: **Job seeker** (consumer) vs **Employer / recruiter** (org). Admin sign-up notice: issued by Sebenza, not self-registered.
- [x] `/sign-up/seeker` — 3-step onboarding: identity basics → consent capture → first profile fields. Resumable; ID number marked encrypted-on-save.
- [x] `/sign-up/employer` — registers an `organization (unverified)`; explains the verification gate up front; flags 2FA mandatory.
- [x] `/verify-email` + `/forgot-password` — UI stubs ready for Resend wire-up in Phase 8.
- [x] Update `SiteHeader` to expose Sign in / Get started; demo-mode notice everywhere auth touches.

### Task 1.5.2: Seeker dashboard (full workspace, not a tile)
- [x] `/dashboard` shell with sidebar (desktop) + bottom tab bar (mobile); Civic Editorial chrome. *(role-themed accent strip on sidebar)*
- [x] `/dashboard` overview — completeness arc, Talent Pulse confirm, search-rank position card, recommended next steps, viewers, contacts, link to public profile.
- [x] `/dashboard/profile` — full profile editor (identity, professional, skills picker with proficiency, location, headline, bio). ID number field present with "Encrypted on save" badge; never echoed back.
- [x] `/dashboard/experience` — CRUD list with start/end dates, "Current" toggle.
- [x] `/dashboard/qualifications` — uploads with verification status, partner-handled verification copy.
- [x] `/dashboard/activity` — your own audit-log view (who viewed, who contacted, what was revealed, what was downloaded).
- [x] `/dashboard/privacy` — active consents list with revoke; data-export request; erasure request (soft-delete + 30-day grace).
- [x] `/dashboard/account` — email, password, 2FA (optional for seekers), session management, sign out.
- [x] `/dashboard/grow` — **Career compass.** Demand-driven skill recommendations, projected rank delta if learned (e.g. *"Add 2 skills → move from #4 to #2 in Software Developer · Gauteng"*), SA-grounded learning paths (SETA learnerships, TVET, INDLELA, SAQA-recognised programmes, free options first), adjacent-profession overlap. Anchored on the same `analytics.demandBySkill` that powers `/insights` so the Phase 6 skills-gap engine plugs straight in. **This is the wedge feature for retention on the seeker side: the platform that *also tells you what to learn next.*** *(Glance card also rendered on `/dashboard` overview for visibility.)*
- [x] **Student mode** — when a seeker's profile carries an academic record (in-progress NQF qualification at a recognised SA institution), the platform shifts gear:
  - [x] **Academic data captured** at sign-up step 3 (collapsible "I'm currently a student" toggle reveals institution / programme / NQF level / current year / expected graduation / NSFAS / internship-and-graduate intent) and in the profile editor (Studies section renders only when `academic` exists, always with a *Verification handled by* note — never a default-verified label).
  - [x] **Public profile** shows *"Currently studying [programme] at [institution]"* honestly with an explicit verification chip, NQF band, year of study, graduation countdown, NSFAS flag, and the seeker's opt-in to internships / graduate programmes.
  - [x] **Career compass — Student lane.** Sits on top of the demand-driven recommendations when academic data is present: *"Bridge your degree to the market"* hero with graduation countdown, recommended electives **inside the seeker's programme** mapped to province-level demand signal, real SA internships + graduate programmes (PwC SAICA, Deloitte, SARS, Discovery, Standard Bank, Yoco, MICT SETA, Stats SA) with public sector listed first, *"Where graduates from your programme go"* destinations table aggregated from confirmed placements, and supplementary free learning to plug the gaps every graduate has.
  - [x] **Honesty rules carried through.** Verification state is never inflated; programme eligibility is shown openly so we don't waste people's time; SAQA-recognised programmes carry an explicit SAQA chip; the destinations table is aggregated, never per-person; the mock implementation matches the Phase 4 + Phase 6 interface exactly so the swap is a data plug.
  - [ ] **Search side-effect (Phase 4):** employer filter for "open to internships / graduate programmes" — strictly opt-in by the seeker, never default. *(Schema fields present; UI filter wires in Phase 4 alongside the DB-backed search.)*
  - [ ] **Government wedge (Phase 6):** materialise the *demand-vs-curriculum* dataset by programme + institution + province from `searchEvents × profiles.academic`. *(Mock shape lives in `lib/mock/academic.ts`; Phase 6 plugs the query layer in.)*
  - [ ] **Verification (Phase 8):** SAQA + institution partnership to flip `academic.verification` from self-reported to authoritative.

### Task 1.5.3: Employer dashboard (full workspace)
- [x] `/employer` shell with sidebar; persistent org-verification banner if unverified.
- [x] `/employer` overview — KPIs (saved searches, talent pools, contact reveals this month, confirmed placements), recent matches with placement nudge.
- [x] `/employer/saved-searches` — CRUD, last-run timestamp, "{n} new matches" badge.
- [x] `/employer/shortlists` — talent pools with member counts, internal share (no PII export).
- [x] `/employer/placements` — every hire confirmed on Sebenza; form to log a new placement; salary band kept private.
- [x] `/employer/organisation` — registered details, verification state, "Submit for verification" CTA (pluggable KYC slot — Phase 8).
- [x] `/employer/team` — invite colleagues; per-member workspace role (Owner / Recruiter / Viewer); each access audit-logged separately.
- [x] `/employer/account` — 2FA mandatory state, sessions, sign out.

### Task 1.5.4: Admin dashboard (full workspace)
- [x] `/admin` shell with sidebar; 2FA-required eyebrow on every page.
- [x] `/admin` overview — KPI strip (pending verifications, open reports, new users 7d, audit events 24h), active queue counts, recent admin actions.
- [x] `/admin/verifications` — tabs for qualifications + organisations; approve / reject (with reason) / view evidence.
- [x] `/admin/moderation` — reported profile queue with reason codes; suspend / restore / close-no-action.
- [x] `/admin/taxonomy` — tabbed reference-data editor (professions, skills, provinces, cities) — controlled vocab only.
- [x] `/admin/audit-log` — filterable PII-access ledger; CSV export (audit-logged).
- [x] `/admin/users` — search by handle/email/role; account actions (suspend/restore/erase) audit-logged.
- [x] `/admin/settings` — feature flags, freshness band thresholds, ranking weights.

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
- [x] Role model (`seeker | employer | admin`) + Server-Action sign-in that **routes by `app_user.role`** (no role chip on the sign-in page — credentials identify the user).
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
- [x] `lib/email/send.ts` abstraction: `EMAIL_TRANSPORT=mailtrap` (dev — captured sandbox) or `EMAIL_TRANSPORT=resend` (prod). Console transport as a fallback when no transport is set.
- [x] `nodemailer` for Mailtrap SMTP; `resend` SDK for production sends.
- [x] Better Auth's `sendVerificationEmail` / `sendResetPassword` callbacks wired to `send()`.

### Task 2.5: Audit-log persistence
- [x] `lib/audit.logAccess()` writes to `audit_log` table (keeps the ring buffer as a tail).
- [x] `/admin/audit-log` + `/admin` overview KPI both read from the table.

---

## 👤 PHASE 3: THE TALENT PROFILE ✅ *(done 2026-05-22)*
*Goal: Rich, trustworthy profiles with a live, time-aware employment status. See `docs/completed/PHASE_3_COMPLETE.md`.*

### Task 3.1: Profile CRUD
- [x] Personal: display name, location (province/city), nationality, ID number (**encrypted on save, never displayed back** — SA Luhn-validated).
- [x] Professional: profession, seniority, bio.
- [x] Skills: multi-select from controlled taxonomy + self-rated proficiency; replace-on-save transaction.
- [x] Experience: add / edit / delete; inline form with date-order validation.

### Task 3.2: Qualifications & Documents
- [x] Upload certificates to **Supabase Storage** (private bucket, signed URLs, service-role key server-only).
- [x] Each qualification: title, institution, awarded year, `verification_status` (default `unverified`; flips to `pending` on document upload).
- [x] Content-type + size limits + **magic-byte sniff** (don't trust browser's claimed type); per-user rate limit (5 / 10 min, in-memory; Upstash in Phase 9); every PII path audit-logged.
- [x] Profile photo upload with client-side resize to 512 px (canvas + JPEG re-encode) — keeps payloads tiny on metered data.

### Task 3.3: Employment Status Engine (the differentiator)
- [x] `status` enum + `statusConfirmedAt` (already in schema since Phase 0).
- [x] Freshness/confidence derivation in `lib/status.ts` — `fresh < 30d`, `ageing < 90d`, `stale ≥ 90d`; confidence weights 1.0 / 0.6 / 0.25.
- [x] Re-confirmation nudge surfaced as a **dashboard banner** (yellow ageing, red stale); inline "Yes, still accurate" button hits `reconfirmStatus`.
- [ ] **Email-cron nudge for ageing/stale statuses → Phase 8** alongside the email comms hardening (the banner is enough for the in-dashboard surface).
- [ ] **Stale statuses down-ranked in search + flagged low-confidence in analytics → Phase 4** (the engine ships in Phase 3; the search-side wire-up is part of the Postgres FTS work).

---

## ⚙️ PHASE 4: THE DATA ENGINE (Backend & Schema)
*Goal: The schema, search engine, and integrity logic everything else stands on.*

### Task 4.1: Drizzle Schema
- [ ] Auth tables (Better Auth) + app `userRole`.
- [ ] `profiles`, `skills`, `profileSkills`, `experiences`, `qualifications`.
- [ ] `organizations`, `placements`, `searchEvents`.
- [ ] POPIA: `consents`, `auditLog`. Taxonomy: `provinces`, `cities`, `professions`.
- [ ] Enums: `employmentStatus`, `verificationStatus`, `userRole`.
- [ ] Indices: GIN on `searchVector`; trigram on profession/skill names; btree on city/skill FKs.
```ts
// status as a first-class, time-aware concept
status: employmentStatus("status").notNull().default("open_to_work"),
statusConfirmedAt: timestamp("status_confirmed_at").notNull().defaultNow(),
nationalIdEnc: text("national_id_enc"),     // encrypted; never in any read payload
searchVector: customTsvector("search_vector"),
deletedAt: timestamp("deleted_at"),         // soft delete → erasure
```

### Task 4.2: Search Engine (Postgres FTS + pg_trgm)
- [ ] Generated `tsvector` over `profession || headline || skills`; GIN index.
- [ ] `websearch_to_tsquery` for free text; `pg_trgm` similarity for typo tolerance.
- [ ] Ranking function blending relevance × status confidence × completeness × citizen highlight.
- [ ] Strict select-list redaction at the query layer (sensitive columns never selected for public reads).

### Task 4.3: Integrity & Server Actions
- [ ] Typed query functions in `db/` (no raw queries in components).
- [ ] Server Actions for all mutations; Zod validation on every input.
- [ ] `logAccess()` enforced on every PII read/export path.

---

## 🏢 PHASE 5: THE EMPLOYER PORTAL
*Goal: Employers find, shortlist, contact talent, and — critically — log hires.*

### Task 5.1: Organization Accounts & KYC Slot
- [ ] Org profile; `verification_status`; pluggable company-KYC slot (third-party later).
- [ ] Only `orgVerified` employers can reveal contact/documents (audit-logged each time).

### Task 5.2: Search, Shortlist, Contact
- [ ] Saved searches + shortlists (talent pools).
- [ ] Contact/reveal flow → consent check → audit log entry.
- [ ] Notifications to seeker when contacted (Resend).

### Task 5.3: Placement Confirmation (analytics fuel)
- [ ] "Mark as hired" flow → writes `placements` (profile, org, role, city, date).
- [ ] Incentive hooks (TBD): why an employer bothers logging — design this, it's the data-quality lever.
- [ ] On placement, prompt seeker to update status → keeps data fresh and ties the loop.

---

## 📊 PHASE 6: THE ANALYTICS & POLICY DASHBOARD
*Goal: The government wedge — real-time workforce visibility.*

### Task 6.1: Employment Analytics (Recharts)
- [ ] Counts/trends by skill, profession, location, seniority, status — **weighted by data freshness**.
- [ ] Time series of registrations, status changes, confirmed placements.
- [ ] Region/skill heat views (lightweight, no heavy map libs on mobile).

### Task 6.2: Skills-Gap Intelligence
- [ ] Derive demand from `searchEvents`: what employers search for but can't find.
- [ ] Surface gaps by location/skill → future training-partnership product + pitch slide.

### Task 6.3: Exports & Policy Reporting
- [ ] CSV/PDF exports of aggregate (non-PII) stats for policy use.
- [ ] Aggregation only; never expose individual PII in analytics. Every export audit-logged.

---

## 🛡️ PHASE 7: ADMIN & MODERATION
*Goal: Keep the database trustworthy.*

### Task 7.1: Admin Shell & Auth
- [ ] `/admin` route group; admin-only guard.

### Task 7.2: 2FA enforcement (deferred from Phase 2)
- [ ] Build `/setup-2fa` (QR + manual key + verify code + 8 downloadable backup codes).
- [ ] Build `/verify-2fa` (TOTP code field, rate-limited, backup-code fallback) — slots into the sign-in flow between password and session-create.
- [ ] Wire Better Auth's twoFactor plugin; enable mandatory 2FA for `employer` and `admin`.
- [ ] Existing employer + admin users without 2FA get a one-time forced setup on next sign-in.
- [ ] Account → 2FA panel: configure, regenerate backup codes, view recovery options.

### Task 7.3: Verification & Moderation Queue
- [ ] Review uploaded qualifications → set `verified / rejected` with reason.
- [ ] Review reported profiles; suspend/restore.
- [ ] Organization verification workflow.

### Task 7.4: Taxonomy & Reference Data
- [ ] Manage `professions`, `skills`, `provinces`, `cities` (controlled vocab, no free text in search).

### Task 7.5: Audit-Log Viewer
- [ ] Searchable view of PII access/exports (who saw what, when) for compliance.

---

## 🔗 PHASE 8: VERIFICATION & INTEGRATIONS
*Goal: Upgrade trust as partnerships unlock.*

### Task 8.1: Third-Party KYC (private path)
- [ ] Pluggable SA identity/KYC provider behind the `verifiedBy` slot (no schema change needed).

### Task 8.2: Government Hooks (post-partnership)
- [ ] SAQA (qualifications) + Home Affairs (ID) verification — **only available via Dept. partnership.**
  Design adapters now; activate when granted. This is the leverage in the government pitch.

### Task 8.3: Email & Comms
- [ ] Resend templates: verification, contact, status nudge, placement confirmation.

---

## 🔒 PHASE 9: TRUST, SECURITY & POPIA HARDENING
*Goal: Safe to put real citizens' data into.*

- [ ] Field-level encryption verified for all ID numbers; key rotation plan.
- [ ] Rate limiting (Upstash) on auth + search; brute-force/enumeration protection.
- [ ] Security pass against the May-2026 Next.js advisories (middleware/proxy bypass, SSRF, etc.).
- [ ] Erasure path tested end-to-end (right to deletion).
- [ ] Privacy Policy + PAIA manual published before real users onboard.
- [ ] Pen-test / dependency audit; secrets management review.
- [ ] **Postgres → AWS Cape Town (`af-south-1`) on Docker.** Migrate off Neon
  (`eu-central-1`) to a self-hosted Postgres in SA jurisdiction so PII never leaves
  the country. Drizzle stays the ORM; the only code change is swapping
  `drizzle-orm/neon-http` for `drizzle-orm/node-postgres` (or `postgres-js`) in
  `db/client.ts`. Plan covers: Docker compose / RDS instance, daily encrypted
  backups to SA storage, PITR retention, monitoring, failover, schema replay
  via `db:migrate`, data replay via `pg_dump | pg_restore`. Schedule the cutover
  during a maintenance window with a read-only Neon snapshot as the rollback.

---

## ♿ PHASE 10: ACCESSIBILITY, PERFORMANCE & LOW-BANDWIDTH
*Goal: Genuinely usable for the people the platform exists to serve.*

- [ ] WCAG 2.2 AA audit (contrast, keyboard, screen-reader labels, focus order).
- [ ] Performance budget enforced; Lighthouse on throttled 3G / low-end device profile.
- [ ] Image discipline (responsive, lazy, tiny); minimal JS on public + search routes.
- [ ] Offline-tolerant where sensible (cached recent results); graceful degradation.
- [ ] **Localization rollout (next-intl):**
  - **Tier 1 (launch):** English (base), isiZulu (`zu`), isiXhosa (`xh`), Afrikaans (`af`).
  - **Tier 2 (fast follow):** Sepedi (`nso`), Setswana (`tn`), Sesotho (`st`) — Sotho-Tswana cluster → ~90% home-language coverage.
  - **Tier 3 (full official compliance):** siSwati (`ss`), Tshivenda (`ve`), Xitsonga (`ts`), isiNdebele (`nr`).
  - ICU message format for plurals/noun-class agreement; locale-aware date/number formatting.
  - **Consent / POPIA / legal copy: professional human translation only — never machine-translated.**
  - Verify display + body fonts cover required diacritics (esp. Tshivenda: ṅ ḓ ṱ ḽ ṋ). Subset per locale.
  - Persistent language switcher; remember choice per user; detect from `Accept-Language` on first visit.
  - Budget for ~30% text expansion (isiXhosa/Afrikaans run longer) — no fixed-width labels.

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

### Profession Taxonomy (seed examples — extend)
Chef · Software Developer (Frontend / Backend / Full-stack) · Help Desk / IT Support · Call-Centre Agent ·
HR Practitioner · Electrician · Plumber · Accountant · Nurse · Driver · Boilermaker · Welder · Teacher

---

*Last Updated: 2026-05-22*
*Version: 1.4 — Phase 3 complete (profile CRUD + Supabase Storage + status engine + dashboard nudge + DAL-based three-layer security audit) — see `docs/completed/PHASE_3_COMPLETE.md` and `docs/SECURITY.md`. Phase 4 (Postgres FTS + real `dbProvider` + signed photo URLs on public reads) opens next — see `docs/PHASE_4_PLAN.md`.*
*Working name: Sebenza (replace with chosen brand)*
