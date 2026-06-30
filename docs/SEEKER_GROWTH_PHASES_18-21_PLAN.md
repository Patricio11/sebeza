# SEEKER GROWTH — PHASES 18–21 (forward roadmap)

*Opened 2026-06-30. Direct continuation of **Phase 17 — Seeker Growth Suite** (shipped: The Climb,
Demand Pulse, AI Career Coach). Phase 17 closed two of the six gaps from the skill-development
assessment; this roadmap turns the **remaining four** into discrete, flag-gated, ship-dark phases.*

> **Numbering:** 17 shipped (`completed/PHASE_17_SEEKER_GROWTH_SUITE_PLAN.md`). 18 → 21 are new. Each phase
> can spin out its own `PHASE_NN_*.md` when work starts (mirroring 17), marking tasks DONE inline.

---

## 🗺️ WHERE THE SIX GAPS LANDED

| # | Gap (from the assessment) | Status | Home |
|---|---|---|---|
| 1 | Learning progress invisible (no checkpoints / rank delta / momentum) | ✅ **Done** | Phase 17.1 — The Climb |
| 5 | Skill attachment binary (proficiency hardcoded `3`) | ✅ **Done** | Phase 17.1 — `CompleteSkillModal` |
| — | (Demand timeliness — weekly "heating up" nudge) | ✅ **Done** | Phase 17.2 — Demand Pulse |
| — | (Seeker-facing AI coaching) | ✅ **Done** | Phase 17.3 — AI Career Coach |
| 2 | Learning-paths catalog static + manually curated + rots | ⏳ **Phase 18** |
| 3 | "Other / custom skills" unimplemented (taxonomy-only) | ⏳ **Phase 19** |
| 4 | No prerequisite mapping / learning sequencing | ⏳ **Phase 20** |
| 6 | Demand insight is province-level only (no hyper-local signal) | ⏳ **Phase 21** |

**Confirmed current state (grounded 2026-06-30):** paths live in `lib/mock/growth.ts` (`MOCK_COMPASS`)
+ `lib/seeker/free-alternatives.ts`; `profile_skills.skill_slug` carries an FK to `skills.slug`
(taxonomy-only — the comma-split combobox matches the catalogue and drops unknowns); no
`skill_prereqs` table exists; `getNearYouDemand` filters `search_events.filters->>'province'` only.

---

## 🔒 SHARED NON-NEGOTIABLES (every task in every phase below)

Identical posture to Phase 17 — repeated here so each phase doc inherits it:

> ### Testing discipline (NON-NEGOTIABLE)
> Nothing is "done" until it is **tested and green**, before its commit:
> 1. **`npm run test:all`** — typecheck + lint + the full vitest suite passes.
> 2. **E2E at desktop AND 360px, both flag states** — **flag OFF = today's behaviour unchanged**
>    (proves zero regression), **flag ON = the new surface works**. Flag-on specs flip the flag in
>    the test DB and **restore it in `afterAll`** so the dark-ship default holds for every other suite.
> 3. **No negative impact** on existing seeker/employer/admin/gov arcs. Broken → fixed before commit.
> 4. **Migrations** apply clean from zero (the harness migrates-from-zero in `global-setup`); journal
>    contiguous; idempotent `ADD COLUMN/TABLE IF NOT EXISTS`.

**Product rules:** No-Flash (CSS-only motion, ~150KB JS budget, 360px-first) · POPIA-First (audited,
consent-respecting, soft-delete) · Verification-Honesty (self-attested never reads "verified") ·
Location-Not-Nationality · i18n-ready (en base + deepMerge; **never machine-translate consent/legal**).

**Flag pattern (reuse Phase 17 scaffolding exactly):** each new seeker surface gets a
`feature_flag_*` `SettingKey` (default `false`) in `lib/admin/settings.ts` + DEFAULTS, the
`settings-actions.ts` validator map **and** the `updateSetting` enum, and a boolean row in
`SettingsForm.tsx` (auto-renders in "Feature flags"). Off = byte-for-byte today.

