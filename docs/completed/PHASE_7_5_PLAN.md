# PHASE 7.5 — STUDENT WORK-AVAILABILITY + LONGITUDINAL OUTCOMES · ✅ COMPLETE (2026-05-23)
*Side-phase between Phase 7 and Phase 8, mirroring the Phase 6.5 pattern. Opened + shipped 2026-05-23.*
*Companion docs: `docs/completed/PHASE_7_5_COMPLETE.md` (ship report) · `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md`.*

> **Why 7.5 and not "more 7.x":** Phase 7 is shipped (`docs/completed/PHASE_7_COMPLETE.md`) and task
> 7.8 already exists. Per our doc convention, completed phases don't reopen. This is a self-contained
> side-phase — exactly like 6.5 — that lands before Phase 8 opens.

---

## 🎯 GOAL

Two capabilities that came out of the student-positioning conversation, built the Sebenza way
(honest, opt-in, POPIA-first):

1. **Work-availability dimension** — let a person (especially a student) signal they're available for
   **casual / part-time / contract / full-time** work, *independent* of their employment status. Serves
   the real "income now while I study" need that today's schema can't express.
2. **Longitudinal education-to-employment outcomes** — the government wedge the voice agent was excited
   about, built with a **hard aggregation floor + a dedicated consent purpose** so it's a policy asset,
   not a profiling liability.

The career-pathing piece the conversation also raised is **already shipped** (Career Compass + Student
lane, Phase 6 / 6.5 on live `searchEvents` demand). 7.5 does **not** rebuild it.

---

## ✅ PRE-FLIGHT RECHECK (all confirmed 2026-05-23)

