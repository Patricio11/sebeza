-- Province + city stored as LABELS, everywhere (docs/GEO_LABEL_CANONICAL_PLAN.md,
-- 2026-08-27).
--
-- Every reader assumed profiles.province / profiles.city hold the human
-- label ("Western Cape", "Cape Town"); the profile editor wrote the slug
-- ("western-cape", "cape-town"). On the live register that split seekers
-- out of province-filtered search and out of their rank pool. The
-- writers are fixed in code; this backfills the rows they left behind.
-- Idempotent: only rows whose value is not already the exact label move.
-- The search_vector trigger recomputes on UPDATE.

UPDATE profiles p
   SET province = pr.label
  FROM provinces pr
 WHERE lower(p.province) IN (pr.slug, lower(pr.label))
   AND p.province <> pr.label;

UPDATE profiles p
   SET city = c.label
  FROM cities c
 WHERE lower(p.city) IN (c.slug, lower(c.label))
   AND p.city <> c.label;
