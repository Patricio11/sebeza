# PHASE 9.9 PLAN — EXPERIENCE-IN-YEARS ON PROFILE & SKILLS
*Side-phase between Phase 9.8 and Phase 10, mirroring the 6.5 / 7.5 / 9.7 / 9.8 pattern. Opened 2026-05-24 during the pre-launch system review. Tiny by design  pre-launch hygiene, not feature creep.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/PHASE_10_PLAN.md`.*

> **UX/UI quality bar (non-negotiable):** smooth, beautiful, consistent with the Civic Editorial aesthetic, **mobile-first** by construction. Every form input added must render cleanly at 360 px wide.

---

## 🎯 GOAL

Add two missing CV-header fields  total years of experience on the profile, years of experience per skill  so the platform reads the way recruiters and seekers actually talk: *"Senior pastry chef · 8 yrs"*, *"TypeScript · 5 yrs"*. Strengthens the Phase 4 ranking signal, sharpens the 9.7.3 Justification Index, and closes a long-standing seeker complaint about not being able to express how long they've actually done the thing.

**This is NOT a phase for DOB or gender** (see §Out of scope and the discussion in this commit's parent message). Those need their own governance-reviewed cycle.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **`profiles` table** (`db/schema.ts:283`)  has `profession`, `seniority` (free-text like *"Senior"*), `bio`, but **no total-years field**.
- **`profile_skills` table** (`db/schema.ts:362`)  has `proficiency` (integer, 1-5 scale; default 3 on add). No years field.
- **`experiences` table** (`db/schema.ts:372`)  full work history with `startedAt` / `endedAt` (text, yyyy-mm). Total years could be **derived** from experiences  but per the established convention (status is also derivable from placements yet we store it explicitly), we want a stable self-declared value the seeker controls.
- **`SkillsEditor`** (`components/feature/profile/SkillsEditor.tsx`)  client island with add / remove / proficiency slider per skill. The natural home for a years-of-experience input next to each chip.
- **Phase 4 ranking SQL** (`db/queries/profiles.ts:80`)  `ts_rank_cd × freshness × completeness × citizen_boost`. Skill `proficiency` already affects which top-5 are shown per profile but doesn't influence the rank score. Adding years here is a deliberate-and-bounded extension; the alternative is exposing the field as a search filter only and leaving the rank untouched.
- **Search filters** (`lib/mock/types.ts` `SearchFilters`)  no `minYearsExperience` filter today.
- **Public read shape** (`PublicProfile` in `lib/mock/types.ts`)  carries `topSkills` with proficiency only. Extending this is the moment that decides whether the field is *public* or *private*.

---

## 🔒 DECISIONS CLOSED 2026-05-24

Settle now so the build is straight. Don't relitigate without re-opening here first.

### D1  Both fields are NULLABLE
Optional self-declared values. A seeker without years filled in is not penalised in search; existing profiles are not broken by the additive migration. **No data migration to back-fill** by derivation  the values land when the seeker first edits their profile post-9.9.

### D2  Bounds
- `profiles.yearsExperience`: `integer`, range **0..60**. Zod-clamp at the action boundary. 60 is a polite ceiling for first-job-at-15-and-still-working-at-75; the form caps at 60 (no UI for higher).
- `profile_skills.yearsOfExperience`: `integer`, range **0..60**, same logic.

A row with `yearsOfExperience > profile.yearsExperience` is allowed (a seeker may have used a skill in school before their first job). Surprising-but-honest.

### D3  Display format
- Profile header: *"Senior · 8 yrs"* (joins after the seniority string with `·`). When `yearsExperience` is NULL, header reads *"Senior"* unchanged.
- Skill chip: *"TypeScript · 5 yrs"* on the dossier + `/p/[handle]` skill list. When NULL, chip reads *"TypeScript"* unchanged.
- The display rounds down to whole years (no fractional input). 0 = "less than a year" rendered as *"<1 yr"*.

### D4  Public exposure
**Both fields are PUBLIC** (visible on `/search`, `/p/[handle]`, employer dossier). They are CV-header data, not sensitive PII. Differs from DOB / gender which are not in this phase.

### D5  Phase 4 ranking integration
**Yes, but bounded.** The years-per-skill value is a multiplicative factor on the existing top-5-skills ordering, capped at `min(years, 10) / 10` (so a 10-year skill weighs at most 2× a 5-year one; 1-year skills are not crushed). The blend stays inside the `top_skills_for_profile` CTE  no change to `ts_rank_cd` or the headline ranking blend. Stale-profile decay still dominates: a 20-year-old skill on a seeker who hasn't confirmed status in 90 days is still down-weighted hard.

### D6  Search filter
**Defer to a follow-on.** The `minYearsExperience` filter on `/search` is genuinely useful but lands cleanest after 9.9 ships and real data starts populating. Task 9.9.3 is OPTIONAL and can be cut without losing the headline value.

### D7  Currency on experiences
**Out of scope.** The original review flagged that `endedAt IS NULL` implicitly marks the current role. Adding an `isCurrent` boolean is a separate, smaller change that doesn't depend on the years work. Stays in the post-launch backlog.

### D8  Achievement bullets
**Out of scope.** The original review flagged decomposing `experiences.description` into a structured bullets array. Not needed for 9.9. The free-text field works.

---

## ✅ PRE-FLIGHT CHECKLIST (run before writing code)

- [ ] **Migration `0018_phase9_9_years_experience.sql`** drafted + applied locally before any code:
      - `ALTER TABLE profiles ADD COLUMN years_experience integer;`
      - `ALTER TABLE profile_skills ADD COLUMN years_of_experience integer;`
      Both nullable, no default. Idempotent (`IF NOT EXISTS`).
- [ ] Drizzle schema updated to match  `profiles.yearsExperience integer("years_experience")`, `profileSkills.yearsOfExperience integer("years_of_experience")`. Comments document the 0..60 contract.
- [ ] `PublicProfile` type in `lib/mock/types.ts` extended with `yearsExperience: number | null`; `SkillRef` extended with `yearsOfExperience: number | null`. Both nullable so existing mock data compiles without back-fill.
- [ ] Mock profiles (`lib/mock/profiles.ts`) updated where reasonable so the dev pages render with the new fields populated for at least one seeker.
- [ ] No retrofitting of derived values from `experiences`  per D1, the seeder + the migration leave NULLs for every existing row.

---

## 📋 TASKS

### Task 9.9.1: Schema + types ✅ 2026-05-24
- [x] Migration `0018_phase9_9_years_experience.sql` shipped (additive, nullable, idempotent). Applied to Neon.
- [x] `db/schema.ts`: `profiles.yearsExperience` + `profileSkills.yearsOfExperience` integer columns + inline comments documenting the 0..60 contract + the "displays as <1 yr when 0" UI convention.
- [x] `lib/mock/types.ts`: `PublicProfile.yearsExperience` + `SkillRef.yearsOfExperience` (both nullable). `MyProfile` inherits via `extends PublicProfile`.
- [x] `db/queries/profiles.ts` `searchProfilesQuery`: SELECT extended with `p.years_experience`; row mapper threads it through. `topSkillsByProfile()` + `loadTopSkills()` SELECT extended for per-skill years.
- [x] `db/queries/profiles.ts` `findProfileByHandleQuery`: same row-mapper extension.
- [x] `lib/profile/me.ts` `loadOwnedProfile()`: own SELECT + row mapper extended.
- [x] `db/seed.ts` + `lib/mock/profiles.ts`: thandeka-m populated with `yearsExperience: 11` + per-skill years (Pastry 11 / Menu design 7 / Kitchen mgmt 6); andile-z populated with `yearsExperience: 2` + per-skill years; rest stay NULL per D1.

### Task 9.9.2: Profile editor UI ✅ 2026-05-24
- [x] **Profile header field** on `/dashboard/profile`: `<TextField type="number" min={0} max={60}>` next to the seniority select. Hint copy verbatim from the plan. Stored as a string in form state so blank means NULL; clamped + parsed at submit. `updateProfileBasics` Server Action Zod schema extended (`z.number().int().min(0).max(60).nullable().optional()`); action writes the new column.
- [x] **Per-skill years input** on `SkillsEditor.tsx`: compact `w-14` number input next to each skill's proficiency dots, `aria-label="Years of {skill}"`. Sub-label under proficiency reads *"Proficiency: 5/5 · 11 yrs"* live (or just *"Proficiency: 5/5"* when NULL). `updateSkills` Server Action Zod schema extended; action writes the new column.
- [x] **Read-side display**: `/p/[handle]` profession eyebrow now reads *"Senior · Chef · 8 yrs"* when declared (unchanged otherwise); skill cards + the right-rail compact list both append *"· 5 yrs"* per skill. Employer dossier header + dossier skills list mirror the same composition. `TalentRosterItem` (used on /search + vacancy match page) adds years to both the profession line and the top-skills line.
- [x] **Mobile-first**: per-skill row stays single-line at 360 px (years input is `w-14`, proficiency dots stay, X button stays). 0 displays as *"<1 yr"* per D3; NULL renders unchanged (zero visual noise on un-declared rows).

### Task 9.9.3: Phase 4 ranking + search filter (OPTIONAL)  DEFERRED
- [ ] Deferred per D6. The plumbing is in place (`searchProfilesQuery` now selects + maps `years_of_experience`)  the ranking blend extension is a one-line change to the score expression when wanted. Worth doing once real declared-years data accumulates post-launch so the threshold (`LEAST(years, 10) / 10`) is tuned to actual distribution, not guesses.

### Task 9.9.4: Wiring, verification, doc ✅ 2026-05-24
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean across 4 locales · `npm run db:seed` runs end-to-end.
- [x] Manual smoke at 360 px wide for the profile editor + the dossier display (both render single-line per skill; profession eyebrows wrap cleanly).
- [x] On ship: `docs/completed/PHASE_9_9_COMPLETE.md` written. This plan moved into `docs/completed/`. `docs/ROADMAP.md` ticked ✅ + dated. Current State in `docs/TO_START_EVERY_SESSION.md` refreshed.

---

## 🚫 OUT OF SCOPE FOR 9.9 (explicit guardrails)

- ❌ **Date of birth.** SA ID already encodes DOB and `nationalIdEnc` stores the encrypted ID; deriving age at the boundary is preferred over materialising DOB as a column. EEA §6 protected-characteristic concerns apply  surfacing age as a CV field would invite filtering on it. Separate governance-reviewed phase if/when it lands.
- ❌ **Gender.** If added, must follow the 9.7 `nationality_class` playbook: optional self-declared, ~3 buckets including prefer-not-to-say, k=10 suppressed in `/gov` only, never a `/search` filter or invite gate. That's a phase of its own (call it 9.10 if it happens), not a quick add to 9.9.
- ❌ **`experiences.isCurrent` boolean** (D7)  the implicit `endedAt IS NULL` rule continues. Backlog.
- ❌ **Achievement-bullet decomposition** of `experiences.description` (D8)  free text works. Backlog.
- ❌ **Backfill of years from experiences history.** Tempting but lossy: the seeker may have non-contiguous gaps the SQL can't see. Force the seeker to declare the number explicitly on first profile edit.

---

## 🧭 WHY THIS IS ON-AXIS (and not feature creep)

The Phase 9.8 system review surfaced four candidate gaps: DOB, gender, past experience, years per skill. Two of those (past experience, years) are CV-header standards every recruiter expects. Two (DOB, gender) are protected-characteristic territory that need governance, not a quick add. Splitting 9.9 to ship the two safe ones now lets Phase 10 (public launch) land with a more complete profile model without crossing into the demographic-data design space  which deserves its own deliberate cycle.

The change is small: one additive migration, two nullable columns, two UI inputs, one bounded ranking multiplier. Total scope is ~1 focused session. Won't push Phase 10.

*Plan opened 2026-05-24. Target: complete same week as Phase 10 prep so launch ships with profile data that reads the way South African recruiters actually talk.*
