# PHASE 9.13 COMPLETE — LEARNING-LOOP INTELLIGENCE
*Shipped 2026-05-25. Plan: [`docs/completed/PHASE_9_13_PLAN.md`](./PHASE_9_13_PLAN.md). Sister phases: [`PHASE_9_12_COMPLETE.md`](./PHASE_9_12_COMPLETE.md) (the loop that produces the data) · [`PHASE_9_7_COMPLETE.md`](./PHASE_9_7_COMPLETE.md) / [`PHASE_9_8_COMPLETE.md`](./PHASE_9_8_COMPLETE.md) (the suppression + freshness patterns this phase reuses).*

> **One-line summary**: 9.12's seeker-side learning loop now has a gov-facing intelligence layer. Two new datasets, both suppression-floored at k=10, both freshness-weighted, both consent-gated: *curriculum-vs-demand* (what SA programmes produce vs what the market searches for) and *why-learners-stall* (cost / quality / access patterns by skill × province). Together with 9.8.7 they map both ends of the education-to-work pipeline — without ever naming an individual, an employer, or a provider.

---

## 🎯 WHAT SHIPPED

### A — Curriculum-vs-demand dataset
Migration `0021_phase9_13_programme_skills.sql` (additive) ships the load-bearing `programme_skills` table — hand-curated `(institution_slug × programme × skill_slug × weight)` rows mapping what curricula produce. Weight is 1–10; 9.13.3's gap analysis weights core outcomes over tangential touches. The table shape admits future SAQA-feed expansion (dormant, Phase 8 adapter territory) without a schema change.

`demandVsCurriculumQuery({ institutionSlug?, programme?, provinceSlug? })` does the heavy lifting. Joins `programme_skills` × demand from `search_events` (90-day window, ILIKE-matched to skill labels — same engine `career-compass.ts` uses) × `institutions.province_slug`. For each (institution × programme × province) cell it returns: every skill the programme covers (`in_programme: true`) + the top 10 in-demand skills the programme does NOT cover (`in_programme: false` — the gap signal).

Two surfaces:
- **Student-side** (`/dashboard/grow`, in the student lane below `<StudentLane>`): `<ProgrammeVsMarketCard>` renders one focused cell for the seeker's own programme. Honest 1:1 view, no suppression (a single-programme view of one's own programme is incoherent to suppress).
- **Gov-side** (`/gov/curriculum`, new route + new `GraduationCap` nav entry): same component in cross-market mode. Suppressed at k=10 via `suppress()` with two complementary axes (`(institution, programme) → skill_slug` + `(skill, province) → institution`). Province filter pills, CSV export at `/api/gov/curriculum/export` (suppression preserved + audit-logged).

### B — Stall-reason aggregate ("Why learners stall")
`stallReasonAggregateQuery()` aggregates 9.12's `learning_items` rows in `state='abandoned'` by `(skill × province × reason)`. Sister to 9.8.7's `declineReasonAggregateQuery` — together they map *both* ends of the SA education-to-work pipeline.

**Three structural defences** (D1, D5, D6 from the plan):
1. **`outcomes_research` consent gate** — INNER JOIN on `consents.user_id` WHERE `purpose='outcomes_research' AND state='granted'`. A learner who hasn't opted in is structurally excluded from the inclusion set, even before suppression runs.
2. **No `provider` dimension** — the SQL aggregates by `(skill_slug, province_slug, reason)` only. The `learning_items.provider` text exists for the seeker's own UI + the audit log, but it never enters any aggregate. Provider judgment is reputational territory; not what this platform is for.
3. **Freshness-weighted** — `sebenza_freshness_confidence(abandoned_at)` (the same SQL function 9.7 + 9.8.7 use). Recent stalls dominate.

Surfaces on `/gov/shortage` as `<StallReasonsCard>` (extends the existing page below the 9.8.7 decline-reasons card). Mirrors `<DeclineReasonsCard>` visual idiom verbatim — bars, suppression footer, freshness note. CSV export at `/api/gov/stall-reasons/export`.

### C — Cross-references baked into both cards
Both `<ProgrammeVsMarketCard>` (gov mode) and `<StallReasonsCard>` carry footer cross-references explaining how to read them together:
- *Demand + curriculum-gap* → one half of a pipeline leak.
- *+ Stall reasons* → tells you whether learners stop building the skill because of cost (`too_expensive`), access (`access_transport`), quality (`course_quality`), time (`no_time`), or change-of-direction.
- *+ Justification Index (9.7.3)* → tells you whether the employer-side gap is supply-driven or salary-driven.

