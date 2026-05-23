# Phase 6.5  Analytics polish + real seeker rank · ✅ COMPLETE

**Shipped:** 2026-05-23

> Side phase between Phase 6 and Phase 7. The audit after Phase 6 surfaced four real issues (one security, one cross-platform, two correctness) plus a set of architectural gaps that would materially upgrade the wedge. Phase 6.5 ships the fixes + the most impactful architectural adds (Tier 1 + Tier 2 from the audit) so Phase 7 inherits a clean foundation.

---

## 1 · Tier 1  Real fixes that needed shipping

### 1.1 CSV formula-injection guard ([`lib/analytics/export.ts`](../../lib/analytics/export.ts))
**The bug:** cells starting with `=` `+` `-` `@` `\t` are executed as formulas when the CSV is opened in Excel / LibreOffice. A malicious search term landing in `search_events.terms` would otherwise pop calc on a policy analyst's laptop.

**The fix:** OWASP-recommended pattern  prefix any cell starting with one of those characters with a single quote, which Excel displays as content and never interprets. The regex also catches `\r` (carriage return) for safety. Standard quoting + double-quote escape for cells containing commas / quotes / newlines still applies.

### 1.2 CSV line endings  `\n` → `\r\n` ([`lib/analytics/export.ts`](../../lib/analytics/export.ts))
RFC 4180 requires CRLF. macOS / Linux Excel handle LF fine, but Windows Excel garbles imports. One-line fix.

### 1.3 Skills-gap join misses partial matches ([`db/queries/analytics.ts`](../../db/queries/analytics.ts))
**The bug:** `LOWER(terms) = LOWER(profession)` is exact-match only. A search for "react developer" missed the "Software Developer" profession entirely → we systematically undercounted real demand.

**The fix:** new CTE pattern with `FILTER` clause + UNION:
- For each profession, sum hits from all terms where either string contains the other (`position(term IN profession) > 0 OR position(profession IN term) > 0`)
- Orphan terms (no profession match at all) get added as standalone "orphan demand" rows  these are search activity for skills that don't map to the taxonomy yet, which is itself a signal
- Aggregation pattern avoids the double-counting that a naive `JOIN ON LIKE` would cause

### 1.4 Heatmap intensity used hardcoded RGB ([`/insights/page.tsx`](../../app/%5Blocale%5D/(public)/insights/page.tsx))
`background: rgba(0, 107, 60, ${alpha})` bypassed the design-system CSS variable. Now uses `color-mix(in srgb, var(--color-brand) X%, transparent)`  same visual result, but theme changes propagate. Same fix swaps the cell into a clickable `<a>` (Tier 2 drill-down  see below).

---

## 2 · Tier 2  Architectural additions

### 2.1 Time-series snapshots ([migration `0003_phase6_5_snapshots.sql`](../../db/migrations/0003_phase6_5_snapshots.sql))
New table `skill_gap_snapshots`: id, captured_at, skill, searches, matches, fresh_matches, gap, province (NULL = national). Two indices  one on `captured_at DESC` for "latest" lookups, one on `(skill, captured_at DESC)` for per-skill time-series.

Each capture writes one row per skill in the top-N. Comparing two captures by `captured_at` yields the week-over-week delta arrows on `/insights`.

### 2.2 Snapshot capture + trend queries ([`db/queries/analytics.ts`](../../db/queries/analytics.ts))
- **`captureSkillGapSnapshot({ province?, top? })`**  runs `skillsGapQuery`, inserts the result into `skill_gap_snapshots`. Phase 8 cron owns this in production. In the meantime triggerable manually from the Phase 7 admin surface via [`lib/analytics/snapshot.ts`](../../lib/analytics/snapshot.ts) Server Action (admin-only, audit-logged).
- **`skillsGapTrendQuery({ top, lookbackDays })`**  returns current top-N gap rows + a `gapDelta` column computed against the most recent snapshot at least `lookbackDays` old. Falls back gracefully to `gapDelta: null` when no prior snapshot exists  the page never breaks.

### 2.3 Real seeker rank ([`db/queries/analytics.ts`](../../db/queries/analytics.ts))
**The Career compass used to claim** "you'd move from #4 to #2 if you added 2 skills" with `currentRank: 0, projectedRank: 0` hardcoded. Embarrassing on read.

