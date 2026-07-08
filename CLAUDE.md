@AGENTS.md

# Sebenza  agent context

**Working name:** Sebenza · South African National Talent-Intelligence Platform.
**Companion docs (read together, always):**
- `docs/TO_START_EVERY_SESSION.md`  non-negotiable rules + tone + current state.
- `docs/ROADMAP.md`  phased build plan (Phase 0 → 26; all shipped except 14, which is partnership-gated).
- `docs/UX_UI_SPEC.md`  design system + screen-by-screen.

**Current state (2026-07): LIVE, DB-BACKED, shipped through Phase 28.** Postgres (Neon) + Drizzle,
61 migrations (0000→0060), Better Auth sessions, 358-test vitest suite (unit/integration/compliance)
+ ~100-test Playwright E2E (desktop + 360px), 20 cron jobs. Nothing user-facing renders mock data
(Phase 23 truth pass); `lib/mock/` survives only as seed source, taxonomy-constant fallback, pure
helpers, and test fixtures. Showcase login accounts: `docs/SHOWCASE_ACCOUNTS.md`.
Phase 28: installable PWA (`app/manifest.ts`, brand icons, minimal offline-only service worker in
`public/sw.js`) + floating mobile bottom nav w/ More sheet (`components/layout/MobileBottomNav.tsx`,
`mobilePrimary` flags in the nav configs) replacing the old mobile top tab strip on all dashboards.

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
- Next.js 16.2.6 (App Router, no `src`, Turbopack) · React 19.2.4 · TS strict + noUncheckedIndexedAccess.
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
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` · SMTP: `EMAIL_TRANSPORT`, `SMTP_*`.

## When in doubt
Rule wins over instinct. If a "wow" instinct conflicts with No-Flash, POPIA-First, or
Verification-Honesty, the rule wins. Read `docs/TO_START_EVERY_SESSION.md` again.
