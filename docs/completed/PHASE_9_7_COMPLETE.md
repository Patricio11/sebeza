# Phase 9.7  Nationality Analytics & Local-Hiring Intelligence · ✅ COMPLETE (2026-05-24)

Side-phase between Phase 9 and Phase 10. Turns nationality from a *search filter* (shipped, unchanged) into a *governed policy lens*: an anti-xenophobia tool by construction, framed on Employment Equity Act 55/1998 §1 and Employment Services Act 4/2014 §8.

Companion docs: `PHASE_9_7_PLAN.md` (this `/docs/completed/` directory), `docs/popia/DPIA.md` (R9 added with this phase), `docs/ROADMAP.md`, `docs/TO_START_EVERY_SESSION.md`.

---

## The headline

Same dataset, two truths, in the language government acts on:

- **`/gov/shortage`**  where the local pool isn't there to fill, so ESA §8 enforcement would be cruel; policy response is training investment.
- **`/gov/opportunity`**  where SA-citizen supply can plausibly meet demand; ESA §8 has practical force here.

Both views run on **one** classifier (`classifyJustification`, pure function, 11 vitest fixtures encoding the rule). The rule itself is published verbatim on `/gov/shortage` so government can argue with the thresholds rather than the model  every threshold is tunable from `/admin/settings`.

---

## Five structural defences (the "Why this is the Sebenza version")

The naive build is "filter and rank employers by how many foreigners they hire." That's a targeting tool. This phase keeps the genuine value the operator asked for while structurally preventing the weaponised version through five mechanisms:

| Mechanism | Where it lives | What it blocks |
|---|---|---|
| **2-class split** (sa_citizen / foreign_national, never raw country) | `db/queries/nationality.ts` + compliance assertion (e) | Country-level targeting + faster re-identification |
| **k=10 + complementary suppression** | `lib/analytics/suppress.ts` (extracted in 9.7.1) + `outcomes_min_cohort_size` setting | Individual re-identification in market views |
| **Small-numbers floor at employer granularity** | `employer_mix_min_placements` (default 5) | Re-identification on per-employer views, where cells are tiny |
| **Dormant-by-default flag on per-employer lookup** | `feature_flag_employer_mix_lookup` (default OFF) | Activation paired with a real DEL §8 partnership |
| **Oversight log** | `/admin/oversight` + `gov.employer_mix.lookup` audit kind | "couldn't this be abused?" → "every use is logged and reviewable" |

Compliance assertion (a) "no nationality cell below k" + (e) "no raw country in any aggregate response" enforce two of these structurally at runtime  they fail loudly the moment a regression sneaks past code review.

---

## What shipped

### 9.7.1  Reusable suppression utility ✅
- `lib/analytics/suppress.ts`  generic `suppress(rows, { countKey, k, axes })` with k-floor + per-axis complementary suppression.
- 11 unit fixtures in `lib/analytics/suppress.test.ts` codifying the contract (boundary conditions + multi-survivor non-derivable + lone-survivor + group independence + row+col-pass independence).
- vitest added as devDep + `npm test` / `npm run test:watch` scripts (Phase 11.4 will formalise the runner).
- `outcomesQuery()` refactored to declare its two axes and call `suppress()` once. ~50 lines of dead helpers removed. Zero behaviour change.

### 9.7.2  Nationality dimension on market analytics ✅
- `db/queries/nationality.ts`  `supplyByNationalityQuery({ province? })` + `statusMixByNationalityQuery()`. Both routed through `suppress()` with appropriate complementary axes.
- Toggle on `/gov` overview (status mix) + `/gov/provinces/[slug]` (supply heatmap) via `?split=nationality`.
- `/api/gov/nationality-mix/export?dim=supply|status&province?=` CSV with suppression-inside-the-query (URL bypass impossible).
- Shared CSV helper extracted to `lib/analytics/csv.ts` (`safeCell`, `csvFromRows`, `csvDisposition`)  audit-log + outcomes + nationality routes all share one encoder.
- Compliance assertion (a) `assertNoNationalityCellBelowFloor()` wired into `/api/admin/outcomes-compliance`.