**`rankInPoolQuery({ handle, profession, province, projectedSkillBoost? })`** computes:
- Current rank via `DENSE_RANK() OVER (ORDER BY freshness × (0.5 + 0.5 × completeness/100) DESC)`  same blend the search SQL uses
- Pool total via `COUNT(*) OVER ()`
- Projected rank by re-running the same ranking with a `+6 × skillBoost` completeness bump just for this seeker (each skill adds ~6 points of completeness per `lib/mock/helpers.computeCompleteness`)

Wired into:
- `/dashboard` overview "Rank in search" tile  replaces the hardcoded `#4 of 312` with real numbers and a real "adding 2 skills moves you to #X" line
- `/dashboard/grow` Career compass headline  `currentRank` + `projectedRank` + `poolLabel` get spliced into `compass.headline` before the existing UI renders, so no template change needed

### 2.4 Skill-level demand query ([`db/queries/analytics.ts`](../../db/queries/analytics.ts))
**`skillDemandQuery({ top })`** joins search terms against the controlled `skills.label` (not just professions). Surfaces gaps like "Cybersecurity" that don't map to any profession but appear in search activity. Half the value of the controlled taxonomy was hidden until this query existed.

Surfaces on `/insights` as a new section "Skill-level demand · top 12" with per-row gap + searches + matches.

### 2.5 Heatmap drill-down ([`/insights/page.tsx`](../../app/%5Blocale%5D/(public)/insights/page.tsx))
Every cell in the supply heatmap is now an `<a href="/search?q=<profession>&province=<slug>">`  click "Western Cape × Chef · 3" → land on `/search` pre-filtered for chefs in the Western Cape. Trapped data unlocked.

### 2.6 Week-over-week Δ column on the skills-gap table
New `<DeltaCell />` helper with four states:
- `null` → "" muted (no prior snapshot to compare against yet)
- `0` → ↔ muted (unchanged)
- `> 0` → ⬆ red (gap widening  demand outpacing supply)
- `< 0` → ⬇ green (gap shrinking  supply catching up)

Drives the "this is getting better / worse" instinct policy analysts want.

---

## 3 · Tier 3  Strategic adds queued for Phase 9

Captured in the new [`docs/PHASE_9_PLAN.md`](../PHASE_9_PLAN.md) (8 sections  strategic adds + production hardening  plus 9 implementation tasks). Includes:

| Idea | Phase 9 task |
|---|---|
| PDF report export (print-CSS, no extra dep) | A.1 |
| Sebenza Labour Market Index (single weekly number) | A.2 |
| `/gov` route group with new `gov` role | A.3 |
| City-level breakdown | A.4 |
| Holt's linear forecasting | A.5 |

These are deferred because they're partner-conversation-driven and depend on either a stable production deployment (`/gov` role; LMI as a media-quotable stat) or accumulated time-series (forecasting needs 12+ weekly snapshots). Phase 6.5 lays the foundation; Phase 9 builds on it.

---

## 4 · Verification

- **Typecheck:** ✅ clean (`npx tsc --noEmit`)
- **Build:** ✅ clean  `/insights` still SSG + ISR; new sections render correctly
- **Live DB smoke:**
  - Migration 0003 applied cleanly
  - `skillsGapTrendQuery` returns rows with `gapDelta: null` (no prior snapshot exists yet  correct fallback)
  - `skillDemandQuery` surfaces gaps at skill granularity (Pastry, TypeScript, React, etc.)
  - `rankInPoolQuery({ Andile })` returns rank in his Gauteng × Software Developer pool with projected rank +6 completeness
  - Heatmap cells link to `/search?q=…&province=…` and the deep-link applies the filters

---

## 5 · Files added / changed

```
NEW  db/migrations/0003_phase6_5_snapshots.sql  (skill_gap_snapshots + 2 indices)
NEW  lib/analytics/snapshot.ts                  (admin-callable capture action)

MOD  db/schema.ts                              (skillGapSnapshots table)
MOD  db/migrations/meta/_journal.json          (register 0003)
MOD  db/queries/analytics.ts                   (skillDemandQuery + captureSkillGapSnapshot
                                                + skillsGapTrendQuery + rankInPoolQuery
                                                + LIKE-based skills-gap match)
MOD  lib/analytics/export.ts                   (CSV injection guard + CRLF)
MOD  app/[locale]/(public)/insights/page.tsx   (Δ column + skill-level section
                                                + clickable heatmap + CSS-var intensity)
MOD  app/[locale]/(seeker)/dashboard/page.tsx  (real rank tile)
MOD  app/[locale]/(seeker)/dashboard/grow/page.tsx (real rank in compass headline)
```
