# Sebenza

South Africa's national talent-intelligence platform  a fast, accessible,
POPIA-first search and analytics surface that matches people to work by skill
and location, and gives government an honest picture of the labour market.

> The trustworthy, real-time layer for South African work.

Built through **Phase 34** (2026-07-29  Self Apply: a per-vacancy public
link seekers can apply through, riding the existing invitation pipeline;
ships dark behind `feature_flag_vacancy_self_apply`. Phase 33 shipped the
full SEO + social-sharing pass 2026-07-28: `metadataBase`, generated OG
cards, hreflang, first JSON-LD, consent-aware profile indexing, and the
WhatsApp-preview fix. Phase 32 closed a four-sweep security audit
2026-07-28: build-failing Server-Action guard, session revocation on
suspension/erasure, auth rate limits, the POPIA §18 welcome email. Phase
31 made ID collection dormant-by-default with derived citizenship
2026-07-19 → 21; Phases 28–29 shipped PWA installability + the seamless
search-invite funnel 2026-07-07 → 08; Phases 23–27 landed Truth & Data
Integrity, testimonials, the Integrations Hub, and security hardening
2026-07-02 → 06; Phases 17–22 shipped the Seeker Growth Suite and
AI-coach safety 2026-06-30 → 07-01). The product is LIVE at
sebenzasa.com against the current Neon (EU) database; the AWS Cape Town
migration is a documented one-day cutover (see
[docs/AWS_MIGRATION_RUNBOOK.md](docs/AWS_MIGRATION_RUNBOOK.md))
deferred pending partnership confirmation.

The pre-launch gov analytics chapter is now complete end-to-end:
**demand → curriculum → learner → barrier → hire → outcome**. Phase 13 added
the per-MODULE grain layer to curriculum-vs-demand (the level curriculum
committees can actually act on) alongside an admin-only editorial LLM
pipeline that bootstraps the catalogue with a human-in-the-loop on every
suggestion. Every dimension is suppression-floored at k=10,
freshness-weighted, and consent-gated where appropriate.

---

## Dormant-by-default posture

Every third-party service that costs money or needs a vendor agreement is
**off** out of the box. A fresh clone runs `typecheck`, `build`, and `dev`
with zero paid credentials. Each integration has one obvious activation path.