**Civic Editorial UX bar (the user's explicit bar — senior-grade, not a SaaS template):** editorial
layouts, thick rules, all-caps eyebrows w/ tracking, Fraunces tabular numerals, the Talent Pulse
glyph, warm paper/ink + teal brand + one ochre accent. Each phase's "UX" notes below are
load-bearing, not decoration.

---

## 📚 PHASE 18 — LIVING LEARNING CATALOG (Gap 2)

**Why first:** every other learning feature reads the catalog. Moving it off a hardcoded constant
into a DB table with a freshness contract + a feedback loop is the foundation — and it unblocks the
Phase 7 provider-hiring work. **Flag:** `feature_flag_living_catalog` (gates the *new* seeker-facing
rating UI + editorial surfaces; the migration itself is behaviour-preserving and unflagged).

**Thesis:** the catalog should *learn as seekers use it* — clicks, completions, and ratings flow
back so product sees which paths convert and which rot, and admins get a re-verification heartbeat.

### 18.0 — Schema + behaviour-preserving migration ✅ DONE 2026-06-30
- ✅ New `learning_paths` table (migration `0053`): `id`, `title`, `provider`, `provider_kind`,
  `cost` (free/subsidised/paid  matches the existing `LearningCost`, not a ZAR field), `cost_note`,
  `outcome`, `duration_weeks`, `unlocks_skills` (jsonb label[]), `national`, `url`, `sebenza_reviewed`,
  `last_verified_at`, `review_count`, `recommend_count` (would-recommend roll-up  no fake stars),
  `sort_order` (preserves the constant's render order), `metadata` (jsonb), `created_at`, `deleted_at`.
- ✅ New `learning_path_reviews` table: `id`, `path_id` FK, `profile_id` FK, `would_recommend`,
  `blocker` (optional), `created_at`, `unique(path_id, profile_id)`.
- ✅ **Seed parity:** `seedLearningPaths()` ports `MOCK_COMPASS.learningPaths` verbatim (single source
  → the constant stays the editable fixture; the table mirrors it). New `db/queries/learning-paths.ts`
  (`listAllLearningPaths`, `getLearningPath`); the three consumers now read the DB:
  `career-compass.ts` (`pickRelevantPaths`), `free-alternatives.ts` (pure `pickFreeAlternative` +
  async `findFreeAlternativeForSkill`), `learning.ts` (`matchLearningPathForSkill` → async).
- ✅ **Tests (green):** `test:all` → typecheck + lint (0 errors) + **322 vitest** incl. a new
  integration **parity test** (`tests/integration/learning-paths-parity.test.ts`: DB catalog ===
  constant, same order + every field) + the refactored pure-picker unit test · build ✅ · migration
  `0053` clean from zero · **24/24 seeker + role-arc E2E** (compass/grow renders identically). ⚠️ Dev
  DB: run `npm run db:migrate` before the catalog reads from the table.

### 18.1 — Seeker feedback loop (flag-gated) ✅ DONE 2026-06-30
- ✅ **Flag** `feature_flag_living_catalog` (settings.ts + DEFAULTS + settings-actions validator/enum +
  SettingsForm row  same Phase-17 pattern). Default OFF.
- ✅ **Per-card review control** (`PathReviewControl`) on each `/dashboard/grow` learning-path card:
  one-tap "Took this path?" 👍 Recommend / 👎 Not for me + an optional note → `submitPathReview`
  (`lib/seeker/path-reviews.ts`): flag-gated, seeker-scoped, upserts `learning_path_reviews`
  (one per seeker/path), recomputes `review_count` / `recommend_count` from source rows (no drift),
  audits `learning_path.reviewed` (meta `wouldRecommend` + `hasBlocker` only  never the note text),
  revalidates grow. Opt-in self-attestation (honesty), No-Flash.
- ✅ **Recommend roll-up** "Recommended by N of M seekers who took it" renders **only when
  `review_count ≥ 5`** (k-anonymity floor; below it → nothing, not "no reviews"). `LearningPath` gains
  DB-only `id` / `reviewCount` / `recommendCount` (absent on the seed constant → parity test holds).
- ✅ **Tests (green):** `test:all` → typecheck + lint (0 errors) + **322 vitest** + build · **flag OFF
  E2E** (no control) + role-arc **12/12** = zero regression · **flag ON E2E** (control renders + submit
  confirmed). New `tests/e2e/living-catalog.spec.ts` (desktop + 360px); flag + reviews + counts
  restored in afterAll.

### 18.2 — Editorial / freshness admin (admin-gated) ✅ DONE 2026-06-30
- ✅ `/admin/learning-paths` + `LearningPathsManager` island: a "Needs re-verification" rail
  (ochre, count) over the full path table with per-row **Verify / Edit / Remove / Restore** + an
  **Add** form. Admin actions `lib/admin/learning-paths.ts` (`create` / `update` /
  `markVerified` / `softDelete` / `restore`)  verifyAdmin + Zod + audited `admin.learning_path.edit`
  (`meta.action`) + revalidate admin **and** `/dashboard/grow`. Nav item added.
- ✅ **Freshness heartbeat:** `countStaleLearningPaths()` (live + `last_verified_at` null or > 90d) +
  weekly cron `/api/cron/learning-path-freshness` → `notifyAllAdmins` (`admin.learning_path.stale`,
  in-app, 6-day dedupe). Seeded paths are verified-at-launch so they don't flag stale on day one.
- ✅ **Tests (green):** `test:all` → typecheck + lint (0 errors) + **325 vitest** + build · **admin E2E
  4/4** (`tests/e2e/admin-learning-paths.spec.ts`: a forced-stale path appears in the rail → re-verify
  clears it; remove → restore) + role-arc regression green. Desktop + 360px; one path forced stale in
  beforeAll, all paths restored fresh + active in afterAll.
- ↪ Deferred (noted): per-path click analytics from the `learning_path.opened` audit (the opened
  audit isn't keyed to `learning_paths.id` today); a small follow-up, not blocking the freshness loop.

---

## ➕ PHASE 19 — CUSTOM SKILLS & TAXONOMY GROWTH (Gap 3)

**Why:** emerging SA markets (climate tech, rural trades) outrun the controlled taxonomy. Seekers
must be able to claim niche skills — and those claims become the signal that *grows* the taxonomy.
**Flag:** `feature_flag_seeker_custom_skills`.

**Honesty + privacy spine:** custom skills are **self-attested, never "verified"**, and **never
enter search** (D2 k-anonymity) until an admin promotes them to canonical. They *do* count toward
profile completeness, and they feed an aggregate "most-requested unindexed skills" analytic.

### 19.0 — Schema + data layer ✅ DONE 2026-06-30
- ✅ New `profile_skills_custom` table (migration `0054`): `id`, `profile_id` FK, `label` (≤ 60),
  `label_normalized` (lowercased/collapsed key), `proficiency`, `years_of_experience`, `created_at`,
  `deleted_at`. **Partial unique** `(profile_id, label_normalized) WHERE deleted_at IS NULL` so a
  removed label can be re-added. (Provenance is implicit — the table *is* the self-attested-custom lane.)
- ✅ Actions `lib/profile/custom-skills.ts` (`addCustomSkill` / `removeCustomSkill`): flag-gated
  (`feature_flag_seeker_custom_skills`), seeker-scoped, **cap 3** + dup + canonical-label rejection
  ("add it from the picker"), audited `profile.custom_skill.add/remove` (meta = normalized label =
  the demand signal). Read `db/queries/custom-skills.ts` (`listCustomSkills`).
- ✅ **Completeness:** custom skills count toward `computeCompleteness` (shared recompute in
  `actions.ts` + the action persists it) — the seeker is rewarded for documenting niche skills,
  while they stay out of search.
- ✅ **Tests (green):** `test:all` → typecheck + lint (0) + **327 vitest** incl. a new integration
  invariant (`custom-skills-not-searchable.test.ts`: a distinctive custom label attached to a seeker
  never surfaces them in `searchProfilesQuery`) + build; migration `0054` clean. ⚠️ Dev DB: `db:migrate`.

### 19.1 — Seeker editor (flag-gated) ✅ DONE 2026-06-30
- ✅ `CustomSkillsEditor` rendered **below** the taxonomy `SkillsEditor` on `/dashboard/profile`
  (flag-gated): a "Self-described skills" group (distinct dashed card, `N/3` counter, quiet "count
  toward completeness but aren't searchable yet" note) + an inline add row (label + 1–5 level select
  + optional years) → `addCustomSkill`; per-chip remove → `removeCustomSkill`. 360px-stacks, No-Flash.
- ✅ Completeness already counts custom skills (19.0). Canonical-label collisions are pushed back to
  the picker; cap/dup are surfaced as inline errors.
- ✅ **Tests (green):** `test:all` (327 vitest) + build · **flag OFF E2E** (no section) + seeker-arc
  **12/12** = zero regression · **flag ON E2E** (add → chip appears → remove → gone). New
  `tests/e2e/custom-skills.spec.ts` (desktop + 360px); flag + rows restored in afterAll. The
  not-searchable guarantee is proven at the data layer (19.0 invariant test).

### 19.2 — Admin canonicalization workflow (admin-gated) ✅ DONE 2026-06-30
- ✅ `/admin/custom-skills` + `CustomSkillsLeaderboard`: aggregated, **anonymized** leaderboard
  (`listCustomSkillLeaderboard` — distinct seeker COUNT per normalized label, never which seekers).
  One-click **Promote** reveals a pre-filled slug → `canonicalizeCustomSkill` (`lib/admin/custom-skills.ts`):
  verifyAdmin + Zod, creates the `skills` row, **migrates** every live holder into `profile_skills` at
  their own self-attested proficiency/years (the new slug can't collide), soft-deletes the custom rows,
  audits `admin.custom_skill.canonicalize`. The existing `profile_skills` trigger refreshes each
  holder's search vector → **they become searchable immediately**. Nav item added.
- ✅ **Tests (green):** `test:all` (327 vitest) + build · **admin E2E 2/2**
  (`tests/e2e/admin-custom-skills.spec.ts`: seed a custom skill → Promote → the label leaves the board
  → DB assertions: canonical `skills` row exists, holder migrated into `profile_skills`, custom row
  retired) + role-arc regression. Desktop + 360px (dismisses the cookie banner that overlaps on mobile);
  all seeded/created rows removed in afterAll.

---

## 🔗 PHASE 20 — SKILL PREREQUISITES & SEQUENCING (Gap 4)

**Why:** recommending "Kubernetes" before "Docker" wastes seeker effort. A lightweight prerequisite
graph makes the compass *teach in the right order* and turns each completion into a "what's next"
moment. **Flag:** `feature_flag_skill_prereqs`.

### 20.0 — Schema + editorial graph
- New `skill_prereqs` table: `skill_slug` FK, `prereq_skill_slug` FK, `reason` (text ≤ 160),
  `created_at`, `primary key (skill_slug, prereq_skill_slug)`. Admin-curated (small, high-signal —
  not a full ontology). Seed a starter set for the densest professions (software, data, trades).
- Cycle-guard in the write path (a prereq chain may not loop).

### 20.1 — Compass re-weighting + prereq pills (flag-gated)
- In `db/queries/career-compass.ts`: after fetching the top-N demand skills, **re-order** so a
  recommended skill never appears above its own unmet prerequisite — bubble the prereq up. Pure
  re-rank; the demand math is unchanged (honesty: we don't fabricate demand, we sequence it).
- **UX:** a quiet "Requires: Docker" pill on recommendation cards (only when the prereq is unmet);
  Fraunces-cap eyebrow, hairline border, no color alarm. On a met prereq → no pill (don't nag).
- **Tests:** flag-ON E2E (a profile missing Docker sees Docker ranked above Kubernetes + the pill);
  flag-OFF = original demand-gap order; unit test for the re-rank + cycle guard.

### 20.2 — "Unlocks next" moment (flag-gated)
- On completing a skill that is a prerequisite for an in-demand skill, the My Learning section shows
  an **"Unlocks next"** card: "You now have Docker. DevOps roles also want Kubernetes — add it?" →
  one-tap accept into the learning loop (reuses `AcceptRecommendationButton`).
- **UX:** appears inline in `MyLearningSection` only when there's a real unlocked next step; ties into
  The Climb's momentum framing (continuity, not a new pattern). Dismissible.
- **Tests:** flag-ON E2E (complete a prereq → unlocks card → accept adds the next item); flag-OFF =
  no card.

---

## 📍 PHASE 21 — HYPER-LOCAL DEMAND SIGNAL (Gap 6)

**Why:** "Gauteng wants data-eng" is true but blunt — Sandton fintech ≠ Soweto contractors. City-
scale signal is high-value **but privacy-sharp**, so it ships behind both a flag **and** a consent
gate, k-anonymized, top-metros-only. **Flag:** `feature_flag_city_demand` + consent
`outcomes_research`.

### 21.0 — Capture city (behaviour-preserving)
- Extend the `/search` write path to store an optional `city` in `search_events.filters` (nullable;
  province still always written). No read-path change yet — pure capture, backfill-safe.
- **Tests:** unit test the write; existing demand queries unchanged (province path intact).

### 21.1 — City aggregation behind k-anonymity + consent (flag-gated)
- New query path in `getNearYouDemand` / `demandVsCurriculumQuery`: city-level aggregation that
  **only** returns a segment when (a) the seeker's city is a top-5 metro (Joburg, Cape Town, Durban,
  Pretoria, Gqeberha), (b) the segment clears a search-count floor (k-anonymity), and (c) the seeker
  has `outcomes_research` consent. Otherwise → silently fall back to the province rail (no empty
  state, no "we'd show you more if…").
- **Tests:** unit tests for each gate (below-floor → suppressed; non-metro → suppressed; no consent →
  suppressed); compliance test that no city segment leaks below the floor.

### 21.2 — "Your city's hotspots" surface (flag-gated)
- A new section on `/dashboard/grow` below the province rail: 3–4 city micro-segments (e.g. "Sandton
  fintech — 1,240 employer searches", top-3 skills each). Renders only when 21.1 yields ≥1 segment.
- **UX:** editorial card grid, ordinal pillars, tabular search counts, ochre accent on the hottest
  segment; an explicit "based on employer searches in your city" provenance line + a one-line consent
  reminder with a link to toggle it off. Honesty: it's market signal, not a job guarantee.
- **Tests:** flag-ON E2E (seed metro city searches + consent → hotspots render; revoke consent → gone);
  flag-OFF = grow page unchanged.

---

## 🧭 SEQUENCING & DEPENDENCIES

```
18 Living Catalog ──(catalog is the substrate everything reads)──► do first; unblocks Phase 7 hiring
19 Custom Skills  ──(grows the taxonomy)──► feeds 20's graph with richer canonical skills
20 Prereqs        ──(operates on canonical skills)──► best after 19 lands some promotions
21 City Demand    ── independent; gated hardest (consent + k-anon) ──► can run any time, suggest last
```

Recommended order **18 → 19 → 20 → 21** (matches the assessment's highest-impact ordering, minus the
two gaps Phase 17 already closed). 21 is independent and can be pulled forward if hyper-local signal
becomes a priority, since it shares no schema with 18–20.

---

## 🚫 OUT OF SCOPE (all four phases)

- Becoming an LMS / hosting course content (standing Phase 11 guardrail).
- City-level **profile** segments or any sub-province *seeker* cohort (only demand-side, k-anonymized).
- A full skill ontology / auto-inferred prerequisites (20 is small + admin-curated, high-signal only).
- Auto-verifying custom skills, or surfacing them in search before admin canonicalization.
- Any "guaranteed interview / job" framing, anywhere.

---

## 📌 STATUS

- [x] **Phase 18 — Living Learning Catalog** ✅ (18.0 schema/migration · 18.1 feedback loop · 18.2 editorial+freshness) — all flag-/admin-gated, test:all + E2E green
- [x] **Phase 19 — Custom Skills & Taxonomy Growth** ✅ (19.0 schema · 19.1 editor · 19.2 canonicalization) — flag-/admin-gated, test:all + E2E green
- [ ] **Phase 20 — Skill Prerequisites & Sequencing** (20.0 graph · 20.1 re-weight+pills · 20.2 unlocks-next)
- [ ] **Phase 21 — Hyper-Local Demand** (21.0 capture · 21.1 gated aggregation · 21.2 hotspots surface)

*Each phase: flag-gated, ship-dark, admin-switchable from `/admin/settings`, verified flag-OFF (zero
regression) + flag-ON (new surface) at desktop + 360px, with `test:all` + build green before commit.*