### 9.7.3  Skills-Shortage Justification Index ✅
- Pure `classifyJustification()` classifier (lib/analytics/justification.ts)  three inputs, four thresholds, three labels per D1. 11 vitest fixtures.
- `justificationIndexQuery({ province? })`  demand from `COUNT(DISTINCT actor_org_id)` on search_events (anti-inflation), freshness-weighted SA supply, employer_confirmed placement split.
- `/gov/shortage` page with the formula published verbatim at the top, province filter chips, classified table with per-cell tooltip carrying the three component values + raw counts, drill-down to `/search`.
- Four new `platform_settings` knobs (migration `0012`): `lmi_demand_floor (1.0)`, `lmi_local_supply_threshold (0.5)`, `lmi_foreign_fill_floor (0.5)`, `employer_mix_min_placements (5)`. All tunable in `/admin/settings`. Zod bounds prevent silly values.
- `/api/gov/justification-index/export?province?=` CSV.
- New nav entry "Shortage justification" (Scale icon).

### 9.7.4  Local-Hiring Opportunity Map ✅
- `/gov/opportunity` reuses `justificationIndexQuery()` (no new query) and filters to `supply_available` cells.
- `<OpportunityHeatmap>`  CSS Grid + brand colour, no map libraries (No-Flash Rule). Grouped by province; bars normalised across provinces.
- ESA §8 framing strip names the Act explicitly; cross-references `/gov/shortage` for the complement.
- New nav entry "Local-hiring opportunity" (Sprout icon).

### 9.7.5  Employer self-view ✅
- `employerOwnMixQuery(orgId)`  strictly scoped to the caller's own org. Three CTEs for total/byRole/byCity, joins to profiles for `is_citizen`. No k-floor on self-data.
- `<EmployerHiringMixCard>` on `/employer` overview: headline tiles, single-bar split, role + city breakdown.
- EEA §1 + ESA §8 framing copy + EEA-1 disclaimer one-liner. **Visible DRAFT banner** until counsel sign-off on DPIA R9  single-line removal in `<DraftBanner />` when that lands.
- New audit kind `employer.own_mix.view` logged on every render.

### 9.7.6  Per-employer governed lookup ✅ (SHIPS DORMANT)
- `lib/gov/employer-lookup.ts` Server Action  double-gated (`verifyGov` + `feature_flag_employer_mix_lookup`), exact-match input only (org name OR CIPC reg number, mutually exclusive), purpose-bound (reason enum + free-text note for "other"), small-numbers guard via `employer_mix_min_placements`.
- Every call writes `gov.employer_mix.lookup` audit row with reason + count + above-floor flag.
- `/gov/employer-lookup` page renders an informative dormant notice when off, the form + result panel when on.
- ESA §8 framing strip ("what this is / what it isn't") + DPIA R9 caveat.
- New nav entry "Per-employer lookup" (FileSearch icon).
- Migration `0013` seeds flag as `false`. Activation pairs with a real DEL §8 partnership workflow.

### 9.7.7  Sensitive-query oversight log ✅
- `/admin/oversight` surfaces every `gov.employer_mix.lookup` + nationality-related `analytics.export` row. Filters: actor / employer (exact name) / date range.
- Summary tiles row at top with the anomaly-watch tile (below-floor + not-found, accent-toned).
- Per-row outcome chips + reason + placement count + floor + full meta JSON drill-down.
- `/api/admin/oversight/export` CSV with lookup meta exploded into discrete columns.
- Migration `0014` adds `(at DESC)` + `(kind, at DESC)` indices on `audit_log` (table had been seq-scanning since Phase 7).
- New ADMIN_NAV entry "Oversight log" (ShieldAlert icon).

