# Sebenza

South Africa's national talent-intelligence platform — a fast, accessible,
POPIA-first search and analytics surface that matches people to work by skill
and location, and gives government an honest picture of the labour market.

> The trustworthy, real-time layer for South African work.

Built through **Phase 9** (2026-05-23). The product is launch-ready against
the current Neon (EU) database; everything beyond is operational + commercial,
not engineering. The AWS Cape Town migration is a documented one-day cutover
(see [docs/AWS_MIGRATION_RUNBOOK.md](docs/AWS_MIGRATION_RUNBOOK.md)) deferred
pending partnership confirmation.

---

## Dormant-by-default posture

Every third-party service that costs money or needs a vendor agreement is
**off** out of the box. A fresh clone runs `typecheck`, `build`, and `dev`
with zero paid credentials. Each integration has one obvious activation path.

| Service | Gate | Effect when dormant | When to activate |
|---|---|---|---|
| **Sentry** | `SENTRY_DSN` unset | No-op `initSentry()`; nothing leaves the box | Add DSN + install `@sentry/nextjs` |
| **Resend** transactional email | `feature_flag_email_notifications` (default OFF) | Templates exist; dispatch is skipped; in-app notifications still fire | Admin flips the flag once Resend domain auth is verified |
| **KYC SaaS** (Home Affairs adapter) | `feature_flag_kyc_provider` (default OFF) + `KYC_PROVIDER` env | `MockIdentityVerifier` returns "pending"; admin handles manually | Drop a provider in `lib/kyc/providers/*`, flip flag — admin enables after partnership |
| **SAQA NLRD worker** | `feature_flag_saqa_worker` (default OFF) | `approveQualification` flips directly; cron is a no-op | Admin flips the flag once the SAQA agreement is signed |
| **Upstash rate limiter** | No call sites wired | In-memory `RateLimiter` exists; nothing is enforced | Import `enforce(bucket, key)` on the Server Action you want to gate |
| **Vercel Cron** | `CRON_SECRET` unset | `isAuthorizedCron` refuses every request | Set `CRON_SECRET` + add cron paths to `vercel.json` |

### On rate limiting

Rate limiting is **not enforced anywhere by default**. The `lib/rate-limit/`
module is shipped and ready to wire when real abuse is observed; budgets get
sized from real traffic, not guessed. Decision recorded in
[docs/popia/DPIA.md](docs/popia/DPIA.md) (Risk R8) and in code comments on
`signIn` + `revealContact`.

Why no sign-in rate limit? A per-email limit creates a denial-of-service
vector — an attacker who knows your email can submit bad passwords and lock
the legitimate user out. Better Auth's scrypt hashing (~100–200ms per attempt)
is the real brute-force mitigation; TOTP 2FA is the second factor for
high-value accounts.

---

## Stack

- **Next.js 16.2.6** (App Router, no `src/`, React 19.2.4 Server Components +
  Server Actions, Turbopack).
- **TypeScript** strict + `noUncheckedIndexedAccess`.
- **Tailwind v4** (design tokens in `app/globals.css` via `@theme`); Fraunces
  display + Hanken Grotesk body via `next/font`.
- **Drizzle ORM 0.45** + **Neon serverless** Postgres (EU, Phase 9; AWS Cape
  Town `af-south-1` migration deferred).
- **Better Auth 1.6.11** with `nextCookies()` + `twoFactor` plugins
  (TOTP + backup codes).
- **next-intl 4.12** — Tier-1 locales `en` / `zu` / `xh` / `af`; deep-merge
  fallback to English. Tier-2 / Tier-3 + professional translation land in
  Phase 10.
- **Supabase Storage** for private documents (CVs, certificates, photos).
- **Recharts 3.8** on `/insights` only (client island, mount-gated).
- Postgres FTS + `pg_trgm` for search ranking; `sebenza_freshness_confidence()`
  SQL function feeds the down-rank.

---

## Phase status

