# PHASE 12 PLAN — TESTING & QA (REVISED 2026-06-10)

**Status:** ACTIVE — next milestone before public ship.
**Supersedes:** the original four-line Phase 12 section in `ROADMAP.md` (written before Phases 9.7–9.23, 10, 11.1–11.5 and 13.1–13.10 shipped).
**Companion docs:** `TO_START_EVERY_SESSION.md` (rules) · `docs/SECURITY.md` (three-layer model) · `docs/A11Y_AUDIT.md` (finding #8 carry-over) · `docs/PERF_BUDGET.md` (empty route table this phase must populate).

---

## Why this revision exists

The original Phase 12 scope was written when the system was ~Phase 6. Since then the platform grew to:

| Surface (code-verified 2026-06-10) | Count |
|---|---|
| Migrations (journal repaired, idx 0–48) | 49 |
| Server-action files (`"use server"`) across auth / profile / seeker / employer / admin / consent / gov | ~59 |
| Cron routes under `app/api/cron/` | 18 |
| Non-cron API routes (exports, LMI, data-export, compliance) | 14 |
| Runtime compliance assertions (`lib/analytics/outcomes-compliance.ts`) | 29 |
| Existing first-party test files (all pure-logic) | 4 |

The 29 compliance assertions are excellent but only run when an admin hits `/api/admin/outcomes-compliance` — they are not part of any automated pipeline. Nothing exercises a behavioural path (reveal gate, invite consent gate, placement window, erasure) end-to-end. Phase 12 closes that gap for the **whole** system as it exists today.

**Non-goals:** UI-component snapshot tests (E2E covers rendering); coverage-percentage targets (we pin named invariants, not vanity metrics); load/soak testing (Phase 10.10, operator-hands); professional pen-test (separate engagement, pre-commercial-launch gate); **external-service integration testing** — SAQA, KYC SaaS, SMS/WhatsApp providers, Sentry, Upstash and external LLM providers are all deliberately dormant behind flags and none is wired to a live credential, so there is nothing external to test. The only thing Phase 12 tests about them is that **their gates stay closed** (see 12.2 "Dormant-by-default gates").

> **Terminology note:** "integration tests" in this plan means *our own layers wired together* — a Server Action exercised against the real Postgres schema with seeded data, asserting the guard + mutation + audit row beneath it. It does **not** mean integrating with third-party systems. Unit = one pure function in isolation; integration = our action + our DB + our rules; E2E = a browser walking the real app.

---

## Decisions (locked before work starts)

- **D1 — Test database is a dedicated, disposable Postgres.** Integration + E2E suites run against a dedicated Neon branch (or local Postgres) identified by `SEBENZA_TEST_DB=1` + its own `DATABASE_URL`. The harness **refuses to run** destructive setup (migrate-from-zero + truncating seed) unless `SEBENZA_TEST_DB=1` is set — structural protection against pointing the suite at the dev/prod DB. `db/seed.ts` already truncates; that behaviour is exactly right for tests and exactly wrong everywhere else, hence the guard.
- **D2 — Playwright, chromium-only, two viewports.** Desktop 1280px + mobile 360px (the No-Flash Rule's reference width). Other browsers deferred; the user base is overwhelmingly Android Chrome.
- **D3 — axe-core automation stays in the post-launch backlog** (per `POST_LAUNCH_BACKLOG.md`), **but** the Playwright harness is built so `@axe-core/playwright` can bolt on later without restructuring (one fixture file, per-route-group specs).
- **D4 — Crons are tested by invoking the route handlers directly** (`GET`/`POST` with `CRON_SECRET` header) against the test DB — no scheduler simulation. Idempotency is asserted by invoking twice.
- **D5 — Email in tests uses the console/no-op transport.** Outcomes are asserted via `notifications` rows + audit rows, never by intercepting SMTP. (`EMAIL_TRANSPORT` unset + `EMAIL_TRANSPORT_STRICT=false` in the test env so the 9.18 loud-fail doesn't fire.)
- **D6 — Server Actions are integration-tested as functions**, with a session stub at the DAL boundary, not through HTTP. The three-layer model (`docs/SECURITY.md`) makes the DAL the real gate; tests stub `verifySession()`/`verifyRole()` inputs and assert the guard + mutation + audit behaviour beneath it.
- **D7 — The 29-assertion compliance suite becomes a first-class vitest suite** (`npm run test:compliance`) run against the seeded test DB. The admin API route stays as the production-side runtime check; CI gets the same truth.
- **D8 — One invariant, one test.** Every test in 12.2/12.4 is named for the rule it pins (e.g. `reveal requires verified org + contact consent + writes audit row`). When a rule regresses, the failing test name says which product rule broke, not which file.

---

## Task 12.0: Test infrastructure (build first)

- [ ] `vitest.config.ts` at project root: node environment, `@/` path alias, three projects — `unit` (no DB, default `npm test`), `integration` (requires `SEBENZA_TEST_DB=1`), `compliance` (same gate).
- [ ] Test-DB harness `tests/helpers/db.ts`: asserts `SEBENZA_TEST_DB=1`, runs `drizzle-kit migrate` from zero, runs the seed once per suite-run; per-file cleanup via targeted truncate of mutated tables (cheaper than re-seed).
- [ ] Session stub helper `tests/helpers/session.ts`: mint seeker / employer(verified) / employer(unverified) / admin / gov contexts from seeded fixture accounts (seed already ships Discovery Bank verified + Acme pending + Globex rejected + Initech unverified — use them, don't invent new fixtures).
- [ ] Install `@playwright/test` (chromium) + `playwright.config.ts`: `webServer` = `npm run build && npm run start` against the test DB; projects for 1280px + 360px.
- [ ] npm scripts: `test` (unit only — stays fast, no DB), `test:integration`, `test:compliance`, `test:e2e`, `test:all`.
- [ ] Document the harness + the D1 guard in this doc's companion `PHASE_12_COMPLETE.md` when shipped, and add a short "Running the tests" section to `README.md`.

## Task 12.1: Unit tests (pure logic, no DB)

Existing (keep, extend where noted): `suppress.test.ts` · `justification.test.ts` · `id-validation.test.ts` · `invite-tokens.test.ts`.

New suites:
- [ ] **`lib/status.ts`** — band boundaries at exactly 29/30/31 and 89/90/91 days; confidence weights 1.0/0.6/0.25; `freshnessSummary` nudge/urgent flags. This is the moat logic; it gets exhaustive boundary coverage.
- [ ] **`lib/crypto`** — encrypt→decrypt round-trip; `v1.` key-id prefix present; tampered ciphertext throws; wrong key throws; empty/unicode/max-length plaintexts.
- [ ] **Consent state machine** (`lib/consent`) — grant → revoke → regrant transitions per purpose; pause (`paused_until`) interaction from 11.3.1; `outcomes_research` + `vacancy_matching` default-off.
- [ ] **CSV safety** — OWASP formula-injection guard (`=+-@\t\r` prefixes); CRLF line endings; UTF-8 BOM (pins the Phase 6.5 fixes).
- [ ] **`lib/seeker/vacancy-outcome.ts`** — composed other-hired notification **never** references the hired person (the D4 privacy invariant from 9.11); cites vacancy requirements + recipient gaps only.
- [ ] **`lib/seeker/free-alternatives.ts`** — ordering: free > subsidised, national > metro, shortest duration; null when no alternative.
- [ ] **Rate limiter** (`lib/rate-limit/memory.ts`) — window roll-over, per-key isolation, budget exhaustion.
- [ ] **Notification catalog** (`lib/notifications/catalog.ts`) — every kind has audience + default channels; dedupe windows are the documented values (e.g. 24h `profile.viewed`).
- [ ] **`formatVacancyLocation`** (13.9) — province+city, province-only, NULL→"Any province (remote / hybrid)".
- [ ] **`lib/taxonomy/countries.ts`** — ZA derivation (`is_citizen`), ISO validity, SADC pinning order.

## Task 12.2: Rules-against-the-database tests (seeded test DB — *our* code layers, no external systems)

These exercise our Server Actions + queries against the real Postgres schema with seeded data. Nothing here calls outside the codebase. Grouped by the seven non-negotiable rules plus the lifecycle machines:

**Redaction Rule**
- [ ] `searchProfilesQuery` result shape: `national_id_enc`, `full_surname`, `email`, `document_storage_key`, `deleted_at`, `dob` never present (key-set assertion on raw rows, not just types).
- [ ] Public profile projection (`/p/[handle]` provider read): same forbidden-key assertion; locked panels' data absent for anonymous reads.
- [ ] POPIA data export (`/api/dashboard/data-export`): national ID appears **only** as `v1.` ciphertext.

**Status-Freshness + ranking**
- [ ] Fresh profile outranks identical stale profile; `sebenza_freshness_confidence` SQL agrees with `lib/status.ts` on the same timestamps (one-source-of-truth pin).
- [ ] Completeness multiplier and citizen-highlight ordering; 13.10: primary-profession match ranks above secondary match within the same tier; secondary matches are still returned.
- [ ] Filters: work-availability `&&` overlap (incl. `remote`/`hybrid`/`seasonal`), `open_to` overlap, internship/grad opt-ins, `minYears`, any-province vacancies (13.9) match all provinces.
- [ ] Exclusions: soft-deleted, suspended, searchability-paused (11.3.1) and seeker-blocked-org (11.3.2, with `callerOrgId`) profiles never surface.

**Three-lock reveal + Placement-Truth**
- [ ] `revealContact`: unverified org → refused; verified org without seeker contact-consent → refused; all three locks open → returns contact **and** writes `profile.contact.reveal` audit row **and** fires notification.
- [ ] Document download: requires `document_sharing` consent; separate audit kind; signed URL TTL ≤ 60s.
- [ ] `markAsHired`: refused without a reveal audit row from this org within 30 days; succeeds with one; `seeker_reported` placements excluded from `confirmedHiresThisMonth` + outcomes aggregates.
- [ ] Mark-as-filled (9.11): transaction atomicity — placements + state flip + outcome fan-out all-or-nothing; second attempt on `filled` refused; outcome notifications exclude hires/declined/expired/withdrawn.

**Consent gates (invites)**
- [ ] `bulkInviteToVacancy`: non-consented seeker silently skipped (reason in audit only, never in response payload); dedupe via UNIQUE; withdrawn → seeker notified.
- [ ] Seeker invites (9.17): unverified org refused; 50/day per-org cap counts dedupe hits; 90-day decline cooldown enforced; token single-use at DB layer.

**Verification-Honesty**
- [ ] `recomputeProfileVerification` rollup: verified ⇔ ≥1 verified qual; pending ⇔ none verified + ≥1 pending; `rejected` never auto-applied; all four mutation sites trigger it.
- [ ] Self-attested skills (`provenance`) never render/count as verified; employment-verification badge expires at 12 months; supersede-on-employer-change downgrade (9.23).

**Erasure + retention**
- [ ] `eraseUser` → soft-delete → vanishes from search immediately; `hard-delete-erased` cron deletes only rows past 30 days and audit-logs `account.hard_delete` **before** the DELETE.

**Taxonomy + suggestion queue (9.15/9.22)**
- [ ] Promote canonicalises + backfills profiles/academic rows; merge re-points FKs; reject **never** mutates user data.

**Cron idempotency (all 18 routes)**
- [ ] Each route: 401 without `CRON_SECRET`; runs clean against seed; **second immediate invocation is a no-op** (status-stale via `status_stale_last_sent_at`, invite expiries via conditional state flips, learning-nudge via the 7-day cross-kind cap, digests/sweeps via their dedupe keys).

**Dormant-by-default gates (the only "external integration" testing we do)**
- [ ] LLM six-gate dispatcher (13.3): refuses with kill-switch flag OFF; refuses for non-admin; refuses PII-shaped payloads (`llm.curriculum.skipped` audit) — no provider is ever called in tests.
- [ ] Messaging dispatch (11.4.4): refuses unless **all six gates** open (admin flag + provider env + consent + per-user flag + verified phone + allowlist row); with the `console` provider fallback, no request leaves the process.
- [ ] SAQA worker cron: no-ops cleanly when `feature_flag_saqa_worker` is OFF; `approveQualification` flips directly (Phase 7 behaviour) on the OFF path.
- [ ] KYC provider resolution: `resolveIdentityVerifier()` returns the mock/manual path when `feature_flag_kyc_provider` is OFF; `adminVerifyIdManually` works without any provider.
- [ ] Email: with `EMAIL_TRANSPORT` console/no-op, notification rows still land and the 9.18 strict-mode loud-fail does not fire in the test env.

## Task 12.3: E2E (Playwright golden paths, 1280px + 360px)

- [ ] **Seeker arc:** sign-up (DOB + nationality + consent step) → verify-email (test-mode token) → profile (skills, availability, open-to) → appears on `/search` → status re-confirm via Talent Pulse.
- [ ] **Employer arc:** sign-up → org onboarding doc upload → admin approves at `/admin/verifications` → search → dossier → reveal (audit row visible in seeker's `/dashboard/activity`) → mark hired.
- [ ] **Vacancy loop:** create vacancy (incl. any-province remote variant) → match page → invite with note → seeker accepts → mark-as-filled with hire pick → non-selected invitee receives outcome notification → Career Compass shows the gap banner.
- [ ] **Seeker-invite loop (9.17):** employer sends invite → `/sign-up/invited/[token]` pre-filled → accepted → appears in Joined list.
- [ ] **Privacy arc:** export JSON downloads (ID as ciphertext); erasure request → grace notice → signed-out; `/p/[handle]` shows no PII anonymously.
- [ ] **Student lane:** sign-up with academic record → `/dashboard/grow` student lane + progression timeline + module-skills section render.
- [ ] **Admin arc:** qualification approve → seeker badge flips (rollup) + notification; moderation suspend → sign-in bounce with reason.
- [ ] **Gov arc:** `/gov` role lands; `/insights` renders; one CSV export downloads and writes an `analytics.export` audit row.
- [ ] Every path asserts zero console errors and (360px) no horizontal overflow on the visited routes.

## Task 12.4: Compliance suite in CI

- [ ] Wire all **29** `runAll()` assertions as a vitest suite against the seeded test DB (D7). Any future compliance assertion must land with its suite entry — note this in the assertion file header.
- [ ] Forbidden-key payload tests: a single shared `FORBIDDEN_PUBLIC_KEYS` list (`national_id_enc`, `dob`, `email`, `full_surname`, `document_storage_key`, `phone_e164_enc`, `cv_*`, milestone/module fields) asserted against every public read path (search, public profile, share-card data, LMI API).
- [ ] Audit completeness: for each PII-touching action exercised in 12.2 (reveal, download, export, admin user view, KYC review fetch), assert exactly the expected audit kind landed — a missing audit row is a test failure, not a warning.
- [ ] Build gate: `npm run test:all` = typecheck + lint + unit + integration + compliance; E2E runs on demand and pre-release.

## Task 12.5: Carry-over quality fixes (small, in-scope)

- [ ] **Modal focus-return sweep** — finish A11Y finding #8: the pre-11.5 modals (older dialogs predating `MarkAsFilledModal`-era patterns) get Esc-close + focus-return; covered by an E2E assertion on each.
- [ ] **Populate `docs/PERF_BUDGET.md`** — run `ANALYZE=true npm run build` + `npx @lhci/cli autorun` (config already in `lighthouserc.json`) and fill the route table. Any route over the 160KB script budget gets a fix or a documented exception in this phase, not later.
- [ ] **`/search` ILIKE → FTS flip decision** — while ranking tests are being written (12.2), decide and pin the final search path so tests target it once. If the flip lands, it lands here; if deferred, the deferral is recorded with the trigger condition.
- [ ] **Clear the repo lint debt, then re-add `lint` to `test:all`** — discovered in Session A (2026-06-10): `npm run lint` fails on pre-existing `app/` page code (react-hooks/purity `Date.now()` in render on 3 admin pages, `react/no-unescaped-entities`, `@next/next/no-html-link-for-pages` on `/insights` export links + reset-password). All new Phase 12 files lint clean. `test:all` runs typecheck + vitest only until this lands, so the gate is green-by-construction from day one.

## Task 12.6: Wiring, verification, doc convention

- [ ] `npm run test:all` green on a fresh clone + fresh test DB (proves the journal fix holds end-to-end: migrate-from-zero → seed → suites).
- [ ] `npm run build` clean.
- [ ] Write `docs/completed/PHASE_12_COMPLETE.md` (what shipped + named-invariant inventory + how to run); move this plan to `docs/completed/`; tick Phase 12 in `ROADMAP.md` with ✅ + date; refresh **Current State** in `TO_START_EVERY_SESSION.md`; commit `Phase 12 complete + Phase 10 Arc B (launch operator tasks) opens`.

---

## Suggested session split

1. **Session A — 12.0 + 12.1:** harness, vitest config, test DB guard, all unit suites. (No DB risk; fast feedback.)
2. **Session B — 12.2 + 12.4:** integration rules + compliance-in-CI. (The bulk of the value.)
3. **Session C — 12.3 + 12.5 + 12.6:** Playwright paths, focus sweep, perf table, wrap-up docs.

## Acceptance bar

Phase 12 is done when: every named invariant above has a test; all 29 compliance assertions run green in CI; the 9 golden paths pass at both viewports; the perf table has real numbers; and a fresh clone can go `migrate → seed → test:all → green` with no manual steps beyond env vars.
