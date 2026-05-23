# Phase 7 — Admin, Moderation & 2FA Enforcement · 📋 PLAN (opened 2026-05-23)

> Active plans live at the top of `docs/`. When this phase ships, this file moves to `docs/completed/PHASE_7_PLAN.md` and `docs/completed/PHASE_7_COMPLETE.md` is written.

**Goal:** Make every admin control real, enforce 2FA for employer + admin sign-in, and ship the audit-driven polish carried over from the post-Phase-5 audit (2026-05-23). After Phase 7 there are no dead buttons in the product — every visible affordance does what it says.

---

## Re-checks (decide before kickoff)

### Re-check #1 — Build `lib/admin/*` as a peer of `lib/employer/*` ✅ LOCKED
Same shape: one Server Action file per surface, each action calls `verifyAdmin()`, each writes an `audit_log` row. No "global admin" magic — every privileged action is grep-able.

### Re-check #2 — 2FA via Better Auth's `twoFactor` plugin ✅ LOCKED
The same plugin SRS uses. Issuer = "Sebenza", 30s period, 6 digits + 10 backup codes shown once at enrolment. Mandatory for `employer` and `admin` roles; optional for `seeker`. After password verification Better Auth intercepts with `twoFactorRedirect: true`; the client calls `/two-factor/verify-totp` or `verify-backup-code` before the session commits.

### Re-check #3 — Forced 2FA setup for existing employer/admin users
Anyone with `role IN ('employer', 'admin')` AND `twoFactorActive = false` (or `app_user.two_factor_enabled = false` once we add that column) hits a one-time forced setup screen on next sign-in. Don't let them into the dashboard until enrolled. Seekers stay free to skip.

### Re-check #4 — Settings schema gets a `platform_settings` table
Today `/admin/settings` is entirely UI-only. Add a single-row table (or a `key/value` table) so freshness band thresholds + ranking weights + feature flags persist. Reading at runtime: cached in a module-scope variable, refreshed every 5 min.

### Re-check #5 — Admin actions on PII-touching surfaces (suspend / approve) write to BOTH audit_log AND a "moderation_actions" trail
For accountability + reversibility. The `audit_log` row is the canonical event; `moderation_actions` carries the human reason ("3 reports, spam template match") so a future admin can review the decision context.

### Re-check #6 — In-product CSV export = real, not download-by-email
`/admin/audit-log` CSV button streams aggregated CSV directly (≤10k rows). Bigger exports → "We'll email you the file" Phase 8 hook. Same for `/insights` export (Phase 6 already lands the in-product CSV).

### Re-check #7 — Doc convention (unchanged)

---

## Implementation plan

### A. Audit-driven polish carryover (Tier 1 + Tier 2 from 2026-05-23 audit)

#### A.1 Admin moderation queue (lib/admin/moderation.ts)
- New table `reports`: `id`, `subjectProfileId`, `reporterUserId`, `reason enum`, `note`, `createdAt`, `status enum (open|closed|actioned)`, `closedAt`, `closedByUserId`, `closedReason`
- Server Actions: `suspendUser({ userId, reason })`, `restoreUser({ userId })`, `closeReport({ reportId, reason })`, `flagProfile({ handle, reason, note })` (called from public `/p/[handle]` Report button)
- Add `app_user.suspendedAt`/`suspendedReason` columns (or use existing `deletedAt` if soft-delete is enough — DECIDE before migration)
- Wire `/admin/moderation` to read live reports + the 3 action buttons per row
- `/admin/overview` "open reports" KPI counts unclosed reports

#### A.2 Verifications queue (lib/admin/verifications.ts)
- Server Actions: `approveQualification({ qualificationId, note })`, `rejectQualification({ qualificationId, reason })`, `approveOrganisation({ orgId, note })`, `rejectOrganisation({ orgId, reason })`
- Each flips the `verification` column on the target row, writes audit `verification.approve` / `verification.reject` with `meta.reason`
- Wire `/admin/verifications` to read pending qualifications (`qualifications.verification = 'pending'`) + pending orgs (`organizations.verification = 'unverified'` with a pending flag — or add `verification = 'pending'` state)
- `/admin/overview` "pending verifications" KPI counts both pending queues

#### A.3 Users management (lib/admin/users.ts)
- Replace the hardcoded `EXTRA_USERS` array with a real DB query: `SELECT * FROM app_user JOIN organization_members (where role=employer) JOIN profiles (where role=seeker) ORDER BY created_at DESC`
- Add search + role filter handlers (Server Action that returns filtered rows + paginates)
- Server Actions: `suspendUser`, `restoreUser`, `eraseUser` (soft-delete + 30-day grace, hard-delete via Phase 8 cron)
- `/admin/overview` "new users 7d" KPI counts `app_user.created_at >= now() - 7d`

