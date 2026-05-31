# Sebenza

South Africa's national talent-intelligence platform — a fast, accessible,
POPIA-first search and analytics surface that matches people to work by skill
and location, and gives government an honest picture of the labour market.

> The trustworthy, real-time layer for South African work.

Built through **Phase 9.13** (2026-05-25). The product is launch-ready against
the current Neon (EU) database; everything beyond is operational + commercial,
not engineering. The AWS Cape Town migration is a documented one-day cutover
(see [docs/AWS_MIGRATION_RUNBOOK.md](docs/AWS_MIGRATION_RUNBOOK.md)) deferred
pending partnership confirmation.

The pre-launch gov analytics chapter is now complete end-to-end:
**demand → curriculum → learner → barrier → hire → outcome**. Every dimension
is suppression-floored at k=10, freshness-weighted, and consent-gated where
appropriate.

---

## Dormant-by-default posture

Every third-party service that costs money or needs a vendor agreement is
**off** out of the box. A fresh clone runs `typecheck`, `build`, and `dev`
with zero paid credentials. Each integration has one obvious activation path.

| Service | Gate | Effect when dormant | When to activate |
|---|---|---|---|
| **Sentry** | `SENTRY_DSN` unset | No-op `initSentry()`; nothing leaves the box | Add DSN + install `@sentry/nextjs` |
| **Resend** transactional email | `feature_flag_email_notifications` (default OFF) | Templates exist; dispatch is skipped; in-app notifications still fire | Admin flips the flag once Resend domain auth is verified |
| **KYC SaaS** partnership path | `feature_flag_kyc_provider` (default OFF) | **Superseded in 9.10** by admin-mediated org vetting at `/employer/onboarding` — admins now review 4 SA-standard KYC docs themselves. Provider path stays available for future partnership. | Drop a provider in `lib/kyc/providers/*`, flip flag |
| **SAQA NLRD worker** | `feature_flag_saqa_worker` (default OFF) | `approveQualification` flips directly; cron is a no-op | Admin flips the flag once the SAQA agreement is signed |
| **Per-employer mix lookup** (gov) | `feature_flag_employer_mix_lookup` (default OFF) | `/gov/employer-lookup` renders informative dormant notice; query refuses | Admin flips the flag once the partnership + oversight protocol is in place |
| **2FA enforcement** | `feature_flag_2fa_enforced` (default OFF for seekers) | Admins must enrol; seekers + employers are encouraged but not forced | Admin flips the flag when the roll-out is communicated |
| **Upstash rate limiter** | No call sites wired | In-memory `RateLimiter` exists; nothing is enforced | Import `enforce(bucket, key)` on the Server Action you want to gate |
| **Vercel Cron** | `CRON_SECRET` unset | `isAuthorizedCron` refuses every request | Set `CRON_SECRET`  paths already declared in `vercel.json` (18 jobs, staggered 02:0006:00 UTC) |
| **SMS / WhatsApp channel** | `feature_flag_sms_channel_enabled` + `feature_flag_whatsapp_channel_enabled` (default OFF) + `SMS_PROVIDER` / `WHATSAPP_PROVIDER` env unset | `lib/messaging/dispatch.ts` enforces a 6-gate check; without admin flag + env vars, all sends short-circuit to `console` and audit-log as `skipped`. Zero spend. | Admin: `/admin/settings` flip flag ON. Operator: set `SMS_PROVIDER=twilio` + `SMS_FROM_NUMBER` + Twilio credentials. Per-seeker: add to `seeker_sms_allowlist` via admin action. |

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
  Town `af-south-1` migration deferred). 22 migrations through 0021.
- **Better Auth 1.6.11** with `nextCookies()` + `twoFactor` plugins
  (TOTP + backup codes).
- **next-intl 4.12** — Tier-1 locales `en` / `zu` / `xh` / `af`; deep-merge
  fallback to English. Tier-2 / Tier-3 + professional translation land in
  Phase 10.
- **Supabase Storage** for private documents (CVs, certificates, KYC docs,
  profile photos). Service-role uploads, signed URLs only on audited reveal.
