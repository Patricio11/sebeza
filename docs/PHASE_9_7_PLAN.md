# PHASE 9.7 PLAN — NATIONALITY ANALYTICS & LOCAL-HIRING INTELLIGENCE
*Side-phase between Phase 9 and Phase 10. Opened 2026-05-23. Open questions closed 2026-05-24.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/` (incl. **R9**, added with this phase).*
*Naming note: this is **Phase 9.7** to avoid colliding with `Task 9.5` (AWS migration, deferred) and `Task 9.6` (launch-scale deferrals) already used inside Phase 9. Different things, different namespaces.*

> **Why 9.7 and not Phase 10:** Phase 10 is the public-launch phase (WCAG 2.2 AA audit, 3G perf budget,
> full localisation). This is analytics enrichment on **already-shipped** infrastructure (the `/gov`
> route group + `gov` role, the k=10 + complementary suppression engine from 7.5.4, the skills-gap engine
> + supply heatmap from 6/6.5, the LMI from 9.4). It belongs *before* launch but must not muddy the
> launch phase. Self-contained side-phase, exactly like 6.5 and 7.5.

---

## 🎯 GOAL

Turn nationality from a *search filter* (already shipped, unchanged) into a *governed policy lens*. The
strategic insight driving this phase: **nationality data, used honestly, is an anti-xenophobia tool, not
a targeting one.** It shows *where* South Africans can fill demand (→ local-hiring incentives are viable)
and *where* a genuine local skills shortage means foreign nationals are filling a real gap (→ training
investment, not blame). Same dataset, both truths, in the language government acts on: evidence.

Everything in this phase is **`gov` / `admin`-gated**, **suppression-floored**, and **audit-logged**.
Nothing public-facing changes.

### The access model (the spine of this phase — read first)
| Tier | Capability | Who | Verdict |
|------|-----------|-----|---------|
| Market | Aggregate nationality breakdowns by skill × province × status | `gov`, `admin` | ✅ build (inherits k=10) |
| Market | Skills-Shortage Justification Index + Local-Hiring Opportunity Map | `gov`, `admin` | ✅ build (the centerpiece) |
| Self | An employer sees **their own** confirmed-placement nationality mix | that `employer` | ✅ build (their own data, low risk) |
| Regulated | `gov` looks up **a specific employer's** mix as an ESA §8 evidence aid | `gov` only, purpose-bound, **dormant by default** | ⚠️ build with small-numbers guard + audit + reason + `feature_flag_employer_mix_lookup` gate; **never ranked, never browsable as a leaderboard** |
| — | Public / cross-employer "who hires the most foreigners" league table | nobody | 🚫 **explicit out of scope** (§ guardrails) |

---

## 🔒 DECISIONS CLOSED 2026-05-24

The four open questions from the original draft are resolved. The recommendations below are now
load-bearing for the implementation; do not relitigate during build without re-opening here first.

### D1 — Justification Index thresholds (was Q2)
The classifier ships with three knobs, **all explicit, all tunable from `/admin/settings`**, all
explainable to a non-technical government user. No ML, no opaque scoring.

```
Genuine local shortage:
  demand_score          >= lmi_demand_floor              (default 1.0)
  AND local_supply_ratio < lmi_local_supply_threshold    (default 0.5)
  AND foreign_fill_share >= lmi_foreign_fill_floor       (default 0.5)
  AND total_placements   >= employer_mix_min_placements  (default 5  reused)

Local supply available:
  demand_score          >= lmi_demand_floor
  AND local_supply_ratio >= 1.0

Indeterminate / low priority:
  anything else  shown as blank or "too few signals to classify"