### 9.7.8  Government policy brief ✅
- `/gov/brief` print-CSS page reuses the `/insights/print` pattern + `<PrintActions />` for one-tap browser Print → Save as PDF.
- Composes existing pieces: LMI headline (9.4) + top 10 shortage cells (9.7.3) + top 10 opportunity cells (9.7.4) + national status-mix table (9.7.2).
- New nav entry "Policy brief" (FileText icon) + prominent CTA on `/gov` overview pageActions.
- `robots: { index: false, follow: false }` so crawlers don't index a policy-sensitive print artefact.
- Cron + email distribution deferred (the page IS the artefact; scheduling is the optional extension).

### 9.7.9  Wiring + closeout ✅
- **5th compliance assertion**: `assertNoRawCountryInAnalytics()` walks each nationality-bearing analytics query's returned cells and fails if any key is literally `nationality`. Wired into `runAll()` + `/api/admin/outcomes-compliance`.
- **Seed extended**: `seedPhase9_7NationalityDemo()` adds 4 foreign-national profiles (Tendai/Zim welder, Chiamaka/Nigerian dev, Kemi/Nigerian dev, Aisha/Kenyan chef), 2 of them placed at Discovery (which now sits at the per-employer floor of 5: 60% SA / 40% foreign for the demo), and 12 distinct synthetic search-events driving demand for (Software developer, Gauteng) so that cell classifies as `supply_available` out of the box.
- Counsel-review caveat for D2 copy carried in:
  - `<EmployerHiringMixCard>` (visible DRAFT banner)
  - `/gov/employer-lookup` page framing strip
  - `/gov/opportunity` framing strip
  - `/gov/brief` footer
  - DPIA R9 (formal record)

---

## Closed open questions (D1D4, 2026-05-24)

| ID | Question | Resolution |
|---|---|---|
| D1 | Justification Index thresholds | Four explicit knobs published verbatim on `/gov/shortage`, all tunable in `/admin/settings`: demand_floor=1.0, local_supply_threshold=0.5, foreign_fill_floor=0.5, min_placements=5 |
| D2 | EEA / nationality legal mapping | Reframed on EEA 55/1998 §1 (Black-people designation applies only to SA citizens) + ESA 4/2014 §8 (reasonable-efforts-to-hire-locally evidence). Counsel review of the wording tracked as DPIA R9 |
| D3 | Per-employer lookup mandate scope | Ships dormant behind `feature_flag_employer_mix_lookup`. Same dormant-by-default posture as KYC + SAQA. Activation pairs with formal DEL partnership workflow |
| D4 | `employer_mix_min_placements` default | 5. Re-assess at every Phase boundary based on placement-volume growth |

---

## Tests + verification

- **22/22 vitest fixtures green** (11 suppress + 11 classifier).
- **`npm run typecheck`** clean.
- **`npm run build`** clean.
- **`/api/admin/outcomes-compliance`** returns all six assertions ✓:
  1. `no-cohort-below-floor`
  2. `unconsented-never-appears`
  3. `seeker-reported-excluded`
  4. `work-availability-publicly-safe`
  5. `no-nationality-cell-below-floor`
  6. `no-raw-country-in-analytics`
- **Migrations 0012 + 0013 + 0014 applied** to Neon.
- **Seed re-applied**  fresh `npm run db:seed` populates the demo dataset.

---

## What this gives the government pitch

| Surface | What a policy user sees |
|---|---|
| `/gov` | LMI hero · top unfilled-demand skills · freshness summary · **status mix toggle (split by SA-citizen / foreign-national)** · outcomes signpost · prominent "Policy brief (print)" CTA |
| `/gov/shortage` | Formula published verbatim · classified table · per-cell tooltip with the three component values · drill-down to `/search` |
| `/gov/opportunity` | ESA §8 framing · grouped-by-province opportunity heatmap · drill-down per cell |
| `/gov/provinces/[slug]` | Province deep dive + nationality split toggle |
| `/gov/employer-lookup` | Dormant notice today. Exact-match form + small-numbers-guarded result panel once activated |
| `/gov/brief` | Single A4 print artefact for meetings: LMI + top shortages + top opportunities + national nationality breakdown |
| `/gov/exports` | CSV downloads of all of the above |
| `/admin/oversight` | Watch-the-watchers: every sensitive query, who ran it, against whom, with what reason. Anomaly-watch tile flags fishing patterns |

