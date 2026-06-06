# PHASE 13.10 COMPLETE  MULTI-ARCHETYPE SEEKER SUPPORT

*Shipped 2026-06-06. Side-phase between Phase 13.9 and Phase 12 (Testing & QA). Triggered by a real seeker message naming the gap.*

> **One-line summary**: Closes two structural gaps for seekers whose careers don't sit in one box. (1) Two new Open-To tags (`open_to_training` + `cross_industry`) surface the "I'll learn on the job" archetype that the four pre-13.10 tags didn't cover. (2) A new `secondary_professions text[]` column lets a seeker declare up to 3 additional profession lanes; the search profession filter widens to **primary OR any secondary** with primary ranked above secondary on the tiebreak. The vacancy reverse-match surfaces secondary matches with a *"matched via secondary profession"* honest-disclosure annotation. Existing single-profession seekers see zero UI change.

Commits:

- `c2a71f9`  docs: Phase 13.10 plan
- `7b63838`  Phase 13.10: multi-archetype seeker support

---

## 🎯 WHAT SHIPPED

### Open-To tags (`lib/mock/types.ts`)
- `open_to_training`  *"I'll take on a new role if the employer is willing to train me. Open to entry-level + skill-adjacent moves."*
- `cross_industry`  *"Willing to bring my skills into a different industry than my primary profession. E.g. customer-service into retail, hospitality into office admin."*
- **Two distinct tags, not one combined** (D8): the archetypes genuinely diverge  a senior chef considering hospital-cafeteria management is `cross_industry` but NOT `open_to_training`; a Matric school-leaver willing to learn anything is the opposite.
- No migration needed  the column was already `text[]` (Phase 11.5.1).

### Schema (migration 0048)
- `ALTER TABLE profiles ADD COLUMN secondary_professions text[] NOT NULL DEFAULT '{}'`.
- GIN index `idx_profiles_secondary_professions_gin` for the array-overlap read path.
- Stores **LABELS** (matches `profiles.profession` storage convention, not slugs).
- D2 cap: **3 secondaries**, enforced at form + action layer (no DB CHECK that would couple to the integer literal).

### Form (ProfileBasicsForm)
- `MultiSelectComboboxField` **"Also experienced in (optional)"** below the Profession ComboboxField.
- `onChange` dedupes + drops the primary + caps at 3 in-place.
- Spans both grid columns at md+ so chips have room.
- **No allowOther path** (D3)  taxonomy queue is the route for new professions.

### Server action (updateProfileBasics)
- `z.array(z.string()).max(3)` + two `.refine()`s:
  - **D3** every entry must be a canonical `PROFESSIONS.label`.
  - **Additional** primary cannot also appear as a secondary.
- Defensive dedupe on insert path.

### Public profile (`/p/[handle]`)
- Italic **"Also experienced in:"** eyebrow + hairline-bordered chips below the meta row; only rendered when array is non-empty.
- Chips are **NOT links** (D5)  the matcher widens automatically; a chip-as-link would imply a secondary-only filter that doesn't exist.
- `TalentRosterItem` (search row) **unchanged**: stays scannable.

### Search (searchProfilesQuery)
- Profession filter widened: **primary OR any secondary** via `unnest(p.secondary_professions)`. GIN index backs the array side.
- New `primaryMatchKey` in the ORDER BY: profession-matching primaries rank above profession-matching secondaries within each citizen-group tier (**D7**). When no profession filter is set, the CASE returns 0 and becomes a no-op.
- `countMatchesByCitizenship` gets the same widened profession condition so the honest-supply line agrees with the ranked list.
- `secondary_professions` column included in the SELECT + the `SearchResultRow` mapping so callers can render the "matched via secondary" annotation without an extra query.

### Vacancy match page (`/employer/vacancies/[id]/match`)
- Per-row italic annotation when the candidate surfaced via secondary profession only: *"matched via secondary profession: Barista"*. **D6** honest disclosure  the employer sees why this person is here.
- Positioned to the left of "Open dossier" so it reads first.

### Help (`content/help/seeker/profile/secondary-professions-and-cross-training.tsx`)
- **New article** covering both features, with explicit honest-framing on the headline-stays-one-primary rule.
- Registered in `seeker/_index.ts` between `studentProgressionTracker` and the vacancy-invitations section.
- `<HelpLink>` chip added on `/dashboard/profile` next to the existing "Open-to tags" chip.
- `employment-history-entry.tsx` also gains a one-paragraph cross-reference + `updatedAt` bump.

---

## 🛡️ NEW DATA / FLAGS / KINDS

- 1 migration (0048).
- 1 new column (`profiles.secondary_professions text[]`).
- 1 new GIN index.
- 2 new enum values (`open_to_training` + `cross_industry`) on the existing `OPEN_TO_TAGS` text array.
- 0 new audit kinds (**D9**  `profile.update` carries the field-change meta).
- 0 new notification kinds.
- 0 new platform flags.

---

## 🧭 KEY DECISIONS (LOCKED)

- **D1** Secondaries are public (visible on `/p/<handle>`)  they're an experience claim like declaring multilingualism.
- **D2** Cap at 3 secondaries.
- **D3** No "Other" submission path  Phase 9.15 admin queue is the supported route.
- **D4** Primary profession stays a single text label  no schema disruption.
- **D5** `TalentRosterItem` does NOT render secondaries (roster stays scannable).
- **D6** Vacancy reverse-match surfaces secondary matches with a "matched via secondary profession" annotation.
- **D7** Primary matches rank above secondary matches on the same profession query.
- **D8** Two distinct new Open-To tags, not one combined.
- **D9** No new audit kinds.

---

## 🧪 VERIFICATION

1. Existing single-profession seeker visits `/dashboard/profile` → "Also experienced in" picker appears empty by default. "Open to training" + "Cross-industry" chips appear in the Open-To section.
2. Add 2 secondaries ("Barista", "Caregiver") + tick "Open to training". Save → `/p/<handle>` renders the chip row.
3. Employer on `/search?profession=Barista` → the secondary-marked seeker appears in the results, ranking BELOW seekers whose primary is "Barista".
4. Employer on `/employer/vacancies/[id]/match` for a "Barista" vacancy → seeker surfaces with the "matched via secondary profession: Barista" annotation.
5. `/search?open_to=open_to_training` → seeker appears.
6. Existing single-profession seekers see no change to their `/p/<handle>` (no chip row when array is empty).
7. Try to submit 4 secondaries via the form → picker caps at 3.
8. Try to add a free-text "Astronaut" via the picker → action refuses, references the Phase 9.15 taxonomy queue.

---

## 📦 FOOTPRINT

| Metric | Value |
|---|---|
| Migrations | 1 (0048) |
| Files changed | 11 |
| New columns | 1 (`profiles.secondary_professions text[]`) |
| New indexes | 1 (GIN on `secondary_professions`) |
| Open-To tag additions | 2 |
| New help articles | 1 |
| Audit kinds | 0 new |
| Platform flags | 0 |
| Lines added / removed | +366 / -24 |

*Phase 13.10 closes the multi-archetype gap for SA national talent. Trust posture: strengthened  the platform stops being editorially-monogamous about profession when the seeker's real history isn't.*
