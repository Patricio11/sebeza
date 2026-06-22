# PHASE 16 PLAN  "NEAR YOU" (reframe what already exists, honestly)

**Status:** PLANNED  ready to implement (post-QA, after Phase 15). Priority 3.
**One line:** foreground the **location dimension Sebenza already has** so the transport-cost barrier is
addressed in the seeker's UX  expressed in Sebenza's *reverse-matching* terms, not as a job-board feed.
**Origin:** `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §2/§3/§5.3 · `docs/POST_LAUNCH_BACKLOG.md` Phase 16.
**Companion docs:** `ROADMAP.md` Task 1.2 (province→city search) · Phase 6/6.5 (heatmap + demand) ·
Phase 9.8 (vacancy invitations) · Phase 11.2.6 (city-demand links) · Phase 11.4.5 (employer leaderboard) ·
Phase 13.9 (any-province remote/hybrid) · `UX_UI_SPEC.md` · `docs/MOBILE_PLAN.md`.

> **Honest scoping note (read first).** Sebenza is **not** missing location matching. It already has
> province→city search, location on every profile + `<TalentRosterItem>`, the province×profession supply
> heatmap with `/search?q=…&province=…` drill-downs, and any-province handling for remote/hybrid (13.9).
> SAYouth's edge here is **purely framing**  they lead with "opportunities close to where you live" and
> productise the transport-cost barrier. **We have the engine; we under-sell it.** This phase foregrounds and
> reframes; it does not rebuild.

---

## ⚠️ D1  THE MODEL-CONSISTENCY DECISION (resolve this before any code)

**The backlog outline (16.1) says: a one-tap "Show opportunities near me" that runs the existing
`/search?province=…`. That wording doesn't fit Sebenza's data model, and following it literally would push
the product toward the job-board model the competitive analysis explicitly says to avoid.** Here's why, and
the honest resolution.

**The mismatch:** `/search` returns **talent profiles**  it is the *employer-facing* talent search, and on
the seeker side it doubles as the **"rank in your pool" / "see who you're competing with"** view. Sebenza is
a **reverse-matching** platform (Phase 9.8): employers spec a vacancy → the system surfaces matched seekers →
invite/accept/decline. **There is deliberately NO seeker-facing vacancy-browsing surface**  no public
vacancy listing, no "apply" button, no "jobs near me" feed. The competitive analysis §5 is explicit: *"Do
NOT steal the broadcast post-and-apply model. Reverse-matching is a deliberate, defensible difference  don't
converge toward the incumbent."* A literal "opportunities near me → /search" would either (a) show the seeker
*other seekers* (confusing), or (b) require building a job-board vacancy feed (forbidden).

**The resolution  "Near You" in reverse-matching terms.** What genuinely helps a seeker on a reverse-matching
platform, and is honest + already-in-the-data, is **three things, all framed around "near where you live":**

1. **Demand near you**  "*{N} employers are hiring {your profession} in {your area} right now*" (the
   honest demand signal from `search_events` / the existing demand engine), with **"near you **or** remote"**
   for remote-available seekers (13.9). This reframes the transport-cost barrier as *opportunity*: "there's
   demand right where you are  you don't have to travel."
2. **Be found near you**  a findability nudge: keep your status fresh + profile complete + availability set,
   so local employers *find you* (this is how a seeker "gets" work on a reverse-matching platform). Drives the
   existing freshness/completeness loop.
3. **Local opportunities you already have**  surface the seeker's **invitations** (Phase 9.8) and
   **recommended/followed employers** (Phase 11.4.5/11.4.2) with the **locality made legible** ("Same city" /
   "{city}, {province}"). These ARE the seeker's real opportunities on Sebenza, and 16.2 makes their location
   glanceable.

**This keeps the transport-cost win the backlog wants, stays honest, reuses everything, adds zero job-board
surface, and feeds the intelligence story (the gov differentiator) on the seeker side.** The rest of this
plan assumes this resolution. **If the founder prefers the literal "/search opportunities" reading, stop 
that's a different, larger, model-changing phase that needs its own governance review (it would mean building
a seeker vacancy-browse surface, which contradicts 9.8's deliberate design).**

---

## Non-negotiables (the user's bar: "smooth, great, fully responsive  national-wide")

- **Fully responsive, 360px-first** to the `docs/MOBILE_PLAN.md` bar  no horizontal scroll, ≥44px taps,
  text-first. The "near you" surfaces must feel native on a cheap Android.
- **No new heavy map libs**  consistent with the deliberate "no heavy map" choice on the Phase 6 heatmap.
  Text + the existing lightweight visual idiom only.
- **No new geolocation / GPS / device-location permission**  use the city already on the profile (avoids a
  new PII/consent surface for a framing win).
- **No rebuild of search/ranking**  presentation + entry-point framing over the existing Phase 4 ranking +
  Phase 6 location scope.
- **POPIA k-anonymity holds**  any "demand near you" aggregate respects the existing suppression floor (see
  D2). The seeker's *own* city is theirs to see; cross-seeker aggregates stay province-level unless a city
  cell clears the k-floor.

## Architecture decisions

- **D2  Demand "near you" is province-level by default; city-level only where it clears the k-floor.** The
  municipal-level concern is already on record (`POST_LAUNCH_BACKLOG.md` → "Municipal-level analytics … flips
  on once cell-counts cross the k-anonymity floor"). So: the demand signal is **province-scoped by default**
  (safe, matches the existing heatmap), and the seeker's **own city** is used only for *framing copy* ("near
  {city}") and to *prioritise/label* their own invitations/employers  never to expose a suppressible
  cross-seeker city aggregate. If/when municipal analytics flip on, the city demand number can deepen; until
  then "near you" = "in {province}" for aggregates, "{city}" for the seeker's own context.
- **D3  "Near you OR remote" is the honest default.** A remote/hybrid-available seeker (13.9 `workAvailability`)
  is never penalised by a strict "near me" lens  the framing always includes their remote reach ("demand in
  {province} + national remote demand for your profession").
- **D4  Locality legibility is purely presentational.** 16.2 makes location glanceable on `<TalentRosterItem>`
  and the seeker's opportunity views using data **already on the row** (city/province). No new query, no new
  column.
- **D5  Reuse the existing demand engine; do not build a new one.** The Career Compass already scopes demand
  to `me.profession · {me.province}` and the heatmap is province×profession. "Near you" is a *seeker-framed
  lens* over that, not a new analytics surface.

---

## Task 16.1  Foreground "Work near you" at the seeker entry point

- [ ] **16.1.1  "Near you" card on `/dashboard`.** A calm card, Mzansi National styling (eyebrow + Fraunces
      heading + hairline rows), leading with the seeker's confirmed city: *"Work near you  {city}, {province}."*
      It shows **(a) demand**: "*{N} employer searches for {profession} in {province} (last 90 days)*" from the
      existing demand engine (D5), province-scoped (D2); **(b) remote reach** if the seeker is remote-available
      (D3): "+ national remote demand"; **(c) a findability line**: a one-tap "Make sure employers can find you
      near {city}" linking to status-confirm / profile-completeness (drives the existing loop). Honest empty
      state when there's little demand: *"Quiet in {city} right now  here's {province}, and remote roles you're
      open to."* (reuse the Phase 7/10 honest-end-state idiom).
- [ ] **16.1.2  Confirm/adjust city inline.** The card reads `me.city` (always set  every profile has a
      residence). A small "not here?" affordance deep-links to the profile editor's location field  no new
      capture, no GPS. (City is set at sign-up + editable on `/dashboard/profile`.)
- [ ] **16.1.3  One-tap "See your pool near you."** Where it's honest (the seeker's *competitive pool* is a
      real, existing surface  the rank-in-pool view), keep the existing `/search?q={profession}&province={slug}`
      link but **label it truthfully**: "See who you're matched against in {province}" (NOT "opportunities").
      This preserves the existing, correct behaviour while fixing the misleading "opportunities" label the
      backlog outline would have introduced (D1).

## Task 16.2  Make locality legible on results + opportunity views (the transport-cost barrier)

- [ ] **16.2.1  Locality on `<TalentRosterItem>`.** Make location prominent + human on the row component
      (employer side `/search` + vacancy match; seeker side wherever the row appears). Today it renders city
      only, mid-line. Add a **glanceable locality treatment**: "{city}, {province}" with the province now
      shown, and  **when a viewer-city is in context** (e.g. an employer's vacancy city, or the seeker's own
      city)  a quiet **"Same city"** chip. Pure presentation over existing row data (D4); no new query.
- [ ] **16.2.2  Locality on the seeker's opportunity views.** On the **invitations** inbox/detail (9.8) and
      the **recommended/followed employers** card (11.4.5/11.4.2), surface the opportunity's locality the same
      way  "Same city" / "{city}, {province}" / "Remote"  so the transport-cost reality is visible at a
      glance. Reuse `formatVacancyLocation` (13.9) for the remote/any-province cases so the wording is one
      source of truth.
- [ ] **16.2.3  Lightweight visual only.** No map. The locality chip uses the existing pill idiom
      (`rounded-[var(--radius-pill)]` + hairline border + token colours). "Same city" gets a subtle brand tint;
      "Remote" gets the existing remote treatment. Colour is never the only signal (always text).

## Task 16.3  Carry "near you" through the loop (consistent, not a one-screen gimmick)

- [ ] **16.3.1  Career Compass city-demand rows (11.2.6).** These already link to `/search?q=…&province=…`.
      Adopt the same "near you" framing + the truthful labelling from 16.1.3, and add the remote line (D3) so
      the demand story reads consistently with the dashboard card.
- [ ] **16.3.2  Vacancy match view (9.8).** Employer-side: where a match is surfaced, the locality treatment
      from 16.2.1 makes "this person is in your city / province / is remote-available" glanceable next to the
      existing "matched via secondary profession" annotation (13.10). Helps the employer act on the
      transport-cost reality too.
- [ ] **16.3.3  Remote consistency (13.9).** Everywhere "near you" appears, a remote-available seeker/role
      reads as "near you **or** remote," never penalised by a strict filter (D3). `formatVacancyLocation` is
      the single wording source for the remote/any-province cases.

---

## Responsive + No-Flash spec (explicit  "smooth, great, fully responsive")

- **"Near you" dashboard card:** the `StatusCard`/`RecommendedEmployersCard` idiom  eyebrow + Fraunces
  heading + hairline-divided rows. Single column at 360px; the demand number is a Fraunces tabular figure
  (`StatCard` idiom). The findability CTA is a ≥44px tap target. Honest empty state reuses `<EmptyState>`.
- **Locality chips:** the existing pill idiom; they must wrap gracefully on narrow rows (no overflow at
  360px  the homepage grid-gap lesson applies; test in the Phase 12 overflow guard).
- **No map, no new images**  pure text + token CSS, zero payload growth (must not regress the perf-budget
  ratchets; this phase should *add ~0 KB* since it's presentational reuse).
- **i18n:** all new copy parameterised (`{city}`, `{province}`, `{count}`, `{profession}`)  careful with
  pluralisation + locale word order for the eventual zu/xh/af translations.

## Compliance / wiring

- [ ] **No new migration**  reads existing `profiles.city` / `profiles.province` + the existing demand
      engine + existing invitation/employer rows. Confirm in the plan's pre-flight (the backlog already
      predicts "no new migration expected").
- [ ] **POPIA / k-anonymity:** the demand aggregate (16.1.1) stays province-level by default (D2) and runs
      through the **existing suppression floor**  no new cross-seeker city aggregate is exposed. The seeker's
      own city is theirs to see (not an aggregate). Add a compliance assertion if any new aggregate query is
      introduced (it shouldn't be  D5 reuses the existing one).
- [ ] **No new geolocation/PII/consent** (D1 non-negotiable)  uses the city already on the profile.
- [ ] **No new audit kind**  the seeker viewing demand framing over their own area isn't a disclosure; the
      existing `search.*` audit on the pool link is unchanged.
- [ ] All new copy in `messages/en.json` (zu/xh/af deepMerge fallback); styled in the Mzansi National system.
- [ ] **Phase 12 E2E:** extend the seeker-arc spec  sign in, assert the "Work near you" card renders with the
      seeded seeker's city, no 360px overflow, no console errors. Assert the pool link is labelled truthfully
      (not "opportunities").
- [ ] **Doc convention on ship:** `docs/completed/PHASE_16_COMPLETE.md` + tick in `ROADMAP.md` + refresh
      `TO_START_EVERY_SESSION.md` Current State + commit `Phase 16 complete`.

## Out of scope (explicit)

- ❌ A seeker vacancy-browse / "jobs near me" feed  that is the post-and-apply job-board model Sebenza
      deliberately rejects (D1; competitive analysis §5). If ever wanted, it's a separate governance-reviewed
      phase, not this one.
- ❌ New geolocation capture / GPS / device-location permission (D1).
- ❌ Rebuilding the search/ranking engine or the demand engine (D5)  presentation + framing only.
- ❌ Distance-in-km precision or any map library  "same city / province" granularity matches the data + the
      No-Flash Rule.
- ❌ City-level cross-seeker demand aggregates before the k-floor clears (D2; tied to the dormant municipal
      analytics).

## Follow-ups (record to `POST_LAUNCH_BACKLOG.md` on ship)

- City-level demand numbers once municipal analytics clear the k-floor (deepens 16.1.1's "demand near you").
- A seeker-controlled "willing to travel to" radius beyond the home city (only if seekers ask; needs care to
  stay presentational, not a new matching axis).

---

## Suggested build order

1. **16.2** (locality legibility on `<TalentRosterItem>` + opportunity views)  pure presentation, lowest
   risk, immediately improves every existing surface.
2. **16.1** (the "Work near you" dashboard card)  the marquee reframe; reuses the demand engine + honest
   labelling fix.
3. **16.3** (carry through compass + match + remote)  consistency pass.
4. Wiring: i18n keys, E2E spec, docs.

*Planned 2026-06-13. Source: `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §5.3. Sequenced against `ROADMAP.md` v2.2.
**D1 (model-consistency) is the one decision to confirm with the founder before building.***
