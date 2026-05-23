# Phase 4  Live Smoke Test (DB-backed public reads)

> Run after the Phase 4 migration applied cleanly. Each box ticked = the `dbProvider` end-to-end works for `/search`, `/p/[handle]` and `/insights` against your live Neon DB.

---

## 0 · Pre-flight

- `.env.local` has `SEBENZA_DATA_PROVIDER=db` (set during Phase 4)
- `npm run db:migrate` ran cleanly (the 0001 migration is in `_journal.json`)
- `npm run dev` is running

---

## 1 · Search ranking parity

The mock provider ranked profiles by `relevance × freshness_confidence × completeness × citizen_boost`. The DB provider does the same blend with `ts_rank_cd × sebenza_freshness_confidence × …`. Order should be identical for the seeded fixtures.

| Search | Expected top 3 (in order) | ✅ |
|---|---|---|
| `developer` in **Gauteng** | Lerato N. → Andile Z. | ☐ |
| `chef` in **Western Cape** | Thandeka M. → Amara O. → Sipho K. (Sipho last because of stale status) | ☐ |
| `electrician` (no filters) | Kabelo M. (only match) | ☐ |
| empty query, no filters | All 8 seekers, freshness-weighted (Sipho near the bottom) | ☐ |

Steps:
1. Open `http://localhost:3000/search`
2. Try each query above; note the order in the result list
3. Each search writes a row to `search_events`  verify by signing in as admin and visiting `/admin/audit-log` (will show `search.profiles`)
4. Open `npm run db:studio` → `search_events` table → confirm rows appear with `terms` set

---

## 2 · Public profile = live DB

1. Visit `http://localhost:3000/p/andile-z`  should render Andile's bio/skills/experience
2. Sign in as Andile (`andile-z@example.co.za` / `sebenza-dev-2026`), visit `/dashboard/profile`
3. Change the bio to e.g. *"DB-backed profile  verified by Phase 4 smoke."* → click Save
4. In a different tab (or sign out), visit `/p/andile-z` again
5. The new bio should be live  no rebuild, no cache invalidation needed

✅:
- ☐ `/p/andile-z` renders bio, skills, experience, qualifications, status chip, completeness arc, photo (if uploaded)
- ☐ Edits in `/dashboard/profile` appear on `/p/andile-z` within seconds
- ☐ `national_id`, `email`, `surname`, `document_storage_key` NEVER appear in the rendered HTML or RSC payload (view source  none of those strings should be there)

---

## 3 · Profile photo flows through public reads

1. As Andile, upload a profile photo via `/dashboard/profile` → top "Photo" section (Phase 3 wired this)
2. Visit `/p/andile-z` in another tab  the photo should render in the public dossier
3. View the page source  the `<img src="…">` should be a Supabase `…?token=…` signed URL (5-min TTL), NOT the raw storage key
4. Refresh after 5 min  the URL changes (each render mints a new short-lived signed URL)

✅:
- ☐ Photo renders on `/p/andile-z`
- ☐ `<img src>` is a signed URL with `?token=…`, not a raw key
- ☐ Removing the photo on `/dashboard/profile` makes `/p/andile-z` revert to the initials avatar

---

## 4 · Insights aggregates from real data

1. Visit `/insights`
2. The status breakdown should reflect the 8 seeded profiles (mostly `open_to_work`, some `employed`/`studying`, etc.)
3. "Confirmed placements this month"  depending on today's date vs. the seed dates (`2026-04-18` Kabelo, `2026-05-04` Thandeka), this is either 1 or 2 placements *this calendar month*
4. The 5-month trend chart shows columns for the 5 most recent months ending in the current month
5. `demandBySkill` shows the professions seeded in the DB

✅:
- ☐ Numbers are NOT the mock values (the mock had `48213 totalActive`  Phase 4 should show something near the seed count of 8)
- ☐ `byStatus` reflects actual rows
- ☐ `trend` is real months (current month + 4 prior)
- ☐ Refresh after 5 min  values may refresh (ISR `revalidate: 300`)

---

## 5 · Switch back to mock (fallback still works)

1. Stop dev server, edit `.env.local`: `SEBENZA_DATA_PROVIDER=mock`
2. Restart, visit `/search`  should show the mock fixtures (same data but with fake `48213` analytics on `/insights`)
3. Set back to `SEBENZA_DATA_PROVIDER=db` and restart

✅:
- ☐ Both modes work (proves the seam holds)

---

## 6 · Sanity tail

- ☐ `npm run typecheck` clean
- ☐ `npm run build` clean  `/insights` shows `●` SSG with ISR, `/p/[handle]` + `/search` show `ƒ` dynamic
- ☐ Mobile 360px view of `/search` results renders cleanly (no horizontal scroll)

---

## When every box ticks

Tell Claude **"Phase 4 smoke passes"** and I'll commit + open Phase 5.

---

## If something fails

- **`/search` returns 500 or empty**  check the dev server logs. `db.execute()` returns `{ rows: [...] }`, not an array  both query files use the right shape now, but if you've extended them, watch for this.
- **`/insights` 500**  check `db.execute()` calls. Also: a `GROUP BY` mismatch (e.g. `LOWER(coalesce(x, ''))` in SELECT vs `LOWER(x)` in GROUP BY) will throw `column "x" must appear in the GROUP BY clause`.
- **Photo doesn't render on `/p/[handle]`**  confirm `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; the dbProvider falls back to `null` photo when storage isn't configured.
- **Profile data is stale on `/p/[handle]`**  `/p/[handle]` is dynamic (ƒ) so every visit hits DB. If you see stale data, check that the route shows `ƒ` in `npm run build`. If it's `●`, the page somehow opted into static  search for `force-static` or missing `await params`.
- **Migration didn't apply**  `npm run db:migrate` reads `_journal.json`. If you hand-edited it, ensure both entries are present and the new SQL file is in `db/migrations/`.
