# Phase 4  The Data Engine · ✅ COMPLETE

**Shipped:** 2026-05-22

> Phase 4 swaps the mock `dataProvider` for a Postgres-backed implementation. `/search`, `/p/[handle]`, and `/insights` stop reading from `lib/mock/*` and start hitting Neon with FTS-ranked SQL. The `lib/mock/*` files stay in place as the seed source  the seeded DB rows are now the truth.

---

## 1 · What shipped

### Migration: `db/migrations/0001_phase4_search.sql`
- `pg_trgm` extension enabled (typo-tolerant LIKE/`%` matching)
- `profiles.search_vector` switched from `text` placeholder → real `tsvector`
- `sebenza_profile_tsvector(text)`  single source of truth for a profile's vector. Composes `profession` (weight A) + `seniority` (B) + `bio` (C) + `city || ' ' || province` (B) + aggregated skill labels (A). Uses the `simple` dictionary (no stemming) so "developer" and "developers" stay distinct matches.
- **Triggers** keep the vector fresh:
  - `profiles_search_vector_trigger`  fires `BEFORE INSERT OR UPDATE OF profession, seniority, bio, city, province`. The app never writes to `search_vector` directly.
  - `profile_skills_search_vector_trigger`  fires `AFTER INSERT OR UPDATE OR DELETE`. Updates the owning profile's vector when its skills change.
- **Indices**:
  - `profiles_search_vector_idx`  GIN on `search_vector` (FTS lookups)
  - `profiles_profession_trgm_idx` / `professions_label_trgm_idx` / `skills_label_trgm_idx`  GIN trigram (typo tolerance, partial match)
  - `profiles_city_trgm_idx`  same for free-text city lookups
  - btree on `province`, `city`, `status`, `verification`, `deleted_at` (filter cardinality)
- **`sebenza_freshness_confidence(timestamp)`** SQL function  mirrors `lib/status.ts` so the ranking SQL and Phase 6 analytics rollups share one definition. Overload for `timestamptz` too.
- **Backfill**: every existing row gets its vector populated. Triggers take over from there.

### Query layer: `db/queries/*`
- **[`profiles.ts`](../../db/queries/profiles.ts)**:
  - `searchProfilesQuery(filters)`  the ranking SQL: `ts_rank_cd × freshness_confidence × (0.5 + 0.5 × completeness) × citizen_boost`. Handles empty queries (no FTS filter, rank degrades to freshness × completeness). Writes a `search_events` row at the end (skills-gap signal for Phase 6). `topSkillsByProfile()` pulls the top 5 skills per profile in one round-trip for the result-card payload.
  - `findProfileByHandleQuery(handle)`  public read with redaction. Enumerates exactly the columns we want  `national_id_enc`, `full_surname`, `search_vector`, `email`, `deleted_at`, `document_storage_key` are NEVER selected. Loads child rows (`skills`, `experience`, `qualifications`, `academic`) in parallel.
  - `recentProfilesQuery(limit)`  landing-strip helper; thin wrapper over the empty-query search.
- **[`analytics.ts`](../../db/queries/analytics.ts)**:
  - `analyticsSnapshotQuery()`  `totalActive`, `confirmedHiresThisMonth`, `byStatus` (count + freshness-confidence per bucket), `demandBySkill` (FULL OUTER JOIN between `search_events` and `profiles.profession`), `trend` (5-month registrations + placements via a `generate_series` join). All counts cast to `int` so the JSON payload stays JS-number-safe.

### `dataProvider` swap: `lib/data/provider.ts`
- `dbProvider` lights up. `mockProvider` stays as a fallback.
- `SEBENZA_DATA_PROVIDER=db` is now the default in `.env.local`.
- Photo signing happens here, not in the query layer:
  - Pages get `profilePhotoUrl` as a **short-lived signed Supabase URL** (5-min TTL).
  - DB stores the raw storage key. The query layer returns the key; the provider signs it via `Promise.all` so the cost is one round-trip regardless of result count.
  - When Supabase isn't configured (off-DB dev), photo URLs degrade to `null` and the `Avatar` component falls back to initials  page still renders.

