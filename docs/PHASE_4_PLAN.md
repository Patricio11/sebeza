# Phase 4 — The Data Engine (Backend & Schema) · 📋 PLAN (opened 2026-05-22)

> Active plans live at the top of `docs/`. When this phase ships, this file moves to `docs/completed/PHASE_4_PLAN.md` and `docs/completed/PHASE_4_COMPLETE.md` is written.

**Goal:** Swap the mock `dataProvider` for a real Postgres-backed one. Stand up the search engine (Postgres FTS + pg_trgm), the ranking SQL (the same shape we've been emulating in `lib/mock/helpers.rankProfiles`), and the typed query layer that every Server Component reads through. After Phase 4, the public `/search`, `/p/[handle]` and `/insights` pages stop reading from `lib/mock/*` entirely.

---

## Re-checks (decide before kickoff)

### Re-check #1 — `dbProvider` lives behind the same `DataProvider` interface ✅ LOCKED
The `lib/data/provider.ts` seam is already in place. Phase 4 fills in the `dbProvider` implementation; pages don't change.

### Re-check #2 — FTS column is materialised, not computed per-query
`profiles.search_vector` (already declared as `text` in `db/schema.ts`) becomes a generated `tsvector` column populated from `profession || headline || skills_aggregated`. GIN index on it. **Decision before `db:generate`**: do we use Postgres `GENERATED ALWAYS AS … STORED` or a trigger? Plan: GENERATED column for the profile-owned fields, and a trigger for `skills_aggregated` (since profile_skills is a separate table). One migration, one batch.

### Re-check #3 — Ranking blends the same factors as the mock
`relevance × freshness_confidence × completeness × citizen_boost`. The mock implementation is in `lib/mock/helpers.rankProfiles`; the SQL version uses `ts_rank_cd(search_vector, query) × freshness_confidence(status_confirmed_at) × (0.5 + 0.5 * (completeness/100.0)) × (CASE WHEN is_citizen AND $highlightCitizens THEN 1.08 ELSE 1.0 END)`. `freshness_confidence` becomes a SQL function (or computed in app code using the timestamp). **Trade-off**: SQL function gives one source of truth; app-code keeps the math in TS. Plan: ship the SQL function so Phase 6 analytics queries can reuse it.

### Re-check #4 — Redaction enforced at the query layer
Every public select-list **explicitly enumerates** columns — no `SELECT *`. `nationalIdEnc`, `fullSurname`, `email`, and `profilePhotoUrl` (the bare key — we mint signed URLs separately) are never in a public read.

### Re-check #5 — Search-side filter for "open to internships / graduate programmes"
Schema already carries these flags on `academic_profiles`. Wires the employer filter checkbox alongside the DB-backed search.

### Re-check #6 — `searchEvents` written from the search code path
Skills-gap signal accumulates from Phase 4, but doesn't surface until Phase 6 analytics. Every search writes a row.

---

## Implementation plan

### 1. Search vector + indices (~45 min)
- Drizzle migration adds:
  - `profiles.search_vector tsvector` generated from `profession || headline || bio`
  - GIN index on `search_vector`
  - GIN trigram (`gin_trgm_ops`) index on `profiles.profession`, `professions.label`, `skills.label`
  - btree on `profiles.province`, `profiles.city`, `profiles.status`
- Trigger to refresh `profiles.search_vector` when a row in `profile_skills` is inserted/updated/deleted (aggregates skill labels into the vector)
- `pg_trgm` extension enabled

### 2. Query layer (~90 min)
- `db/queries/profiles.ts`:
  - `findProfileByHandle(handle)` — full public read with redaction
  - `searchProfiles(filters)` — the ranking SQL above; writes a `searchEvents` row at the end
  - `recentProfiles(limit)` — for the landing trust strip
- `db/queries/analytics.ts`:
  - `getAnalyticsSnapshot()` — counts by status/profession/location, weighted by freshness; trend by month
- `db/queries/taxonomy.ts`:
  - `loadProvinces()`, `loadProfessions()`, `loadSkills()`, `loadInstitutions()` — DB-backed taxonomy (replaces the static `lib/mock/taxonomy.ts` for reads; the static file stays as the seed source)

### 3. `dbProvider` implementation (~30 min)
- `lib/data/provider.ts` → fill in `dbProvider` against `db/queries/*`
- Flip default: `SEBENZA_DATA_PROVIDER=db` becomes the recommended dev setting
- `mockProvider` kept as a fallback for off-DB dev (`SEBENZA_DATA_PROVIDER=mock`)

### 4. Signed photo URLs on public reads (~30 min)
- `dataProvider.searchProfiles` and `getProfile` return `profilePhotoUrl` as a signed URL (server-rendered)
- `/p/[handle]` and `TalentRosterItem` use the signed URL directly

### 5. Verification + commit (~30 min)
- `npm run typecheck && npm run build` clean
- Smoke: search "developer in Gauteng" returns Lerato + matches the rank order seen on the mock side
- Smoke: `/insights` shows real counts (not mock numbers)
- Smoke: `/p/andile-z` renders his real bio/skills from the DB
- Write `docs/completed/PHASE_4_COMPLETE.md`; tick Phase 4 in `ROADMAP.md`; update Current State; open `docs/PHASE_5_PLAN.md` (employer reveal + placement confirmation); commit with `Phase 4 complete + Phase 5 opens`

---

## Acceptance criteria (Phase 4 is DONE when every box ticks)

- [ ] `/search` returns the seeded profiles, ranked using the same blend the mock used
- [ ] Search results match — same top 3 for "chef in Cape Town" before and after the swap
- [ ] `/p/andile-z` renders from the DB (verify by editing Andile in `/dashboard/profile` → see the change on `/p/andile-z` without a redeploy)
- [ ] `/insights` aggregates from real `placements` + `profiles` rows
- [ ] Every public read enumerates columns — no `nationalIdEnc` / `fullSurname` / `email` in the network payload
- [ ] Search writes one `search_events` row per query
- [ ] Photos uploaded in Phase 3 appear on the public profile (signed URL) and in search results (thumb variant)
- [ ] Toggling `SEBENZA_DATA_PROVIDER` between `db` and `mock` keeps the pages working in both modes
- [ ] `npm run build` clean; static routes still static where appropriate

---

## Out of scope for Phase 4

- **Employer reveal flow** — Phase 5 task 5.2
- **Skills-gap engine + demand-vs-curriculum dataset** — Phase 6
- **Career compass real-data wire-up** — Phase 6 (Phase 3 left it on the mock dataset)
- **2FA enforcement** — Phase 7
- **SAQA / Home Affairs adapters** — Phase 8

---

## Risks to flag at kickoff

- **Generated tsvector + triggered tsvector aggregation can fight each other.** Decide upfront: trigger-only (simpler, one path) or generated-for-some-cols + trigger-for-skills (more performant but two paths to debug). Plan: trigger-only — the perf delta is invisible at our row counts.
- **`pg_trgm` requires extension creation.** Neon supports it; Drizzle migration needs `CREATE EXTENSION IF NOT EXISTS pg_trgm;` raw SQL.
- **Search ranking parity with the mock matters for the demo.** Diff the result order before/after the swap on a fixed set of queries.
- **Photo signed URLs blow caching.** For the public profile photo, consider a longer TTL (15–30 min) or proxy through a server route — already flagged in `docs/completed/PHASE_3_PLAN.md`.
- **`searchEvents` table grows fast.** Phase 6 introduces an analytics rollup; until then keep an eye on the row count.

---

*When this ships: write `docs/completed/PHASE_4_COMPLETE.md` and open `docs/PHASE_5_PLAN.md` (employer reveal + placement confirmation).*
