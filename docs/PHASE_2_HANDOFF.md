# Phase 1 → Phase 2 — handoff & readiness audit

> **Status as of 2026-05-22.** Phase 0, Phase 1, and Phase 1.5 are complete. The platform demos end-to-end as a three-role mock-driven product. This document is the audit that proves it and the checklist that opens Phase 2.

**Scope of Phase 2** (per `ROADMAP.md`): turn the mock-driven platform into a working backend — real auth (Better Auth ≥ 1.6.5), real sessions, real consent capture, real role-based guards. The seed data is the mock data we already have; nothing is invented.

> **Rule of the seed.** *We must use the mock data as seed.* Every record visible in the running mock-driven app today (Thandeka, Sipho, Amara, Lerato, Kabelo, Nomvula, Andile, Zinhle; Discovery Bank; the placements; the SETA / TVET learning paths; the controlled taxonomy of professions, skills, provinces, cities, institutions) must seed into Postgres as Phase 2 cuts over. No re-invention; the demo we have *is* the starting database.

---

## 1 · What Phase 0 / 1 / 1.5 actually delivered

### Code surfaces (every checkbox in `ROADMAP.md` cross-checked against the repo)

**Public**
- `/` Landing — Mzansi National hero, live national-pulse dossier with count-up stats, Principles section, three pillars, real-outcomes cards, employer / government split, final CTA. Full mobile responsiveness (M1–M7 in `MOBILE_PLAN.md`).
- `/search` — sticky search bar, filter rail (desktop) + bottom-sheet (mobile), editorial talent roster, all states (loading / empty / error), redaction enforced at the type layer (`PublicProfile` carries no PII).
- `/p/[handle]` — civic dossier with hero Avatar (responsive `xl` / `2xl`), trust dossier action card, bio pull-quote, studies block (when academic), proficiency bars, vertical experience timeline, qualification cards, consolidated "Recorded access" gated section.
- `/insights` — national bulletin masthead, KPI stat cards, by-status responsive table → mobile cards, Recharts trend + skills-gap (mount-gated to dodge SSR sizing), aggregate-only CSV export CTA.

**Auth (UI only — no real auth wired yet)**
- `/sign-in` with role chip selector (seeker / employer / admin).
- `/sign-up` role chooser + `/sign-up/seeker` (3 steps incl. collapsible student-mode capture) + `/sign-up/employer` + `/verify-email` + `/forgot-password`.

**Seeker workspace (eight routes under `/dashboard`)**
- Overview, profile editor, experience, qualifications, **Career compass** (`/dashboard/grow` — demand-driven skill recs + Student lane), activity, privacy & consent, account.

**Employer workspace (eight routes under `/employer`)**
- Overview, saved searches, talent pools, placements, organisation, team, account. Persistent org-unverified banner across every page.

**Admin workspace (eight routes under `/admin`)**
- Overview, verification queue (qualifications + organisations), moderation, taxonomy, audit log, users, settings. 2FA-required eyebrow on every page.

**Errors**
- `/not-found` and `/error` carry the SA flag stripe and chevron motif (even when no header is loaded).

**i18n** — `/[locale]/...` for `en` / `zu` / `xh` / `af`. Non-English catalogs are stubs; missing keys deep-merge-fall-back to English. `next-intl` 4.12 plugin wired via `proxy.ts` (Next 16 convention).

**Chrome shared across the platform**
- `SiteHeader` (internal pages) and `LandingHeader` (landing) — both with the SA green/gold/red top stripe and the chevron-marked wordmark.
- `MobileNav` (full-screen drawer, used by both headers, body-scroll-locked).
- `DashboardShell` (role-themed accent strip, chevron-marked workspace label, faint chevron motif in every page masthead, mobile top tab strip with fade-edge cue).
- `SiteFooter` (charcoal ink, flag stripe at top, chevron mark, trust strip).
- `AuthShell` (flag stripe, chevron motif bleed, demo-mode banner).

**Signature components**
- `StatusChip` (Talent Pulse glyph — fresh / ageing / stale rings).
- `VerificationBadge` (unverified / pending / verified / rejected — never inflates).
- `ProfileCompleteness` (bar + arc variants).
- `Avatar` (photo-first, sophisticated initials fallback with deterministic SA-palette gradient + chevron watermark, optional verification ring).
- `TalentRosterItem` (the search-result row — uses Avatar).
- `StatCard` (Fraunces numeral + inline SVG sparkline).
- `DataSpine` (left-aligned vertical meta rail).
- `EmptyState`, `Skeleton`, `Button`, `FormField` (Text / Select / Textarea + `EncryptedBadge`).
- `SAChevron` (`mark` / `inline` / `signature` / `divider` variants).
- `CustomSelect` (portaled popover on desktop, full-screen bottom sheet on mobile, full keyboard a11y, hidden-input form submission still native).
- `AnimatedCount` (IntersectionObserver, `prefers-reduced-motion` aware).

### Spine — POPIA + integrity

