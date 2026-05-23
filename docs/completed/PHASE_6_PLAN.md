# Phase 6  Analytics & Skills-Gap Intelligence · 📋 PLAN (opened 2026-05-23)

> Active plans live at the top of `docs/`. When this phase ships, this file moves to `docs/completed/PHASE_6_PLAN.md` and `docs/completed/PHASE_6_COMPLETE.md` is written.

**Goal:** The government wedge. Take everything Phase 4 + Phase 5 logged (`profiles`, `search_events`, `placements`, `audit_log`) and produce honest, real-time workforce analytics  counts and trends weighted by freshness, plus the **skills-gap signal**: what employers SEARCH for vs what's AVAILABLE. This is the pitch deck that wins the partnership conversation.

---

## Re-checks (decide before kickoff)

### Re-check #1  Materialised analytics rollups
The Phase 4 `analyticsSnapshotQuery` re-aggregates on every visit. Fine for 8 seeded profiles, ruinous at scale. Phase 6 introduces 2–3 small materialised views (or hourly cron-rebuilt tables) so the `/insights` page reads from cached aggregates, with a "last computed: 12 min ago" indicator. The ISR window stays at 5 min for the page itself.

### Re-check #2  Skills-gap formula
`searches` per profession/skill comes from `search_events`. `matches` comes from `profile_skills × profession`. Gap = `searches - matches`, weighted by freshness. Phase 4 has a placeholder; Phase 6 elevates it to the headline insight: **a queryable, per-province, per-skill skills-gap dashboard**.

### Re-check #3  Time series weighted by freshness
Trend counts (`registrations`, `placements`, `status_changes`) already work. Add a fourth: `fresh_active = profiles WHERE freshness_band = 'fresh'`. This is the number policymakers actually want.

### Re-check #4  Government export
CSV + signed-PDF exports of aggregate (never per-PII) stats. Each export writes an `analytics.export` audit row with the requested cuts. Phase 8 hooks Resend so the export emails the requester instead of streaming.

### Re-check #5  Career compass wires to real demand
Phase 3's `/dashboard/grow` reads from `lib/mock/growth.ts`. Phase 6 replaces it with a real query: for the seeker's profession + province, surface the top N skills by `gap_size` from the skills-gap view, ranked by projected impact (the same blend as search but inverted: scoring skills by "what would lift me most").

### Re-check #6  Searchability of new filters
The `open_to_internships` / `open_to_graduate_programmes` filter UI deferred from Phase 4/5 lands here as part of the search filter polish that the analytics surface needs.

### Re-check #7  Doc convention (unchanged)

---

## Implementation plan

### 1. Rollup tables / materialised views (~60 min)
- `mv_demand_by_profession` (skill, province, searches, matches, gap, freshness_avg)
- `mv_supply_by_status` (status, province, count, freshness_confidence)
- `mv_placements_monthly` (yyyy-mm, count, top_orgs, top_professions)
- Refresh function `sebenza_refresh_analytics()` run hourly (cron in Phase 8 wires this; for now refresh on every `/insights` ISR cycle when data is stale)

### 2. Query layer extensions (~45 min)
- `db/queries/analytics.ts`  extend with `skillsGap(province?, top?)`, `demandHotspots(profession)`, `trendByMonth(months)`
- `db/queries/career-compass.ts`  `topGrowthSkillsForProfession(profession, currentSkills)`

### 3. `/insights` page rebuild (~90 min)
- Replace existing charts with: gap heatmap (province × profession), demand-vs-supply table top 20, freshness-weighted status pie, monthly placement trend
- "Export CSV" button → action that streams aggregated CSV + writes `analytics.export` row
- "Last refreshed" badge with relative timestamp

### 4. Career compass real wire-up (~45 min)
- `getCompassForHandle` becomes `getCompassForProfile(profile)` reading from real demand data
- Adjacent professions derived from `profile_skills` overlap analysis
- Existing UI stays; only the data source flips

### 5. Search-side filter polish (~30 min)
- Add `openToInternships` + `openToGraduateProgrammes` to `SearchFilters` + the search query
- Filter UI on `/search`

### 6. Verification + commit (~30 min)

---

## Acceptance criteria (Phase 6 is DONE when every box ticks)

- [ ] `/insights` shows real province × profession heatmap from live data
- [ ] Top 20 demand-vs-supply table reflects actual `search_events` + `profile_skills`
- [ ] "Export CSV" button produces a downloadable file + `analytics.export` audit row
- [ ] Career compass `/dashboard/grow` reads from the real demand query (not `lib/mock/growth.ts`)
- [ ] `/search` has working "open to internships" + "open to graduate programmes" toggles
- [ ] `npm run build` clean

---

## Out of scope for Phase 6

- **Cron-driven refresh of rollups + saved-search alert emails** → Phase 8 (Resend + scheduled jobs)
- **2FA enforcement** → Phase 7
- **SAQA / Home Affairs adapters** → Phase 8
- **Public PDF policy reports** → could land here or defer to Phase 9 launch readiness

---

## Risks to flag at kickoff

- **Materialised views in Neon have refresh-lock implications.** For small data this is invisible; for scale we may need to use the cron-rebuild pattern (delete + insert in a tx) instead. Decide on first migration.
- **Skills-gap query needs careful indexing.** Add a GIN/btree on `search_events.terms` + indices on `profile_skills.skill_slug` before running on production-scale data.
- **CSV export size could blow up.** Cap export at top-N rows; offer "request full export by email" for the big slice (Phase 8 hooks it).

---

*When this ships: write `docs/completed/PHASE_6_COMPLETE.md` and open `docs/PHASE_7_PLAN.md` (admin shell + 2FA enforcement).*

---

## Overlap note with `PHASE_7_PLAN.md` (admin)

The post-Phase-5 audit (`docs/PHASE_7_PLAN.md` section A.7) already lists `/insights` "Export CSV" as a fix. Owner: whichever phase ships first wires it. If Phase 6 lands first, the export becomes part of the analytics rebuild here and Phase 7 just removes that bullet. If Phase 7 lands first (less likely  Phase 6 is next), Phase 6's analytics page just consumes the export pattern already established. Coordinate before starting either.