```

Definitions:
- **`demand_score`** = `COUNT(DISTINCT actor_org_id)` on `search_events` for the (profession × province)
  cell in the trailing 30 days, divided by 10. So `demand_score = 1.0` means *ten different employers*
  searched for this cell. (Per-org distinct, not raw event count — closes the demand-inflation vector
  where one motivated employer hammers a search 40 times.)
- **`local_supply_ratio`** = `(count of SA-citizen profiles in that cell, freshness-weighted via
  sebenza_freshness_confidence(), with available_for set OR status = 'open_to_work') ÷ (demand_score × 10)`.
  Ratio of 0.5 = half an available SA candidate per searching employer.
- **`foreign_fill_share`** = share of `employer_confirmed` placements in that cell that went to
  foreign nationals (using the 2-class `nationality_class` derivation).

**Required on the UI:** the formula is published verbatim on `/gov` alongside the classification
table (same pattern as `/privacy` publishing the LMI formula). Each cell's row tooltip surfaces its
own `demand_score / local_supply_ratio / foreign_fill_share` values so a user can see *why* a cell
was labelled what it was. No mystery.

New `platform_settings` keys added by 9.7:
- `lmi_demand_floor` (default `1.0`)
- `lmi_local_supply_threshold` (default `0.5`)
- `lmi_foreign_fill_floor` (default `0.5`)
- `employer_mix_min_placements` (default `5`, **reused** by both 9.7.3 and 9.7.6  one floor, not two)

### D2 — Legal framing (was Q3)
The naive "Sebenza helps with your EEA report" framing is wrong. The accurate framing rests on **two
distinct statutes**, both currently in force in South Africa:

- **Employment Equity Act 55 of 1998, §1** — the definition of "Black people" (the largest designated
  group) applies *only to South African citizens* (plus a narrow pre-1994 naturalised + by-birth
  qualification). Foreign-national Black hires don't count toward an employer's designated-group
  representation. So the citizen / foreign-national split *does* matter for EEA, but as a structural
  qualifier on the existing race fields, not as a separately-reported nationality field.

- **Employment Services Act 4 of 2014, §8** — requires employers to prove they made *reasonable
  efforts to recruit South African citizens or permanent residents* before hiring a foreign national.
  The Department of Employment & Labour (DEL) can request that evidence. They currently have almost
  no data to triangulate against. **This is the lever 9.7.6 actually serves.**

Framing applied across the three surfaces:

- **9.7.5 (employer self-view)** copy:
  > "Your SA-citizen / foreign-national split of platform-confirmed placements. Useful for your
  > EEA §1 designated-group qualification (the Black-people designation counts only SA citizens)
  > and your ESA §8 local-hiring efforts record-keeping. Not a substitute for your EEA-1 filing or
  > your Department of Home Affairs documentation."

- **9.7.3 / 9.7.4 (Justification Index + Opportunity Map)** legend:
  > "*Local supply available* cells are where ESA §8 has practical force — government can credibly
  > ask 'could this role have been filled locally?' *Genuine local shortage* cells are where §8
  > enforcement is harder because the actual supply isn't there; the policy response is training
  > investment, not blame."

- **9.7.6 (per-employer gov lookup)** framing: an **ESA §8 evidence aid** for DEL during a specific
  inquiry — bounded by one employer + one stated reason, never a fishing expedition. Confirmed-
  placement mix is *one input* to that inquiry, alongside the employer's own recruitment records.

**Caveat that must follow this everywhere it appears:** this is the engineering team's reading of
the statutes, not a lawyer's opinion. Before any of this language ships in pitch decks, sales
material, public-facing copy, or PAIA documentation, run it past a labour-law practitioner who
works with EEA / ESA filings. The legal claim is sturdy enough to build against; the *exact
wording* should come from counsel. Tracked as **DPIA R9**.

### D3 — `gov` per-employer lookup ships dormant (was Q4)
9.7.6 ships behind **`feature_flag_employer_mix_lookup`, default OFF**, mirroring the dormant-by-
default posture of KYC and SAQA. The engine is built and tested; the switch is flipped only when a
real DEL §8 partnership workflow exists. Activation pairs with the formal regulatory protections
(purpose limitation, retention windows, named operators) becoming concrete.

### D4 — `employer_mix_min_placements` default (was Q1)
Default **5**, tunable from `/admin/settings`. Re-assess at every Phase boundary based on actual
placement volume — raise the floor if median per-employer placement count climbs significantly.

---

## ✅ PRE-FLIGHT RECHECK (run before writing code)

- [ ] Confirm `profiles.nationality` + `is_citizen` (or equivalent) shape and that `citizen_boost` in the
      Phase 4 ranking SQL reads from it. 9.7 **reads** these; the search filter itself is **unchanged**.
- [ ] Confirm `outcomesQuery()` + the suppression helpers (`outcomes_min_cohort_size`, complementary
      suppression across row+column groups) are exportable/reusable as a generic
      `suppress(rows, dims, k)` — 9.7 reuses this verbatim. If it's currently inlined to outcomes, the
      first task is to extract it (no behaviour change).
- [ ] Confirm `placements` columns + `placement_source` (`employer_confirmed` / `seeker_reported`) and
      that only `employer_confirmed` feeds official aggregates (the 7.5.5 honesty rule). 9.7 inherits this.
- [ ] Confirm `verifyGov()` DAL guard + `gov` role + `/gov` route group + proxy entries from 9.4.
- [ ] Confirm `platform_settings` key/value pattern (used for `outcomes_min_cohort_size`) — 9.7 adds
      `employer_mix_min_placements`, `lmi_demand_floor`, `lmi_local_supply_threshold`, `lmi_foreign_fill_floor`.
- [ ] Confirm the audit-log write helper + action-naming convention (e.g. `placement.self_report`).
      9.7 adds new audited actions (below).
- [ ] Confirm the hardened CSV export path (injection guard + CRLF + row cap) — all 9.7 exports reuse it.
- [ ] Confirm `is_citizen` provenance is **self-declared at sign-up** today (no Home Affairs verification
      wired); D2 caveat language reflects this honestly.

---

## 🧩 DEPENDENCY NOTE

The honesty of every number here rests on **employer-confirmed placements** (7.5.5). A nationality mix is
only meaningful if hires are logged. Lever C (the day-≥21 dossier nudge) is shipped; **Lever A** (analytics
value-exchange via the employer hiring funnel) is still deferred to Phase 9 and remains the main lever for
volume. 9.7 does not depend on Lever A landing, but the richness of 9.7.4/9.7.5 scales with placement
logging — note the coupling, don't block on it.

**Realistic data density at launch:** with current placement-logging volume, k=10 + the employer-mix
floor will leave most of the Opportunity Map blank initially. That's honest, not a bug. Better to
classify five cells correctly than five hundred cells confidently-wrongly. The phase demo materials
should acknowledge this so the launch pitch doesn't fall flat.

**Recommended order:** 9.7.1 (extract/confirm suppression util, *test-first*) → 9.7.2 (market nationality
dimension) → 9.7.3 (Justification Index) → 9.7.4 (Opportunity Map) → 9.7.5 (employer self-view) → 9.7.6
(governed per-employer lookup, last — highest sensitivity, ships dormant) → 9.7.7 (oversight log) →
9.7.8 (scheduled brief, in scope) → 9.7.9 (wiring/verification).

If counsel review of D2's framing takes time, **9.7.1 through 9.7.4 can ship without waiting** — those
carry no per-employer surface and no public-facing legal-claim copy.

---

## 📋 TASKS

### Task 9.7.1: Reusable suppression utility (groundwork, zero behaviour change) ✅ 2026-05-24
- [x] **Test fixtures first.** Wrote 11 unit tests in `lib/analytics/suppress.test.ts` codifying the
      contract: empty input, all-pass, all-fail, primary alone, row-axis complementary, col-axis
      complementary, multi-survivor non-derivable, lone survivor no-suppressed-sibling, group
      independence, no-axes-only-primary, k=10 boundary, row+col-pass independence.
- [x] Extracted to `lib/analytics/suppress.ts`. Generic shape:
      `suppress(rows, { countKey, k, axes })` where each axis is one complementary pass
      (`{ groupBy: dims[], complementOver: dim }`). Pure function, no DB, no I/O.
- [x] `outcomesQuery()` refactored to declare its two axes (row=province, col=graduation_year) and
      call `suppress()` once. ~50 lines of dead helpers removed.
- [x] vitest added as devDep + `npm test` / `npm run test:watch` scripts (Phase 11.4 will formalise).
- [x] Verified: `npm test` 11/11 green · `npm run typecheck` clean · `npm run build` clean.
      Outcomes-compliance route compiles against the refactored `outcomesQuery`. Commit `3e83485`.

### Task 9.7.2: Nationality dimension on market analytics (`/gov`, `/insights`) ✅ 2026-05-24
- [x] `nationality_class` derivation lives inline in the SQL of both query functions
      (`CASE WHEN is_citizen THEN 'sa_citizen' ELSE 'foreign_national' END AS nationality_class`).
      2-class only, never raw country. Raw `nationality` stays redacted on the individual profile.
- [x] Two new query functions in `db/queries/nationality.ts`:
      - `supplyByNationalityQuery({ province? })` → province × profession × nationality_class supply,
        freshness-weighted, suppressed via two complementary axes
        (row=nationality_class within (province, profession); col=province within (profession, nationality_class)).
      - `statusMixByNationalityQuery()` → status × nationality_class count, suppressed across
        the nationality_class axis within each status bucket.
- [x] Both reuse `outcomes_min_cohort_size` as the analytics k-floor (one knob across the system;
      a separate `analytics_min_cell_size` was considered, deferred until policy needs differ).
- [x] `/gov` overview gets a status-mix card; toggle via `?split=nationality`. Default view is the
      "use the toggle above" hint card  no surprise PII-shaped split on first load.
      New component: `<NationalityStatusMixCard>`.
- [x] `/gov/provinces/[slug]` gets a supply-by-profession × nationality table; same `?split=nationality`
      toggle pattern. Province-scoped query so suppression runs against this province's cell counts.
      New component: `<NationalitySupplyTable>`.
- [x] **Placement rate + time-to-hire deferred**: those live in `outcomesQuery()` which is cohort-shaped
      (programme × institution × province × graduation_year). Splitting a Wits 2024 BSc CS cohort by
      nationality_class blanks almost every cell at k=10 with current data density. Note for 9.7.5 (or
      later when placement volume scales).
- [x] CSV export at `GET /api/gov/nationality-mix/export?dim=supply|status&province?=<label>`. `gov`
      / `admin` only via `verifyGov()`; runs the suppressed query, encodes via the shared CSV helper,
      audit-logs as `analytics.export` for the 9.7.7 oversight log. **`suppress()` runs inside the
      query function, before any caller (including this route) sees the rows**  structurally impossible
      to bypass by hitting the URL.
- [x] Shared CSV helper extracted to `lib/analytics/csv.ts` (`safeCell`, `csvFromRows`, `csvDisposition`).
      Audit-log + outcomes export routes refactored to call it  3 export routes, 1 encoder.
- [x] Compliance assertion (a) added: `assertNoNationalityCellBelowFloor()` in
      `lib/analytics/outcomes-compliance.ts`, wired into the admin compliance route.
- [x] Exports surface in `/gov/exports` updated with two new cards (nationality status + supply).
- [x] Verified: `npm test` 11/11 green · `npm run typecheck` clean · `npm run build` clean
      (new `/api/gov/nationality-mix/export` route present in build output). Commit `<TBD>`.

### Task 9.7.3: Skills-Shortage Justification Index (the centerpiece) ✅ 2026-05-24
- [x] Demand from `search_events` weighted by `COUNT(DISTINCT actor_org_id)` in the trailing 30
      days, scoped to the cell's province via `filters->>'province'`. Per-org distinct closes the
      demand-inflation vector.
- [x] Local supply = freshness-weighted (via `sebenza_freshness_confidence`) count of SA-citizen
      profiles in the cell with `status='open_to_work'` OR `cardinality(work_availability) > 0`.
- [x] Fill pattern = foreign-national share of `employer_confirmed` placements, joined to profiles
      for the `is_citizen` flag.
- [x] Pure classifier extracted to `lib/analytics/justification.ts` with **11 unit fixtures**
      covering shortage / supply-available / indeterminate paths + boundary conditions + a
      tunable-thresholds test. Vitest: 22/22 green (11 suppress + 11 classifier).
- [x] SQL plumbing in `db/queries/justification.ts`. Returns one row per `(profession × province)`
      cell with `demand_score / local_supply_ratio / foreign_fill_share / sa_supply /
      total_placements / foreign_placements / label`.
- [x] k-floor + complementary suppression applied to the SA-supply count via `suppress()` (two
      axes: row=province within profession, col=profession within province).
- [x] `/gov/shortage` page with: formula-published-verbatim section at the top, province filter
      chips, classified-cells table sorted shortage  supply-available  indeterminate, per-row
      tooltip carrying the three component values + the raw counts. Tone-rule applied: legend
      frames shortages as training-investment signals.
- [x] Drill-down per row to `/search?q=<profession>&province=<province>` so policy users see the
      actual talent behind the number.
- [x] Four new `platform_settings` keys land via migration `0012_phase9_7_lmi_thresholds.sql`:
      `lmi_demand_floor (1.0)`, `lmi_local_supply_threshold (0.5)`, `lmi_foreign_fill_floor (0.5)`,
      `employer_mix_min_placements (5)`. All tunable from `/admin/settings`; bounds enforced by
      Zod schemas in `lib/admin/settings-actions.ts`. New "Shortage Justification Index" section
      on the admin settings page surfaces the four knobs with hint copy explaining each one.
- [x] CSV export at `GET /api/gov/justification-index/export?province?=`. Suppression + classifier
      run INSIDE the query so the route physically cannot bypass either. Audit-logged as
      `analytics.export`. Surfaced on `/gov/exports`.
- [x] New nav entry `Shortage justification` (Scale icon) added to `GOV_NAV`.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run db:migrate` applied
      to Neon · `npm run build` clean (`/api/gov/justification-index/export` in the route
      manifest). Commit `<TBD>`.