---

## Files added / changed

**Engine + types**
- `lib/analytics/suppress.ts` (9.7.1)
- `lib/analytics/suppress.test.ts` (9.7.1)
- `lib/analytics/justification.ts` (9.7.3)
- `lib/analytics/justification.test.ts` (9.7.3)
- `lib/analytics/csv.ts` (9.7.2)
- `lib/analytics/outcomes-compliance.ts` (5th + 6th assertion added)
- `lib/analytics/outcomes.ts` (9.7.1 refactor)
- `lib/gov/employer-lookup.ts` (9.7.6 Server Action)
- `lib/gov/employer-lookup-types.ts` (9.7.6 shared types)
- `lib/gov/oversight-query.ts` (9.7.7)
- `lib/audit/index.ts` (2 new audit kinds)
- `lib/admin/settings.ts` + `settings-actions.ts` (5 new setting keys)

**Queries**
- `db/queries/nationality.ts` (9.7.2)
- `db/queries/justification.ts` (9.7.3)
- `db/queries/employerMix.ts` (9.7.5)

**Pages**
- `app/[locale]/(gov)/gov/page.tsx` (status-mix toggle + brief CTA)
- `app/[locale]/(gov)/gov/provinces/[slug]/page.tsx` (supply split toggle)
- `app/[locale]/(gov)/gov/shortage/page.tsx` (new)
- `app/[locale]/(gov)/gov/opportunity/page.tsx` (new)
- `app/[locale]/(gov)/gov/employer-lookup/page.tsx` (new)
- `app/[locale]/(gov)/gov/brief/page.tsx` (new)
- `app/[locale]/(gov)/gov/exports/page.tsx` (3 new cards)
- `app/[locale]/(admin)/admin/oversight/page.tsx` (new)
- `app/[locale]/(employer)/employer/page.tsx` (mix card wire-up)

**API routes**
- `app/api/gov/nationality-mix/export/route.ts` (new)
- `app/api/gov/justification-index/export/route.ts` (new)
- `app/api/admin/oversight/export/route.ts` (new)
- `app/api/admin/outcomes-compliance/route.ts` (2 new assertions wired)
- `app/api/admin/audit-log/export/route.ts` (refactored to shared CSV helper)
- `app/api/insights/outcomes/export/route.ts` (refactored to shared CSV helper)

**Components**
- `components/feature/gov/NationalityStatusMixCard.tsx` (new)
- `components/feature/gov/NationalitySupplyTable.tsx` (new)
- `components/feature/gov/JustificationTable.tsx` (new)
- `components/feature/gov/OpportunityHeatmap.tsx` (new)
- `components/feature/gov/EmployerLookupForm.tsx` (new)
- `components/feature/employer/EmployerHiringMixCard.tsx` (new)
- `components/feature/admin/SettingsForm.tsx` (5 new rows)
- `components/layout/govNav.ts` (4 new entries)
- `components/layout/adminNav.ts` (1 new entry)

**Migrations** (all applied to Neon)
- `0012_phase9_7_lmi_thresholds.sql`  4 Justification Index threshold seeds
- `0013_phase9_7_employer_mix_lookup_flag.sql`  dormant flag seed
- `0014_phase9_7_audit_log_indices.sql`  `(at DESC)` + `(kind, at DESC)` indices

**Seed**
- `db/seed.ts`  `seedPhase9_7NationalityDemo()` (4 foreign profiles + 2 mixed placements + 12 demand-signal search events)

