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

---

## ✅ TASK 17.0 — Scaffolding (flags + admin toggles) — DONE 2026-06-22
- `lib/admin/settings.ts`: added 3 `SettingKey`s + DEFAULTS (all `false`).
- `lib/admin/settings-actions.ts`: added to the per-key validator map (`z.boolean()`) + the
  `updateSetting` key enum.
- `components/feature/admin/SettingsForm.tsx`: 3 boolean rows → auto-render in the "Feature flags"
  section as admin switches.
- Verified: typecheck clean.

---

## 🧗 TASK 17.1 — THE CLIMB (live skill journey) — ⏳ IN PROGRESS
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

### 17.1.c — Verify + commit
- typecheck + lint + build; extend seeker E2E (progress controls + momentum render when flag on);
  `npm run test:all`; reseed note. Commit.

---

## 📈 TASK 17.2 — DEMAND PULSE — ⏳ PENDING
**Flag:** `feature_flag_seeker_demand_pulse`. **Goal:** when real employer demand for one of a
seeker's skills (or a top recommended one) spikes in their province, tell them — turning the
silent `search_events` signal into a timely, motivating nudge.

- **Query** `lib/seeker/demand-pulse.ts`: for a seeker, compare this-week vs prior-weeks employer
  searches (province-scoped, `search_events`) that hit their skills/profession; surface the
  biggest mover above a floor. Province-level only (D2 k-anonymity; demand-side, no seeker cohort).
- **Notification kind** `demand.pulse` (in-app ON, email OFF default) in the catalog.
- **Cron** `app/api/cron/seeker-demand-pulse/route.ts` (weekly): gated by the flag; per active,
  searchable seeker, fire at most one pulse with dedupe; reuse the digest cron's suppression idiom.
- **Dashboard surface:** a small "Demand pulse" card on `/dashboard` (+ a link into Career Compass)
  when there's a live spike — gated by the flag.
- Verify + commit.

---

## 🤖 TASK 17.3 — AI CAREER COACH — ⏳ PENDING
**Flag:** `feature_flag_seeker_ai_coach` **AND** a configured/budgeted LLM provider. **Goal:** a
seeker-facing LLM coach. **Scope v1: interview practice only** (role-aware questions + feedback) —
not bio/CV rewriting yet.

- **Dispatcher** `lib/llm/seeker-coach.ts`: mirror `lib/llm/curriculum.ts`'s multi-gate dispatch
  (active provider → budget < cap → **feature flag** → PII guard → audited). Reuse
  `lib/llm/providers/*`. New audit kind `seeker.ai_coach.call` with token/cost meta; **never send
  name/ID/contact** — only profession + skills + a role title.
- **Surface** `/dashboard/coach` (in nav, gated): a calm, text-only practice flow — pick a target
  role → get a few tailored questions → optionally submit an answer → get specific, honest feedback.
  No "guaranteed job" framing (same guardrail as work-readiness content).
- **Off-by-default + visibly gated:** when the flag is on but no provider is configured, the page
  explains it's unavailable (no crash). Budget exhaustion degrades gracefully.
- Verify + commit. (Heaviest; do last.)

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
- [ ] 17.1 The Climb
- [ ] 17.2 Demand Pulse
- [ ] 17.3 AI Career Coach
