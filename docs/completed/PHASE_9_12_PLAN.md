# PHASE 9.12 PLAN — THE LEARNING LOOP (STUDENT GROWTH PATH)
*Side-phase after 9.11 (vacancy-outcome loop), before 9.13 (learning-loop intelligence) and Phase 10. Opened 2026-05-25. **Scope narrowed 2026-05-25**: the gov-facing analytics (demand-vs-curriculum dataset + "why learners stall" intelligence) split out into [`docs/PHASE_9_13_PLAN.md`](./PHASE_9_13_PLAN.md) — 9.12 ships the seeker-side loop; 9.13 reads the data the loop generates.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/` · `docs/PHASE_9_13_PLAN.md`.*

> **Why 9.12 (not 9.11):** the 9.11 slot shipped a *different* feature — the **vacancy-outcome loop**
> (Mark-as-Filled + honest closure notifications). This learning-loop work is the next free number, 9.12.
>
> **Builds on what 9.9–9.11 just shipped — do NOT rebuild these:**
> - **The deep-link entry path already exists.** 9.11 shipped `/dashboard/grow?missing=<slugs>`: the
>   Career Compass already reads the param, shows a banner restating skill gaps, and tags matching
>   recommendation rows with a **"Vacancy gap"** chip. 9.12 *plugs the learning loop into this existing
>   surface* — it does not build the entry path or the gap banner from scratch.
> - **Per-skill experience slot exists.** 9.9 shipped `profile_skills.years_of_experience` — a completed
>   self-attested skill can populate it (defaulting to NULL / "<1 yr" honestly).
> - **"Verified employer" is now a real state.** 9.10 shipped admin-mediated org KYC, so the
>   self-attested-vs-verified honesty story is sharper than when this plan was first drafted.

---

## 🎯 GOAL

Turn the Career Compass from *advice you read* into a *loop you live in*:

> **study → system advises a skill → learner accepts → marks progress (started / gave up + why /
> completed) → a completed skill is added to the profile (honestly, as self-attested) → the learner
> ranks higher and gets found.**

**Design principle (hard):** *keep it simple.* Sebenza **points to** real SA learning and **tracks
self-marked progress** against it. It does **not** become a course platform / LMS. (See Out of Scope.)

**Out-of-scope for 9.12** (forwarded to 9.13): demand-vs-curriculum dataset materialisation +
"why learners stall" gov analytics. Both depend on 9.12 data flowing for ≥ k learners first; building
them before that data exists is premature.

---

## 🧭 HONEST ASSESSMENT (why this is worth building)

- **Strongest retention mechanic on the seeker side.** A job board earns a return visit only during a
  job hunt. A learning loop earns one every week for months. This is the feature that makes Sebenza a
  habit, not a bookmark.
- **The loop actually closes:** completing a skill raises search rank (via the existing
  `rankInPoolQuery`), which is visible, motivating proof the effort paid off. Self-reinforcing.
- **"Gave up, and why" is captured here, but its policy value is realised in 9.13.** 9.12's job is to
  collect the signal cleanly; 9.13's job is to aggregate it with suppression and surface the policy view.
- **Two honest limits, built in, not bolted on:**
  1. **Self-attested ≠ verified.** A completed-via-learning skill is added `unverified` with explicit
     provenance. Never minted as "verified." (Verification-Honesty Rule.)
  2. **Not an LMS.** We track state against *external* SA learning; we never host content or certify
     completion. This is what keeps it simple and keeps scope sane.

---

## 🔒 LOCKED DECISIONS

### D1 — `profile_skills` gains a `provenance` column via additive migration `0020`
Pre-flight (against [db/schema.ts:370-388](../db/schema.ts#L370-L388)) confirms there is no provenance
or per-skill verification field today (only `proficiency` + `yearsOfExperience`). 9.12.3 ships migration
`0020_phase9_12_learning_loop.sql` which adds:
- New `pgEnum skill_provenance` = `["self_attested", "self_attested_learning", "imported", "verified_provider"]`.
- New nullable `profile_skills.provenance skill_provenance` column. Existing rows back-fill to `self_attested`.
- New nullable `profile_skills.verified_at timestamp` column (NULL until the dormant Phase 8 SAQA/provider
  adapter writes here). UI never reads `verified_at = NOT NULL` as "verified" without the matching
  `provenance = 'verified_provider'` — the two columns together are the honesty contract.

### D2 — No new `consent_purpose` enum entry for learning progress itself
Learning progress is the seeker's own personal data on their own surface. It's covered by the existing
profile consent the seeker already granted; audit-logged like every other PII read. Adding a new
`consent_purpose` would over-fragment the consent screen for zero new audience. (The gov-facing
aggregate in 9.13 reuses `outcomes_research` (7.5.3) as the inclusion gate — same pattern as 7.5.4.)

### D3 — Re-recommend after abandon → only when reason is cost/access-driven
If `abandon_reason ∈ {"too_expensive", "access_transport"}`, the compass surfaces a *free* alternative
for the same skill on the next render. Other reasons (`too_difficult`, `course_quality`, `changed_direction`)
do NOT auto-resurface — those are signals the learner moved on, not signals they need a different option.
Bounded, cheap, dead-end → better-match.

### D4 — Honest progress only; no streaks, no points, no leaderboards
The compass shows: progress ring (reuse the Talent-Pulse motif), state pill (`accepted` / `in_progress` /
`completed` / `abandoned`), and the projected-rank delta on completion (`rankInPoolQuery`). That's it.
For a platform serving people under real economic stress, manufactured pressure mechanics are the wrong
tone. Strong lean confirmed; locked.

### D5 — Frequency cap on nudges is cross-kind, not per-kind
A learner who recently received `vacancy.outcome.other-hired` (9.11) and then stalls on a learning item
in the same week should NOT also receive a `learning.nudge`. Two demoralizing nudges stacked is the
opposite of the loop's intent. The Phase 8 cron applies a weekly cap *combined* across
`{vacancy.outcome.other-hired, learning.nudge}` per recipient — at most one of these in any 7-day
window. `learning.completed` (celebrate the win) is exempt — it's positive payoff, not pressure.

---

## 🔍 WHAT WE ALREADY HAVE (verified 2026-05-25 against live code)

**Built + wired to live data:**
- `/dashboard/grow` Career Compass wired to live demand via `db/queries/career-compass.ts`.
- `rankInPoolQuery` — real `DENSE_RANK() OVER (profession × province)` with projected rank if skills added.
- `skillDemandQuery` — skill-level demand granularity.
- Academic capture at sign-up step 3 + profile editor Studies section; honest verification chip.
- Student-lane compass UI: "bridge your degree," recommended in-programme electives, real SA
  internships/graduate programmes, destinations table.
- `openToInternships/GraduateProgrammes` opt-in search filter, live in DB search.
- **`/dashboard/grow?missing=<slugs>` deep-link + "Vacancy gap" chip — shipped in 9.11.** The Compass
  already reads the param, banners the gaps, and highlights matching rows. **9.12 plugs into this; it is
  not rebuilt.** The learning loop's "accept" action attaches to exactly these highlighted rows.
- `profile_skills (profileId, skillSlug, proficiency, yearsOfExperience)` — confirmed via direct read;
  no provenance column yet (D1 adds it).
- `consentPurpose` additive enum pattern (vacancy_matching from 9.8.3) — clean template if needed
  (not needed for 9.12 per D2).
- `lib/analytics/suppress.ts` exists and is reusable (deferred to 9.13).

**Still mock / unticked (forwarded to 9.13):**
- ❌ **Demand-vs-curriculum dataset** (ROADMAP line 126) — still a mock shape in `lib/mock/academic.ts`.
- ⚠️ **Destinations table** renders on the 7.5 seeded 12-person synthetic Wits cohort. Suppression
  + honest "limited data" state lands in 9.13.
- ⏸️ **SAQA / institution verification** (line 127) — stays deferred to the Phase 8 dormant adapter.

---

## ✅ PRE-FLIGHT RECHECK (run before writing code in 9.12.1)

- [ ] Open `/dashboard/grow` as a seeded student **and** a seeded non-student seeker; confirm the compass
      renders live recommendations (not mock) and the projected-rank delta is real (`rankInPoolQuery`).
- [ ] Confirm `db/queries/career-compass.ts` + `rankInPoolQuery` + `skillDemandQuery` signatures so the
      learning loop reads recommendations from them (no parallel recommender).
- [ ] Confirm `profile_skills` shape (✅ pre-verified) and note migration `0020` will add the provenance columns.
- [ ] Confirm `academic_profiles` shape — needed downstream by 9.13 but verified here for consistency.
- [ ] Confirm notification kinds + `notification_prefs` + Phase 8 cron pattern — 9.12.6 adds gentle nudges + D5 cross-kind cap.

---

## 📋 TASKS

### Task 9.12.1: Audit & confirm the existing compass (verify, don't assume)
- [ ] Walk the live `/dashboard/grow` paths above; capture before-screenshots of the current compass +
      student lane. Record in `PHASE_9_12_COMPLETE.md` what is genuinely live vs. still mock.
- [ ] Confirm the destinations table data source + current row counts (informs 9.13's right-sizing).
- [ ] No code change in this task — it's the "check what we have" gate. Findings steer 9.12.2–9.12.7.

### Task 9.12.2: Solidify study-aware recommendations (mostly exists — tighten)
- [ ] Ensure recommendations for a student blend: (a) in-programme electives mapped to province demand,
      (b) market skills their target profession demands that they lack (`skillDemandQuery`),
      (c) adjacent-profession overlap. Reuse existing queries; no new recommender.
- [ ] Each recommendation carries *why*: "High demand in Gauteng · you don't have this yet · +1 rank."
      Honest, legible reasoning — never a black-box "recommended for you."
- [ ] Each links to a **real SA learning resource** (SETA / TVET / INDLELA / SAQA-recognised / free-first),
      reusing the learning-path data already in the compass. We link out; we don't host.

### Task 9.12.3: Schema + acceptance + progress state machine (the core loop)
- [ ] **Migration `0020_phase9_12_learning_loop.sql`** (additive — no destructive changes):
      - New `pgEnum skill_provenance` per D1; new `profile_skills.provenance` (default `self_attested`)
        + nullable `profile_skills.verified_at`.
      - New `pgEnum learning_state` = `["accepted","in_progress","completed","abandoned"]`.
      - New `pgEnum abandon_reason` = `["too_expensive","no_time","course_quality","access_transport",
        "changed_direction","too_difficult","other"]` (`other` requires a note).
      - New `learning_items` table: `id`, `skill_slug` (FK skills), `profile_id` (FK profiles), `title`,
        `provider`, `resource_url`, `resource_kind` (`seta|tvet|indlela|free|other`), `is_free`,
        `state` (default `accepted`), `started_at`, `completed_at`, `abandoned_at`, `abandon_reason`,
        `abandon_note`, `created_at`. Indexes on `(profile_id, state)` + `(skill_slug, state)`.
- [ ] Seeker actions (Server Actions in `lib/seeker/learning.ts`, optimistic UI):
      **Accept** → `accepted`; **Start** → `in_progress`; **Mark complete** → `completed`; **Give up** → `abandoned` + reason.
- [ ] Lightweight UI on `/dashboard/grow`: a "My learning" section with each accepted item + its state.
      Reuse the **Talent-Pulse ring** motif for a simple progress indicator (no new viz, on-brand).
      Per D4: no streaks, no points, no leaderboards.
- [ ] Audit kinds: `learning.accept`, `learning.start`, `learning.complete`, `learning.abandon`.

### Task 9.12.4: Completion → self-attested skill (the payoff, done honestly)
- [ ] On `completed`, prompt: "Add **[skill]** to your profile?" → on confirm, attach to `profile_skills`
      with **`provenance = 'self_attested_learning'`** (per D1) and `verified_at = NULL`. Populate the
      existing `profile_skills.years_of_experience` (9.9) as NULL — a freshly-learned skill honestly
      shows "<1 yr", never an inflated number.
- [ ] **UI never shows this as "verified."** Badge reads honestly (e.g. "Self-attested · via learning").
      A future SAQA/provider hook (Phase 8, dormant) is the only thing that can flip provenance to
      `verified_provider` + stamp `verified_at`.
- [ ] The new skill flows into the existing ranking naturally → the seeker can *see* their projected rank
      improve (reuse `rankInPoolQuery`). This visible payoff is the loop's reward — and it's truthful.
- [ ] Guard against duplicates (skill already present) + allow remove. If the skill is present with
      `provenance = 'self_attested'` already, completing a learning item upgrades the provenance to
      `self_attested_learning` (better honesty, not a downgrade).
- [ ] D3: If the most recent `learning_items` row for this skill is `abandoned` with reason
      `too_expensive` or `access_transport`, the compass surfaces a *free* alternative for the same skill
      on the next render.

### Task 9.12.5: Abandonment reasons (the hidden signal — captured here, surfaced in 9.13)
- [ ] Fast modal (radio + optional 200-char note), mobile-first — *not a quiz* (mirrors the vacancy decline UX).
- [ ] Plain-language note reminder: don't include sensitive personal info (treated as PII in audit/export).
- [ ] Every state change audit-logged (`learning.abandon`, with from→to + reason). Trust = it's recorded.
- [ ] Note: the *aggregate* "why learners stall" intelligence ships in 9.13 once data has accumulated;
      9.12.5 just captures the signal cleanly.

### Task 9.12.6: Gentle progress nudges (light touch, reuse Phase 8)
- [ ] New notification kinds `learning.nudge` (e.g. "Still working on [skill]?") + `learning.completed`
      (celebrate honestly + show the rank gain). Honour `notification_prefs`; default conservative.
- [ ] Reuse the Phase 8 cron pattern; idempotent; **frequency-capped per D5 — cross-kind, weekly cap
      combined with `vacancy.outcome.other-hired`.** A stalled-but-not-abandoned item gets *one* gentle
      check-in, not a stream — and only if the seeker hasn't already heard from us this week.
- [ ] `learning.completed` is exempt from the cap (positive payoff, not pressure).

### Task 9.12.7: POPIA, wiring, verification, doc convention
- [ ] **Consent/POPIA:** per D2, no new `consent_purpose` enum entry. Seeker's own view covered by
      existing profile consent. Audit-log PII reads as everywhere else.
- [ ] All strings in `messages/en.json`; `zu/xh/af` deepMerge fallback (full translation Phase 10).
- [ ] Compliance assertions (extend the suite): (a) a `profile_skills` row with `provenance ≠ 'verified_provider'`
      is **never** rendered "verified" on any surface; (b) learning progress never appears on any
      public/employer surface (seeker-private; gov sees only suppressed aggregates *in 9.13*);
      (c) `learning.nudge` respects the D5 cross-kind cap.
- [ ] `npm test` green; `npm run build` clean (typecheck + lint + static gen × 4 locales); smoke-test
      `/dashboard/grow` learning flows 200.
- [ ] Seed: accept a couple of items for a seeded student — one `in_progress`, one `completed` (→ skill
      added with `provenance = 'self_attested_learning'`, rank visibly moves), one `abandoned`
      (reason `too_expensive`) — so the loop renders real rows out of the box and 9.13 has data to
      aggregate against from day 1.
- [ ] On ship: `docs/completed/PHASE_9_12_COMPLETE.md`; tick 9.12 in `ROADMAP.md` ✅ + date; refresh
      **Current State** in `TO_START_EVERY_SESSION.md`; confirm `docs/PHASE_9_13_PLAN.md` is open;
      commit `Phase 9.12 complete — the learning loop`.

---

## ✨ IMPROVEMENTS ADDED (beyond what you originally described)
- **"Path to your goal profession" milestone view** — a simple "you have 6 of the 9 skills [province]
  employers want for Backend Developer" progress line, driven by existing demand + `rankInPoolQuery`.
  One honest, motivating glance; no new infrastructure. (Surface during 9.12.2 if cheap; otherwise
  defer to 9.13.)
- **Honest reasoning on every recommendation** (the "why this skill" line) — turns advice into something
  the learner trusts and can act on, not a black box.
- **Provenance honesty contract** (D1 `provenance` + `verified_at` together) — closes the only door
  through which a self-attested skill could ever leak onto a "verified" surface.

---

## 🚫 OUT OF SCOPE FOR 9.12 (keep it simple — explicit guardrails)
- ❌ **Becoming an LMS** — no hosted lessons, no quizzes, no video, no platform-issued certificates. We
  link to real SA providers and track *self-marked* state. This is the line that keeps the feature simple.
- ❌ **Auto-verifying completed skills** — self-attested only, `unverified`, honest provenance. SAQA/
  provider verification stays the dormant Phase 8 adapter.
- ❌ **Heavy gamification** (streaks, points, leaderboards, pressure mechanics) — see D4.
- ❌ **Activating SAQA/institution verification** (ROADMAP line 127) — remains deferred.
- ❌ **Learning progress on any public/employer surface** — seeker-private. Gov sees suppressed
  aggregates only, and only in 9.13.
- ❌ **Per-person curriculum/stall data to anyone** — aggregate + suppressed, like every other analytic,
  and shipped in 9.13 not here.
- ❌ **The demand-vs-curriculum dataset materialisation** — forwarded to 9.13.
- ❌ **"Why learners stall" gov analytics surface** — forwarded to 9.13.

---

## 🧭 WHY THIS IS THE SEBENZA VERSION
The feature you described is genuinely one of the best retention ideas in the project — and the honest
build is *more* compelling than a naive one, not less. 9.12 keeps every part of the loop you asked for
(study-aware advice → accept → started/gave-up-with-reason/completed → completed-becomes-a-skill) and
adds the honest "why this skill" reasoning + the provenance honesty contract. We protect it with the
two rules that keep it trustworthy and simple: **self-attested is never shown as verified**, and **we
point to learning, we don't host it.** The result is a loop that brings learners back every week, turns
their effort into visible ranking gains, and produces — quietly, in audit-logged rows the seeker owns —
the raw data 9.13 will aggregate into a map of *where the education-to-work pipeline leaks.*

*Plan opened 2026-05-25. Scope narrowed 2026-05-25 (analytics split to 9.13). Target: complete before
9.13 opens; both land before Phase 10 (public launch).*
