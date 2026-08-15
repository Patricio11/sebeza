@AGENTS.md

# Sebenza  agent context

**Working name:** Sebenza · South African National Talent-Intelligence Platform.
**Companion docs (read together, always):**
- `docs/TO_START_EVERY_SESSION.md`  non-negotiable rules + tone + current state.
- `docs/ROADMAP.md`  phased build plan (Phase 0 → 34; all shipped except 14, which is partnership-gated).
- `docs/UX_UI_SPEC.md`  design system + screen-by-screen.

**Current state (2026-08): LIVE, DB-BACKED, shipped through Phase 34 + the post-34 polish wave.**
Postgres (Neon) + Drizzle, 65 migrations (0000→0064), Better Auth sessions, ~434-test vitest suite
(unit/integration/compliance) + ~126-test Playwright E2E (desktop + 360px), 20 cron jobs.
Post-34 wave (2026-07-30 → 08-15, plan docs in docs/): profile LANGUAGES (spoken + written levels,
migration 0064, counts in completeness via the ONE shared engine - keep recompute paths in parity);
suggestion APPROVAL LOOP (promote/merge backfills the suggester's profile + notifies via
`taxonomy.suggestion.approved`; skills were the gap); /marketing explainer funnel
(docs/MARKETING_PAGE_COPY.md is copy-of-record; live stats only); branded 404 + `[...rest]`
catch-all + global-error; admin smoke gate `tests/e2e/admin-smoke.spec.ts` (extend its route list
when adding admin pages); 17 private colleges in the institutions taxonomy.
**House rules added: NO em-dashes anywhere users or the founder read (AI tell); never call
`toLocaleDateString()` without an explicit locale in SSR'd components - use `formatDateZA()`
(lib/utils; React #418 class); plan docs use `- [ ]` checkbox TASKS/VERIFY ticked as they land.**
Phase 34 (Self Apply, plan `docs/PHASE_34_SELF_APPLY_PLAN.md`): per-vacancy public apply link,
SHIPS DARK behind `feature_flag_vacancy_self_apply` + per-vacancy toggle. Self-applications ride
`vacancy_invitations` via the new `origin` column (born `accepted`, "Self-applied" chip; employer
vets via existing review/shortlist; accept-rate strips EXCLUDE them). `lib/vacancy/public.ts` is
the deliberate 9.8.8 public carve-out  its anonymous payload type structurally cannot carry
salaryBand (source-level test). D4: the audited apply confirmation IS the consent act; no
`vacancy_matching` requirement for seeker-initiated applications. New-user funnel records the
application AT SIGN-UP. **`components/ui/BrandDialog.tsx` is the house modal primitive**  use it
for every new dialog. E2E flag-ON verified on the Docker harness only  NEVER flip platform flags
on the shared Neon DB (it IS prod).
Phase 32 (security remediation, plan `docs/PHASE_32_SECURITY_HARDENING_PLAN.md`, DPIA addendum R-27):
**a `"use server"` export is a PUBLIC HTTP endpoint**  `lib/security/server-action-guards.test.ts`
fails the build on any unguarded Server Action (allowlist entries must justify being public).
Suspension/erasure/password-reset/2FA-reset revoke sessions; DAL fails closed on moderation state;
auth rate limits in `lib/rate-limit` (signin/2fa-verify keyed per IP and counting FAILURES only 
`peek` up front, `enforce` on the failure path  so shared-IP offices/CGNAT never lock out; per-email
keying is a lockout weapon, never use it); open redirects closed via `safeInternalPath`; welcome
email (role-aware, POPIA §18 consent restatement) fires from `afterEmailVerification`. Known gap: no
persisted user locale → transactional email is English-only.
Phase 33 (SEO): metadata/JSON-LD/social previews; Vercel `<Analytics/>`+`<SpeedInsights/>` in the
locale layout render ONLY when `process.env.VERCEL === "1"` (they 404 anywhere else  keep the gate).
Phase 31 (data minimisation, plan `docs/PHASE_9_19_PLAN.md`): ID/passport collection DORMANT by
default (`feature_flag_id_verification_enabled` OFF; ack-gated on /admin/verifications; collection
actions hard-refuse, removal never gated). Nationality = ONE picker for everyone (default ZA, no
citizen question); `is_citizen` DERIVED server-side (`code === "ZA"`); labels derive from the ISO
code (free text retired). Responsible party: Yetotec (Pty) Ltd. Nothing user-facing renders mock data
(Phase 23 truth pass); `lib/mock/` survives only as seed source, taxonomy-constant fallback, pure
helpers, and test fixtures. Showcase login accounts: `docs/SHOWCASE_ACCOUNTS.md`.
Phase 28: installable PWA (`app/manifest.ts`, brand icons, minimal offline-only service worker in
`public/sw.js`) + floating mobile bottom nav w/ More sheet (`components/layout/MobileBottomNav.tsx`,
`mobilePrimary` flags in the nav configs) replacing the old mobile top tab strip on all dashboards.
Phase 29: optional `positions` headcount on vacancies (+"Select top N" on the match page) and the
seamless /search invite funnel  public multi-select (localStorage, survives sign-in), viewer-gated
dialog (sign-in / verify-org / vacancy picker), `bulkInviteByHandles`, `?returnTo=` create-vacancy
detour guarded by `lib/nav/safe-internal-path`.

## Non-negotiable rules (summary  full text in docs/TO_START_EVERY_SESSION.md)
1. **No-Flash.** Works on a low-end Android over 3G. JS budget ~150KB on key routes.
2. **Location-Not-Nationality.** Matched by residence + skill. Nationality shown, never a gate.
3. **POPIA-First.** Consents (9 purposes), persistent audit log, field-level encryption, soft-delete.
4. **Redaction.** Public/search payloads never include IDs, documents, raw contact.
5. **Verification-Honesty.** Default `unverified`. Badges reflect reality  never lie.
6. **Status-Freshness.** Stale statuses (≥90d) down-ranked + flagged.
7. **Placement-Truth.** A hire counts only when confirmed via the platform.
8. **Testing discipline.** Nothing is "done" until `test:all` + E2E (both flag states, desktop +
   360px) are green and migrations apply clean from zero. Ship-dark: new seeker features go behind
   default-OFF feature flags on /admin/settings.

## Aesthetic  "Civic Editorial"
Fraunces (display) × Hanken Grotesk (body); warm paper/ink + institutional teal + one ochre accent.
Editorial layouts, thick rules, all-caps tracked eyebrows, tabular numerals. NOT a SaaS card grid.

## Stack (pinned)
- Next.js 16.2.12 (App Router, no `src`, Turbopack) · React 19.2.4 · TS strict + noUncheckedIndexedAccess.
- Tailwind v4 (tokens in `app/globals.css` @theme) · next-intl 4.12 (en base; zu/xh/af deepMerge fallback).
- Drizzle ORM 0.45 + Postgres (Neon serverless driver; `DATABASE_DRIVER=postgres-js` for local/Docker).
- Better Auth 1.6 (sessions, email verification, 2FA TOTP; prod admins hard-require 2FA).
- Supabase Storage (private buckets, signed URLs) · nodemailer SMTP (`EMAIL_TRANSPORT=smtp|console`).
- Recharts 3.8 (insights only) · Lucide · clsx + tailwind-merge `cn()`.

## Architecture (what actually matters now)
- **DB is the source of truth.** Pages call `db/queries/*` directly. The old `lib/data/provider.ts`
  seam survives only for landing/insights/search/profile reads; it defaults to `db` and THROWS on
  `mock` in production.
- **`lib/audit/logAccess()`** wraps every PII-touching path (~70 audit kinds, persistent table).
- **Auth:** `lib/auth/dal.ts` (`verifyRole`/`verifyAdmin`/`verifyOrgVerified`/`verifyGov`).
- **Feature flags:** `lib/admin/settings.ts` SettingKey + DEFAULTS; toggles on /admin/settings.
  Adding a key requires: the union + DEFAULTS + settings-actions validator map + its z.enum list.
- **Crypto:** `lib/crypto` AES-256-GCM, key-id prefix (`SEBENZA_ENCRYPTION_KEY` env; KMS still future).
- **Integrations:** /admin/integrations (Phase 25)  SMS/WhatsApp/Email creds encrypted in DB with
  env fallback; LLM providers on /admin/llm (same posture); DB/Storage are env-only + health cards.
- **AI Coach safety (Phase 22):** the seeker LLM coach is OFF by default; enabling is ack-gated on
  /admin/llm and requires verified crisis resources (/admin/crisis-resources). Distress screening
  runs BEFORE any provider call. Never weaken this path.
- **Migrations:** hand-written idempotent SQL in `db/migrations/` + `meta/_journal.json` (idx must
  stay contiguous). The test harness migrates from zero on every vitest run.

## Commands
```bash
npm run dev          # local dev (Turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint
npm run db:migrate   # apply migrations      db:seed  db:studio  db:generate
npm run test         # vitest unit
npm run test:all     # typecheck + lint + full vitest (unit/integration/compliance)
npm run test:e2e     # Playwright (Docker test Postgres + .env.test.local)
```

## Environment (see `.env.example` for the full annotated list)
- `SEBENZA_DATA_PROVIDER`  defaults to `db`; `mock` is dev/test-only (throws in prod).
- `DATABASE_URL` (+ optional `DATABASE_DRIVER=postgres-js`) · `SEBENZA_ENCRYPTION_KEY` (base64, 32B).
- `BETTER_AUTH_SECRET` · `CRON_SECRET` (all 20 cron routes fail closed without it).
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` · SMTP: `EMAIL_TRANSPORT`, `SMTP_*`.

## When in doubt
Rule wins over instinct. If a "wow" instinct conflicts with No-Flash, POPIA-First, or
Verification-Honesty, the rule wins. Read `docs/TO_START_EVERY_SESSION.md` again.
