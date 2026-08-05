# PLAN - PRIVATE COLLEGES IN THE INSTITUTION PICKER

*Founder request (2026-07-30): the student sign-up institution picker only lists public
universities / UoTs / UNISA / TVETs / INDLELA. Major private colleges - where a large share of SA
qualifications actually come from ("like myself I did IT at Damelin… we should add Rosebank as
well") - are missing, forcing those students through the free-text "My institution isn't listed"
path and the admin suggestion queue.*

## Approach

The picker renders the `INSTITUTIONS` constant (`lib/mock/taxonomy.ts`); `academic_profiles.
institution_slug` has an FK onto the `institutions` table, so every new entry needs BOTH the
constant (UI) and a DB row (FK). Live DB gets the rows via an idempotent migration (the seed only
runs on dev/test databases). Existing free-text "pending" rows users already created (e.g. a typed
"Damelin") keep working - different slugs, no conflict; admins can still canonicalise them.

## TASKS

- [x] `lib/mock/taxonomy.ts`: new **Private colleges** group in `INSTITUTIONS` (17 majors,
  `kind: "private"`, main-campus city/province): Damelin, Rosebank College (IIE), Varsity College
  (IIE), Vega School (IIE), IIE MSA, Boston City Campus, Eduvos, Richfield, MANCOSA, Milpark
  Education, STADIO, Regenesys Business School, Regent Business School, IMM Graduate School, AFDA,
  CTU Training Solutions, Oxbridge Academy. Positioned after UNISA (distance), before the TVETs.
- [x] `INSTITUTION_KIND_LABEL.private`: "Private" → "Private college" (renders on profiles).
- [x] Migration `0063_private_colleges.sql` (idempotent `ON CONFLICT (slug) DO NOTHING`) +
  journal idx 63 in the same commit.
- [x] Apply to the live Neon DB (`db:migrate` - additive-only, safe).

## VERIFY

- [x] Migration applies clean; 17 rows present in the live DB.
- [x] typecheck + unit vitest green.
- [x] Picker shows the new group (dev server spot-check).