### Task 9.7.4: Local-Hiring Opportunity Map (the actionable flip side) ✅ 2026-05-24
- [x] New `/gov/opportunity` page. Reuses `justificationIndexQuery()` (no new query) and filters
      to cells classified `supply_available`. Grouped by province; cells sorted by sa_supply
      descending; bars normalised across provinces so cross-province comparison reads honestly.
- [x] New `<OpportunityHeatmap>` component  CSS Grid + brand colour, no new map libraries
      (No-Flash Rule). The "heatmap" idea is a grid of bars, not a choropleth.
- [x] Drill-down per cell to `/search?q=<profession>&province=<province>` so policy users see
      the actual talent behind the number. Same convention as the 6.5 heatmap and the 9.7.3 table.
- [x] Inherits k=10 + complementary suppression from `justificationIndexQuery` (no separate
      suppression pass needed; the query has already dropped sub-k SA-supply cells).
- [x] ESA §8 framing in the legend per D2: dedicated framing strip on the page heads "Where §8
      has practical force," names the Act explicitly (Employment Services Act 4 of 2014 §8),
      and cross-references `/gov/shortage` so the reader sees the *complement* of where §8
      enforcement is harder. Counsel-review caveat (DPIA R9) printed beneath.
- [x] Headline tiles: opportunity-cell count · freshness-weighted SA supply available · shortage-
      cell count (cross-reference). Province filter chips like 9.7.3.