| Phase | Title | Status | Notes |
|---|---|---|---|
| 0 | Repo + non-negotiable rules | ✅ | [PHASE_0_COMPLETE](docs/completed/PHASE_0_COMPLETE.md) |
| 1 | Mock-data clickable surface | ✅ | [PHASE_1_COMPLETE](docs/completed/PHASE_1_COMPLETE.md) |
| 1.5 | Civic-Editorial design system | ✅ | [PHASE_1_5_COMPLETE](docs/completed/PHASE_1_5_COMPLETE.md) |
| 2 | Auth + real consent persistence | ✅ | [PHASE_2_COMPLETE](docs/completed/PHASE_2_COMPLETE.md) |
| 3 | File storage (Supabase) | ✅ | [PHASE_3_COMPLETE](docs/completed/PHASE_3_COMPLETE.md) |
| 4 | Data-provider DB swap | ✅ | [PHASE_4_COMPLETE](docs/completed/PHASE_4_COMPLETE.md) |
| 5 | Employer workflows (saved searches, reveals, hires) | ✅ | [PHASE_5_COMPLETE](docs/completed/PHASE_5_COMPLETE.md) |
| 6 | Analytics + snapshots | ✅ | [PHASE_6_COMPLETE](docs/completed/PHASE_6_COMPLETE.md) |
| 6.5 | CSV hardening (OWASP, RFC 4180, BOM) | ✅ | [PHASE_6_5_COMPLETE](docs/completed/PHASE_6_5_COMPLETE.md) |
| 7 | Admin actions + in-app notifications + 2FA | ✅ | [PHASE_7_COMPLETE](docs/completed/PHASE_7_COMPLETE.md) |
| 7.5 | Longitudinal outcomes (k-anonymity, complementary suppression) | ✅ | [PHASE_7_5_COMPLETE](docs/completed/PHASE_7_5_COMPLETE.md) |
| 8 | KYC + SAQA hooks, retention cron, data export, self-erase | ✅ | [PHASE_8_COMPLETE](docs/completed/PHASE_8_COMPLETE.md) |
| 9 | Trust, security, strategic adds (LMI, `/gov`, POPIA docs) | ✅ | [PHASE_9_COMPLETE](docs/completed/PHASE_9_COMPLETE.md) |
| 10 | Accessibility, perf budget, Tier-1/2/3 translations | planned | Public-launch phase |

---

## Roles

| Role | Home | Highlights |
|---|---|---|
| **seeker** | `/dashboard` | Talent Pulse confirm, profile editor, work-availability chips, self-reported placement, KYC panel, §23 data export, §24 self-erase, TOTP 2FA |
| **employer** | `/employer` | Saved searches, candidate reveals (30-day window, audit-logged), placement nudge banner, hire confirmation |
| **admin** | `/admin` | Moderation queue, settings, feature flags, audit log + CSV export, outcomes-compliance smoke check |
| **gov** | `/gov` | Sebenza LMI hero, province deep-dives, top unfilled-demand skills, exports surface, 2FA panel |

The proxy + DAL + Server Action layers each enforce the role gate
(defence-in-depth). `verifyGov()` allows admins through for ops override.

---

## Local setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill DATABASE_URL (Neon), SEBENZA_ENCRYPTION_KEY, BETTER_AUTH_SECRET.
# Generate the two secrets locally:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Every other key in .env.example can stay empty — the system runs dormant.

# 3. Database
npm run db:generate     # generate Drizzle migration (only if you changed schema)
npm run db:migrate      # apply 0000 → 0011 to your Neon DB
npm run db:seed         # mock-data seed (idempotent)

