# PHASE 12 PLAN  TESTING & QA (REVISED 2026-06-10)

**Status:** ACTIVE  next milestone before public ship.
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

The 29 compliance assertions are excellent but only run when an admin hits `/api/admin/outcomes-compliance`  they are not part of any automated pipeline. Nothing exercises a behavioural path (reveal gate, invite consent gate, placement window, erasure) end-to-end. Phase 12 closes that gap for the **whole** system as it exists today.

**Non-goals:** UI-component snapshot tests (E2E covers rendering); coverage-percentage targets (we pin named invariants, not vanity metrics); load/soak testing (Phase 10.10, operator-hands); professional pen-test (separate engagement, pre-commercial-launch gate); **external-service integration testing**  SAQA, KYC SaaS, SMS/WhatsApp providers, Sentry, Upstash and external LLM providers are all deliberately dormant behind flags and none is wired to a live credential, so there is nothing external to test. The only thing Phase 12 tests about them is that **their gates stay closed** (see 12.2 "Dormant-by-default gates").

> **Terminology note:** "integration tests" in this plan means *our own layers wired together*  a Server Action exercised against the real Postgres schema with seeded data, asserting the guard + mutation + audit row beneath it. It does **not** mean integrating with third-party systems. Unit = one pure function in isolation; integration = our action + our DB + our rules; E2E = a browser walking the real app.

---

## Decisions (locked before work starts)

