# Phase 6 — Analytics & Skills-Gap Engine · ✅ COMPLETE

**Shipped:** 2026-05-23

> The government wedge. `/insights` becomes a real workforce-intelligence surface — skills-gap signal from `search_events × profile_skills`, a province × profession supply heatmap, freshness-band breakdown (the "data you can trust" honesty bar), and a working CSV export with an audit trail. Career compass on `/dashboard/grow` stops reading from `lib/mock/growth.ts` and now derives recommendations from live demand against the controlled skill taxonomy, scoped to the seeker's profession + province.

---

## 1 · What shipped

### Query layer extensions ([`db/queries/analytics.ts`](../../db/queries/analytics.ts))
- **`skillsGapQuery({ province?, top? })`** — returns `SkillsGapRow[]` with `searches`, `matches`, `freshMatches` (freshness-weighted supply via `sebenza_freshness_confidence`), and signed `gap`. Optional province scope on supply; demand stays national.
- **`supplyHeatmapQuery()`** — sparse (province × profession) cells with `supply` count + average `freshness`. Frontend builds the matrix.
- **`freshnessBreakdownQuery()`** — counts active profiles bucketed `fresh / ageing / stale` (matches `lib/status.ts` band definitions). Drives the "Data freshness" tiles.

### Career compass on real data ([`db/queries/career-compass.ts`](../../db/queries/career-compass.ts))
- **`getCompassForProfile(profile)`** returns the same `CompassSnapshot` shape that `lib/mock/growth.ts` exposed — so the UI doesn't change — but composes it from three live queries:
  1. **Demand-driven recommendations:** skills the seeker doesn't have, ranked by recent (90d) search-term frequency that hits the skill label
  2. **Peer-pattern recommendations:** skills common to higher-completeness profiles in the same profession + province (the "common_among_top_ranked" reason chip)
  3. **Adjacent professions:** skill-overlap heuristic — for every other profession, what % of its skill set the seeker already has; ≥40% overlap surfaces as a reachable adjacent role with missing-skills chips
- Static SA-grounded learning paths (SETA / TVET / INDLELA / SAQA) stay from the curated catalog — Phase 7 admin/taxonomy lets admins manage that list, at which point it moves to a DB table

### Both seeker surfaces now use the real compass
- `/dashboard/grow` — full career compass page (recommendations + learning paths + adjacent professions + city demand table)
- `/dashboard` — the "Career compass · highest-leverage skill" tile on the overview reads the same data