- [x] New nav entry "Local-hiring opportunity" (Sprout icon) in `GOV_NAV`, paired alongside
      "Shortage justification".
- [x] No new CSV export  the 9.7.3 export already carries the `classification` column. The
      `/gov/exports` description now mentions filtering to `supply_available` in a spreadsheet.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean.
      Commit `<TBD>`.

### Task 9.7.5: Employer self-view — "Your hiring on Sebenza" ✅ 2026-05-24 (engine + UI; final copy gated on DPIA R9)
- [x] Card on `/employer` overview slotted between the KPI grid and "Recent matches". Shows total
      employer-confirmed placements, SA-citizen + foreign-national splits with % + single-bar
      stacked split, per-role breakdown (top 10) and per-city breakdown (top 10). Date range
      footer (first hire  last hire).
- [x] **Their own data only**: `employerOwnMixQuery(orgId)` filters strictly on
      `placements.organization_id = orgId AND source = 'employer_confirmed'`. No cross-employer
      comparison, no ranking, no benchmark surface in the query layer. The query function physically
      cannot return another org's data.
- [x] No k-floor on self-data  the employer knows who they hired; a floor here would be theatre.
      The disclosure-control concern only applies when third parties view the data (which is what
      9.7.6 + 9.7.7 are for).
- [x] EEA §1 + ESA §8 framing copy per D2 is **live in the component** so the engineering work
      is testable end-to-end. A visible **DRAFT banner at the top of the card** flags the wording
      as engineering-team reading pending counsel review (DPIA R9). The banner comes off in a
      follow-up commit once sign-off lands.