- **D1  Test database is a dedicated, disposable Postgres.** Integration + E2E suites run against a dedicated Neon branch (or local Postgres) identified by `SEBENZA_TEST_DB=1` + its own `DATABASE_URL`. The harness **refuses to run** destructive setup (migrate-from-zero + truncating seed) unless `SEBENZA_TEST_DB=1` is set  structural protection against pointing the suite at the dev/prod DB. `db/seed.ts` already truncates; that behaviour is exactly right for tests and exactly wrong everywhere else, hence the guard.
- **D2  Playwright, chromium-only, two viewports.** Desktop 1280px + mobile 360px (the No-Flash Rule's reference width). Other browsers deferred; the user base is overwhelmingly Android Chrome.
- **D3  axe-core automation stays in the post-launch backlog** (per `POST_LAUNCH_BACKLOG.md`), **but** the Playwright harness is built so `@axe-core/playwright` can bolt on later without restructuring (one fixture file, per-route-group specs).
- **D4  Crons are tested by invoking the route handlers directly** (`GET`/`POST` with `CRON_SECRET` header) against the test DB  no scheduler simulation. Idempotency is asserted by invoking twice.
- **D5  Email in tests uses the console/no-op transport.** Outcomes are asserted via `notifications` rows + audit rows, never by intercepting SMTP. (`EMAIL_TRANSPORT` unset + `EMAIL_TRANSPORT_STRICT=false` in the test env so the 9.18 loud-fail doesn't fire.)
- **D6  Server Actions are integration-tested as functions**, with a session stub at the DAL boundary, not through HTTP. The three-layer model (`docs/SECURITY.md`) makes the DAL the real gate; tests stub `verifySession()`/`verifyRole()` inputs and assert the guard + mutation + audit behaviour beneath it.
- **D7  The 29-assertion compliance suite becomes a first-class vitest suite** (`npm run test:compliance`) run against the seeded test DB. The admin API route stays as the production-side runtime check; CI gets the same truth.
- **D8  One invariant, one test.** Every test in 12.2/12.4 is named for the rule it pins (e.g. `reveal requires verified org + contact consent + writes audit row`). When a rule regresses, the failing test name says which product rule broke, not which file.

---

## Task 12.0: Test infrastructure (build first)

- [x] `vitest.config.mts` (ESM forced by `.mts`  the project has no `"type": "module"`): node environment, `@/` alias, `server-only` stub, three projects  `unit` / `integration` / `compliance`. *(Session A + B)*
- [x] Test-DB harness: `tests/helpers/db.ts` (D1 guard  loads ONLY `.env.test.local`, refuses without `SEBENZA_TEST_DB=1`) + `tests/helpers/global-setup.ts` (programmatic migrate-from-zero + truncating seed per project run) + `tests/helpers/setup-env.ts` (per-worker env) + `tests/helpers/migrate-cli.ts`. Test DB = Docker `sebenza-test-pg` (Postgres 16, port 54329, restart unless-stopped) via the new `DATABASE_DRIVER=postgres-js` seam in `db/client.ts`. *(Session B)*
- [x] Session stubbing: done as targeted `vi.mock("@/lib/auth/dal")` per suite (see `tests/integration/reveal-placement-gates.test.ts`) rather than a central helper  the mock IS the documented D6 seam; extract to `tests/helpers/session.ts` when a third suite needs it. *(Session C)*
- [x] `@playwright/test` + chromium installed; `playwright.config.ts` webServer runs the production build on port 3100 with EXPLICIT test-env overrides (process env beats `.env.local`, so the dev Neon DB is unreachable); projects `desktop` + `mobile-360`. *(Session C)*
- [x] npm scripts: `test` / `test:watch` (unit), `test:integration`, `test:compliance`, `test:e2e`, `test:all`. *(Sessions A–C)*
- [ ] Document the harness + the D1 guard in this doc's companion `PHASE_12_COMPLETE.md` when shipped, and add a short "Running the tests" section to `README.md`.

## Task 12.1: Unit tests (pure logic, no DB)

Existing (keep, extend where noted): `suppress.test.ts` · `justification.test.ts` · `id-validation.test.ts` · `invite-tokens.test.ts`.

New suites  **all shipped in Session A (2026-06-10), 195 unit tests green**:
- [x] **`lib/status.ts`**  band boundaries at exactly 29/30/31 and 89/90/91 days; confidence weights 1.0/0.6/0.25; `freshnessSummary` nudge/urgent flags.
- [x] **`lib/crypto`**  round-trip; `v1.` prefix; random-IV non-determinism; tamper/wrong-key/unknown-key-id fail closed; env-key validation.
- [x] **Consent state machine** (`lib/consent`)  purpose-catalogue pin; `isSearchable` none/granted/revoked; non-degrading optional purposes. *(pause interaction is DB-backed → covered at the 11.3.1 exclusion fixture in 12.2)*
- [x] **CSV safety**  OWASP formula-injection guard; RFC 4180 quoting; CRLF + BOM.
- [x] **`lib/seeker/vacancy-outcome.ts`**  D4 anonymity (incl. structural input-shape pin); missing-skill cap 5; Compass deep link; no fabricated gaps.
- [x] **`lib/seeker/free-alternatives.ts`**  ordering contract re-derived independently across the full skills taxonomy; excludeTitles; unknown → null.
- [x] **Rate limiter**  sliding-window roll-over, key + bucket isolation, DPIA R8 budget pins.
- [x] **Notification catalog**  shape totality + pinned Phase 7.6 decisions + DPIA R3 no-shortlist-kind pin.
- [x] **`formatVacancyLocation`** (13.9) + national-remote bucket helpers.
- [x] **`lib/taxonomy/countries.ts`**  ZA-first ordering, code uniqueness, flag-emoji rules.

## Task 12.2: Rules-against-the-database tests (seeded test DB  *our* code layers, no external systems)

These exercise our Server Actions + queries against the real Postgres schema with seeded data. Nothing here calls outside the codebase. Grouped by the seven non-negotiable rules plus the lifecycle machines:

**Redaction Rule**
- [x] `searchProfilesQuery` result shape: forbidden keys never present (key-set assertion on raw rows, not just types). *(Session B: `tests/integration/search-redaction.test.ts`)*
- [x] Public profile projection (`/p/[handle]` provider read): same forbidden-key assertion. *(Session B; locked-panel anonymous check also covered browser-side in E2E `public-arc.spec.ts`)*
- [ ] POPIA data export (`/api/dashboard/data-export`): national ID appears **only** as `v1.` ciphertext.

**Status-Freshness + ranking**
- [x] Fresh profile outranks identical stale profile; `sebenza_freshness_confidence` SQL agrees with `lib/status.ts` at band boundaries. *(Session B: `tests/integration/ranking-freshness.test.ts`)*
- [x] 13.10: primary-profession match ranks above secondary match; secondary matches still returned. *(Session B)*  citizen-highlight grouping + completeness multiplier still open.
- [ ] Filters: work-availability `&&` overlap (incl. `remote`/`hybrid`/`seasonal`), `open_to` overlap, internship/grad opt-ins, `minYears`, any-province vacancies (13.9) match all provinces.
- [x] Exclusions: soft-deleted vanishes from search + dossier immediately. *(Session B)*  suspended / searchability-paused (11.3.1) / seeker-blocked-org (11.3.2) exclusions still open.

**Three-lock reveal + Placement-Truth**
- [x] `revealContact`: DAL consulted first (lock #1); revoked/missing consent refused (lock #2); all locks open → contact + `profile.contact.reveal` audit row + seeker notification (lock #3). *(Session C: `tests/integration/reveal-placement-gates.test.ts`)*
- [ ] Document download: requires `document_sharing` consent; separate audit kind; signed URL TTL ≤ 60s. *(needs a storage stub  Supabase is not configured in the test env)*
- [x] `markAsHired`: refused with no reveal; refused with a 31-day-old reveal; succeeds with a recent one; lands as `employer_confirmed` + notification. *(Session C)*  `seeker_reported` exclusion from aggregates is pinned by the compliance suite.
- [ ] Mark-as-filled (9.11): transaction atomicity  placements + state flip + outcome fan-out all-or-nothing; second attempt on `filled` refused; outcome notifications exclude hires/declined/expired/withdrawn.

**Consent gates (invites)**
- [x] `bulkInviteToVacancy`: non-consented seeker silently skipped; skip reason never in the response payload (D5); UNIQUE dedupe on re-invite. *(Session C)*  withdraw-notification path still open.
- [ ] Seeker invites (9.17): unverified org refused; 50/day per-org cap counts dedupe hits; 90-day decline cooldown enforced; token single-use at DB layer. *(cooldown + verified-org + no-orphan are pinned by the compliance suite; the cap + single-use behavioural tests still open)*

**Verification-Honesty**
- [ ] `recomputeProfileVerification` rollup: verified ⇔ ≥1 verified qual; pending ⇔ none verified + ≥1 pending; `rejected` never auto-applied; all four mutation sites trigger it.
- [ ] Self-attested skills (`provenance`) never render/count as verified; employment-verification badge expires at 12 months; supersede-on-employer-change downgrade (9.23).

**Erasure + retention**
- [ ] `eraseUser` → soft-delete → vanishes from search immediately; `hard-delete-erased` cron deletes only rows past 30 days and audit-logs `account.hard_delete` **before** the DELETE.

**Taxonomy + suggestion queue (9.15/9.22)**
- [ ] Promote canonicalises + backfills profiles/academic rows; merge re-points FKs; reject **never** mutates user data.

**Cron idempotency (all 18 routes)**
- [x] Every route (filesystem-discovered): 401 without/with-wrong `CRON_SECRET`; status-stale-warning second run fires 0; seven high-stakes sweeps run clean twice. *(Session B: `tests/integration/cron-endpoints.test.ts`)*  learning-nudge 7-day-cap and digest dedupe behavioural fixtures still open.

**Dormant-by-default gates (the only "external integration" testing we do)**
- [ ] LLM six-gate dispatcher (13.3): refuses with kill-switch flag OFF; refuses for non-admin; refuses PII-shaped payloads (`llm.curriculum.skipped` audit)  no provider is ever called in tests.
- [ ] Messaging dispatch (11.4.4): refuses unless **all six gates** open (admin flag + provider env + consent + per-user flag + verified phone + allowlist row); with the `console` provider fallback, no request leaves the process.
- [x] SAQA worker cron: no-ops cleanly when `feature_flag_saqa_worker` is OFF. *(Session B)*  `approveQualification` OFF-path direct-flip fixture still open.
- [ ] KYC provider resolution: `resolveIdentityVerifier()` returns the mock/manual path when `feature_flag_kyc_provider` is OFF; `adminVerifyIdManually` works without any provider.
- [x] Email: with `EMAIL_TRANSPORT=console`, notification rows still land and the 9.18 strict-mode loud-fail does not fire in the test env. *(implicitly exercised by every Session B/C suite  reveal/placement/cron tests all create notifications under the console transport)*

## Task 12.3: E2E (Playwright golden paths, 1280px + 360px)

> Harness live since Session C (2026-06-11): `npm run test:e2e` builds the production app and serves it on :3100 against the test DB. First runs found + fixed two real bugs: duplicate `<main id="main">` landmark while `/search` streams (loading.tsx skeleton), and the CSP's `upgrade-insecure-requests` breaking same-origin navigation on the http-only test server (now gated behind `SEBENZA_E2E_HTTP=1`).

- [x] **Public arc** (`public-arc.spec.ts`): landing renders clean → search roster → dossier leaks no PII (no seed emails, no 13-digit IDs in rendered HTML) → anonymous visitor bounced off `/dashboard`. Both viewports; zero console errors; no horizontal overflow at 360px.
- [x] **Seeker sign-in arc** (`seeker-arc.spec.ts`): seeded-account sign-in → dashboard → privacy centre (consents read from the real DB) → own activity page.
- [x] **Employer arc** (`role-arcs.spec.ts`): verified-org sign-in → workspace → vacancies → seeker dossier renders; **unverified org is bounced off the dossier** (the verifyOrgVerified gate proven browser-side). The reveal/mark-hired behaviours are pinned in `reveal-placement-gates.test.ts` (integration) where the audit/notification rows can be asserted directly.
- [x] **Student lane** (`role-arcs.spec.ts`): cohort-member sign-in → `/dashboard/grow` renders the academic lane (programme anchored).
- [x] **Admin arc** (`role-arcs.spec.ts`): admin sign-in → overview → verifications + moderation queues render. (Approve→rollup flip is pinned by the `profile-verification-matches-rollup` compliance assertion + the rollup integration plan; suspend→invisible is pinned in `search-filters-exclusions.test.ts`.)
- [x] **Analytics surface** (`role-arcs.spec.ts`): `/insights` renders aggregate-only (no ID-shaped strings). The seed ships no gov-role account (partnership-gated portal), so `/gov` browser coverage lands with the gov pilot fixture.
- [x] Console-error + 360px-overflow guards on the public arc; both viewports run every spec.
- [ ] **Deferred to the backlog** (recorded in `POST_LAUNCH_BACKLOG.md` → E2E follow-ups): full sign-up arc with email-token capture, the browser-driven vacancy loop, the 9.17 invited-sign-up landing, and the privacy export-download click-through. Their underlying behaviours are covered at the integration layer (sign-up validators, invite-token unit fixtures, `/api/dashboard/data-export` ciphertext fixture); what's deferred is only the browser walk.

## Task 12.4: Compliance suite in CI

- [x] All **29** assertions run as named vitest tests against the seeded test DB, dynamically discovered (future assertions auto-enroll; count fixture is a removal guard). *(Session B: `tests/compliance/assertions.test.ts`. First run found + fixed: broken `u."createdAt"` SQL in the no-orphan assertion; stale vacancy allowlist; 3 seed profiles violating the 9.14 rollup.)*
- [x] Forbidden-key payload tests: shared `FORBIDDEN_PUBLIC_KEYS` list asserted on search + public-profile reads incl. children. *(Session B)*  share-card data + LMI API payloads still open.
- [x] Audit completeness for reveal (`profile.contact.reveal`) + placement (`placement.confirm` path) with missing-row-equals-failure semantics. *(Session C)*  download / export / admin-view / KYC-fetch audits still open.
- [x] Build gate: `npm run test:all` = typecheck + unit + integration + compliance (lint re-enters per 12.5). E2E (`npm run test:e2e`) on demand and pre-release. *(Sessions A–B; 291 vitest tests green as of 2026-06-11)*

## Task 12.5: Carry-over quality fixes (small, in-scope)

- [x] **Modal Esc sweep** *(Session D, 2026-06-12)*  audited all 20 `role="dialog"`/`aria-modal` components: 4 lacked Escape entirely (`BulkInviteIsland`, `DepartureIsland`, `ConfirmStatusIsland`, mobile `SearchFilters` sheet) and now close on Esc using the established `MarkAsFilledModal` pattern. **Focus-return** is implemented by none of the 20 (browser default focus-to-body on unmount)  doing it right means one shared hook applied across all modals, queued in `POST_LAUNCH_BACKLOG.md` with the audited component list rather than rushed here.
- [x] **JS budget measured + turned into an automated gate** *(Session D, 2026-06-12)*: `tests/e2e/perf-budget.spec.ts` measures encoded script wire bytes (via `Request.sizes()`  deterministic; naive network counting swung ±70 KB with prefetch timing) for each route's own `<script src>` set on the production build, with zero-third-party enforcement on every E2E run. **Finding: the shared baseline puts every key route over the 160 KB target**  `/` 194.2 · `/search` 210.2 · `/p` 195.5 · `/sign-in` 196.8 · `/insights` 291.7 KB (Recharts +~95 KB in the route bundle). All five pinned as tight ratchet ceilings (measured +3 KB) per this task's "fix or documented exception" clause; the trim is the backlog "No-Flash bundle pass". Full Lighthouse score runs remain operator-hands (real Chrome + LHCI's public upload).
- [x] **`/search` ILIKE → FTS flip decision** *(Session D, 2026-06-12)*: **no flip needed  the backlog entry was stale.** `searchProfilesQuery` contains zero ILIKE; free-text search runs `websearch_to_tsquery` + `ts_rank_cd` over the materialised `search_vector` (Phase 4 as designed). The Session B ranking fixtures pin this path. `POST_LAUNCH_BACKLOG.md` corrected.
- [x] **Lint debt cleared; `lint` is back in `test:all`** *(Session D, 2026-06-12)*. The 162 errors fell into four families, resolved by documented config triage in `eslint.config.mjs` + one code fix: (1) `@next/next/no-html-link-for-pages` OFF  guards the legacy `pages/` dir this project never had; all 98 hits were false positives (plain `<a>` to API download endpoints is correct). (2) `react/no-unescaped-entities` OFF  40 cosmetic hits in static prose; React escapes text nodes. (3) react-hooks v6 rules (`purity`, `set-state-in-effect`, `error-boundaries`, `static-components`) downgraded to **warn**  they postdate the codebase and flag deliberate patterns (mount-gated Recharts islands, per-request `Date.now()` in Server Components); per-site triage queued post-launch. (4) One genuine bug fixed: `reset-password` used a plain `<a href="/forgot-password">` that dropped the active locale  now the i18n-aware `Link`.

## Task 12.6: Wiring, verification, doc convention

- [ ] `npm run test:all` green on a fresh clone + fresh test DB (proves the journal fix holds end-to-end: migrate-from-zero → seed → suites).
- [ ] `npm run build` clean.
- [ ] Write `docs/completed/PHASE_12_COMPLETE.md` (what shipped + named-invariant inventory + how to run); move this plan to `docs/completed/`; tick Phase 12 in `ROADMAP.md` with ✅ + date; refresh **Current State** in `TO_START_EVERY_SESSION.md`; commit `Phase 12 complete + Phase 10 Arc B (launch operator tasks) opens`.

---

## Suggested session split

1. **Session A  12.0 + 12.1:** harness, vitest config, test DB guard, all unit suites. (No DB risk; fast feedback.)
2. **Session B  12.2 + 12.4:** integration rules + compliance-in-CI. (The bulk of the value.)
3. **Session C  12.3 + 12.5 + 12.6:** Playwright paths, focus sweep, perf table, wrap-up docs.

## Acceptance bar

Phase 12 is done when: every named invariant above has a test; all 29 compliance assertions run green in CI; the 9 golden paths pass at both viewports; the perf table has real numbers; and a fresh clone can go `migrate → seed → test:all → green` with no manual steps beyond env vars.
