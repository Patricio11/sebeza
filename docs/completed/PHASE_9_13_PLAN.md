# PHASE 9.13 PLAN  LEARNING-LOOP INTELLIGENCE (DEMAND-VS-CURRICULUM + STALL ANALYTICS)
*Side-phase opened off [`docs/PHASE_9_12_PLAN.md`](./PHASE_9_12_PLAN.md). 9.12 ships the seeker-side learning loop; 9.13 reads the data the loop generates and surfaces it as gov-facing policy intelligence. Last side-phase before Phase 10. Opened 2026-05-25.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/` · `docs/PHASE_9_12_PLAN.md` · `docs/completed/PHASE_9_7_PLAN.md` (suppression patterns) · `docs/completed/PHASE_7_5_PLAN.md` (`outcomes_research` consent pattern).*

> **Why 9.13 is its own phase, not folded into 9.12:** 9.12 generates the data (accepted / in-progress /
> completed / abandoned learning items, with reasons). 9.13's analytics are not meaningful  and the
> suppression floor (k=10) would hide ~everything  until that data has accumulated for ≥ k learners
> per cell. Splitting forces honest sequencing: ship the loop, let it run, *then* surface the
> aggregate. It also keeps 9.12's PR diff focused on the loop UX and 9.13's PR focused on the data
> contract + suppression compliance.

---

## 🎯 GOAL

Surface two genuinely new policy signals that emerge from 9.12's learning data, both governed by the
existing suppression + consent infrastructure (no new privacy machinery):

1. **Demand-vs-curriculum dataset.** *"Students in [programme] at [institution] are/aren't building the
   skills [province] demands."*  the curriculum-vs-market gap. Replaces the mock shape in
   `lib/mock/academic.ts` with a real query that joins `academic_profiles` × in-programme skill
   coverage × `searchEvents` / `skillDemandQuery`. **Student-side**: your own programme; honest "limited
   data" state until ≥ k peers exist. **`/gov`**: cross-market, suppression-floored, `outcomes_research`-gated.
2. **"Why learners stall" analytics.** Aggregate `abandon_reason` × skill × province from 9.12's
   `learning_items.abandon_reason`. Pairs with the 9.8.7 "why roles go unfilled" dataset  together
   they map both ends of the education-to-work pipeline. Suppression-floored; gov-side only; freshness-weighted.

Both are reads of existing tables (no new seeker-facing surface). The only schema add is the
**institution × programme × skill** mapping table required for the curriculum dataset  9.13.2 below.

---

## 🧭 HONEST ASSESSMENT (why this is worth building separately)

- **It's the policy-pitch upgrade.** 9.7 + 9.8.7 already gave gov the demand side (skills shortage,
  nationality mix, decline reasons). 9.13 adds the supply side (what curricula are producing + where
  learners stall). The two halves together are the pitch.
- **No new privacy machinery.** Both datasets reuse `lib/analytics/suppress.ts` (k=10 + complementary
  passes) and `outcomes_research` consent as the inclusion gate for gov-facing cuts. Same patterns
  shipped in 7.5.4 and 9.7. Compliance assertions are extensions of an existing suite, not new ones.
- **It launches data-thin and grows honest.** At ship time both surfaces will render mostly "limited
  data so far" empty states. That's correct  and far better than ghost numbers. As 9.12 data
  accumulates, the cells unsuppress naturally.
- **Two risks acknowledged:**
  1. Curriculum dataset needs an `institution × programme × skill` mapping table that doesn't exist
     today. This is the load-bearing schema piece  it's bigger than the analytics queries it feeds.
     (9.13.2 handles this; expect it to be ~half the phase.)
  2. At current scale the gov views may suppress out entirely on launch day. The "limited data" state
     must read confidently, not apologetically  *"k=10 floor protects individual learners' privacy
     while cohort data accumulates"*  so reviewers understand the floor is a feature, not a bug.

---

## 🔒 LOCKED DECISIONS

### D1  Gov-facing cuts gate on `outcomes_research` consent (in addition to suppression)
Matches the 7.5.4 pattern. A learner who hasn't opted in to `outcomes_research` is excluded from the
inclusion set for the gov-side curriculum + stall aggregates. (Their own student-side view of their own
data is unaffected  they always see their own progress.) Personal opt-in is the trust mechanism;
suppression is the structural defence. Both apply.

### D2  "Limited data" empty state ships from day 1, confidently
Below-floor cells render an honest "limited data" message that explains the k-floor as a privacy
protection, not an apology. Pattern from `<DeclineReasonsCard>` (9.8.7)  reuse the wording. No ghost
numbers, no zeros that imply absence-of-signal vs absence-of-data.

### D3  Build both surfaces from day 1 (don't ship student-side, defer gov-side)
The temptation to ship the student-side curriculum view first + defer the gov view is rejected. The
suppression floor + `outcomes_research` gate are exactly the mechanisms that make the gov view safe at
low volume. Shipping both keeps the patterns consistent and means 9.13 closes the analytics chapter
properly before Phase 10.

### D4  Institution × programme × skill mapping is the load-bearing schema piece
Without this mapping there is no curriculum dataset. 9.13.2 ships a new `programme_skills` table
(`institution_slug` × `programme` × `skill_slug` × `weight`) seeded from a hand-curated set for the
top SA institutions × top programmes (Wits CS, UCT Engineering, Stellenbosch BCom, etc.). The seeded
set is small + honest; the table is structured to admit future SAQA-feed expansion (dormant, Phase 8
adapter territory).

### D5  Stall analytics never name a provider
The `learning_items.provider` field is per-row free text the learner saw. Aggregating "Coursera has a
40% abandonment rate on Excel" is reputational territory that crosses the line from policy intelligence
into vendor judgment. Stall analytics aggregate by `skill_slug × province × abandon_reason` only 
never by provider. Per-row provider stays in the audit log for individual support, not in any
aggregate surface.

### D6  Freshness-weighted, same engine as 9.8.7
Reuse `sebenza_freshness_confidence(abandoned_at)` and `(completed_at)`  recent events dominate,
stale signal decays. Same SQL function 9.8.7 uses; no new freshness machinery.

---

## 🔍 WHAT WE ALREADY HAVE (pre-verified 2026-05-25)

- `lib/analytics/suppress.ts`  k=10 + complementary passes. Reusable.
- `outcomes_research` consent purpose (7.5.3)  inclusion gate template.
- `academic_profiles` table  programme / institutionSlug / nqfLevel / expectedGraduation. Confirmed
  against [db/schema.ts:341-356](../db/schema.ts#L341-L356).
- `institutions` table  slug / label / kind / city / provinceSlug. Confirmed against
  [db/schema.ts:1052-1060](../db/schema.ts#L1052-L1060).
- `skillDemandQuery` + `searchEvents`  demand side. From Phase 6 + 6.5.
- `<DeclineReasonsCard>` (9.8.7)  visual + suppression-handling reference pattern.
- `/api/gov/decline-reasons/export`  CSV export pattern with suppression preserved. Replicable.
- 7.5 seeded 12-person synthetic Wits BSc CS cohort  gives 9.13 a real (small) cohort to render
  against from day 1, suppression-floored honestly.
- 9.12's `learning_items` table + audit kinds (9.12.3)  the source data.

**Doesn't exist (9.13 ships):**
- ❌ `programme_skills` table mapping `(institution_slug, programme) → skill_slug × weight`.
- ❌ Demand-vs-curriculum query.
- ❌ Stall-reason aggregate query.
- ❌ Student-side "your programme vs market" card on `/dashboard/grow`.
- ❌ `/gov/curriculum` page.
- ❌ Stall surfaces on `/gov/shortage` (extends the existing page; doesn't add a new one).
- ❌ CSV export routes for both.

---

## ✅ PRE-FLIGHT RECHECK (run before writing code in 9.13.1)

- [ ] Confirm 9.12 has shipped and `learning_items` rows are flowing from the seed fixtures.
- [ ] Confirm `suppress.ts` signature unchanged since 9.8.7.
- [ ] Confirm `outcomes_research` consent is still default-off + non-degrading + opt-in surface lives
      on `/dashboard/privacy`.
- [ ] Confirm 9.12.7 seed has at least one `abandoned` row with `abandon_reason = "too_expensive"`
      and one `completed` row so 9.13 has both signals to aggregate against.
- [ ] Confirm the 7.5 12-person cohort is still in the seed and that destinations table still renders.
- [ ] Confirm `sebenza_freshness_confidence(timestamp)` SQL function is the one 9.8.7 uses (we reuse it).

---

## 📋 TASKS

### Task 9.13.1: Audit & confirm 9.12 data is flowing (verify, don't assume)
- [ ] Walk the seeded student's learning items via DB query; confirm `state` + `abandon_reason` columns
      populated as expected.
- [ ] Confirm `/dashboard/grow` student lane still renders + the destinations table data source.
- [ ] No code change in this task  it's the "check 9.12 actually landed" gate.

### Task 9.13.2: Programme × skill mapping schema + seed
- [ ] **Migration `0021_phase9_13_programme_skills.sql`** (additive):
      - New `programme_skills` table: `institution_slug` (FK institutions) × `programme` (text, matches
        `academic_profiles.programme` shape) × `skill_slug` (FK skills) × `weight` (integer 1..10,
        default 5) × `created_at`. PK on `(institution_slug, programme, skill_slug)`. Indexes on
        `(skill_slug)` + `(institution_slug, programme)`.
      - No new enums.
- [ ] Seed a hand-curated mapping for the top SA institutions × top programmes already in the
      `institutions` seed (Wits BSc CS, UCT BSc Eng, Stellenbosch BCom, UJ BCom IT, etc.). Aim for
      8–12 institutions × 2–3 programmes each × 6–10 skills per programme. Documented in the seed
      file as a hand-curated curriculum approximation pending SAQA feed (dormant Phase 8 adapter).
- [ ] No queries built yet  this task just ships the table + seed so 9.13.3 + 9.13.4 can read from it.

### Task 9.13.3: Demand-vs-curriculum query + student-side + gov-side surfaces
- [ ] New aggregate `demandVsCurriculumQuery({ institutionSlug?, programme?, provinceSlug? })` in
      `db/queries/curriculum.ts`:
      - Joins `programme_skills` × `skillDemandQuery` (province-scoped).
      - Returns per-skill rows: `{ skillSlug, label, demandScore, inProgramme: boolean, weight, gap: number }`.
      - For gov-side cross-market cuts: applies `outcomes_research` consent gate (D1) +
        `suppress()` (D2) + freshness weighting (D6).
- [ ] Student-side surface on `/dashboard/grow` (student lane): new `<ProgrammeVsMarketCard>` 
      "Your programme covers 7 of the 11 skills Gauteng currently demands for BSc CS graduates."
      Renders the seeker's own programme vs their own province, no consent gate (it's their own data
      view). Below-floor renders D2's "limited data" state.
- [ ] Gov-side surface at new route `/gov/curriculum`:
      - Province filter (matches `/gov/shortage`).
      - Programme dropdown populated from `academic_profiles` distinct values.
      - Bars / table mirroring `<DeclineReasonsCard>` idiom.
      - CSV export at `/api/gov/curriculum/export`  reuses `csvFromRows()` + `csvDisposition()`;
        suppression preserved (D2); audit-logged as `analytics.export`.
- [ ] Remove the mock from `lib/mock/academic.ts` once both surfaces read live (mark the file as
      "data lifted to DB query; mock retained for student-lane copy stubs only" or delete cleanly).

### Task 9.13.4: "Why learners stall" aggregate query + gov surface
- [ ] New aggregate `stallReasonAggregateQuery({ orgScoped?, provinceSlug? })` in
      `db/queries/stall-reasons.ts`:
      - Reads `learning_items` rows in `state = 'abandoned'`.
      - Groups by `(skill_slug, province_slug, abandon_reason)`.
      - Per D5: no `provider` dimension. Per D6: freshness-weighted on `abandoned_at`. Per D1:
        gated on `outcomes_research` consent for inclusion. Per D2: `suppress()`-floored.
- [ ] Extends `/gov/shortage` with a new section `<StallReasonsCard>` (mirrors `<DeclineReasonsCard>`
      visual idiom  bars, mobile-first cards). Cross-references the 9.8.7 decline-reasons card with a
      footer line: *"Compare with employer decline reasons above  a salary-driven skill gap reads
      differently from a learning-cost-driven one."*
- [ ] CSV export at `/api/gov/stall-reasons/export`; same hardening pattern as 9.8.7.

### Task 9.13.5: POPIA, wiring, verification, doc convention
- [ ] **Consent/POPIA:** per D1, both gov-side queries reuse `outcomes_research` as the inclusion gate
       no new consent purpose. Audit-log PII reads as everywhere else; CSV exports audit-logged as
      `analytics.export`.
- [ ] All strings in `messages/en.json`; `zu/xh/af` deepMerge fallback.
- [ ] Compliance assertions (extend the suite): (a) `demandVsCurriculumQuery` + `stallReasonAggregateQuery`
      emit **nothing below k**, incl. exports (re-uses 9.8.7 test harness shape); (b) neither query
      ever returns a `provider` dimension (D5 structural check); (c) gov-side inclusion set is
      strictly a subset of profiles with `outcomes_research = granted` (D1 structural check).
- [ ] `npm test` green; `npm run build` clean (typecheck + lint + static gen × 4 locales).
- [ ] Seed: extend 9.12's seed so at least 10 learners exist with `outcomes_research` granted +
      `abandoned` rows across 2 skills × 2 provinces × 2 reasons. This pushes one cell above k=10
      on the seed so the surfaces have one real unsuppressed cell at ship time  visible proof the
      query works, while every other cell honestly shows "limited data."
- [ ] On ship: `docs/completed/PHASE_9_13_COMPLETE.md`; move both 9.12 + 9.13 plans to `/completed/`
      if not already done; tick 9.13 in `ROADMAP.md` ✅ + date; refresh **Current State** in
      `TO_START_EVERY_SESSION.md`; confirm `docs/PHASE_10_PLAN.md` is the next active plan;
      commit `Phase 9.13 complete  learning-loop intelligence + Phase 10 opens`.

---

## 🚫 OUT OF SCOPE FOR 9.13 (explicit guardrails)

- ❌ **Provider-level aggregates**  D5. Reputational territory crosses the line.
- ❌ **Per-person curriculum or stall data on any surface**  aggregate + suppressed always.
- ❌ **Auto-feeding `programme_skills` from SAQA**  stays the dormant Phase 8 adapter; 9.13 ships the
  hand-curated mapping as a labelled approximation.
- ❌ **Reactivating SAQA / institution verification** (ROADMAP line 127)  remains deferred.
- ❌ **New consent purpose for learning analytics**  reuse `outcomes_research` per D1.
- ❌ **A separate "learning" gov nav entry**  the curriculum dataset gets its own page
  (`/gov/curriculum`); stall analytics extend `/gov/shortage` inline.

---

## ⚠️ RISK AREAS

1. **`programme_skills` mapping is hand-curated + biased toward coverage we know.** Honest framing
   matters: the page header says *"based on a curated mapping of programme outcomes  SAQA-fed
   accuracy lands when the partnership is in place."*
2. **Programme name normalisation.** `academic_profiles.programme` is free text (e.g. "BSc Computer
   Science" vs "Bachelor of Science: Computer Science"). 9.13.3's join needs a normalisation step or
   a lookup table  recommend a `programme_aliases` view or a normalised column added in 9.13.2's
   migration if the join misses on the seed.
3. **`/gov/curriculum` empty-state aesthetics.** At launch, most cells will be suppressed.
   `<ProgrammeVsMarketCard>` + the gov page need to *look intentional* in that state, not broken.
   Reuse 9.8.7's `<DeclineReasonsCard>` pattern explicitly.
4. **Cross-section consistency with 9.7 + 9.8.7.** Three suppression-floored surfaces in the same
   gov section now (`/gov/shortage` decline reasons + new stall reasons + `/gov/curriculum`). Same
   floor (k=10), same freshness function, same `outcomes_research` gate where applicable  verify
   parity at ship time so reviewers see a coherent analytics chapter, not three independent surfaces.

---

## 🧭 WHY THIS IS THE LAUNCH-CLOSING SIDE-PHASE

9.7 mapped *who's hiring and why some demographics are under-represented*. 9.8.7 mapped *why open
roles stay unfilled*. 9.11 closed the loop on *what happens when a role is filled and others miss out*.
9.12 turns *individual seeker effort* into a tracked, audited loop. 9.13 is what makes that effort
visible as a **structural map of where the education-to-work pipeline leaks**  without ever naming
an individual, an employer, or a provider.

Pre-launch, this is the last analytic that doesn't yet exist. After 9.13 the gov-pitch story is complete
end-to-end: demand → curriculum → learner → barrier → hire → outcome. Phase 10 then ships the
language + accessibility + perf-budget polish needed to put it in front of the public.

*Plan opened 2026-05-25. Target: complete after 9.12 has shipped + at least one seed run has populated
`learning_items` with stalled + completed rows. Both 9.12 and 9.13 must land before Phase 10.*
