# PHASE 16 COMPLETE — "Near You" (2026-06-13)

**Status:** ✅ shipped. Plan: `docs/completed/PHASE_16_PLAN.md`.
**One line:** foregrounded the location dimension Sebenza already has — expressed in **reverse-matching**
terms (demand near you + be-found-near-you + locality-legible invitations/employers), **not** a job-board
feed — so the transport-cost barrier is addressed without converging toward the incumbent's post-and-apply
model.

Built off the SAYouth competitive analysis (`docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §5.3). SAYouth's only
edge here is framing ("opportunities close to where you live"); Sebenza already had the engine
(province→city search, location on every profile, the demand/heatmap layer) and under-sold it.

## ✅ The §D1 decision (founder-confirmed 2026-06-13)
The outline's "run `/search` for opportunities near me" doesn't fit the model — `/search` returns **talent**
(the seeker's competitive pool), and Sebenza deliberately has **no seeker vacancy-browse surface**
(reverse-matching, not a job board). **Confirmed resolution, built here:** express "near you" as
**(1) demand near you + (2) be-found-near-you + (3) locality-legible invitations/employers.** The pool link
is labelled truthfully ("see who you're matched against"), never "opportunities."

---

## What shipped

### 16.1 — "Work near you" dashboard card (the marquee)
- New **`<WorkNearYouCard>`** on `/dashboard` (full-width, above the Career Compass — "near you" then "grow").
- **Leads with agency (be-found):** "Be found for {profession} work near {city}" + a completeness bar +
  "Complete your profile" CTA — the part the seeker controls on a reverse-matching platform.
- **Honest demand context:** "{N} searches for {profession} in {province} · last 90 days" with an honest
  empty state when quiet. Backed by a new `getNearYouDemand()` in `db/queries/career-compass.ts` that reads
  the **same `search_events` table + 90-day window** the compass demand engine already uses (D5 — reuse the
  engine, don't build a parallel one). It counts demand-side employer-search activity (`search_events` are
  not attributed to orgs and are never a seeker cohort), so it stays **province-level** with **no
  k-anonymity exposure** (D2).
- **"Near you OR remote" (D3):** a remote/hybrid-available seeker also sees the SA-wide demand line — never
  penalised by a strict local lens.
- **Truthful pool link (16.1.3 / D1):** "See who you're matched against in {province}" → the existing
  `/search?q={profession}&province={slug}` (the rank-in-pool view), plus a "Not in {city}? Update your
  location" affordance (no GPS, reads the city already on the profile).

### 16.2 — Locality made legible (presentational, D4)
- **`<TalentRosterItem>`** now shows **"{city}, {province}"** (province made legible) and accepts an optional
  `viewerCity` prop that lights up a quiet **"Same city"** chip when a candidate is in the viewer's city.
  Wired on the **vacancy match page** (`viewerCity` = the vacancy's city) so an employer sees local
  candidates at a glance — the transport-cost reality, for free, over existing row data. No new query.
- **Invitations list** (`/dashboard/invitations`) gains the same **"Same city"** chip when the role is in the
  seeker's own city (the seeker's city is the viewer-context).
- **`<RecommendedEmployersCard>`** was already province-scoped ("Employers hiring {profession}s in
  {province}") — consistent, no change needed.

### 16.3 — Carried through the loop
- **Career Compass city-demand table** (`/dashboard/grow`): copy tightened to the honest near-you framing
  ("What employers are searching for in your province" + "tap a skill to see who else is listed for it") —
  truthful pool labelling, never "opportunities."
- **Vacancy match view:** the `viewerCity` "Same city" treatment (16.2.1).
- **Remote consistency (D3):** `formatVacancyLocation` (Phase 13.9) remains the single source for the
  any-province/remote wording everywhere; the WorkNearYouCard carries the "or remote" line.

---

## Non-negotiables met

- **Reverse-matching, not a job board (§D1):** no seeker vacancy-browse feed; the pool link is truthfully
  labelled; the demand surface is intelligence, not a listings page.
- **Fully responsive, 360px-first:** the WorkNearYouCard stacks cleanly on mobile (be-found block goes
  column on `<sm`, ≥44px tap targets, completeness bar + CTA reflow); E2E asserts **zero horizontal overflow
  at 360px**. Locality chips wrap gracefully in the existing chip clusters.
- **No-Flash:** text + the existing token palette + one tiny SVG bar; **no map libs**, ~0 KB payload growth
  (pure presentation + one small query).
- **No new geolocation / GPS / PII / consent / migration** (D1/D4): reads `profiles.city` / `province` + the
  existing demand engine + existing invitation/employer rows.
- **POPIA / k-anonymity (D2):** the demand aggregate is province-level demand-side activity, run off the same
  table the compass uses; no new cross-seeker city aggregate is exposed.
- **i18n-ready:** new copy in `messages/en.json` (`seekerDash.nearYou` 11 keys + `search.rosterItem.sameCity`
  + refreshed `seekerDash.grow` city-demand copy); zu/xh/af deepMerge fallback.

## Verification (2026-06-13)

- `npm run test:all` → typecheck ✅ · lint ✅ (0 errors) · **318 vitest tests** ✅
- `npm run build` → ✅
- `npm run test:e2e` (seeker arc) → **12/12** at desktop + 360px, incl. the new Phase 16 test: the
  "Work near you" card renders with the seeker's city, the pool link is labelled "who you're matched against"
  (never "opportunities near"), and there's no 360px overflow.

## Files

**New:** `components/feature/seeker/WorkNearYouCard.tsx`; `getNearYouDemand()` in
`db/queries/career-compass.ts`.
**Edited:** `components/ui/TalentRosterItem.tsx` (`viewerCity` + "{city}, {province}" + Same-city chip) ·
`app/[locale]/(employer)/employer/vacancies/[id]/match/page.tsx` (viewerCity wiring) ·
`app/[locale]/(seeker)/dashboard/{page,invitations/page}.tsx` · `messages/en.json` ·
`tests/e2e/seeker-arc.spec.ts`.

## Out of scope / follow-ups (recorded for the backlog)

- City-level demand numbers once municipal analytics clear the k-floor (deepens 16.1's demand line).
- A seeker-controlled "willing to travel to" radius beyond the home city (only if seekers ask; must stay
  presentational, not a new matching axis).

**Next:** Phase 14 (zero-rating) remains partnership-gated research (`docs/PHASE_14_PLAN.md`). The three
SAYouth-derived post-launch phases are now: 14 = standing strategic objective, **15 ✅ shipped**,
**16 ✅ shipped**.