- `db/schema.ts` — Drizzle tables defined for `app_user`, `profiles`, `skills`, `profile_skills`, `experiences`, `qualifications`, `organizations`, `placements`, `search_events`, `consents`, `audit_log`, `provinces`, `cities`, `professions`, `academic_profiles` (added during this handoff). Enums for `employment_status`, `verification_status`, `user_role`, `consent_purpose`, `consent_state`.
- `db/client.ts` — Neon HTTP driver + Drizzle. Lazy connection.
- `lib/crypto/index.ts` — AES-256-GCM field encryption with key-id prefix for future rotation.
- `lib/audit/logAccess()` — every mock-provider PII read already calls this; ring buffer renders in `/admin` for visibility. Phase 2 swaps to `audit_log` table.
- `lib/auth/guard.ts` — `requireRole()` / `requireOrgVerified()` stubs; signatures stable for Phase 2 to fill.
- `lib/consent/index.ts` — state machine + purpose taxonomy.

### Mock data — the seed source of truth

The whole platform reads through `lib/data/provider.ts`. Today it's the `mockProvider`; Phase 4 flips to `dbProvider`. The mock data that needs to land in Postgres:

| Mock module | Tables it seeds in Phase 2 |
|---|---|
| `lib/mock/profiles.ts` (8 profiles incl. 2 students) | `app_user`, `profiles`, `experiences`, `qualifications`, `profile_skills`, `academic_profiles` |
| `lib/mock/analytics.ts` | (analytics derive from joins — no direct seed; the trend / by-status numbers are illustrative until real data accumulates) |
| `lib/mock/taxonomy.ts` (9 provinces + ~25 cities + 13 professions + 15 skills + 21 institutions + NQF levels) | `provinces`, `cities`, `professions`, `skills` + the future `institutions` table |
| `lib/mock/academic.ts` (CS + Accounting student snapshots — electives, programmes, destinations) | Phase 6 derives this from `search_events × profiles.academic`; the snapshot module stays as a reference contract |
| `lib/mock/growth.ts` (skill recommendations, learning paths, adjacent professions) | Phase 6 derives demand from `search_events`; the learning-paths list itself becomes a taxonomy seed under `learning_paths` (new in Phase 6) |

The seed script (`db/seed.ts`) added in this handoff reads from these mock modules directly so the dataset stays single-sourced.

---

## 2 · Gaps closed in this handoff (Phase 1 finish-work)

These were the items that would have blocked Phase 2 if left untouched. All landed in the same commit as this doc.

- [x] `profile_photo_url` added to `profiles` schema (matches the `PublicProfile.profilePhotoUrl` field).
- [x] `academic_profiles` table added with FK to `profiles`, full NQF enum + verification state + opt-in flags. Matches `AcademicProfile` from `lib/mock/types.ts` 1:1.
- [x] `institutions` table added — the controlled vocab from `lib/mock/taxonomy.ts` `INSTITUTIONS` becomes a real reference table.
- [x] `organization_members` table added so the employer team page has a real persistence target in Phase 5.
- [x] `db/seed.ts` written — reads from `lib/mock/*` and writes via Drizzle. Idempotent (truncates first, then inserts). Documents every relationship explicitly.
- [x] `package.json` scripts added: `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed`.
- [x] `tsx` + `dotenv` added to `devDependencies` so the seed script runs from the command line.
- [x] `.env.example` reorganised by phase, with comments pointing to the seed command and Better Auth secret-generation snippet.

---

## 3 · Pre-Phase-2 checklist (run before writing a single Better Auth line)

```bash
# 1. Provision Neon
#    - Create a project in eu-central-1 (or document residency in compliance log)
#    - Copy the DATABASE_URL into .env.local
cp .env.example .env.local
# edit DATABASE_URL=postgres://...

# 2. Generate an encryption key (32 bytes, base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# paste into SEBENZA_ENCRYPTION_KEY in .env.local

# 3. Generate a Better Auth secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# paste into BETTER_AUTH_SECRET (and set BETTER_AUTH_URL=http://localhost:3000)

# 4. Generate + apply the initial migration
npm install
npm run db:generate    # drizzle-kit generate — writes db/migrations/*.sql
npm run db:migrate     # drizzle-kit migrate — applies to Neon

# 5. Seed the mock dataset
npm run db:seed        # tsx db/seed.ts — idempotent

# 6. Verify
npm run dev
# open Drizzle Studio in another shell if you want a visual check:
npm run db:studio
```

After step 6, the running app still reads through `lib/data/provider.ts` (still `mockProvider` by default). Phase 2's first job is to wire Better Auth on top of these tables and add a real `dbProvider` for the auth-touching reads. Search / profile / insights queries stay on `mockProvider` until Phase 4 — that's deliberate and lets Phase 2 stay scoped.

---

## 4 · Phase 2 kickoff — the work, in order

> **Phase 2 = real auth + real consent. Nothing else changes.** Phase 3 (profile CRUD via Server Actions) and Phase 4 (Postgres FTS + ranking + the real `dbProvider`) come after. Keep the diff focused.