### `/insights` page rebuilt ([`app/[locale]/(public)/insights/page.tsx`](../../app/%5Blocale%5D/(public)/insights/page.tsx))
Three new sections layered on the existing trend + status table:
- **Freshness band tiles** — three big tiles (Fresh / Ageing / Stale) with percentage of total. The "data you can trust" headline made concrete.
- **Skills gap · demand vs supply** — top-20 table with searches, matches, freshness-weighted matches, and signed gap visualised as a bar (red when demand > supply, green when oversupply). Honest empty state when search activity is too low.
- **Supply heatmap · province × profession** — dynamic top-N matrix (N derived from data so the grid is never larger than what's populated). Background opacity scales with supply count; cells without data show a dim "·". Title tooltip surfaces "n profiles · X% fresh" per cell.

### CSV export action ([`lib/analytics/export.ts`](../../lib/analytics/export.ts))
- `exportInsightsCsv()` Server Action — composes a multi-section CSV (status / skills-gap / heatmap / freshness / trend), each section preceded by a section header row for grep-ability.
- Writes an `analytics.export` audit-log row with `meta.scope = "insights"` + `rowCount` + `generatedAt` — the export itself is a PII-touching event we want traceable.
- **10k-row cap** — bigger slices return a friendly fail with a "Phase 8 'email me the file' flow lands then" message. We never silently truncate.
- ([`components/feature/InsightsExportButton.tsx`](../../components/feature/InsightsExportButton.tsx)) client island handles the Blob → `<a download>` → revoke dance.

### Search filter polish — `openToInternships` + `openToGraduateProgrammes`
- `SearchFilters` type ([`lib/mock/types.ts`](../../lib/mock/types.ts)) extended.
- `searchProfilesQuery` ([`db/queries/profiles.ts`](../../db/queries/profiles.ts)) honours both filters via an `EXISTS (SELECT 1 FROM academic_profiles …)` clause — keeps the select-list redaction clean.
- `/search` page ([`app/[locale]/(public)/search/page.tsx`](../../app/%5Blocale%5D/(public)/search/page.tsx)) reads them from `?internships=1&graduates=1`.
- `SearchFilters` filter UI ([`components/feature/SearchFilters.tsx`](../../components/feature/SearchFilters.tsx)) gets a new "Early-career opt-ins" filter group with both checkboxes + honest copy ("strictly opt-in by the seeker; never default; never inferred").

### Tier-2 audit carryovers fixed
- Landing "Confirmed hires · May" → now `Intl.DateTimeFormat` of current month on `/insights` (the same hardcoded label appeared there too)

---

## 2 · Re-checks honoured (from `docs/completed/PHASE_6_PLAN.md`)

| # | Decision | Outcome |
|---|---|---|
| 1 | Materialised analytics rollups | ⏳ Deferred — at our scale regular queries + ISR (5-min) are fast enough. `lib/status.ts` rebuild docstring flags Phase 9 perf-pass to swap views → materialised views with concurrent refresh when data grows |
| 2 | Skills-gap formula = `searches - matches`, freshness-weighted | ✅ `skillsGapQuery` returns signed gap + `freshMatches` (freshness-weighted) |
| 3 | Time series weighted by freshness — add `fresh_active` | ✅ `freshnessBreakdownQuery` exposes fresh/ageing/stale per-bucket; surfaced as the "Data freshness" tiles |
| 4 | Government CSV export | ✅ Real export with audit row; 10k cap; Phase 8 email-the-file flow noted in fail message |
| 5 | Career compass wires to real demand | ✅ `getCompassForProfile` replaces `getCompassForHandle` on both `/dashboard` + `/dashboard/grow` |
| 6 | `open_to_internships` / `open_to_graduate_programmes` search filter | ✅ Honoured by `searchProfilesQuery` via EXISTS join; UI shipped on `/search` |
| 7 | Doc convention | ✅ This file + Phase 7 plan already open + ROADMAP tick + commit |

---

## 3 · Verification

- **Typecheck:** ✅ clean (`npx tsc --noEmit`)
- **Build:** ✅ clean — `/insights` still SSG + `revalidate: 300`, `/search` + `/dashboard/grow` still dynamic (ƒ)
- **Live DB smoke (against Neon):**
  - `skillsGapQuery({ top: 8 })` returns Chef (gap -3), Software Developer (-2), Electrician/Nurse/Accountant (-1 each) — negative gaps mean oversupply at our seeded scale; sign flips as real employer search activity accumulates
  - `supplyHeatmapQuery()` returns the expected 5 cells (Gauteng × Software Developer + Electrician, KZN × Nurse, Western Cape × Chef + Accountant)
  - `freshnessBreakdownQuery()` returns `fresh: 7, ageing: 0, stale: 1` (Sipho confirmed Jan 2026 is the only stale)
  - `getCompassForProfile(Andile)` returns demand-driven recommendations + adjacent professions derived from his skill overlap

---

## 4 · What Phase 6 deliberately deferred

- **Materialised views with concurrent refresh** → Phase 9 (perf pass when data grows; today regular queries are sub-10ms)
- **Pagination on `/search`** — schema supports it but the UI rebuild is bundled with Phase 7 polish (Task 7.8)
- **Saved-search alert emails ("3 new matches this week")** — Phase 8 cron + Resend
- **Phase 6 in-product CSV `email-me-the-full-file` flow** for slices > 10k rows — Phase 8 with Resend
- **Multi-period comparison ("vs last month")** on `/insights` — Phase 6.5 polish or Phase 9 hardening
- **Heatmap as a real visual heatmap (SVG / Recharts)** — current HTML-table heatmap with background-opacity scale works at our scale and is mobile-friendly; can elevate to SVG later if data demands it

---

## 5 · Files added / changed

```
NEW  db/queries/career-compass.ts                 (real compass derivation)
NEW  lib/analytics/export.ts                      (CSV export Server Action)
NEW  components/feature/InsightsExportButton.tsx  (Blob download client island)
MOD  db/queries/analytics.ts                      (+skillsGap, supplyHeatmap, freshness)
MOD  db/queries/profiles.ts                       (+internship/grad filters)
MOD  lib/mock/types.ts                            (+SearchFilters extensions)
MOD  app/[locale]/(public)/insights/page.tsx      (3 new sections + working export)
MOD  app/[locale]/(public)/search/page.tsx        (parse new ?internships ?graduates)
MOD  app/[locale]/(seeker)/dashboard/page.tsx     (real compass tile)
MOD  app/[locale]/(seeker)/dashboard/grow/page.tsx (real compass page)
MOD  components/feature/SearchFilters.tsx         (early-career opt-ins UI)
```

No schema migration this phase — all SQL extensions land on the existing Phase 4 functions + indices.