**Docs**
- `docs/popia/DPIA.md`  R9 (legal-framing claims pending counsel review)
- `docs/PHASE_9_7_PLAN.md` → moved to `docs/completed/`
- `docs/completed/PHASE_9_7_COMPLETE.md` (this file)
- `docs/ROADMAP.md`  9.7 ticked
- `docs/TO_START_EVERY_SESSION.md`  Current State refreshed

---

## Reframing decision  2026-05-24 (post-operator review)

The first draft framed the employer self-view + the gov per-employer
lookup + the opportunity / shortage / brief pages around two specific
South African statutes: **Employment Equity Act §1** (designated-group
qualification  uses the term "Black people") and **Employment Services
Act §8** (reasonable-efforts to recruit South African citizens, enforced
by the Department of Employment & Labour).

The operator (Patricio) called this out the moment it surfaced in
public-facing copy review. Two distinct concerns, both correct:

1. **Racial framing on a national platform.** Sebenza is for every South
   African worker. Pulling EEA §1's "Black people" definition into the
   platform's copy drags racial categories into a tool whose product
   line is non-racial by design.
2. **Overclaiming a regulatory relationship.** Citing ESA §8 + DEL by
   name implies a partnership / sanctioned-evidence-trail role that
   does not exist today. If a regulator ever formally asks for tailored
   framing, that lands as its own intentional, counsel-reviewed change
   rather than as a default copy choice.

**Outcome**: every user-facing surface was reframed to neutral
policy-intelligence + employer-records language **on the same day Phase
9.7 closed**. The DRAFT banner on `<EmployerHiringMixCard>` came off
(removed entirely; not needed). The reason-enum on the per-employer
lookup dropped `esa_s8_compliance` in favour of `compliance_check`.
DPIA R9 was revised to record the reframing as the mitigation  the
legal-claims-unverified risk is now formally addressed by the *absence*
of those claims in the platform's copy.

**What's preserved**: every structural defence (2-class split,
k-anonymity floor, complementary suppression, employer-min-placements
floor, dormant-by-default flag, audit log on every gov query, oversight
log). Those don't depend on the legal framing; they remain the trust
posture.

**What's gone**: EEA §1 + "Black people" + ESA §8 + DEL references on
any user-facing surface or audit-log enum value. Code comments retain
historical context (the journey is honest) but UI strings do not.

Reframing commit: `<TBD>` (this commit). Original framing decision
recorded in [PHASE_9_7_PLAN.md](PHASE_9_7_PLAN.md) §D2 as the historical
record of what was considered.

---

## Outstanding (not in Phase 9.7's scope)

1. **`feature_flag_employer_mix_lookup` activation**  pairs with a
   concrete operational need rather than a hypothetical partnership.
   Engine + UI built and tested; flag-flip in `/admin/settings` is the
   activation step. The dormant page itself renders an informative
   notice so users handed the URL after activation get the right
   context.
2. **9.7.8 cron + email distribution**  recurring monthly brief
   delivery. The page is the artefact today; the LMI nightly cron is
   the template when scheduling lands.
3. **Genuine "Local shortage" classifications**  require more diverse
   employer-confirmed placement data than is reasonable to seed
   synthetically. Will emerge organically as more employers log hires
   across more (profession × province) cells. The seed currently lights
   up *Local supply available* classifications cleanly; *Local shortage*
   awaits real data.

---

## What's next

Phase 10  the public-launch phase. WCAG 2.2 AA audit, performance budget on throttled 3G, full Tier-1 + Tier-2 + Tier-3 localisation rollout. Sebenza is launch-ready against the current Neon (EU) DB; AWS Cape Town migration is a turnkey one-day swap per `docs/AWS_MIGRATION_RUNBOOK.md` when partnership confirms.

*Phase 9.7 opened 2026-05-23, closed 2026-05-24.*