- [x] `consentPurpose` enum had 4 members (`searchability` / `contact_reveal` / `document_sharing` / `analytics_aggregate`). Added `outcomes_research` as the 5th via `ALTER TYPE … ADD VALUE IF NOT EXISTS` in its own isolated migration (`0008_phase7_5_outcomes_consent.sql`) since PG enum extension is transaction-sensitive on older PG. Neon (PG 16) ran it cleanly.
- [x] `academic_profiles` has every column 7.5.4 needs: programme, institution_slug, field_of_study, nqf_level, current_year, expected_graduation (text yyyy-mm), nsfas, openToInternships, openToGraduateProgrammes, verification. No rewrite needed.
- [x] `placements` had no existing `source`/`kind` column. Added `placement_source` enum (`employer_confirmed` default, `seeker_reported`) + column + partial index on `(organization_id, hired_at DESC) WHERE source = 'employer_confirmed'`. Phase 5's 30-day reveal gate at [lib/employer/placements.ts:46](lib/employer/placements.ts#L46) is untouched — it operates on the employer-confirmed path only.
- [x] `platform_settings` key/value getter at [lib/admin/settings.ts:47](lib/admin/settings.ts#L47) is typed (`SettingKey` union). Extended the union, defaults, and per-key Zod schema to add `outcomes_min_cohort_size` (default 10, min 5, max 200).
- [x] `searchProfilesQuery` filter pattern uses raw `sql\`\`` template literals at [db/queries/profiles.ts:106](db/queries/profiles.ts#L106). 7.5.2 mirrors with `p.work_availability && ARRAY[...]::work_availability_kind[]`.

---

## 🧩 DEPENDENCY NOTE (read once — it changes sequencing)

The longitudinal dataset (7.5.4) is only as honest as the data feeding it. Two known-open items bear
directly on it:

- **Placement logging completeness** (the incentive question open since day one). "Where graduates from
  your programme go" is **empty** if employers don't log hires. → addressed here as **7.5.5**, because
  it's a direct data-quality dependency of 7.5.4, not a nice-to-have.
- **Stale-status email cron** (currently Phase 8 task). Affects freshness of the "still studying / still
  open" signal. → **stays in Phase 8.** Pulling Resend + cron infra forward would balloon 7.5. We note the
  coupling and accept that until Phase 8, freshness depends on in-dashboard nudges (the existing banner).

**Recommended order within 7.5:** 7.5.1 → 7.5.2 (the clean, low-risk win) → 7.5.3 (consent groundwork)
→ 7.5.5 (placement completeness) → 7.5.4 (longitudinal analytics, last, because it depends on 7.5.3 + 7.5.5).

---

## 📋 TASKS

### Task 7.5.1: Work-availability dimension (schema + model)
A new axis, decoupled from `employmentStatus`. A `studying` person can be available for `casual`; a
`full_time` employee can be open to `contract`. Status answers "what's your situation"; availability
answers "what work will you take."

- [x] `pgEnum work_availability_kind` = `["casual", "part_time", "contract", "full_time"]`.
- [x] Column on `profiles` (array, opt-in, defaults empty — never inferred):
  ```ts
  workAvailability: workAvailabilityKind("work_availability")
    .array().notNull().default(sql`'{}'::work_availability_kind[]`),
  ```
  *(Alternative: a `profile_work_availability` join table mirroring `profileSkills`. Array + GIN is
  lighter for a fixed 4-value vocab; choose join-table only if we later attach per-availability metadata
  like rate or hours.)*
- [x] GIN index on `work_availability` for `&&` / `@>` containment queries.
- [x] `drizzle-zod` validator; migration `0004_work_availability.sql`.
- [x] Extend the `dataProvider` interface + both `dbProvider` and mock so the field flows end-to-end.
- [x] **Redaction:** availability is **non-sensitive** — safe on public/search payloads (it's the point of it).

### Task 7.5.2: Surfacing work-availability (UI + search)
- [x] **Seeker profile editor** (`/dashboard/profile`): a "What work are you open to?" checkbox group.
      Plain-language labels ("Casual / shift work", "Part-time", "Contract", "Full-time"). All i18n keys.
- [x] **Student onboarding** (`/sign-up/seeker` step 3, the existing "I'm currently a student" branch):
      sibling toggle "I'm available for work while I study" → reveals the same availability group.
      This is the casual-shift use case the conversation led with (waitressing / running / retail).
- [x] **Public profile** (`/p/[handle]`): honest chip row — "Available for: Casual · Weekends" style.
      No verification claim (it's a self-declared preference, not a credential).
- [x] **`<TalentRosterItem>`**: compact availability indicator beside the status chip.
- [x] **Search filter** (`/search`): multi-select "Available for" → array containment in
      `searchProfilesQuery`:
  ```sql
  AND (cardinality($availableFor) = 0
       OR profiles.work_availability && $availableFor::work_availability_kind[])
  ```
- [x] Empty/zero-result copy stays honest (reuse the Phase 7.8 end-state pattern).

### Task 7.5.3: Dedicated consent purpose for outcomes research
A student consenting to "be found for jobs" has **not** consented to "be a longitudinal data point in a
government outcomes study." POPIA treats these as different purposes. So we add a separate, optional one.

- [x] Extend `consentPurpose` enum with `outcomes_research`.
- [x] **Optional + default-off + non-degrading:** withholding it must not weaken the job-search product
      in any way. No dark patterns, no nags, no gated features. (Document this explicitly — it's a
      lawfulness condition, not a UX preference.)
- [x] Consent UI on `/dashboard/privacy` + a clear explainer at the academic-data step: *what* is shared
      (aggregate cohort outcomes), *what is never shared* (any individual record), *who sees it* (policy
      aggregates only), and that it's revocable.
- [x] **Human-translated copy only** (existing rule — consent/legal never machine-translated).
- [x] Store in `consents` (versioned, purpose-specified) exactly like the others; revoke/regrant
      audit-logged.
- [x] The 7.5.4 dataset includes a profile **only if** `outcomes_research` is currently granted.

### Task 7.5.4: Longitudinal education-to-employment analytics (aggregation floor)
The wedge — built so it can never re-identify a young person. This is the part the voice agent was right
to be excited about and wrong to treat as pure upside.

- [x] **Cohort dimensions only** (all controlled taxonomy, no free text):
      `programme × institution × province × graduation_year`. Never a per-person timeline on any surface.
- [x] **Metrics:** cohort size, # placed (employer-confirmed only, per 7.5.5), median time-to-hire,
      top destination professions/sectors. All freshness-weighted via `sebenza_freshness_confidence`.
- [x] **Hard suppression floor (k-anonymity):** never emit a cell with fewer than `N` individuals.
      `HAVING count(DISTINCT profile_id) >= $minCohort`. Default `N = 10`, configurable via
      `platform_settings` key `outcomes_min_cohort_size` (mirrors the Phase 7.7 freshness-band pattern).
- [x] **Complementary suppression:** if suppressing one small cell still lets its value be derived from a
      visible row/column total, suppress the next-smallest too. (Standard statistical-disclosure control —
      get this right or the floor leaks.)
- [x] **Consented-only:** dataset restricted to profiles with `outcomes_research` granted (7.5.3).
- [x] **Source:** `academic_profiles × placements × searchEvents`, consented + suppressed in the query
      layer — not in the component.
- [x] **Surface:** `/insights` only now; designed to drop into the Phase 9 `/gov` route group cleanly.
      Never rendered on any individual-facing page.
- [x] **Export:** reuse the Phase 6.5 hardened CSV path (injection guard, CRLF, row cap). The suppression
      floor applies to exports too — assert it in a test.
- [x] **(Phase 8 hand-off, not built here):** `outcome_snapshots` table for trend-over-time, owned by the
      nightly cron — parallels `skill_gap_snapshots`. 7.5 computes live with suppression; the snapshot
      wiring is a one-line cron add in Phase 8.

### Task 7.5.5: Placement-logging completeness (data-quality dependency)
Keeps Placement-Truth intact while capturing more signal, so 7.5.4's "where graduates land" isn't empty.

- [x] Add `placement_source` to `placements`: `employer_confirmed` (default, the existing flow — counts in
      official/government analytics) vs `seeker_reported` (softer signal).
- [x] **Honesty rule (mirrors Verification-Honesty):** only `employer_confirmed` placements count in the
      trustworthy aggregate and the government-facing outcomes dataset. `seeker_reported` may show on the
      seeker's own profile as self-declared, clearly flagged, and is **excluded** from 7.5.4.
- [x] Seeker self-report entry point: when a seeker sets status to `employed`, optionally let them note
      where (controlled org/profession), stored as `seeker_reported`. Never silently promoted to confirmed.
- [x] **Incentive design = open product decision (needs your input, not a code task):** what makes an
      employer bother logging a hire? Candidate levers to weigh — confirmed placements unlock/refresh an
      employer's analytics view; logging is a condition of "verified in good standing"; a one-tap prompt at
      the point the contact-reveal → hire window closes. Pick one before building the prompt; don't ship a
      dead nudge.

### Task 7.5.6: Wiring, verification, and doc convention
- [x] All new strings in `messages/en.json`; `zu/xh/af` keep the deepMerge fallback (full translation in
      the Phase 10 localization pass — except consent copy in 7.5.3, which is human-translated now).
- [x] `npm run build` clean (typecheck + lint + static gen across locales).
- [x] Smoke-test new/changed routes return 200 under `next start`.
- [x] **Compliance tests (extend Phase 11.4 set):**
  - assert work-availability is the *only* new field exposed publicly (no PII leaked alongside it);
  - assert the outcomes dataset returns **zero rows below the suppression floor**, including via export;
  - assert a profile without `outcomes_research` consent **never** appears in 7.5.4 source rows.
- [x] On ship: write `docs/completed/PHASE_7_5_COMPLETE.md`, tick the 7.5 header in `ROADMAP.md` with ✅ +
      date, update the **Current State** block in `TO_START_EVERY_SESSION.md`, open/confirm
      `docs/PHASE_8_PLAN.md`, commit `Phase 7.5 complete + Phase 8 opens`.

---

## 🔓 OPEN QUESTIONS (decide before / during build)
1. **Placement incentive (7.5.5):** which lever? This gates whether the outcomes data is rich or sparse.
2. **Suppression floor value:** `N = 10` to start? Higher (e.g. 15–20) is safer for small
   programme×institution×province cells but blanks more of the map early on. Tunable via settings.
3. **Availability vs. status coupling:** should setting availability to anything imply `open_to_work`, or
   stay fully independent? (Leaning independent — clarity beats cleverness.)
4. **Student casual filter for employers:** does "Available for casual" need the same strict opt-in
   treatment as internships, or is it inherently opt-in by virtue of being self-set? (Leaning: self-set
   is the opt-in; no separate consent needed — it's a preference, not PII.)

## 🚫 OUT OF SCOPE FOR 7.5 (explicit)
- Rebuilding Career Compass / Student lane — already shipped (Phase 6 / 6.5).
- Resend transactional emails + cron jobs — Phase 8 (incl. the stale-status nudge cron).
- `outcome_snapshots` cron ownership — Phase 8 (table/query designed here, scheduled there).
- SAQA / Home Affairs / institution verification of academic records — Phase 8.
- `/gov` route group + `gov` role — Phase 9 (7.5.4 is built to slot into it).
- PDF / LMI / city-level / forecast — Phase 9.

---

## 🧭 WHY THIS IS THE SEBENZA VERSION (not the voice-agent version)
The voice agent treated "watch students grow over time" as pure upside and never mentioned that a
longitudinal record of a young person's study → graduation → hire is the most profiling-sensitive thing
the platform could hold. 7.5 keeps the upside (a genuine policy asset; a stronger Department pitch) and
removes the liability via three mechanisms it never raised: a **dedicated, optional, non-degrading consent
purpose**, a **hard aggregation floor with complementary suppression**, and **consented-only inclusion**.
The casual-work axis — the part the agent led with but spent least on — is the smaller, cleaner win and
ships first.

*Plan opened 2026-05-23. Target: complete before Phase 8 opens.*
