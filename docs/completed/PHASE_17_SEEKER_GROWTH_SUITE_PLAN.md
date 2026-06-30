# PHASE 17 — SEEKER GROWTH SUITE (flag-gated, ship-dark)

*Opened 2026-06-22. Direct continuation of Phase 11 (Seeker Retention & Skill-Growth
Conversion). Derives from the differentiator in `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §3 line
46: the learning **flywheel** — "recommend → accept → progress → honest self-attested skill →
visible ranking gain — a retention + skills-growth flywheel, not a resource list."*

> **Numbering note:** 14 = zero-rating (`PHASE_14_PLAN.md`, partnership-gated); 15 + 16 shipped.
> This is the next new phase. Renumber freely if preferred.

---

## 🎯 THESIS

Phase 11 built the learning loop's *machinery* (recommendations, accept/progress states, honest
skill-attach, badges, the student lane). But the **most motivating + most *different* half of the
flywheel is invisible**:

- A seeker taps **Start** on a skill, then nothing happens until they tap **Mark complete** — the
  empty-state literally promises *"start tracking your progress,"* but `learning_items` has **no
  progress column**. The "Active" state is a void.
- The **rank payoff is never shown live.** `rankInPoolQuery` can already compute *"finish this →
  #31 → #22,"* and completion even calculates that delta for the notification — but the seeker
  never *watches their rank climb as they learn*. No job board does this. It is the wedge.
- On completion, proficiency is **hardcoded to 3** — the seeker's real depth is guessed, not owned.

This phase ships **three flag-gated seeker features**, each **default OFF** so it ships dark and
the admin switches it on from `/admin/settings`:

| Feature | Flag | What | Cost |
|---|---|---|---|
| **The Climb** | `feature_flag_seeker_skill_journey` | Live learning progress + visible rank payoff + seeker-set proficiency + a "Your growth" recap | Medium (1 migration + actions + UI) |
| **Demand Pulse** | `feature_flag_seeker_demand_pulse` | Weekly "your skill is heating up near you" nudge from real employer-search spikes | Low (reuse search_events + cron + notifications) |
| **AI Career Coach** | `feature_flag_seeker_ai_coach` | Seeker-facing LLM coach (interview practice), reusing the gated `llm_providers` dispatcher | High (heaviest; cost-gated; only runs once an admin configures a provider + budget) |

**Non-negotiables (every feature):** No-Flash (lightweight, CSS-only motion), POPIA-First
(audited, consent-respecting), Verification-Honesty (a self-attested skill never reads "verified"),
i18n-ready (en base + deepMerge), 360px-first. The AI Coach additionally inherits the LLM
dispatcher's multi-gate posture (active provider → budget → s.72 cross-border ack → feature flag →
PII guard): **zero spend until every gate is open.**

> ### 🔒 Testing discipline (NON-NEGOTIABLE — applies to every task here)
> Nothing is "done" until it is **tested and green**. For each feature, before its commit:
> 1. **Unit/compliance** — `npm run test:all` (typecheck + lint + the full vitest suite) passes.
> 2. **E2E both flag states** — at desktop **and** 360px: **flag OFF = today's behaviour
>    unchanged** (proves zero regression), and **flag ON = the new surface works** (proves the
>    feature). Flag-on specs flip the flag in the test DB and **restore it in `afterAll`** so the
>    dark-ship default holds for every other suite.
> 3. **No negative impact on existing functionality** — the existing seeker/employer/admin E2E
>    arcs stay green. If anything breaks, it is **fixed before commit**, never committed red.
> 4. **Migrations** apply clean (the test harness migrates-from-zero in `global-setup`).

---

## ✅ TASK 17.0 — Scaffolding (flags + admin toggles) — DONE 2026-06-22
- `lib/admin/settings.ts`: added 3 `SettingKey`s + DEFAULTS (all `false`).
- `lib/admin/settings-actions.ts`: added to the per-key validator map (`z.boolean()`) + the
  `updateSetting` key enum.
- `components/feature/admin/SettingsForm.tsx`: 3 boolean rows → auto-render in the "Feature flags"
  section as admin switches.
- Verified: typecheck clean.

---

## 🧗 TASK 17.1 — THE CLIMB (live skill journey) — ✅ DONE 2026-06-22
**Flag:** `feature_flag_seeker_skill_journey`. **Goal:** make the Active learning state a living,
visible climb, and make the payoff (rank gain) the emotional core.

### 17.1.a — Data + actions
- **Migration** `0052_*`: `learning_items.progress_percent integer NOT NULL DEFAULT 0` (idempotent
  `ADD COLUMN IF NOT EXISTS`; journal entry idx 52, `when` 1782400000000). Add to `db/schema.ts`.
- `lib/seeker/learning.ts`:
  - `setLearningProgress(itemId, percent)` — clamp 0–100; `accepted` → promote to `in_progress` +
    `startedAt`; audit `learning.progress`; revalidate grow + dashboard. Reject completed/abandoned.
  - `completeLearningItem(itemId, opts?: { proficiency?: 1–5; yearsOfExperience?: number|null })` —
    use the seeker's chosen proficiency/years on the **insert** (new skill) instead of the hardcoded
    `3`/null. Existing rows keep the upgrade-only honesty contract (provenance only; never downgrade
    `verified_provider`).
  - `listMyLearningItems()` + `MyLearningRow`: expose `progressPercent`.

### 17.1.b — UI (`components/feature/seeker/learning/`)
- `LearningItemRow`: for `accepted`/`in_progress`, render a **progress bar + checkpoint buttons**
  (0/25/50/75/100) → `setLearningProgress`. Show the **live rank payoff** ("finish → #X") when
  passed. "Mark complete" opens a new **`CompleteSkillModal`** (proficiency 1–5 selector + optional
  years + the rank payoff line) → `completeLearningItem(id, {proficiency, years})`.
- New **`GrowthMomentumCard`**: skills grown via learning (count), in-progress count, current rank
  #N of M, **projected rank if they finish the in-progress ones** (`rankInPoolQuery` boost =
  in-progress count), and an honest momentum line. No fabricated history.
- Wire into `/dashboard/grow` (top of "My learning") + a compact glance on `/dashboard` overview.
  **All gated** by `getSetting("feature_flag_seeker_skill_journey")` — off = today's behaviour.

### 17.1.c — Verify + commit ✅
- **Shipped:** migration `0052_phase17_learning_progress.sql` (+ journal idx 52);
  `setLearningProgress` + `learning.progress` audit kind; `completeLearningItem(opts)` (seeker
  proficiency replaces the hardcoded 3); `CompleteSkillModal` + `GrowthMomentumCard` + progress
  checkpoints in `LearningItemRow`; wired into `/dashboard/grow`, all gated by the flag.
- **Tests (green):** `npm run test:all` → typecheck + lint + **318 vitest** ✅ · build ✅ ·
  migration applied clean (harness migrate-from-zero) · **flag OFF E2E 24/24** (seeker + role
  arcs, incl. `/dashboard/grow`) = zero regression · **flag ON E2E 2/2** (new
  `tests/e2e/skill-journey.spec.ts`: growth momentum + progress checkpoints render; flag restored
  in afterAll). Desktop + 360px.
- ⚠️ Dev DB: run `npm run db:migrate` (adds `progress_percent`) before enabling the flag.

---

## 📈 TASK 17.2 — DEMAND PULSE — ✅ DONE 2026-06-22
**Flag:** `feature_flag_seeker_demand_pulse`. **Goal:** turn the silent `search_events` signal into
a timely "your skill is heating up near you" nudge.

- ✅ **Query** `lib/seeker/demand-pulse.ts` (`getDemandPulse`): biggest positive employer-demand
  mover this week vs the prior-3-week baseline, province-scoped, over the seeker's profession +
  top skills; null when nothing genuinely heats up. Demand-side, province-level only (D2).
- ✅ **Notification kind** `demand.pulse` (in-app ON, email OFF, 6-day dedupe) in the catalog.
- ✅ **Cron** `app/api/cron/seeker-demand-pulse/route.ts` (weekly): flag-gated; per non-deleted
  seeker, dedupe → top-3 skills → `getDemandPulse` → `createNotification`; per-row isolation.
- ✅ **Dashboard card** `DemandPulseCard` on `/dashboard`, gated by the flag (renders only on a real
  spike → no quiet state), links into Career Compass.
- **Tests (green):** `npm run test:all` → typecheck + lint + **321 vitest** ✅ (catalog kind
  validated) · build ✅ · **flag OFF E2E 12/12** (seeker arc) = zero regression · **flag ON E2E
  2/2** (new `tests/e2e/demand-pulse.spec.ts`: seeds a this-week spike for andile-z's profession,
  asserts the card; flag + events restored in afterAll). Desktop + 360px.

---

## 🤖 TASK 17.3 — AI CAREER COACH — ✅ DONE 2026-06-22
**Flag:** `feature_flag_seeker_ai_coach` **AND** a configured/budgeted LLM provider. **Goal:** a
seeker-facing LLM coach. **Scope v1: interview practice** (role-aware practice questions).

- ✅ **Dispatcher** `lib/llm/seeker-coach.ts` (`generateInterviewQuestions`): the same multi-gate
  posture as the curriculum dispatcher — flag → PII guard → active provider → decryptable creds →
  budget (shared pool); audited via new `seeker.ai_coach.call` / `.skipped` kinds with token/cost
  meta only. **Never sends name/ID/contact** — only profession + skills + a role title. A generic
  chat call (OpenAI-compatible + Anthropic) reuses the encrypted `llm_providers` creds.
- ✅ **Surface** `/dashboard/coach` (`page.tsx` gated by the flag → `notFound()` when off) + the
  `CoachPractice` client flow (one role field → numbered practice questions). Calm, text-only,
  No-Flash. Explicit "practice, not a guarantee" framing. Server Action `lib/seeker/coach.ts`.
- ✅ **Nav** `SEEKER_NAV` gains an "AI coach" item; the seeker layout filters it out unless the flag
  is on (no dead link when dark).
- ✅ **Graceful degradation:** flag on + no active provider (every seeded row dormant) → `no_provider`
  → a calm "not switched on yet" message. Budget/credentials/error all map to non-alarming copy.
- **Tests (green):** `npm run test:all` → typecheck + lint (0 errors) + **321 vitest** ✅ · build ✅ ·
  **flag OFF E2E 2/2** (nav hidden + page surface unreachable) + seeker arc **12/12** = zero
  regression · **flag ON E2E 2/2** (new `tests/e2e/ai-coach.spec.ts`: page renders + degrades
  gracefully with no provider; flag removed in afterAll). Desktop + 360px.

---

## 🧪 VERIFICATION (whole phase)
- Per task: typecheck + lint + build + `npm run test:all` (318+ vitest) + seeker E2E at desktop +
  360px. Each feature's E2E asserts: **flag OFF = today's behaviour; flag ON = the new surface.**
- Migration: `npm run db:migrate` clean; journal contiguous.

## 🚫 OUT OF SCOPE
- Becoming an LMS / hosting courses (Phase 11 guardrail).
- City-level demand micro-segments (k-anonymity; province-level only).
- AI bio/CV rewriting, "decode this job post," resume optimiser (future AI-coach capabilities).
- Any "guaranteed interview/job" framing.

## 📌 STATUS
- [x] 17.0 Scaffolding (flags + admin toggles)
- [x] 17.1 The Climb — tests green (test:all 318 ✅ · flag-OFF 24/24 ✅ · flag-ON 2/2 ✅)
- [x] 17.2 Demand Pulse — tests green (test:all 321 ✅ · flag-OFF 12/12 ✅ · flag-ON 2/2 ✅)
- [x] 17.3 AI Career Coach — tests green (test:all 321 ✅ · flag-OFF 2/2 + arc 12/12 ✅ · flag-ON 2/2 ✅)

**✅ PHASE 17 COMPLETE** — all three seeker-growth features shipped dark (default OFF), each
admin-switchable from `/admin/settings`, each verified at desktop + 360px with flag OFF (zero
regression) and flag ON (the new surface), and the full vitest + build green throughout.