#### A.4 Taxonomy CRUD (lib/admin/taxonomy.ts)
- Server Actions: `addProfession({ slug, label })`, `addSkill`, `removeProfession`, `removeSkill`, `addCity`, `removeCity`
- Validation: slug must be kebab-case + unique; can't remove a profession/skill that's still referenced by `profiles` or `profile_skills`
- Wire `/admin/taxonomy` edit pencils + Add button
- Loading state on add (don't let the user spam-click)

#### A.5 Audit-log filters + CSV export
- Wire the filter form: `kind` + `actor` → reload page with `?kind=&actor=` search params; query layer filters
- "Export CSV" action: builds aggregated CSV (max 10k rows, paginated) + writes `analytics.export` audit row + streams via `Response`

#### A.6 Platform settings persistence
- Migration: `platform_settings` table with `key text PRIMARY KEY`, `value jsonb`, `updatedAt`, `updatedByUserId`
- Seed default values for the existing UI fields (freshness band days, ranking weights, feature flags)
- `lib/admin/settings.ts`: `updateSetting({ key, value })` Server Action (admin-only)
- Read helper `getSetting(key)` cached in a module-scope `Map` with 5-min TTL
- Wire `/admin/settings` Save button

#### A.7 Public surface polish (Tier 2 audit)
- Landing: replace hardcoded `"May"` with `Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date())`
- `/search`: remove the "Load more" disabled button until pagination ships (Phase 6 follow-up) — replace with "Showing X of Y · refine filters to narrow"
- `/p/[handle]`: "Report" button → calls `flagProfile` action (A.1); "Request contact" + "Save to pool" → link to `/sign-in?next=/employer/dossier/<handle>` for unauth, else to the actual action
- `/insights`: "Export CSV" → real CSV export (might also land in Phase 6 if the analytics rebuild gets there first)
- `/dashboard/profile`: surface email field (read-only from session) for clarity
- Add a "Request data export" + "Erase me" Server Action stub so the buttons disable honestly (Phase 8 finishes them but the click-handler-to-nowhere goes away)

#### A.8 Seed data quality
- Add 2 saved searches for Discovery Bank (Senior developer · Gauteng + Pastry chef · Western Cape)
- Add 2 shortlist pools for Discovery Bank (Q3 engineering, Pastry pop-up) with the existing seeded members
- Seed 1 prior `profile.contact.reveal` audit row for Naledi → Andile (lets the dossier render the cached state on first visit)
- Backfill `actorUserId` + `salaryBand` on the 2 seeded placements
- Seed 1-2 open `reports` for the moderation queue demo

### B. 2FA enforcement (the original ROADMAP Phase 7 work)

#### B.1 Schema + plugin wire-up
- Add `app_user.two_factor_enabled boolean default false` (Better Auth's twoFactor plugin manages its own `twoFactor` table; we still want a top-level flag for the forced-setup gate)
- Add Better Auth `twoFactor` plugin to `lib/auth/server.ts` (must stay before `nextCookies` per docs)
- `npx @better-auth/cli generate` → review the schema delta → fold into a new migration

#### B.2 Setup + verify pages
- `/setup-2fa`: QR + manual key + verify-code field; on success display 10 backup codes (one-time only — must be downloaded/printed)
- `/verify-2fa`: TOTP field + "Use backup code instead" link → `verify-backup-code` flow; rate-limited (Better Auth handles)
- Both pages use `AuthShell` chrome

#### B.3 Forced setup gate
- Server-side guard middleware: if `user.role IN ('employer','admin')` AND `user.twoFactorEnabled = false` AND current path is NOT `/setup-2fa` → redirect to `/setup-2fa`
- After successful setup, `user.twoFactorEnabled = true`; gate stops triggering
- Account page (`/employer/account`, `/dashboard/account`) gets a "Configure 2FA" panel that actually works (was disabled Phase 7-stub since the audit)

#### B.4 Sign-in flow change
- Phase 2's `signIn` action gets a 2FA branch:
  - Better Auth returns `{ twoFactorRedirect: true }` after a correct password if 2FA is on
  - Form's `onSubmit` checks for the flag and pushes to `/verify-2fa`
  - `/verify-2fa` form action commits the session after TOTP/backup code verification
- Update `docs/SECURITY.md` Layer 2 section to mention 2FA validation

#### B.5 Backup codes + recovery
- Backup codes are single-use, hashed at rest, regeneratable from `/setup-2fa` (invalidates the old set)
- Recovery flow if user loses both device + backup codes: admin-side action `reset2faForUser({ userId, reason })` — also audit-logged

---

## Acceptance criteria (Phase 7 is DONE when every box ticks)

### Admin actions
- [ ] Suspend a reported user → row flips in DB; user can't sign in (gets "Account suspended" message); audit row written
- [ ] Approve a pending qualification → `verification = 'verified'`; seeker sees the badge change on their dashboard
- [ ] Add a new profession via /admin/taxonomy → appears in /sign-up/seeker dropdown immediately
- [ ] Adjust freshness-band thresholds in /admin/settings → `/insights` recomputes on next render
- [ ] /admin/audit-log filters narrow the list; CSV export streams a real file with the filtered rows

### 2FA
- [ ] Admin signs in → forced to /setup-2fa → scans QR → enters TOTP → backup codes shown once → lands on /admin
- [ ] Admin signs in again on a different device → /verify-2fa challenge → enters TOTP → /admin
- [ ] Admin loses TOTP device → uses a backup code → lands on /admin → code is now invalid for reuse
- [ ] Seeker signs in → no 2FA gate (optional)
- [ ] Employer with verified org → forced setup applies

### Audit-driven polish
- [ ] Landing "Confirmed hires · MONTH" reflects the actual current month
- [ ] /search no longer shows a disabled "Load more"
- [ ] /p/[handle] Report button writes a moderation report (visible in /admin/moderation)
- [ ] /p/[handle] "Request contact" routes to sign-in for unauth, to dossier for verified employer
- [ ] Every admin button does what its label says — zero dead controls

---

## Out of scope for Phase 7

- **Pagination on /search** — Phase 6 (alongside the FTS query rebuild for skills-gap)
- **Email notifications** for suspend / approve / report events → Phase 8 (Resend)
- **Cron-driven hard-delete of soft-erased users** (30-day window) → Phase 8
- **Rate limiting via Upstash** → Phase 9 (Better Auth's in-memory limit + 2FA brute-force protection holds for Phase 7)
- **SAQA / Home Affairs verification adapters** → Phase 8

---

## Risks to flag at kickoff

- **Backup codes shown once + hashed at rest** — if the user closes the modal without copying, they have to regenerate. Document this prominently in the setup flow. Make the "Download .txt" button huge.
- **Forced-setup gate must not loop** — verify the redirect logic excludes `/setup-2fa`, `/verify-2fa`, and `/api/auth/**` so the user can actually reach the setup page. Test with a sandbox account.
- **`admin/users` suspend action must use soft-delete** — never hard-delete from this surface. Hard-delete only via the Phase 8 erasure cron after the 30-day grace.
- **2FA reset by admin is a privileged escalation path** — only Sebenza-issued admins can do it; double-log the audit row with both the admin actor and the affected user as subject.
- **Settings persistence cache** — if cache TTL is too long, freshness-band changes don't surface for hours. Default 5 min; consider Redis pub/sub when we move to multi-instance (Phase 9).
- **Better Auth's `twoFactor` plugin must come BEFORE `nextCookies`** in the plugins array — order matters per their docs. Verify on a fresh build.

---

## Audit-2026-05-23 — full findings recap

Captured during the post-Phase-5 audit before this plan was opened. Every item is mapped to a section above; reference list for traceability:

| Surface | Issue | Mapped to |
|---|---|---|
| `/admin` overview KPIs | All 4 numbers hardcoded | A.1 + A.2 + A.3 (live KPI queries) |
| `/admin/audit-log` filters | No submit handler | A.5 |
| `/admin/audit-log` CSV | Dead button | A.5 |
| `/admin/moderation` queue + buttons | All fake / dead | A.1 |
| `/admin/settings` save | Entire page UI-only | A.6 |
| `/admin/taxonomy` add/edit | All buttons inert | A.4 |
| `/admin/users` search + fake employer rows | Mixed real/mock; search dead | A.3 |
| `/admin/verifications` approve/reject | All buttons inert | A.2 |
| Landing "Confirmed hires · May" | Month hardcoded | A.7 |
| `/search` load-more | Disabled button implies pagination | A.7 |
| `/p/[handle]` Report button | No handler | A.7 + A.1 |
| `/p/[handle]` contact/save buttons | Disabled with no sign-in route | A.7 |
| `/insights` CSV export | Dead button (overlaps Phase 6) | A.7 / Phase 6 |
| Seed: `salary_band`, `actor_user_id` missing on placements | Phase 5 columns not backfilled | A.8 |
| Seed: 0 saved searches, 0 shortlists, 0 prior reveals | Empty states forever in employer demo | A.8 |
| Production hardening | Rate-limit, CSP, Sentry, loading.tsx, robots, sitemap | **Phase 9** (explicit) |

---

*When this ships: write `docs/completed/PHASE_7_COMPLETE.md` and open `docs/PHASE_8_PLAN.md` (Resend email + cron jobs + KYC adapter + SAQA verification).*