- [x] Disclaimer one-liner: "Sebenza-confirmed placements only  not a substitute for your EEA-1
      filing or your Department of Home Affairs documentation" sits at the bottom of the framing
      section, same shape as the existing self-reported-placement disclaimer.
- [x] New audit kind `employer.own_mix.view` in the catalog. Logged on every render with
      `actor = session.id`, `subject = orgId`, `meta = { total }`  feeds the 9.7.7 oversight
      log so a regulator can later correlate self-views with their own `gov.employer_mix.lookup`
      records.
- [x] Files: `db/queries/employerMix.ts`, `components/feature/employer/EmployerHiringMixCard.tsx`,
      `app/[locale]/(employer)/employer/page.tsx` (wire-up), `lib/audit/index.ts` (kind added).
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean.
      Commit `<TBD>`.

**What's blocking the DRAFT banner removal:** DPIA R9 counsel review on the EEA §1 / ESA §8
framing. Until then, the card renders the framing for engineering testing but the banner makes
the legal-claim caveat explicit. Once counsel signs off, remove the `<DraftBanner />` call in
`EmployerHiringMixCard.tsx` and tighten any wording counsel changes.

### Task 9.7.6: Governed per-employer compliance lookup (`gov` only) ✅ 2026-05-24 (ships dormant)
- [x] **Access:** double-gated. `verifyGov()` for role + 2FA, AND `feature_flag_employer_mix_lookup ===
      true` for the dormant flag. The Server Action re-checks the flag (defence in depth), so the page
      can never accidentally bypass policy if a future refactor forgets a check.