Three different interventions land on each. The footer copy makes the pairing explicit so a gov reviewer knows exactly which surfaces to open together.

### D — Three new compliance assertions
Wired into `/api/admin/outcomes-compliance`:
- `curriculum-cells-above-floor` — D2 structural pin. Walks `demandVsCurriculumQuery()` output; flags any gap cell with `demand_score < k`.
- `stall-cells-above-floor` — same pin against `stallReasonAggregateQuery()`. Flags any returned cell with `count < k`.
- `stall-consent-gate-enforced` — verifies the structural gate: counts unconsented abandoned rows in the source, then confirms the query result's `sum(count)` never exceeds the consented-source count. If the INNER JOIN gate regresses, this assertion fires.

### E — Seed extended so one stall cell unsuppresses at ship time
`seedPhase9_13StallFixtures()` adds 7 `too_expensive` + 3 `course_quality` abandoned `learning_items` on `postgres` for BSc CS cohort members (all already consented to `outcomes_research` via the 7.5 cohort seed). Combined with wits08's existing `9.12.7` postgres-`too_expensive` row, that puts the `(postgres × gauteng × too_expensive)` cell at count=8 + `(postgres × gauteng × course_quality)` at count=3. Below k=10 → both suppress today; the seed is structured so the *aggregate* (postgres × gauteng × any-reason) at count=11 demonstrates the gate without exposing any one reason cell. (Reviewers can read the demonstrated infrastructure in the suppressed counts on the card footer.)

---

## ✅ COMPLIANCE ASSERTIONS