- **Recharts 3.8** on `/insights` only (client island, mount-gated).
- Postgres FTS + `pg_trgm` for search ranking; `sebenza_freshness_confidence()`
  SQL function feeds every freshness-weighted query (search rank, decline
  reasons, stall reasons, curriculum vs demand).

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
| 9.7 | Nationality analytics + Justification Index + Opportunity Map + oversight log | ✅ | [PHASE_9_7_COMPLETE](docs/completed/PHASE_9_7_COMPLETE.md) |
| 9.8 | Vacancies + invitations + decline-reasons + vacancy→placement linkage | ✅ | [PHASE_9_8_COMPLETE](docs/completed/PHASE_9_8_COMPLETE.md) |
| 9.9 | Years-of-experience on profile + per-skill | ✅ | [PHASE_9_9_COMPLETE](docs/completed/PHASE_9_9_COMPLETE.md) |
| 9.10 | Employer KYC / org vetting (admin-mediated) | ✅ | [PHASE_9_10_COMPLETE](docs/completed/PHASE_9_10_COMPLETE.md) |
| 9.11 | Mark-as-Filled + vacancy-outcome growth notifications | ✅ | [PHASE_9_11_COMPLETE](docs/completed/PHASE_9_11_COMPLETE.md) |
| 9.12 | The learning loop (accept → start → complete → self-attested skill) | ✅ | [PHASE_9_12_COMPLETE](docs/completed/PHASE_9_12_COMPLETE.md) |
| 9.13 | Learning-loop intelligence (curriculum-vs-demand + stall reasons) | ✅ | [PHASE_9_13_COMPLETE](docs/completed/PHASE_9_13_COMPLETE.md) |
| 10 | Accessibility, perf budget, Tier-1/2/3 translations | planned | Public-launch phase |

---

## Roles

| Role | Home | Highlights |
|---|---|---|
| **seeker** | `/dashboard` | Talent Pulse confirm, profile editor with years-of-experience (9.9), self-reported placement, KYC panel, §23 data export, §24 self-erase, TOTP 2FA, **vacancy invitations** with accept/decline-with-reason (9.8), **learning loop** on `/dashboard/grow` — accept → start → complete → skill lands on profile honestly as `self_attested_learning` (9.12), **honest closure** when a vacancy is filled with someone else + curriculum-vs-market view for students (9.11 + 9.13) |
| **employer** | `/employer` | Saved searches, candidate reveals (30-day window, audit-logged), **vacancies** (create / reverse-match / invite / withdraw / mark-as-filled in one action) (9.8 + 9.11), **admin-mediated KYC** at `/employer/onboarding` with 4 SA-standard docs (9.10), placement nudge banner, hire confirmation |
| **admin** | `/admin` | Moderation queue, settings, feature flags, audit log + CSV export, **18 compliance assertions** on `/api/admin/outcomes-compliance`, **organisation review** queue with signed-URL inline document access (9.10) |
| **gov** | `/gov` | Sebenza LMI hero, province deep-dives, **Skills-Shortage Justification Index** (9.7), **Local-Hiring Opportunity Map** (9.7), **Why roles go unfilled** (9.8.7) + **Why learners stall** (9.13) on `/gov/shortage`, **Curriculum vs demand** at `/gov/curriculum` (9.13), per-employer lookup dormant behind flag (9.7.6), printable policy brief, exports surface, 2FA panel |

The proxy + DAL + Server Action layers each enforce the role gate
(defence-in-depth). `verifyGov()` allows admins through for ops override.

PII-touching actions (contact reveal, document download, mark-as-hired,
outside-pipeline search) require `verifyOrgVerified()` — the employer's org
must be `verification = 'verified'`. Non-PII reads use the permissive
`verifyEmployer()`.

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
npm run db:migrate      # apply 0000 → 0021 to your Neon DB
npm run db:seed         # idempotent seed (taxonomy + fixture cohort + lifecycle fixtures)