### Page changes
- `/insights` adds `export const revalidate = 300`  ISR; aggregates refresh every 5 min instead of being frozen at build-time snapshot.
- `/search`, `/p/[handle]` already dynamic (`ƒ`); no source change needed  the provider swap is invisible to them.

### Schema
- `db/schema.ts`  `searchVector` declared via a `customType<tsvector>` so the Drizzle TypeScript types are accurate. Column is read-only from the app; triggers own it.

---

## 2 · Re-checks honoured

| # | Decision | Outcome |
|---|---|---|
| 1 | `dbProvider` lives behind the same `DataProvider` interface | ✅ Pages don't change; one env var flip swaps backends |
| 2 | FTS column is materialised via trigger (not GENERATED) | ✅ One path. Aggregating skill labels from a separate table required a trigger anyway. |
| 3 | Ranking blends `relevance × freshness × completeness × citizen_boost` | ✅ `freshness_confidence` SQL fn so ranking + Phase 6 analytics share one definition |
| 4 | Redaction enforced at the query layer (explicit select-lists) | ✅ Every public SELECT enumerates columns; no `SELECT *` anywhere |
| 5 | Search-side filter for "open to internships / graduate programmes" | ⚠️ Deferred  schema flag is present, search filter UI wires alongside the Phase 5 employer reveal flow |
| 6 | `searchEvents` written from the search code path | ✅ Best-effort insert at the end of every search; never blocks the response |

---

## 3 · Verification

- **Typecheck:** ✅ clean (`npx tsc --noEmit`)
- **Build:** ✅ clean  every protected route dynamic (ƒ), `/insights` SSG with `revalidate: 300`, all 4 locales prerender
- **FTS smoke (against live Neon):**
  - `developer` → Lerato (0.975) + Andile (0.790)
  - `chef in Cape Town` → Thandeka (1.200) + Amara (1.000) + Sipho (1.000)
  - `freshness_confidence` correctly drops Sipho to 0.25 (stale since Jan)
- **dbProvider live smoke:** ready (see `docs/PHASE_4_SMOKE_TEST.md`)

---

## 4 · Bugs hit (and how)

- **`db.execute()` returns `{ rows: [...] }`, not an array.** I assumed array-like and the first build crashed with `TypeError: b is not iterable`. Fixed by extracting `.rows` everywhere; added an `unwrap<T>()` helper in `analytics.ts` to keep call-sites readable.
- **GROUP BY mismatch in `demandBySkill`.** `LOWER(coalesce(terms, ''))` in SELECT vs `LOWER(terms)` in GROUP BY  Postgres treats them as different expressions. Dropped the redundant coalesce (WHERE already filters NULLs).

Both were caught by the build doing a real prerender against the live DB. Worth keeping that loop tight.

---

## 5 · Files added / changed

```
NEW  db/migrations/0001_phase4_search.sql        (FTS + indices + triggers + fn)
NEW  db/queries/profiles.ts                      (search + read + recent)
NEW  db/queries/analytics.ts                     (counts + trend + demand)
MOD  db/schema.ts                                (tsvector customType)
MOD  db/migrations/meta/_journal.json            (register 0001)
MOD  lib/data/provider.ts                        (light up dbProvider + sign photos)
MOD  app/[locale]/(public)/insights/page.tsx     (revalidate = 300)
MOD  .env.local                                  (SEBENZA_DATA_PROVIDER=db)
```

---

## 6 · What Phase 4 deliberately deferred

- **Employer contact-reveal flow + audit-logged document download** → Phase 5
- **`open_to_internships` / `open_to_graduate_programmes` filter UI on search** → Phase 5 (schema flag exists; UI lands with the reveal flow)
- **Materialised view for `analyticsSnapshotQuery`** → Phase 6 (row counts are small enough now that direct aggregate is fine)
- **`demandBySkill` derived from `search_events × profile_skills` (not `profile.profession`)** → Phase 6 (the wedge query for the gov pitch)
- **Career compass on real demand data** → Phase 6 (today still on the mock dataset)
- **2FA enforcement** → Phase 7
- **SAQA / Home Affairs verification adapters** → Phase 8
- **Postgres → AWS Cape Town `af-south-1`** → Phase 9