### 2.1 · Better Auth (≥ 1.6.5) wiring
1. `npm i better-auth` + the Drizzle adapter.
2. Create `lib/auth/server.ts` exporting the Better Auth instance configured with:
   - Drizzle adapter against the existing `db` client.
   - Email + password.
   - Email OTP (via Resend in dev = console transport, Phase 8 hooks up real Resend).
   - `appRole` plugin (or a custom field on the user table) — values `seeker | employer | admin`.
   - Required 2FA for `employer` and `admin` (TOTP).
3. Wire `app/api/auth/[...all]/route.ts` (Better Auth's catch-all handler).
4. Replace the stub `lib/auth/guard.ts` getSessionUser with the real Better Auth session reader.
5. Add a `proxy.ts` rule alongside the existing next-intl middleware that calls `requireRole()` on the `(seeker)` / `(employer)` / `(admin)` route groups.

### 2.2 · Sign-up flows
1. `/sign-up/seeker` step 1 — capture identity. **ID number must call `encryptField()` before write.** Create the `app_user` + the consent shell.
2. `/sign-up/seeker` step 2 — persist consents to `consents` (state = `granted`, version = the catalog version the user actually saw, timestamp now). Profile becomes searchable only when `searchability` is granted.
3. `/sign-up/seeker` step 3 — create the `profiles` row + (if student) the `academic_profiles` row. Send the welcome + verification email via Resend (real in Phase 8; console in Phase 2).
4. `/sign-up/employer` — create the `organizations` row in state `unverified`, link the user as the owner in `organization_members`. Force the user through TOTP setup before any session is granted.

### 2.3 · Consent & privacy UX
1. The `/dashboard/privacy` page is already built — wire its consent rows to a `revokeConsent()` Server Action that updates `consents.state = 'revoked'` and writes an `audit_log` row.
2. Export-my-data: Server Action that produces a JSON dump (profile + experience + qualifications + consents + audit_log filtered to this user) and emails the user a signed download link.
3. Erasure: soft-delete via `profiles.deleted_at = now()`. A nightly cron (Phase 8) does the hard delete after 30 days.

### 2.4 · Acceptance criteria for Phase 2 done
- A real Discovery Bank employer account can sign in. Org is unverified — contact reveal is locked.
- Andile (the mock student) can sign in (seeded with a known password — see `db/seed.ts` for the seed creds doc).
- The admin account can sign in with TOTP. Audit log records every PII access.
- `requireRole('seeker')` redirects an unauthed user to `/sign-in`. `requireOrgVerified()` blocks unverified employers from any reveal action.
- A seeker can grant or revoke `searchability` consent; revoking it removes them from `/search` results immediately.
- `logAccess()` writes to Postgres, not the ring buffer. `/admin/audit-log` reads from the table.

When all six bullets are true, Phase 2 ships and Phase 3 (profile CRUD via Server Actions) opens.

---

## 5 · Out of scope for Phase 2 (don't blur the line)

- **Search side-effect: "open to internships / graduate programmes" filter** — schema flags are already there on `academic_profiles`; the UI filter ships with the real DB-backed search in Phase 4.
- **Supabase Storage document upload** — qualifications + CV + profile photo upload is Phase 3. (We use Supabase Storage standalone; Better Auth + Neon stay as the auth + DB stack.)
- **Real Resend templates** — Phase 8. Console transport is fine for Phase 2.
- **KYC partner integration** — Phase 8. Org verification stays manual via the admin queue for Phase 2/5.
- **Rate limiting + Upstash** — Phase 9.
- **Search FTS + pg_trgm + ranking SQL** — Phase 4.
- **Skills-gap engine + demand-vs-curriculum dataset** — Phase 6.
- **SAQA / institution verification of `academic_profiles.verification`** — Phase 8.

---

## 6 · Risks to flag at Phase 2 kickoff

- **Better Auth migration files conflict with our own.** Better Auth's adapter creates `session`, `account`, `verification`, and optionally `two_factor` tables. Either let it own those (separate migration namespace) or include them explicitly in our `db/schema.ts` so a single `db:generate` run produces a coherent diff. Decide *before* running `db:generate`.
- **Mock IDs vs UUIDs.** Mock profiles use slug handles (`thandeka-m`, `lerato-n`). Real users will have UUID `app_user.id` + a generated handle. The seed mints UUIDs for each mock user; the handles stay human-readable for URLs. Document this in `db/seed.ts`.
- **POPIA cross-border residency.** Neon's regions are well outside SA. Either pick `eu-central-1` and document the cross-border note in the compliance log *before* real PII is written, or wait for Neon to ship an SA region. Mock-only data has no POPIA exposure; the moment the first real user signs up, this becomes load-bearing.
- **Encryption key rotation.** The wire format already includes a `v1.` prefix. When the first rotation happens (Phase 8/9), the decryption path must support both keys for the grace period. The unit test for this is on the Phase 11 checklist — add a "rotation test" early so the format isn't accidentally simplified.

---

*Owner: Lead Architect. Reviewers: Compliance, DevOps. Next update: when Phase 2 ships.*