# 4. Dev
npm run dev             # http://localhost:3000
npm run build           # production build (4 locales × every route)
npm run typecheck       # tsc --noEmit
npm run lint
npm test                # vitest run (suppression engine + outcomes-query fixtures)
```

### Seed credentials (dev only — never deploy)

Password for every seeded account: `sebenza-dev-2026`

| Role | Email |
|---|---|
| admin | `admin@sebenzasa.com` |
| employer | `naledi.khumalo@discovery.co.za` |
| seeker | `{handle}@example.co.za` (any seeded handle, e.g. `lerato-mokoena`) |
| gov | seeded via admin role-grant; flip a seeker to `gov` in `/admin` |

The seed also lands fixtures for: 3 lifecycle orgs (Acme `pending`,
Globex `rejected`, Initech `unverified`) for the 9.10 admin queue;
12 BSc CS Wits cohort members with retroactive placements for 7.5
outcomes + 9.13 stall analytics; 3 vacancies + 5 invitations across
every state for the 9.8 demo; 3 learning items on `wits-bsc-cs-2026-08`
for the 9.12 My Learning section; 10 abandoned learning items on
`postgres` so the 9.13 stall infrastructure has demonstrable counts.

---

## Routes (current surface)

### Public
- `/` — landing, Civic-Editorial hero + national pulse + LMI badge
- `/search` — talent search (FTS + freshness down-rank + years-of-experience surfacing)
- `/p/[handle]` — public profile (redacted; never IDs / documents / raw contact)
- `/insights` — analytics + skills-gap; **`/insights/print`** for the PDF export
- `/privacy` — POPIA Privacy Policy (12 sections)
- `/paia` — PAIA manual (Section 51 of Act 2 of 2000)

### Authed
- `/dashboard/*` — seeker workspace (profile, privacy, notifications, **invitations**, **grow** with the learning loop)
- `/employer/*` — employer workspace (search, dossier, saved searches, **vacancies/[id]/match**, **onboarding** KYC, organisation summary, placements, account)
- `/admin/*` — admin moderation + settings + audit log + **verifications** (qualifications + organisations) + oversight + taxonomy + users
- `/gov/*` — government workspace (overview, provinces, **shortage** Justification Index + decline reasons + stall reasons, **opportunity**, **curriculum** vs demand, employer-lookup, brief, exports, account)

### APIs
- `GET /api/lmi` — Sebenza Labour Market Index, formula published in response
- `GET /api/admin/audit-log/export` — CSV (hard-capped 10 000 rows)
- `GET /api/admin/outcomes-compliance` — runs **18 compliance assertions** live (outcomes + nationality + vacancy + learning + curriculum + stall)
- `GET /api/admin/oversight/export` — CSV of the per-employer-lookup oversight log (9.7.7)
- `GET /api/insights/outcomes/export` — outcomes dataset CSV (k-anonymity floor applies)
- `GET /api/dashboard/data-export` — POPIA §23 personal data export
- `GET /api/gov/justification-index/export` — Skills-Shortage Justification Index CSV (suppressed)
- `GET /api/gov/nationality-mix/export` — nationality-class mix CSV (suppressed)
- `GET /api/gov/decline-reasons/export` — "why roles go unfilled" CSV (suppressed)
- `GET /api/gov/stall-reasons/export` — "why learners stall" CSV (suppressed + `outcomes_research`-gated)
- `GET /api/gov/curriculum/export` — curriculum-vs-demand CSV (suppressed)
- `GET /api/cron/*` — 18 Vercel Cron entry points (CRON_SECRET-gated; fail-closed; schedules in `vercel.json`, staggered 02:00–06:00 UTC = 04:00–08:00 SAST):
  `hard-delete-erased`, `status-stale-warning`, `saved-search-matches`,
  `skill-gap-snapshot`, `outcome-snapshots`, `lmi-snapshot`, `saqa-worker`,
  `vacancy-invite-expiry`, `seeker-invite-expiry`, `seeker-weekly-digest` (Mondays only),
  `learning-nudge`, `vacancy-follow-up-nudges`, `placement-status-check-due`,
  `placement-retention-snapshot`, `employment-verification-expire`, `seeker-badge-sweep`,
  `searchability-pause-sweep`, `followed-employer-vacancy-sweep`

All authed routes localised at `/[locale]/...` for `en`, `zu`, `xh`, `af`.

---

## POPIA posture

Sebenza is built POPIA-first. Compliance is documented end-to-end:

- [docs/popia/INFORMATION_OFFICER.md](docs/popia/INFORMATION_OFFICER.md) — designation placeholder + working contact (`popia@sebenzasa.com`)
- [docs/popia/DPIA.md](docs/popia/DPIA.md) — risks + mitigations (R8 = rate-limit decision; R9 = 9.7 reframing of nationality analytics as policy intelligence, not regulatory enforcement)
- [docs/popia/BREACH_RESPONSE.md](docs/popia/BREACH_RESPONSE.md) — containment / assessment / notification stages, Section-22 template
- [docs/popia/RETENTION_POLICY.md](docs/popia/RETENTION_POLICY.md) — per-category retention windows + enforcement mechanism
- [docs/popia/ENCRYPTION_INVENTORY.md](docs/popia/ENCRYPTION_INVENTORY.md) — at-rest / in-transit / application-level + rotation runbook

Built-in mechanisms:

- **AES-256-GCM** field-level encryption on national ID numbers (key-id
  prefix for rotation); never displayed back, even to admins.
- **Audit log** as system of record for every PII-touching code path.
  4 new audit kinds in 9.11 (vacancy outcomes), 4 in 9.12 (learning loop),
  7 in 9.10 (org vetting lifecycle).
- **Consent state machine** with versioned consent text + timestamp.
  Purposes: `searchability`, `contact_reveal`, `document_sharing`,
  `analytics_aggregate`, `outcomes_research`, `vacancy_matching`.
- **k-anonymity** (k=10) + complementary suppression on every gov-facing
  aggregate (outcomes, nationality mix, decline reasons, stall reasons,
  curriculum-vs-demand). One reusable engine in `lib/analytics/suppress.ts`.
- **18 runnable compliance assertions** wired into `/api/admin/outcomes-compliance`
  covering: outcomes (4), nationality (2), vacancy + invite (6), learning loop (3),
  learning intelligence (3). Each assertion is a structural pin against regressions.
- **Provenance honesty contract** (9.12 D1): a `profile_skills` row only
  renders as "Verified" when `provenance='verified_provider'` AND
  `verified_at IS NOT NULL`. Self-attested rows — including completion-driven
  ones — always read with explicit provenance ("Self-attested · via learning").
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
- **Cron + CRON_SECRET wiring** — schedules in `vercel.json` (16 jobs, staggered 02:00–05:30 UTC). Background in [docs/completed/PHASE_8_COMPLETE.md](docs/completed/PHASE_8_COMPLETE.md).
- **Per-employer mix lookup activation** — [docs/completed/PHASE_9_7_COMPLETE.md](docs/completed/PHASE_9_7_COMPLETE.md) "Dormant-by-default" section + oversight log protocol.
- **Outcomes-dataset compliance** — `GET /api/admin/outcomes-compliance` runs the 18 assertions live; CI hookup is the Phase 10 polish.

---

## Architecture seams to know

- **`lib/data/provider.ts`** — the typed mock-↔-DB seam. Pages never branch
  on which provider is active. Production uses `dbProvider`; mock stays for
  isolated demos.
- **`lib/audit/logAccess()`** — every PII-touching code path wraps in this.
  `AuditKind` union is the canonical catalogue (currently ~60 kinds).
- **`lib/auth/dal.ts`** — `verifySession()`, `verifyRole(role)`, `verifyAdmin()`,
  `verifyGov()`, `verifyEmployer()` (permissive), `verifyOrgVerified()` (strict
  PII gate). Three-layer enforcement: proxy → DAL → Server Action.
- **`lib/crypto/`** — AES-256-GCM with key-id prefix; env-based today, KMS-ready.
- **`lib/notifications/server.ts`** — `createNotification` is per-kind
  catalog + idempotency-aware; fan-out helpers (`notifyOrgMembers`,
  `notifyAllAdmins`) are revalidate-driven, no polling.
- **`lib/analytics/suppress.ts`** — k-anonymity + complementary suppression
  engine, pure function. Single source of truth for every gov-facing
  aggregate's privacy floor.
- **`lib/analytics/lmi.ts`** — composite formula
  `0.4 × freshness + 0.4 × (1 − gap) + 0.2 × placement_velocity`; published
  publicly on `/privacy` and in the API response so the index is honest.
- **`lib/analytics/outcomes-compliance.ts`** — 18 runnable assertions covering
  every aggregate surface's structural privacy contract.
- **`db/schema.ts`** mirrors `lib/mock/types.ts`. Keep them aligned.

---

## The gov-pitch story (end-to-end)

Each link in the SA education-to-work pipeline now has a suppression-floored,
freshness-weighted, consent-gated-where-appropriate analytic surface:

1. **Demand** — `/gov/shortage` Justification Index (9.7.3) + Sebenza LMI
2. **Supply (nationality mix)** — `/gov/provinces` + employer self-view (9.7)
3. **Curriculum coverage** — `/gov/curriculum` (9.13.3)
4. **Learning barriers** — `/gov/shortage` "Why learners stall" (9.13.4)
5. **Vacancy outcomes** — `/gov/shortage` "Why roles go unfilled" (9.8.7)
6. **Hires + outcomes** — `/insights` longitudinal cohort dataset (7.5)
7. **Local-hiring opportunity** — `/gov/opportunity` Map (9.7)
8. **Per-employer lookup** — `/gov/employer-lookup` (9.7.6, dormant behind
   `feature_flag_employer_mix_lookup` + oversight log)
9. **Printable brief** — `/gov/brief` (PDF-ready)

Every aggregate above is exported as CSV through a `/api/gov/*/export` route
that preserves the suppression floor. Every read + every export lands an
`analytics.export` audit row.

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

Sebenza is launch-ready against the current Neon (EU) DB. The pre-launch gov
analytics chapter is closed (Phase 9.13). Remaining work is operational +
commercial:

1. **Designate the Information Officer** + Deputy; register with the
   Information Regulator.
2. **Pitch the government partner / pilot**. The full nine-surface story
   above, the Sebenza LMI, the longitudinal outcomes dataset, the 18-strong
   compliance assertion suite, and the POPIA / PAIA / DPIA documentation are
   the materials.
3. **On partnership confirmation**: flip the relevant platform flags
   (KYC, SAQA, Resend, employer-mix lookup, 2FA enforcement), follow the AWS
   migration runbook, designate providers.
4. **Phase 10** — accessibility audit (WCAG 2.2 AA), performance budget on
   throttled 3G, full Tier-1 + Tier-2 + Tier-3 localisation rollout, the
   compliance assertions wired into CI as a build gate.