# 4. Dev
npm run dev             # http://localhost:3000
npm run build           # production build
npm run typecheck       # tsc --noEmit
npm run lint
```

### Seed credentials (dev only — never deploy)

Password for every seeded account: `sebenza-dev-2026`

| Role | Email |
|---|---|
| admin | `admin@sebenza.co.za` |
| employer | `naledi.khumalo@discovery.co.za` |
| seeker | `{handle}@example.co.za` (any seeded handle, e.g. `lerato-mokoena`) |
| gov | seeded via admin role-grant; flip a seeker to `gov` in `/admin` |

---

## Routes (current surface)

### Public
- `/` — landing, Civic-Editorial hero + national pulse + LMI badge
- `/search` — talent search (FTS + freshness down-rank)
- `/p/[handle]` — public profile (redacted; never IDs / documents / raw contact)
- `/insights` — analytics + skills-gap; **`/insights/print`** for the PDF export
- `/privacy` — POPIA Privacy Policy (12 sections)
- `/paia` — PAIA manual (Section 51 of Act 2 of 2000)

### Authed
- `/dashboard/*` — seeker workspace
- `/employer/*` — employer workspace
- `/admin/*` — admin moderation + settings + audit log
- `/gov/*` — government workspace (overview, provinces, exports, account)

### APIs
- `GET /api/lmi` — Sebenza Labour Market Index, formula published in response
- `GET /api/admin/audit-log/export` — CSV (hard-capped 10 000 rows)
- `GET /api/insights/outcomes/export` — outcomes dataset CSV (k-anonymity floor applies)
- `GET /api/admin/outcomes-compliance` — runs the 4 compliance assertions live
- `GET /api/dashboard/data-export` — POPIA §23 personal data export
- `GET /api/cron/*` — Vercel Cron entry points (CRON_SECRET-gated; fail-closed)

All authed routes localised at `/[locale]/...` for `en`, `zu`, `xh`, `af`.

---

## POPIA posture

Sebenza is built POPIA-first. Compliance is documented end-to-end:

- [docs/popia/INFORMATION_OFFICER.md](docs/popia/INFORMATION_OFFICER.md) — designation placeholder + working contact (`popia@sebenza.co.za`)
- [docs/popia/DPIA.md](docs/popia/DPIA.md) — 8 risks + mitigations (R8 = rate-limit decision)
- [docs/popia/BREACH_RESPONSE.md](docs/popia/BREACH_RESPONSE.md) — containment / assessment / notification stages, Section-22 template
- [docs/popia/RETENTION_POLICY.md](docs/popia/RETENTION_POLICY.md) — per-category retention windows + enforcement mechanism
- [docs/popia/ENCRYPTION_INVENTORY.md](docs/popia/ENCRYPTION_INVENTORY.md) — at-rest / in-transit / application-level + rotation runbook

Built-in mechanisms:

- **AES-256-GCM** field-level encryption on national ID numbers (key-id
  prefix for rotation); never displayed back, even to admins.
- **Audit log** as system of record for every PII-touching code path.
- **Consent state machine** with versioned consent text + timestamp.
- **k-anonymity** (k=10) + complementary suppression on the longitudinal
  outcomes dataset, with 4 runnable compliance assertions wired into an
  admin smoke route.
- **§23** data export and **§24** self-erase wired into the seeker dashboard.
- **Cookie banner** — essential always-on, analytics opt-in (default OFF);
  one first-party cookie, server-resolved so it doesn't flash.
- **Security headers** — CSP, HSTS, Permissions-Policy, X-Frame-Options DENY,
  COOP same-origin, Referrer-Policy strict-origin-when-cross-origin, applied
  via `proxy.ts` on every response.
- **Redaction at the type level** — `PublicProfile` cannot carry IDs /
  documents / raw contact; the type is the gate.

---

## Operator runbooks

When it's time to activate a deferred service, the runbook is already written:

- **AWS Cape Town `af-south-1` migration** — [docs/AWS_MIGRATION_RUNBOOK.md](docs/AWS_MIGRATION_RUNBOOK.md) (~4 hours, zero remaining POPIA work).
- **KYC / SAQA / Resend activation** — [docs/completed/PHASE_8_COMPLETE.md](docs/completed/PHASE_8_COMPLETE.md) "Activation" section.
- **Cron + CRON_SECRET wiring** — [docs/completed/PHASE_8_COMPLETE.md](docs/completed/PHASE_8_COMPLETE.md).
- **Outcomes-dataset compliance** — `GET /api/admin/outcomes-compliance` runs the assertions live; CI hookup is the Phase 10 polish.

---

## Architecture seams to know

- **`lib/data/provider.ts`** — the typed mock-↔-DB seam. Pages never branch
  on which provider is active.
- **`lib/audit/logAccess()`** — every PII-touching code path wraps in this.
- **`lib/auth/dal.ts`** — `verifyAdmin()`, `verifyGov()`, `getSessionUser()`,
  `roleHome()`. Three-layer gate (proxy → DAL → Server Action) is enforced.
- **`lib/crypto/`** — AES-256-GCM with key-id prefix; env-based today, KMS-ready.
- **`lib/notifications/server.ts`** — `createNotification` is per-kind
  catalog + idempotency-aware; fan-out helpers (`notifyOrgMembers`,
  `notifyAllAdmins`) are revalidate-driven, no polling.
- **`lib/analytics/lmi.ts`** — composite formula
  `0.4 × freshness + 0.4 × (1 − gap) + 0.2 × placement_velocity`; published
  publicly on `/privacy` and in the API response so the index is honest.
- **`db/schema.ts`** mirrors `lib/mock/types.ts`. Keep them aligned.

---

## Companion docs

The three documents in `docs/` are load-bearing and read together every session:

1. [docs/TO_START_EVERY_SESSION.md](docs/TO_START_EVERY_SESSION.md) — non-negotiable rules + Current State block.
2. [docs/ROADMAP.md](docs/ROADMAP.md) — phased build plan (Phase 0 → 10).
3. [docs/UX_UI_SPEC.md](docs/UX_UI_SPEC.md) — design system + screen-by-screen UX.

See also [CLAUDE.md](CLAUDE.md) for a per-session agent brief and
[docs/SECURITY.md](docs/SECURITY.md) for the security posture summary.

---

## What's next

Sebenza is launch-ready against the current Neon (EU) DB. Remaining work is
operational + commercial:

1. **Designate the Information Officer** + Deputy; register with the
   Information Regulator.
2. **Pitch the government partner / pilot**. The `/gov` workspace, the
   Sebenza LMI, the longitudinal outcomes dataset, and the POPIA / PAIA /
   DPIA documentation are the materials.
3. **On partnership confirmation**: flip the relevant platform flags
   (KYC, SAQA, Resend, cron), follow the AWS migration runbook, designate
   providers.
4. **Phase 10** — accessibility audit (WCAG 2.2 AA), performance budget on
   throttled 3G, full Tier-1 + Tier-2 + Tier-3 localisation rollout.
