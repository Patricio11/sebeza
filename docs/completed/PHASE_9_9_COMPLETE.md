# Phase 9.9  Experience-in-years on profile & skills · ✅ COMPLETE (2026-05-24)

Pre-launch hygiene side-phase between Phase 9.8 and Phase 10. The Phase 9.8 system review surfaced four profile-model gaps (DOB, gender, total-years, per-skill years). Two of those (total-years, per-skill years) are CV-header standards every SA recruiter expects; the other two are protected-characteristic territory that need governance, not a quick add. This phase shipped the two safe ones so Phase 10 (public launch) lands with a more complete profile model without crossing into demographic-data design.

Companion docs: `PHASE_9_9_PLAN.md` (this directory), `docs/ROADMAP.md`, `docs/TO_START_EVERY_SESSION.md`, `docs/PHASE_10_PLAN.md`.

---

## What shipped

### 9.9.1  Schema + types
- Migration `0018_phase9_9_years_experience.sql` (additive, nullable, idempotent). Applied to Neon.
  - `profiles.years_experience integer`
  - `profile_skills.years_of_experience integer`
- Drizzle schema mirrors the new columns + carries the 0..60 contract + the "displays as <1 yr when 0" UI convention as inline comments.
- `PublicProfile.yearsExperience: number | null` (nullable so existing mock data compiles without back-fill).
- `SkillRef.yearsOfExperience: number | null`.
- `MyProfile` inherits both via `extends PublicProfile`.
- `searchProfilesQuery()` SELECT extended with `p.years_experience`; row mapper threads it through.
- `findProfileByHandleQuery()` + the parallel `loadOwnedProfile()` in `lib/profile/me.ts` both extended.
- `loadTopSkills()` + `topSkillsByProfile()` SELECT + map extended.
- Seed: `lib/mock/profiles.ts` populates years on two seekers (thandeka-m total = 11 yrs with per-skill years; andile-z total = 2 yrs with per-skill years). The rest stay NULL per D1 (no back-fill from `experiences`  lossy). Seed runs end-to-end.

### 9.9.2  Profile editor + read-side display
- **`updateProfileBasics` Server Action** Zod schema extended with `yearsExperience: number().int().min(0).max(60).nullable().optional()`. Server-clamps; UI also clamps.
- **`updateSkills` Server Action** Zod schema extended with `yearsOfExperience` per skill (same clamp). Action writes the new column on every save (NULL when blank).
- **`ProfileBasicsForm`**: new number input *"Total years of experience"* with hint *"How long you've been working in your field. Leave blank if you'd rather not say."* Sits next to the seniority select. Stored as a string in form state so blank means NULL (vs 0 which means "<1 yr"); clamped + parsed at submit.
- **`SkillsEditor`**: compact 14-wide number input next to each skill's proficiency dots, label *"Years of {skill}"* via `aria-label`. Sub-label under the proficiency reads *"Proficiency: 5/5 · 11 yrs"* live. Per-skill row stays single-line at 360 px.
- **`/p/[handle]` public profile**: profession eyebrow reads *"Senior · Chef · 8 yrs"* when years declared (unchanged otherwise). Skill cards + the right-rail compact skills list both append *"· 5 yrs"* per skill when declared.
- **Employer dossier header**: profession line reads *"Profession · Senior · 8 yrs"* when declared. Skill cards in the dossier skills section append *"· 5 yrs"* per skill.
- **`TalentRosterItem`** (used on /search + the vacancy match page): profession line adds *"· 8 yrs"* after profession; top-skills line composes *"TypeScript (5 yrs) · React (3 yrs) · Python"*.
- All display paths render unchanged when value is NULL; 0 displays as *"<1 yr"* per D3.

### 9.9.3  Phase 4 ranking + search filter
- **Deferred per D6** (optional in the original plan, gated on real-data signal post-launch). The values now flow through `searchProfilesQuery` so the ranking blend extension is a one-line change when wanted. Search-filter UI sits in the post-launch backlog.

### 9.9.4  Wiring, verification, doc
- Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean across 4 locales · `npm run db:seed` runs end-to-end. Migration `0018` applied to Neon.
- On ship: this `PHASE_9_9_COMPLETE.md`. `docs/PHASE_9_9_PLAN.md` moved into `docs/completed/`. `docs/ROADMAP.md` ticked ✅ + dated. Current State in `docs/TO_START_EVERY_SESSION.md` updated.

---

## Out-of-scope (explicit guardrails kept)

| Not built | Why |
|---|---|
| **Date of birth** | SA ID already encodes DOB and `nationalIdEnc` stores the encrypted ID; deriving age at the boundary is preferred over materialising DOB as a column. EEA §6 protected-characteristic concerns apply. Separate governance-reviewed phase if/when added. |
| **Gender** | If added, must follow the 9.7 `nationality_class` playbook: optional self-declared, ~3 buckets including prefer-not-to-say, k=10 suppressed in `/gov` only, never a `/search` filter or invite gate. Phase of its own. |
| **`experiences.isCurrent` boolean** | The implicit `endedAt IS NULL` rule continues. Backlog. |
| **Achievement-bullet decomposition** of `experiences.description` | Free text works. Backlog. |
| **Back-fill of years from experiences history** | Tempting but lossy (non-contiguous gaps). Force the seeker to declare on first edit. |
| **Phase 4 ranking blend + `minYearsExperience` search filter** (Task 9.9.3) | Deferred per D6  worth doing once real declared-years data accumulates post-launch. The plumbing is in place; one query change + one filter input. |

---

## Migrations applied

- `0018_phase9_9_years_experience.sql` (9.9.1)  two nullable integer columns: `profiles.years_experience` + `profile_skills.years_of_experience`.

---

## Why this fits before Phase 10

The change is small: one additive migration, two nullable columns, two UI inputs, the read-side rendering on four surfaces. ~1 focused session. No new compliance assertions needed (CV-header data, no PII concern). No new notification kinds, no new cron, no schema migration that touches existing data. Phase 10 (public launch) is not pushed.

The other two profile gaps (DOB, gender) stay out of this phase by design  they deserve their own deliberate, counsel-reviewed cycle if/when they land. The 9.7 nationality playbook is the template.

Plan opened + shipped same day, 2026-05-24, alongside the Phase 9.8 close-out review.
