# Province + city: one canonical form (labels), and an honest compass headline

Founder, 2026-08-27, from one screenshot: "Learn 2 skills → move from #1 to #1 ...
Software Developer · western-cape". Two faults in one line.

```
"#1 to #1"     ▶ the headline had one string for every case. A seeker already
                 on top (or alone in their pool, or with no rank) read a move
                 that is not a move.

"western-cape" ▶ the raw stored value leaked. Worse: on the live register
                 province was stored in TWO forms ("Western Cape" x8 /
                 "western-cape" x5, "KwaZulu-Natal" / "kwazulu-natal") and
                 city too ("Cape Town" x5 / "cape-town" x5, "Durban" /
                 "durban"). Search matches province by LABEL, so the slug
                 rows were invisible to a province-filtered search and sat
                 in a rank pool of their own.
```

## Root cause

Every reader assumed the label (search `lower(p.province) = lower(label)`, stall
reasons `REPLACE(province, ' ', '-')`, seed `provinceSlugByLabel`, the auth
comment "stored as the label, same as profiles.city everywhere"). Two writers
did not: the profile editor saved the picker SLUG for both fields, and the
city-at-signup change (2026-08-26) saved the city slug.

## Decisions

- **Label is the one on-disk form** for `profiles.province` and `profiles.city`.
  `lib/geo/canonical.ts` (pure, taxonomy constants) converts slug-or-label to the
  label; every writer calls it (signup, profile editor, seed). Unknown free text
  is kept trimmed, never dropped.
- **Readers stay tolerant** (`lower(...) = lower(...)`), and the rank pool
  canonicalises its input so "gauteng" and "Gauteng" answer the same.
- **Backfill in a migration (0078)** via the `provinces` / `cities` tables,
  idempotent; the search_vector trigger recomputes on UPDATE.
- **Headline says only what is true**: move (from ≠ to), hold (from = to > 1),
  stay #1 (already top), be found first as the pool grows (pool of one), get
  found more often (no rank). Pool total shown ("#2 of 7").

## TASKS

- [x] lib/geo/canonical.ts + unit tests
- [x] Writers: signup (city), profile editor action (city + province), seed fixtures; editor form maps stored labels back to picker slugs
- [x] Migration 0078 backfill + journal
- [x] rankInPoolQuery + compass poolLabel canonicalise the province (label in the UI)
- [x] Admin removeCity usage check matches label or slug
- [x] Compass headline variants (en + zu/xh/af drafts) with pool total
- [x] Integration test: no slug rows after migrate+seed; rank pool slug == label

## Career Compass review (founder, 2026-08-27: "fully check it, users must enjoy this part")

Walked the live page on the harness as Lerato: Learn → Start → Save for later →
Mark complete → adjacent-role switch, desktop + 360px, console watched.

- [x] BUG: "Mark complete" 500'd: `profile_skills` never had a unique (profile, skill) index, so the completion upsert's ON CONFLICT could not be inferred (Postgres 42P10). Migration 0079 dedupes + adds the index; schema declares it; seed inserts tolerate repeats; integration test covers new-skill and upgrade paths
- [x] Hero CTA "Add to my profile" contradicted "Learn N skills"; now "See what to learn ↓" (anchors to the recommendations)
- [x] Projected-rank card showed "#1 → #1"; now "Rank stays #1" when nothing moves
- [x] Empty states for recommendations, adjacent professions and city demand (en + zu/xh/af drafts)
- [x] City-demand header prints the province label, never the raw value
- [x] Learning row: "Upload it for the verified badge" promised a badge evidence uploads no longer earn; now "Add it to your qualifications"; provider separator restored
- [ ] Known gap (not done here): the My learning section, recommendation buttons and chips are English-only strings outside the catalogs (about 40 strings); the page headings and hero are translated

## VERIFY

- [x] Full suite + build green (600 tests, 69 files)
- [x] Harness screenshots cc01-cc08 in test-results/: hero "move from #2 to #1 of 16 · Software Developer · Gauteng", Learn → Start → Save → Complete (no 500), switch-profession modal, 360px; console clean. Compass hero with the honest variant + "Software Developer · Gauteng"
- [ ] Neon: `npm run db:migrate` applies 0078 + 0079 (founder); then re-check distinct province/city values