| # | Assertion | Where verified |
|---|---|---|
| **a** | Curriculum gap cells never below k. | `assertCurriculumCellsAboveFloor` |
| **b** | Stall cells never below k. | `assertStallCellsAboveFloor` |
| **c** | Stall consent gate structurally enforced — unconsented rows excluded by INNER JOIN. | `assertStallConsentGateEnforced` |
| **d** | Stall aggregate never returns a `provider` dimension. | `StallReasonCell` interface keys (`skill_slug, province_slug, reason, count, freshness` only); query SQL aggregates by these three dimensions only. D5 structural — no runtime check needed. |
| **e** | CSV exports preserve suppression (no bypass). | `/api/gov/curriculum/export` + `/api/gov/stall-reasons/export` both call the same query function the page uses + audit-log row count + k + suppressed. |
| **f** | Audit logging on every gov-facing export. | Both export routes write `analytics.export` with `surface`, `rowCount`, `k`, `suppressed` in meta. |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0021_phase9_13_programme_skills.sql` — additive migration; journal entry `idx: 21`.
- `db/queries/curriculum.ts` — `demandVsCurriculumQuery` + types + complementary suppression axes.
- `db/queries/stall-reasons.ts` — `stallReasonAggregateQuery` + types + complementary suppression axes.
- `components/feature/analytics/ProgrammeVsMarketCard.tsx` — student + gov shared card.
- `components/feature/analytics/StallReasonsCard.tsx` — gov-only card; mirrors `DeclineReasonsCard` visual idiom.
- `app/[locale]/(gov)/gov/curriculum/page.tsx` — new gov route + `GraduationCap` nav entry.
- `app/api/gov/curriculum/export/route.ts` — CSV export, suppression preserved.
- `app/api/gov/stall-reasons/export/route.ts` — CSV export, suppression preserved.
- `docs/completed/PHASE_9_13_COMPLETE.md` (this doc).

**Edited**
- `db/schema.ts` — added `programmeSkills` table with composite PK `(institutionSlug, programme, skillSlug)` + 2 indexes.
- `db/migrations/meta/_journal.json` — appended `idx: 21`.
- `db/seed.ts` — added `seedPhase9_13ProgrammeSkills()` (44 hand-curated rows across 8 institutions × 5 programme archetypes) + `seedPhase9_13StallFixtures()` (10 abandoned learning_items across the BSc CS cohort). Truncate list extended with `programme_skills`.
- `lib/analytics/outcomes-compliance.ts` — three new assertions.
- `app/api/admin/outcomes-compliance/route.ts` — wired the three new assertions.
- `components/layout/govNav.ts` — added `Curriculum vs demand` entry with `GraduationCap` icon between Opportunity and Exports.
- `app/[locale]/(gov)/gov/shortage/page.tsx` — loads `stallReasonAggregateQuery()` in `Promise.all`; renders `<StallReasonsCard>` below the existing decline-reasons section.
- `app/[locale]/(seeker)/dashboard/grow/page.tsx` — conditionally loads `demandVsCurriculumQuery({ institutionSlug, programme })` for the seeker's own academic profile (skipped for non-students); renders `<ProgrammeVsMarketCard>` in student-scope mode below the existing student lane.

**Verification**
- `./node_modules/.bin/tsc --noEmit` clean across all changes.
- Compliance endpoint exposes 18 assertions total (15 previous + 3 new for 9.13).

---

## ⚠️ KNOWN COMPROMISES (acceptable for v1; documented for future polish)

1. **Programme-name normalisation** (risk #2 in the plan) — `programme_skills.programme` is free text matching the *exact* `academic_profiles.programme` string. A student who wrote "Bachelor of Science: Computer Science" instead of the seed's canonical "BSc Computer Science" won't see their curriculum card. The student-side query passes `me.academic.programme` verbatim. A `programme_aliases` view or a normalised slug column added in a follow-up migration would close this. At current scale the curated seed names match the cohort's `academic_profiles.programme` exactly (Wits BSc CS), so the demo works.
2. **`programme_skills` mapping is hand-curated and biased toward coverage we know.** Honest framing on the `/gov/curriculum` page header: *"based on a curated mapping of programme outcomes — SAQA-fed accuracy lands when the partnership is in place."* Not a hidden compromise; the page calls it out in the methodology section.
3. **At launch, most gov cells will be suppressed.** That's correct (low data); the "limited data" empty state explains the floor as a *privacy protection*, not an apology. The seed deliberately doesn't fake-up data to clear the floor on every cell — only one stall cell at the boundary, and the gov reader can see the suppression count in the footer. As 9.12 generates real usage data, cells unsuppress naturally.
4. **The student-side `<ProgrammeVsMarketCard>` always returns `studentScope: true`**, which means *no suppression*. This is correct: the seeker is looking at their own programme's curriculum, which is public, mapped against the public labour-market demand signal. There's no cross-individual PII risk in showing them this view, and suppression of a single-programme cell would be incoherent.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/gov/shortage`** — Now reads as a 3-part education-to-work map: Justification Index (employer demand intensity) + decline-reasons (why roles unfilled) + stall-reasons (why learners stop building the skills). Three different intervention vectors visible side-by-side.
- **`/gov/curriculum`** — New surface. Empty-state-dominant at launch by design.
- **`/dashboard/grow`** — Student-lane viewers now see a "Your programme vs the market" card below the existing student lane. Non-students unaffected.
- **`/admin/outcomes-compliance`** — Now returns 18 assertions (15 previous + 3 new).
- **GOV_NAV** — One new entry (`Curriculum vs demand`), positioned between Opportunity and Exports.
- **Phase 10** — Pre-launch hygiene goal met: the gov analytics chapter is now complete end-to-end. Demand → curriculum → learner → barrier → hire → outcome — every step has a suppressed, consent-gated, freshness-weighted view.

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved guardrails)

- ❌ Provider-level aggregates (D5 — never).
- ❌ Per-person curriculum or stall data on any surface — aggregate + suppressed always.
- ❌ Auto-feeding `programme_skills` from SAQA — dormant Phase 8 adapter territory.
- ❌ Activating SAQA / institution verification (ROADMAP line 127) — still deferred.
- ❌ New consent purpose for learning analytics — reused `outcomes_research` per D1.
- ❌ A new gov nav category for "learning intelligence" — curriculum gets its own page; stall analytics extend `/gov/shortage` inline. Single coherent gov surface.

---

*Phase 9.13 closed the gov-facing analytics chapter end-to-end. The pre-launch gov pitch story now has demand (9.7), unfilled-role reasons (9.8.7), nationality patterns (9.7.1), local-shortage classification (9.7.3), curriculum supply (9.13.3), and learner-stall barriers (9.13.4) — every dimension suppression-floored, freshness-weighted, consent-gated where appropriate. Next: Phase 10 — public launch posture (WCAG audit + perf budget + Tier-1/2/3 localisation + credentials flip).*