| Service | Gate | Effect when dormant | When to activate |
|---|---|---|---|
| **Sentry** | `SENTRY_DSN` unset | No-op `initSentry()`; nothing leaves the box | Add DSN + install `@sentry/nextjs` |
| **Transactional email** (generic SMTP via nodemailer) | `feature_flag_email_notifications` (default OFF) + `EMAIL_TRANSPORT=console` default | Templates exist; dispatch logs to console; in-app notifications still fire | Set `EMAIL_TRANSPORT=smtp` + `SMTP_*` credentials (any provider  Resend works via its SMTP interface), then admin flips the flag |
| **KYC SaaS** partnership path | `feature_flag_kyc_provider` (default OFF) | **Superseded in 9.10** by admin-mediated org vetting at `/employer/onboarding`  admins now review 4 SA-standard KYC docs themselves. Provider path stays available for future partnership. | Drop a provider in `lib/kyc/providers/*`, flip flag |
| **SAQA NLRD worker** | `feature_flag_saqa_worker` (default OFF) | `approveQualification` flips directly; cron is a no-op | Admin flips the flag once the SAQA agreement is signed |
| **Per-employer mix lookup** (gov) | `feature_flag_employer_mix_lookup` (default OFF) | `/gov/employer-lookup` renders informative dormant notice; query refuses | Admin flips the flag once the partnership + oversight protocol is in place |
| **2FA enforcement** | `feature_flag_2fa_enforced` (default OFF for seekers) | Admins must enrol; seekers + employers are encouraged but not forced | Admin flips the flag when the roll-out is communicated |
| **Rate limiter** | Wired since Phase 26 | In-memory `RateLimiter` enforced via `enforce(bucket, key)` on the hot paths (contact reveal, AI coach, uploads); no external service required | Nothing to activate  swap in a shared store only if multi-instance limits are needed |
| **Vercel Cron** | `CRON_SECRET` unset | `isAuthorizedCron` refuses every request | Set `CRON_SECRET`  paths already declared in `vercel.json` (20 jobs, staggered 02:0006:00 UTC) |
| **SMS / WhatsApp channel** | `feature_flag_sms_channel_enabled` + `feature_flag_whatsapp_channel_enabled` (default OFF) + `SMS_PROVIDER` / `WHATSAPP_PROVIDER` env unset | `lib/messaging/dispatch.ts` enforces a 6-gate check; without admin flag + env vars, all sends short-circuit to `console` and audit-log as `skipped`. Zero spend. | Admin: `/admin/settings` flip flag ON. Operator: set `SMS_PROVIDER=twilio` + `SMS_FROM_NUMBER` + Twilio credentials. Per-seeker: add to `seeker_sms_allowlist` via admin action. |
| **LLM editorial curriculum pipeline** (Phase 13.3) | `feature_flag_llm_curriculum_enabled` (default OFF) + every `llm_providers` row dormant + zero `monthly_budget_zar` | `lib/llm/curriculum.ts` enforces a 6-gate dispatch (active row · valid creds · budget > 0 · admin role · kill-switch ON · payload safety). Without all six, every call short-circuits with `llm.curriculum.skipped`. Zero spend, no outbound HTTP. Admin-side only  the student never talks to the LLM. | Admin: configure a provider on `/admin/llm` (cross-border providers require explicit POPIA s.72 acknowledgement), set a monthly budget, click Test, then Activate. Flip `feature_flag_llm_curriculum_enabled` ON in `/admin/settings`. Bulk-import on `/admin/curriculum`. Self-hosted is the POPIA-clean recommended path. |
| **ID / passport collection** (Phase 31) | `feature_flag_id_verification_enabled` (default OFF, ack-gated on `/admin/verifications`) | Profile editor shows a Date-of-birth-only section; every ID collection action hard-refuses server-side. Removal paths are NEVER gated (data-subject rights). | Admin flips the ack-gated switch once a real verification partnership confirms  the ON state carries a verify-and-discard commitment (DPIA R-26). |
| **Self Apply public vacancy links** (Phase 34) | `feature_flag_vacancy_self_apply` (default OFF) + per-vacancy `selfApplyEnabled` toggle | Employer toggle hidden; every `/apply/[token]` page renders a calm "not accepting applications" panel; apply actions refuse. Zero regression while dark. | Admin flips the flag on `/admin/settings`; employers then enable Self Apply per vacancy  the link panel (copy + WhatsApp share) appears on the vacancy detail page. |
| **AI Career Coach** (Phases 17 + 22) | `feature_flag_seeker_ai_coach` (default OFF, ack-gated on `/admin/llm`) | Coach surface hidden; distress screening + crisis resources + output moderation shipped in Phase 22 but the switch requires verified crisis lines first. | A human verifies the crisis-line numbers on `/admin/crisis-resources`, then the admin acknowledges + flips the flag. |
| **Vercel Analytics + Speed Insights** (Phase 33) | `process.env.VERCEL !== "1"` | Components not mounted  no 404ing `/_vercel/*` scripts on localhost, E2E, or future self-hosting. Cookieless by design (consistent with the cookie banner's promise). | Automatic on Vercel; enable the two toggles in the Vercel dashboard. |

### On rate limiting

Phase 26 wired the `lib/rate-limit/` module onto the abuse-relevant Server
Actions (contact reveal, AI-coach calls, uploads); **Phase 32 extended it to
the auth surface** after the audit found Better Auth's own limiter only runs
for `/api/auth/*` routes  never for our direct Server-Action calls, leaving
6-digit TOTP brute-forceable. Buckets now include `signin`, `2fa-verify`,
`email-send`, `invite`, `report`, and `self-apply` (Phase 34). Auth buckets
are keyed **per IP, never per email** (a per-email counter is a lockout
weapon an attacker can aim at a victim) and count **failures only**, so
shared-IP offices and CGNAT mobile networks never lock out honest users.
Background decisions in [docs/popia/DPIA.md](docs/popia/DPIA.md) (R8, R-27).

---

## Stack

- **Next.js 16.2.12** (App Router, no `src/`, React 19.2.4 Server Components +
  Server Actions, Turbopack).
- **TypeScript** strict + `noUncheckedIndexedAccess`.
- **Tailwind v4** (design tokens in `app/globals.css` via `@theme`); Fraunces
  display + Hanken Grotesk body via `next/font`.
- **Drizzle ORM 0.45** + **Neon serverless** Postgres (EU, Phase 9; AWS Cape
  Town `af-south-1` migration deferred). 65 migrations through 0064.
- **Better Auth 1.6.25** with `nextCookies()` + `twoFactor` plugins
  (TOTP + backup codes).
- **next-intl 4.12**  Tier-1 locales `en` / `zu` / `xh` / `af`; deep-merge
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
| 9.14 | Seeker verification roll-up (auto-derived from qualifications) | ✅ | [PHASE_9_14_COMPLETE](docs/completed/PHASE_9_14_COMPLETE.md) |
| 9.15 | "Other" free-text + admin taxonomy suggestion queue | ✅ | [PHASE_9_15_COMPLETE](docs/completed/PHASE_9_15_COMPLETE.md) |
| 9.16 | DOB + nationality at sign-up + admin-mediated ID verification | ✅ | `docs/completed/PHASE_9_16_PLAN.md` |
| 9.17 | Employer-initiated seeker invitations (agent workflow) | ✅ | `docs/completed/PHASE_9_17_PLAN.md` |
| 9.18 | Remote/Hybrid + SMTP collapse + draft persistence + domain rename | ✅ | ROADMAP §9.18 |
| 9.19 | Years-experience floor + NQF floor + follow-up nudges + season window | ✅ | (folded into 9.21/9.22) |
| 9.20 | Placement lifecycle ledger (status check-ins + departures) | ✅ | [PHASE_9_20_COMPLETE](docs/completed/PHASE_9_20_COMPLETE.md) |
| 9.21 | Seasonal-window vacancies | ✅ | [PHASE_9_21_COMPLETE](docs/completed/PHASE_9_21_COMPLETE.md) |
| 9.22 | Current-employment self-declaration | ✅ | [PHASE_9_22_COMPLETE](docs/completed/PHASE_9_22_COMPLETE.md) |
| 9.23 | Opt-in employment verification (one-shot email flow) | ✅ | [PHASE_9_23_COMPLETE](docs/completed/PHASE_9_23_COMPLETE.md) |
| 10 | Help centres + public-launch prep (a11y, perf, Tier-1/2/3 stubs) | ✅ | [PHASE_10_1_COMPLETE](docs/completed/PHASE_10_1_COMPLETE.md)  [10_4](docs/completed/PHASE_10_4_COMPLETE.md) |
| 11.1 | Engagement velocity (weekly digest, "why no invites?", welcome-back, badges) | ✅ | [PHASE_11_1_COMPLETE](docs/completed/PHASE_11_1_COMPLETE.md) |
| 11.2 | Learning-loop completion (LearningPath URLs, free-alt swap, cert bridge) | ✅ | [PHASE_11_2_COMPLETE](docs/completed/PHASE_11_2_COMPLETE.md) |
| 11.3 | Seeker control + trust posture (pause, block, report-invite, vacancy snapshot) | ✅ | [PHASE_11_3_COMPLETE](docs/completed/PHASE_11_3_COMPLETE.md) |
| 11.4 | SA distribution surface (share-card PNG, follow employer, data-saver, dormant SMS/WhatsApp) | ✅ | [PHASE_11_4_COMPLETE](docs/completed/PHASE_11_4_COMPLETE.md) |
| 11.5 | Profile depth + mobile / a11y polish (Open-to tags, CV backup, lazy load, 9 a11y fixes) | ✅ | [PHASE_11_5_COMPLETE](docs/completed/PHASE_11_5_COMPLETE.md) |
| 12 | Testing & QA (Docker test Postgres, vitest suite, Playwright E2E harness, perf ratchets) | ✅ | Shipped 2026-06-10 → 12 |
| 13 | Student lane expansion + editorial-LLM curriculum pipeline (shipped ahead of 12) | ✅ | [PHASE_13_COMPLETE](docs/completed/PHASE_13_COMPLETE.md) · [CATALOGUE_GUIDE](docs/PHASE_13_CATALOGUE_GUIDE.md) |
| 13.8 | Per-row "Invite to vacancy" CTA on `/search` (verified-org employers) | ✅ | [PHASE_13_8_COMPLETE](docs/completed/PHASE_13_8_COMPLETE.md) |
| 13.9 | "Any province" option for remote / hybrid vacancies | ✅ | [PHASE_13_9_COMPLETE](docs/completed/PHASE_13_9_COMPLETE.md) |
| 13.10 | Multi-archetype seeker support (secondary professions + cross-trainable Open-To tags) | ✅ | [PHASE_13_10_COMPLETE](docs/completed/PHASE_13_10_COMPLETE.md) |
| 14 | Zero-rating (data-free access) | dormant | Partnership-gated; wakes on operator agreement, no engineering pending |
| 15 | Work-readiness content + CV generator | ✅ | Shipped 2026-06-13 |
| 16 | "Near You" local-first discovery | ✅ | Shipped 2026-06-13 |
| 17 | Seeker Growth Suite (The Climb, Demand Pulse, AI Career Coach  all flag-gated, shipped dark) | ✅ | Shipped 2026-06-30 · [plan](docs/completed/PHASE_17_SEEKER_GROWTH_SUITE_PLAN.md) |
| 18 | Living Learning Catalog (`learning_paths` in DB + reviews + freshness admin) | ✅ | Shipped 2026-06-30 · [plan](docs/completed/SEEKER_GROWTH_PHASES_18-21_PLAN.md) |
| 19 | Custom skills + admin canonicalization | ✅ | Shipped 2026-06-30 |
| 20 | Skill prerequisites graph + compass sequencing | ✅ | Shipped 2026-06-30 |
| 21 | Hyper-local city demand (consent + k-anonymity gated) | ✅ | Shipped 2026-06-30 |
| 22 | AI-coach safety (distress detection → crisis resources, output moderation, ack-gated admin switch) | ✅ | Shipped 2026-07-01 · [plan](docs/PHASE_22_AI_COACH_SAFETY_PLAN.md) |
| 23 | Truth & Data Integrity (student lane → DB, real landing stats, DB-backed taxonomy pickers, provider default = `db`, showcase seed) | ✅ | Shipped 2026-07-02 · [SHOWCASE_ACCOUNTS](docs/SHOWCASE_ACCOUNTS.md) |
| 24 | Testimonials (admin-run collection, consented, curated, landing rail) | ✅ | Shipped 2026-07-02 |
| 25 | Integrations Hub (`/admin/integrations`: encrypted admin-managed SMS / WhatsApp / Email creds, DB + storage health, consent-gated bulk announcements) | ✅ | Shipped 2026-07-05 · [plan](docs/PHASE_23_27_TRUTH_TESTIMONIALS_INTEGRATIONS_PLAN.md) |
| 26 | Security hardening (rate limits wired, prod admin 2FA hard-require, CSP `unsafe-eval` dev-only, bound array params, `timingSafeEqual`, LIKE escaping) | ✅ | Shipped 2026-07-06 |
| 27 | Governance sync (docs + DPIA + roadmap alignment) | ✅ | Shipped 2026-07-06 |
| 28 | PWA installability + floating mobile bottom nav (all role dashboards) | ✅ | Shipped 2026-07-07 |
| 29 | Vacancy seats (`positions`) + the seamless `/search` invite funnel (`?returnTo=` detour, localStorage-surviving selection) | ✅ | Shipped 2026-07-08 · [plan](docs/PHASE_29_SEATS_AND_SEARCH_INVITE_FUNNEL.md) |
| 31 | Data minimisation (ID collection dormant + ack-gated; ONE nationality picker, `is_citizen` derived server-side; Yetotec (Pty) Ltd named responsible party) | ✅ | Shipped 2026-07-19 → 21 · [plan](docs/PHASE_9_19_PLAN.md) · DPIA R-26 |
| 32 | Security remediation + welcome email (build-failing Server-Action guard, session revocation, auth rate limits, open-redirect closure, POPIA §18 welcome email) | ✅ | Shipped 2026-07-28 · [plan](docs/PHASE_32_SECURITY_HARDENING_PLAN.md) · DPIA R-27 |
| 33 | Full SEO + social sharing (metadataBase, generated OG cards, hreflang, JSON-LD, consent-aware profile indexing, sitemap/robots fixes, Vercel Analytics) | ✅ | Shipped 2026-07-28 · [plan](docs/PHASE_33_SEO_PLAN.md) · founder GSC/Bing steps open |
| 34 | Self Apply (public vacancy link + seeker-initiated applications; BrandDialog house modal; ships dark) | ✅ | Shipped 2026-07-29 · [plan](docs/PHASE_34_SELF_APPLY_PLAN.md) · [screenshots](docs/screenshots/phase34-self-apply/) |
| 34+ | Post-34 polish wave: profile languages (spoken + written levels, in completeness), suggestion approval loop (backfill + notify), /marketing explainer funnel, branded 404 + catch-all + global-error, admin smoke gate + hydration fix, 17 private colleges, skill-suggest discoverability | ✅ | Shipped 2026-07-30 → 08-15 · plan docs in `docs/` |

---

## Roles

| Role | Home | Highlights |
|---|---|---|
| **seeker** | `/dashboard` | Talent Pulse confirm, profile editor with years-of-experience (9.9), self-reported placement, KYC panel, §23 data export, §24 self-erase, TOTP 2FA, **vacancy invitations** with accept/decline-with-reason (9.8), **learning loop** on `/dashboard/grow`  accept → start → complete → skill lands on profile honestly as `self_attested_learning` (9.12), **honest closure** when a vacancy is filled with someone else + curriculum-vs-market view for students (9.11 + 9.13), **module/elective/project capture** + skills inferred from current studies (13.1 + 13.2), **private progression timeline** with auto-derived events + self-declared milestones (13.4), **languages** with spoken + written levels (count toward completeness; shown to recruiters on the dossier) |
| **employer** | `/employer` | Saved searches, candidate reveals (30-day window, audit-logged), **vacancies** (create / reverse-match / invite / withdraw / mark-as-filled in one action) (9.8 + 9.11), **admin-mediated KYC** at `/employer/onboarding` with 4 SA-standard docs (9.10), placement nudge banner, hire confirmation |
| **admin** | `/admin` | Moderation queue, settings, feature flags, audit log + CSV export, **29+ compliance assertions** on `/api/admin/outcomes-compliance`, **organisation review** queue with signed-URL inline document access (9.10), **`/admin/llm`** provider configuration with at-most-one-active partial unique index + cross-border s.72 acknowledgement (13.3), **`/admin/curriculum`** editorial curation queue + bulk-import + provenance ledger (13.3) |
| **gov** | `/gov` | Sebenza LMI hero, province deep-dives, **Skills-Shortage Justification Index** (9.7), **Local-Hiring Opportunity Map** (9.7), **Why roles go unfilled** (9.8.7) + **Why learners stall** (9.13) on `/gov/shortage`, **Curriculum vs demand** at `/gov/curriculum` (9.13) with module-grain gap panel (13.6), per-employer lookup dormant behind flag (9.7.6), printable policy brief, exports surface, 2FA panel |

The proxy + DAL + Server Action layers each enforce the role gate
(defence-in-depth). `verifyGov()` allows admins through for ops override.

PII-touching actions (contact reveal, document download, mark-as-hired,
outside-pipeline search) require `verifyOrgVerified()`  the employer's org
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
# Every other key in .env.example can stay empty  the system runs dormant.

# 3. Database
npm run db:generate     # generate Drizzle migration (only if you changed schema)
npm run db:migrate      # apply all migrations (0000 → 0064) to your Neon DB
npm run db:seed         # TRUNCATING seed  dev/test databases ONLY, never a live DB
                        # (taxonomy + fixture cohort + lifecycle fixtures + showcase accounts)
# If migrate exits silently but the seed fails on a missing column, the
# DB and the migration journal have drifted  run `npm run db:push` to
# sync the schema directly, then re-seed.
# IMPORTANT: db:push fixes the *schema* but leaves the drizzle tracking
# table (drizzle.__drizzle_migrations) stuck at the old head, so later
# `db:migrate` runs silently skip everything. After a push recovery, run
#   npx tsx scripts/reconcile-migrations.mts   # re-align tracking table
# (bookkeeping-only, transactional, guarded). Then db:migrate is a clean
# no-op again. Diagnose first: npx tsx scripts/diagnose-migrations.mts
# Recovery template: docs/completed/MIGRATION_JOURNAL_RECOVERY_PLAN.md

# 4. Dev
npm run dev             # http://localhost:3000
npm run build           # production build (4 locales × every route)
npm run typecheck       # tsc --noEmit
npm run lint
npm test                # vitest unit project (263 tests / 22 files)
npm run test:all        # typecheck + lint + full vitest (unit/integration/compliance, ~434 tests)
npm run test:e2e        # Playwright (126 tests / 26 files, desktop + mobile-360 projects;
                        # needs the Docker test Postgres + .env.test.local)
```

### Seed credentials (dev only  never deploy)

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

The Phase 23 **showcase seed** adds a set of demo-ready accounts with
realistic, coherent journeys across every role  see
[docs/SHOWCASE_ACCOUNTS.md](docs/SHOWCASE_ACCOUNTS.md) for the account
list and what each one demonstrates. Phase 34 adds a Self Apply showcase
vacancy ("IT Support Technician" @ Discovery Bank) with the fixed demo
link `/apply/sa-demo-it-support-2026-fixed01`  inert until
`feature_flag_vacancy_self_apply` is flipped ON.

---

## Routes (current surface)

### Public
- `/`  landing, Civic-Editorial hero + national pulse + LMI badge + FAQ (Phase 33, with FAQPage JSON-LD)
- `/search`  talent search (FTS + freshness down-rank + years-of-experience surfacing) + the Phase 29 invite-funnel multi-select
- `/p/[handle]`  public profile (redacted; never IDs / documents / raw contact; robots follow the seeker's own `searchability` consent  Phase 33) + `/p/[handle]/card` OG share image
- `/apply/[token]`  Phase 34 Self Apply vacancy dossier (flag-gated, noindex, unguessable per-vacancy token) + `/apply/[token]/card` OG share image
- `/insights`  analytics + skills-gap; **`/insights/print`** for the PDF export
- `/privacy`  POPIA Privacy Policy (12 sections)
- `/paia`  PAIA manual (Section 51 of Act 2 of 2000)
- `/terms`  Terms of Service (contract acceptance at sign-up links here)
- `/accessibility`  accessibility statement (WCAG 2.2 AA posture, honest limitations)
- `/og-image`  generated sitewide default OG card (Phase 33)

### Authed
- `/dashboard/*`  seeker workspace (profile, privacy, notifications, **invitations**, **grow** with the learning loop)
- `/employer/*`  employer workspace (search, dossier, saved searches, **vacancies/[id]/match**, **onboarding** KYC, organisation summary, placements, account)
- `/admin/*`  admin moderation + settings + audit log + **verifications** (qualifications + organisations) + oversight + taxonomy + users
- `/gov/*`  government workspace (overview, provinces, **shortage** Justification Index + decline reasons + stall reasons, **opportunity**, **curriculum** vs demand, employer-lookup, brief, exports, account)

### APIs
- `GET /api/lmi`  Sebenza Labour Market Index, formula published in response
- `GET /api/admin/audit-log/export`  CSV (hard-capped 10 000 rows)
- `GET /api/admin/outcomes-compliance`  runs **29+ compliance assertions** live (outcomes + nationality + vacancy + learning + curriculum + stall + the Phase 34 public-vacancy carve-out allowlist)
- `GET /api/admin/oversight/export`  CSV of the per-employer-lookup oversight log (9.7.7)
- `GET /api/insights/outcomes/export`  outcomes dataset CSV (k-anonymity floor applies)
- `GET /api/dashboard/data-export`  POPIA §23 personal data export
- `GET /api/gov/justification-index/export`  Skills-Shortage Justification Index CSV (suppressed)
- `GET /api/gov/nationality-mix/export`  nationality-class mix CSV (suppressed)
- `GET /api/gov/decline-reasons/export`  "why roles go unfilled" CSV (suppressed)
- `GET /api/gov/stall-reasons/export`  "why learners stall" CSV (suppressed + `outcomes_research`-gated)
- `GET /api/gov/curriculum/export`  curriculum-vs-demand CSV (suppressed)
- `GET /api/cron/*`  20 Vercel Cron entry points (CRON_SECRET-gated; fail-closed; schedules in `vercel.json`, staggered 02:00–06:00 UTC = 04:00–08:00 SAST):
  `hard-delete-erased`, `status-stale-warning`, `saved-search-matches`,
  `skill-gap-snapshot`, `outcome-snapshots`, `lmi-snapshot`, `saqa-worker`,
  `vacancy-invite-expiry`, `seeker-invite-expiry`, `seeker-weekly-digest` (Mondays only),
  `learning-nudge`, `vacancy-follow-up-nudges`, `placement-status-check-due`,
  `placement-retention-snapshot`, `employment-verification-expire`, `seeker-badge-sweep`,
  `searchability-pause-sweep`, `followed-employer-vacancy-sweep`,
  `seeker-demand-pulse`, `learning-path-freshness`

All authed routes localised at `/[locale]/...` for `en`, `zu`, `xh`, `af`.

---

## POPIA posture

Sebenza is built POPIA-first. Compliance is documented end-to-end:

- [docs/popia/INFORMATION_OFFICER.md](docs/popia/INFORMATION_OFFICER.md)  designation placeholder + working contact (`popia@sebenzasa.com`)
- [docs/popia/DPIA.md](docs/popia/DPIA.md)  risks + mitigations (R8 = rate-limit decision; R9 = 9.7 reframing of nationality analytics as policy intelligence, not regulatory enforcement)
- [docs/popia/BREACH_RESPONSE.md](docs/popia/BREACH_RESPONSE.md)  containment / assessment / notification stages, Section-22 template
- [docs/popia/RETENTION_POLICY.md](docs/popia/RETENTION_POLICY.md)  per-category retention windows + enforcement mechanism
- [docs/popia/ENCRYPTION_INVENTORY.md](docs/popia/ENCRYPTION_INVENTORY.md)  at-rest / in-transit / application-level + rotation runbook

Built-in mechanisms:

- **AES-256-GCM** field-level encryption on national ID numbers (key-id
  prefix for rotation); never displayed back, even to admins.
- **Audit log** as system of record for every PII-touching code path.
  4 new audit kinds in 9.11 (vacancy outcomes), 4 in 9.12 (learning loop),
  7 in 9.10 (org vetting lifecycle).
- **Consent state machine** with versioned consent text + timestamp.
  Nine purposes: `searchability`, `contact_reveal`, `document_sharing`,
  `analytics_aggregate`, `outcomes_research`, `vacancy_matching`,
  `messaging_channel_sms`, `messaging_channel_whatsapp`, `announcements`.
  Sign-up renders a grouped ALLOWLIST (searchability + employer purposes +
  statistics); T&C acceptance is a separate CONTRACT line, never bundled
  into consent. Phase 34's Self Apply is seeker-initiated  the audited
  apply confirmation is the consent act for that disclosure.
- **k-anonymity** (k=10) + complementary suppression on every gov-facing
  aggregate (outcomes, nationality mix, decline reasons, stall reasons,
  curriculum-vs-demand). One reusable engine in `lib/analytics/suppress.ts`.
- **29+ runnable compliance assertions** wired into `/api/admin/outcomes-compliance`
  covering: outcomes (4), nationality (2), vacancy + invite (6), learning loop (3),
  learning intelligence (3). Each assertion is a structural pin against regressions.
- **Provenance honesty contract** (9.12 D1): a `profile_skills` row only
  renders as "Verified" when `provenance='verified_provider'` AND
  `verified_at IS NOT NULL`. Self-attested rows  including completion-driven
  ones  always read with explicit provenance ("Self-attested · via learning").
- **§23** data export and **§24** self-erase wired into the seeker dashboard.
- **Cookie banner**  essential always-on, analytics opt-in (default OFF);
  one first-party cookie, server-resolved so it doesn't flash.
- **Security headers**  CSP, HSTS, Permissions-Policy, X-Frame-Options DENY,
  COOP same-origin, Referrer-Policy strict-origin-when-cross-origin, applied
  via `proxy.ts` on every response.
- **Redaction at the type level**  `PublicProfile` cannot carry IDs /
  documents / raw contact; the type is the gate.

---

## Operator runbooks

When it's time to activate a deferred service, the runbook is already written:

- **AWS Cape Town `af-south-1` migration**  [docs/AWS_MIGRATION_RUNBOOK.md](docs/AWS_MIGRATION_RUNBOOK.md) (~4 hours, zero remaining POPIA work).
- **KYC / SAQA / email activation**  [docs/completed/PHASE_8_COMPLETE.md](docs/completed/PHASE_8_COMPLETE.md) "Activation" section.
- **Cron + CRON_SECRET wiring**  schedules in `vercel.json` (20 jobs, staggered 02:00–06:00 UTC). Background in [docs/completed/PHASE_8_COMPLETE.md](docs/completed/PHASE_8_COMPLETE.md).
- **Per-employer mix lookup activation**  [docs/completed/PHASE_9_7_COMPLETE.md](docs/completed/PHASE_9_7_COMPLETE.md) "Dormant-by-default" section + oversight log protocol.
- **Outcomes-dataset compliance**  `GET /api/admin/outcomes-compliance` runs the 29+ assertions live; CI hookup is the Phase 10 polish.

---

## Architecture seams to know

- **`lib/data/provider.ts`**  the typed mock-↔-DB seam. Pages never branch
  on which provider is active. `SEBENZA_DATA_PROVIDER` defaults to `db`
  (since 23.5); `mock` is dev/test-only and **throws in production**.
- **`lib/audit/logAccess()`**  every PII-touching code path wraps in this.
  `AuditKind` union is the canonical catalogue (currently ~70 kinds).
- **`lib/auth/dal.ts`**  `verifySession()`, `verifyRole(role)`, `verifyAdmin()`,
  `verifyGov()`, `verifyEmployer()` (permissive), `verifyOrgVerified()` (strict
  PII gate). Three-layer enforcement: proxy → DAL → Server Action.
- **`lib/crypto/`**  AES-256-GCM with key-id prefix; env-based today, KMS-ready.
- **`lib/notifications/server.ts`**  `createNotification` is per-kind
  catalog + idempotency-aware; fan-out helpers (`notifyOrgMembers`,
  `notifyAllAdmins`) are revalidate-driven, no polling.
- **`lib/analytics/suppress.ts`**  k-anonymity + complementary suppression
  engine, pure function. Single source of truth for every gov-facing
  aggregate's privacy floor.
- **`lib/analytics/lmi.ts`**  composite formula
  `0.4 × freshness + 0.4 × (1 − gap) + 0.2 × placement_velocity`; published
  publicly on `/privacy` and in the API response so the index is honest.
- **`lib/analytics/outcomes-compliance.ts`**  18 runnable assertions covering
  every aggregate surface's structural privacy contract.
- **`db/schema.ts`** mirrors `lib/mock/types.ts`. Keep them aligned.

---

## The gov-pitch story (end-to-end)

Each link in the SA education-to-work pipeline now has a suppression-floored,
freshness-weighted, consent-gated-where-appropriate analytic surface:

1. **Demand**  `/gov/shortage` Justification Index (9.7.3) + Sebenza LMI
2. **Supply (nationality mix)**  `/gov/provinces` + employer self-view (9.7)
3. **Curriculum coverage**  `/gov/curriculum` (9.13.3)
4. **Learning barriers**  `/gov/shortage` "Why learners stall" (9.13.4)
5. **Vacancy outcomes**  `/gov/shortage` "Why roles go unfilled" (9.8.7)
6. **Hires + outcomes**  `/insights` longitudinal cohort dataset (7.5)
7. **Local-hiring opportunity**  `/gov/opportunity` Map (9.7)
8. **Per-employer lookup**  `/gov/employer-lookup` (9.7.6, dormant behind
   `feature_flag_employer_mix_lookup` + oversight log)
9. **Printable brief**  `/gov/brief` (PDF-ready)

Every aggregate above is exported as CSV through a `/api/gov/*/export` route
that preserves the suppression floor. Every read + every export lands an
`analytics.export` audit row.

---

## Companion docs

The three documents in `docs/` are load-bearing and read together every session:

1. [docs/TO_START_EVERY_SESSION.md](docs/TO_START_EVERY_SESSION.md)  non-negotiable rules + Current State block.
2. [docs/ROADMAP.md](docs/ROADMAP.md)  phased build plan (Phase 0 → 34).
3. [docs/UX_UI_SPEC.md](docs/UX_UI_SPEC.md)  design system + screen-by-screen UX.

See also [CLAUDE.md](CLAUDE.md) for a per-session agent brief and
[docs/SECURITY.md](docs/SECURITY.md) for the security posture summary.

Recent-phase plan docs:
[docs/PHASE_29_SEATS_AND_SEARCH_INVITE_FUNNEL.md](docs/PHASE_29_SEATS_AND_SEARCH_INVITE_FUNNEL.md),
[docs/PHASE_9_19_PLAN.md](docs/PHASE_9_19_PLAN.md) (ships as Phase 31),
[docs/PHASE_32_SECURITY_HARDENING_PLAN.md](docs/PHASE_32_SECURITY_HARDENING_PLAN.md),
[docs/PHASE_33_SEO_PLAN.md](docs/PHASE_33_SEO_PLAN.md),
[docs/PHASE_34_SELF_APPLY_PLAN.md](docs/PHASE_34_SELF_APPLY_PLAN.md),
and the full-system audit at
[docs/FULL_SYSTEM_AUDIT_2026_07.md](docs/FULL_SYSTEM_AUDIT_2026_07.md).

---

## What's next

Sebenza is engineering-complete through Phase 34. What remains is operator
work + launch toggles, not code:

1. **Phase 33 SEO manual steps**  set `GOOGLE_SITE_VERIFICATION` /
   `BING_SITE_VERIFICATION` in Vercel + verify in Search Console, submit
   `sitemap.xml`, enable Vercel Analytics + Speed Insights in the dashboard,
   WhatsApp paste-test a landing + profile link.
2. **Self Apply launch (Phase 34)**  flip `feature_flag_vacancy_self_apply`
   on `/admin/settings`, enable the toggle on open vacancies, share links.
   E2E is green on both viewports; nothing else blocks it.
3. **Secret rotation**  rotate `SEBENZA_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`,
   `CRON_SECRET`, and provider credentials before commercial launch.
4. **Launch ops (Phase 10 Arc B)**  Information Regulator registration +
   DPIA sign-off (the Information Officer is designated: the CEO), attorney
   review of `/terms`, and the go-live checklist.
5. **Crisis-resource verification**  a human must verify the crisis-line
   numbers before `feature_flag_seeker_ai_coach` goes ON in prod (the switch
   is ack-gated on `/admin/llm`; safety layer shipped in Phase 22).
6. **Transactional-email locale**  known gap from Phase 32: no user locale
   is persisted, so all email renders English; follow-up phase.
7. **Phase 14 zero-rating**  dormant pending a mobile-operator partnership.
8. **On government partnership confirmation**: flip the relevant platform
   flags (KYC, SAQA, employer-mix lookup, 2FA enforcement), follow the AWS
   Cape Town migration runbook, designate providers.