- [x] **Input is exact-match only.** Form has two fields  org name OR CIPC registration number  and
      submitting requires EXACTLY one filled. The other is disabled while one is being typed (UX hint
      that they are mutually exclusive). Name match is `ILIKE` with no wildcards (case-folded equality);
      registration number is strict `=`. No autocomplete, no faceted browse, no list endpoint at any
      layer  the query layer literally has no `ORDER BY` or `LIMIT` that pages employers by mix.
- [x] **Small-numbers guard (hard):** when the org is found, the placement count is fetched. If count
      `< employer_mix_min_placements` (default 5), the result returns `aboveFloor: false`  the UI
      surfaces the *count* but **never** the SA-citizen / foreign-national split. The audit log still
      records the raw count for the regulator-of-the-regulator (visible only via admin audit-log + the
      9.7.7 oversight log).
- [x] **Purpose-bound:** reason enum (`esa_s8_compliance` / `incentive_verification` / `mandated_audit`
      / `other`). `other` requires a free-text note ≥ 5 chars. Reason + actor + employer + timestamp +
      placement count + above-floor flag + floor value all written to `gov.employer_mix.lookup` audit
      row. No reason  no result (validated server-side; the form blocks submit too).
- [x] ESA §8 framing per D2 baked into the page header strip ("What this surface is, and what it
      isn't"). Counsel-review caveat (DPIA R9) printed beneath.
- [x] Freshness note (first hire  last hire date range + employer-confirmed-only disclaimer) shown
      alongside the above-floor split. Below-floor result is a clear amber notice explaining the
      suppression, not a sterile "no data."
- [x] Dormant notice when the flag is off: the page still renders (so URLs handed off after activation
      work), with an honest "dormant by default" panel explaining the activation path and the audit-log
      contract that fires from the first test query after the flip.
- [x] New nav entry "Per-employer lookup" (FileSearch icon) added to `GOV_NAV` and shows regardless of
      flag  the dormant page is informative, not a broken link. Surface the platform's capability
      transparently rather than hide it as a "secret feature."
- [x] Files: `lib/gov/employer-lookup.ts` (Server Action), `lib/gov/employer-lookup-types.ts` (types +
      reason catalog), `components/feature/gov/EmployerLookupForm.tsx` (client form + result panel),
      `app/[locale]/(gov)/gov/employer-lookup/page.tsx` (page shell + dormant notice), settings + audit
      kind + admin toggle row, migration `0013_phase9_7_employer_mix_lookup_flag.sql` (seed false).
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean · migration
      0013 applied to Neon. Commit `<TBD>`.

### Task 9.7.7: Sensitive-query oversight log (watch the watchers)
- [ ] An `/admin` view surfacing all `gov.employer_mix.lookup` + nationality-split export events from the
      audit log — who ran a sensitive nationality query, when, against whom, with what stated reason.
- [ ] Filterable (actor, date, employer) + reuses the Phase 7 audit-log-filter + CSV pattern.
- [ ] **Trust rationale:** giving `gov` a powerful lens is safe *because* its use is itself observable.
      This is the governance signal that makes DEL comfortable adopting it — and the honest answer to
      "couldn't this be abused?" is "every use is logged and reviewable."

### Task 9.7.8: Scheduled LMI / nationality brief for `gov` (kept in scope)
- [ ] Reuse `/insights/print` print-CSS + the LMI cron infra. Minimum viable: a `/gov/brief` print-CSS
      page (the cron-to-PDF + email distribution is the optional extension). The recurring artifact
      is the *point* — the data without it is invisible to policy users.
- [ ] Compose: LMI headline + shortage / opportunity highlights + suppressed nationality dimension.
- [ ] No new infra; assembly of existing pieces.

### Task 9.7.9: Wiring, verification, doc convention
- [ ] All new strings in `messages/en.json`; `zu/xh/af` deepMerge fallback (full translation Phase 10).
- [ ] Extend `lib/analytics/*-compliance.ts` assertions:
      (a) no nationality cell below k anywhere, including exports;
      (b) no endpoint returns employers ranked/sorted by nationality mix;
      (c) per-employer split never returned below `employer_mix_min_placements`;
      (d) every `gov.employer_mix.lookup` carries a reason;
      (e) **no API path exposes raw `nationality` (country-level) in any list/aggregate response — only
      `nationality_class`** (structural defence against country-level analytics regressions).
      Exposed via the admin-only compliance endpoint; wired into the Phase 11.4 runner.
- [ ] `npm run build` clean (typecheck + lint + static gen × 4 locales). Smoke-test new `/gov` + `/admin` routes 200.
- [ ] Seed: a couple of foreign-national profiles + a mixed-nationality placement set on a seeded org so
      the Justification Index, self-view, and governed lookup all render a real (suppressed) row out of the box.
- [ ] On ship: `docs/completed/PHASE_9_7_COMPLETE.md`; tick the 9.7 header in `ROADMAP.md` ✅ + date;
      refresh **Current State** in `TO_START_EVERY_SESSION.md`; confirm `docs/PHASE_10_PLAN.md`; commit
      `Phase 9.7 complete + Phase 10 opens`.

---

## 🔓 STILL-OPEN QUESTIONS (carry through implementation, decide on data)

Most of the original open questions are resolved (see **DECISIONS CLOSED** above). One operational
question remains, and one external dependency:

1. **D4 default value review** — `employer_mix_min_placements = 5` is the start. Re-assess at every
   Phase boundary based on actual placement volume. Raise the floor if median per-employer placement
   count climbs significantly.
2. **D2 counsel sign-off (DPIA R9)** — the EEA §1 / ESA §8 framing is the engineering team's reading.
   Counsel review must close before any 9.7.5 or 9.7.6 public-facing copy ships. 9.7.1–9.7.4 are
   unaffected and can proceed in parallel.

## 🚫 OUT OF SCOPE FOR 9.7 (explicit guardrails — do not build)
- ❌ **Any public or cross-employer "nationality league table"** or endpoint that ranks/sorts employers by
  foreign-national count. This is the xenophobia-weapon artifact; it does not exist in the codebase.
- ❌ **Country-level nationality analytics** — analytics use the 2-class `sa_citizen` / `foreign_national`
  split only; raw country stays on the redacted individual profile. Structurally enforced by compliance
  assertion (e) above.
- ❌ **Per-employer mix below the small-numbers floor** — no exceptions, including for `gov`/`admin`.
- ❌ Changing the **search-side nationality filter** — it is shipped and correct; this phase does not touch it.
- ❌ Surfacing nationality analytics on any **seeker/employer/public** surface (gov/admin only).
- ❌ **Partial-match / autocomplete / browse** on the 9.7.6 employer lookup — exact-match string only.
- SAQA / Home Affairs nationality verification — stays with the dormant Phase 8 adapters. The
  `is_citizen` field's verification quality is what it is (self-declared); the DPIA reflects that.

---

## 🧭 WHY THIS IS THE SEBENZA VERSION
The naive build is "filter and rank employers by how many foreigners they hire." That's a targeting tool.
This phase keeps the genuine value the operator asked for — local-hiring intelligence, the shortage
justification that *defends* both local hiring and necessary foreign hiring with evidence, and an
employer's legitimate view of their own mix — while structurally preventing the weaponised version through
**five** mechanisms: the **2-class split** (no country-level targeting, structurally asserted), the
**inherited k=10 + complementary suppression** (no individual re-identification), the **small-numbers
floor at employer granularity** (the sharp edge the market views don't have), the **dormant-by-default
flag on the per-employer lookup** (activation paired with a real DEL §8 mandate), and the **oversight
log** (every sensitive query is itself watched). The capability serves policy; it cannot become a list.

*Plan opened 2026-05-23. Open questions closed 2026-05-24. Target: complete before Phase 10 (public launch) opens.*
