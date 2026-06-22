# PHASE 13.10 PLAN  MULTI-ARCHETYPE SEEKER SUPPORT

*Side-phase between Phase 13.9 (Any province) and Phase 12 (Testing & QA). Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `docs/completed/PHASE_11_5_COMPLETE.md` (the Open-To tags + `secondaryProfessions`-shaped `currentModules` schema pattern this builds on).*

> **Thesis:** Sebenza was scaffolded around the canonical *one seeker, one profession* pattern. Real SA talent  particularly across hospitality, caregiving, customer-service, and trades  often carries a multi-stint, cross-industry, *willing-to-be-trained* archetype. A seeker who has 7 years customer service + 2 years caregiving + 2 years barista + 2 years kitchen assistant + Matric + Computer Literacy + Home Based Care today must:
>
> 1. Pick ONE primary profession (the headline rule).
> 2. Try to express her cross-industry flexibility via Open-To tags that don't fit (`mentorship` / `freelance` / `contract_gigs` / `public_speaking` are all *experienced professional offering side work*).
> 3. Hope the skill-overlap matcher (Phase 9.8.2) rescues her from being invisible on the profession filter.
>
> Phase 13.10 closes both gaps additively: new Open-To tags surface the "I'll learn on the job" archetype, and a small `secondary_professions` column lets the matcher recognise her as a barista AND a caregiver AND a customer-service rep without ranking any of those above her primary.

---

## 🎯 GOAL

After Phase 13.10 ships:

- A seeker can tick **Open to training** and/or **Cross-industry** in the `/dashboard/profile` Open-To section so employers searching for entry-level + cross-industry-flexible candidates can find them via the existing Phase 11.5.1 `/search?open_to=` filter.
- A seeker can declare up to **3 secondary professions** that the search profession filter + the Phase 9.8.2 vacancy reverse-matcher honour as equivalent to her primary.
- The public profile `/p/[handle]` renders secondary professions as a small chip row below the primary headline ("Also experienced in: Barista · Kitchen Porter · Caregiver")  never as a list-of-equals.
- Existing single-profession seekers see zero UI change. The whole shape is opt-in.

Built honest: the headline still picks one primary profession; secondaries are *additional* recognised lanes, not co-equals. The matcher widens; the editorial framing stays single-headlined.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **`OPEN_TO_TAGS` enum** + `profiles.open_to_tags text[]` column (Phase 11.5.1). Current values: `mentorship` / `freelance` / `contract_gigs` / `public_speaking`. We extend the enum + add labels + hints.
- **`/search?open_to=` filter** via `&&` array overlap on the column. No change to the search query; just new values land naturally.
- **`profiles.profession` single text field** (since Phase 4). Stays the headline. We add a sibling array column for secondaries.
- **`PROFESSIONS` taxonomy** in `lib/mock/taxonomy.ts` (~75 entries). The same source the primary profession picker reads.
- **`<MultiSelectComboboxField>`**  the picker pattern reused for skills since the Phase 9.18 "hiring UX polish" pass. Mirrors the same pattern for secondary professions.
- **Phase 9.8.2 `matchVacancyCandidates()`** uses `searchProfilesQuery` under the hood  widening the search profession filter automatically widens the reverse-matcher.

---

## 📋 TASKS

### Task 13.10.1: Two new Open-To tags

**Scope.** Extend `OPEN_TO_TAGS` in `lib/mock/types.ts`:

```ts
export const OPEN_TO_TAGS = [
  "mentorship",
  "freelance",
  "contract_gigs",
  "public_speaking",
  // Phase 13.10  cross-industry / entry-level archetypes
  "open_to_training",
  "cross_industry",
] as const;
```

Add labels + hints:

```ts
open_to_training: "Open to training",
cross_industry: "Cross-industry",
```

Hints:

- `open_to_training` → "I'll take on a new role if the employer is willing to train me. Open to entry-level + skill-adjacent moves."
- `cross_industry` → "Willing to bring my skills into a different industry than my primary profession. E.g. customer-service into retail, hospitality into office admin."

**Why two, not one.** The two archetypes are genuinely distinct:
- A senior chef who'd consider a kitchen-management role in a hospital cafeteria is `cross_industry` but NOT `open_to_training`.
- A school-leaver with Matric who's willing to learn anything is `open_to_training` but doesn't need a `cross_industry` label (she has no primary industry to cross from).
- The seeker who triggered this plan is BOTH.

**Editorial framing.** The four pre-Phase-13.10 tags all describe "experienced professional offering X as a side". The two new tags describe "candidate willing to receive X". Different direction, same Open-To array. No friction at the schema layer; the seeker chooses any combination.

- [ ] Extend `OPEN_TO_TAGS` + `OPEN_TO_TAG_LABEL` + `OPEN_TO_TAG_HINT`.
- [ ] No migration (column is already `text[]`).
- [ ] No new audit kinds (existing `profile.update` carries the field-change meta).

---

### Task 13.10.2: Schema  `secondary_professions` column

**Migration `0048_phase13_10_secondary_professions.sql`:**

```sql
ALTER TABLE profiles
  ADD COLUMN secondary_professions text[] NOT NULL DEFAULT '{}';

-- Lookup index for the search filter (Task 13.10.5). Without this,
-- the array-overlap (`&&`) WHERE clause does a sequential scan.
CREATE INDEX idx_profiles_secondary_professions_gin
  ON profiles USING gin (secondary_professions);
```

**Schema (`db/schema.ts`):**

```ts
secondaryProfessions: text("secondary_professions")
  .array()
  .notNull()
  .default(sql`'{}'::text[]`),
```

**Types.** `MyProfile.secondaryProfessions: string[]` + `PublicProfile.secondaryProfessions?: string[]` (public exposure decided in D1).

**Storage convention.** Stores profession **labels** matching the existing `profiles.profession` string convention, not slugs. Yes, slug would be cleaner  but `profiles.profession` is already text-label, and an in-phase migration to slug-everywhere is out of scope. The action layer validates each label against the canonical `PROFESSIONS` taxonomy on write; no free-text escapes.

- [ ] Migration + schema column + MyProfile/PublicProfile types.

---

### Task 13.10.3: Profile editor  secondary professions picker

**`/dashboard/profile` → `<ProfileBasicsForm>` extension.** Below the existing primary `<ComboboxField>` for profession, add a multi-select picker:

```tsx
<MultiSelectComboboxField
  label="Also experienced in (optional)"
  options={PROFESSIONS.map((p) => ({ value: p.label, label: p.label }))}
  values={secondaryProfessions}
  onChange={setSecondaryProfessions}
  max={3}
  hint="Up to 3 other professions you've worked in. Surfaces you to employers who search for those roles. Your headline stays the primary."
/>
```

**Validation (server action `updateProfileBasics`).**

- Each entry must be a canonical `PROFESSIONS.label`.
- Cap at 3 (server-side refuse on overflow).
- Cannot duplicate the primary profession.
- **No "Other" path** (D3)  keep data clean. Users add new professions via the Phase 9.15 admin suggestion queue, then they appear in the picker.

- [ ] Form field.
- [ ] Server action validation extending `updateProfileBasics`.
- [ ] Audit row meta carries `secondaryProfessionsCount` (count only, not the values  the labels are non-PII but the principle stands).

---

### Task 13.10.4: Public profile rendering

**`/p/[handle]` headline area.** Today:

```
[Avatar]  Thandiwe M.
          Senior · Customer Service · 9 yrs · Cape Town
```

Phase 13.10 adds a chip row below when `secondaryProfessions.length > 0`:

```
[Avatar]  Thandiwe M.
          Senior · Customer Service · 9 yrs · Cape Town
          Also experienced in: Barista · Kitchen Porter · Caregiver
```

Civic-Editorial typography: ALL-CAPS eyebrow "ALSO EXPERIENCED IN" if rendered on the dossier, or italic-lowercase inline on the public profile. Chips are NOT clickable links  the matcher widens automatically, but a chip-as-link would let employers think they're filtering by secondary only (and a generic `/search?profession=barista` already exists for that intent).

**Search-result row (`<TalentRosterItem>`).** Does NOT render secondary professions  keeps the roster row scannable. The widened search filter does the heavy lifting; the row stays single-headline.

- [ ] `/p/[handle]` chip row.
- [ ] No change to `<TalentRosterItem>` (D5  roster row stays scannable).

---

### Task 13.10.5: Search profession filter widening

**`searchProfilesQuery` in `db/queries/profiles.ts`.** Today the profession filter is:

```sql
WHERE LOWER(p.profession) = LOWER($1)
```

Phase 13.10 widens to union:

```sql
WHERE LOWER(p.profession) = LOWER($1)
   OR LOWER($1) = ANY(SELECT LOWER(unnest(p.secondary_professions)))
```

(Or equivalent Drizzle idiom; the GIN index from 13.10.2 covers the array-side.)

**Ranking.** Primary still ranks higher. Implemented via a CASE in the ORDER BY:

```sql
ORDER BY
  CASE WHEN LOWER(p.profession) = LOWER($1) THEN 0 ELSE 1 END,
  <existing freshness × completeness × citizen-group rank>
```

Seekers whose primary matches sort above seekers whose secondary matches, within each citizen-group tier. The Citizen-Visibility Rule (D3 from 9.7) still holds  primary-matching SA citizens still rank above primary-matching non-citizens, and the secondary-matching block also splits the same way.

- [ ] SQL update in `searchProfilesQuery`.
- [ ] CASE-based rank tiebreak.
- [ ] Verify `countMatchesByCitizenship` counts the union too (it already shares the WHERE clause via `vacancyToSearchFilters`).

---

### Task 13.10.6: Vacancy reverse-matcher widening (free via 13.10.5)

**`matchVacancyCandidates(vacancy)` in `lib/employer/vacancies.ts`.** Already composes a `SearchFilters` carrying the vacancy's profession label. Once `searchProfilesQuery` widens (Task 13.10.5), the reverse-matcher widens automatically  the seeker whose `secondaryProfessions` includes "Barista" surfaces for a vacancy targeting `barista`.

**Honest disclosure on the match page.** Below each matched candidate, a small annotation when the match came via secondary: *"matched via secondary profession: Barista"*. The employer sees how the platform reached this candidate so the honest-supply line stays honest.

- [ ] Confirm `matchVacancyCandidates` picks up secondary-only matches.
- [ ] Add the "matched via secondary" annotation on `/employer/vacancies/[id]/match`.

---

### Task 13.10.7: Help article paragraph

Add a one-paragraph block to `content/help/seeker/profile/employment-history-entry.tsx` (or wherever the profession-picking guidance lives) explaining:

- The headline stays one primary profession  pick the one with the most weight on your trajectory.
- Add up to 3 secondaries to surface to employers searching for those roles.
- The two new Open-To tags (`open_to_training`, `cross_industry`) cover entry-level + industry-shift archetypes.

No new article  this is a paragraph + bump `updatedAt`.

- [ ] One paragraph + `updatedAt` bump.

---

## 🚫 OUT OF SCOPE FOR PHASE 13.10 (explicit guardrails)

- ❌ **Per-secondary-profession years of experience.** Already on the `experiences` + `profile_skills` side; the secondary is a label, not a sub-profile.
- ❌ **Making `profiles.profession` a slug column.** Big migration touching every consumer; tracked separately, not blocking.
- ❌ **Multi-profession vacancies** ("we're hiring a barista OR a kitchen porter"). The matcher already handles this via skill overlap; if vacancies need to express multi-profession-acceptable, that's a different shape (probably a `professionSlugs: text[]` column on vacancies).
- ❌ **A "Skills you can be trained in" field separate from `open_to_training`.** Open-To carries the signal; a separate list adds editorial drag for marginal signal.
- ❌ **Suggesting secondaries from declared experiences.** Tempting (the platform sees she worked as a barista for 2 years) but turns the field into an audit-trail rather than a seeker-controlled signal. Suggest in a future polish; not Phase 13.10.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Secondary professions are **public** (visible on `/p/[handle]`). | They're an experience claim, like declaring multilingualism; no special-category PII implication. Posting employers benefit from seeing them. |
| D2 | Cap at **3 secondaries**. | Three covers virtually every real seeker we've sampled (1-2 sidesteps from a primary career); higher invites inflation ("I've also been a 'leader', a 'team player'") and dilutes the matcher's signal. |
| D3 | **No "Other" submission path** on the picker. | Keep data clean for matching; Phase 9.15 admin queue is the supported route for new professions. Adds editorial discipline. |
| D4 | Primary profession stays a **single text label**. | No schema disruption to /search, /p/[handle], `<TalentRosterItem>`. Secondaries are additive, not transformative. |
| D5 | Search-result row (`<TalentRosterItem>`) does **NOT** render secondaries. | Keep the roster scannable; the widening happens at the WHERE clause, not at the per-row UI. The public profile page is where the full claim lives. |
| D6 | Vacancy reverse-match surfaces secondary matches with a **"matched via secondary"** annotation. | Honest disclosure  the employer sees why this candidate is in the list. No silent expansion. |
| D7 | Primary profession matches **rank above** secondary matches on the same profession query. | The headline is still the headline; a barista-by-trade ranks above a customer-service-rep-also-barista when an employer searches for "Barista". Within each rank tier, the existing freshness × completeness × Citizen-Visibility ranking applies unchanged. |
| D8 | Two distinct new Open-To tags (`open_to_training` + `cross_industry`), not one combined. | The two archetypes are genuinely distinct (D8 doc above). Combining would dilute editorial framing + force seekers to over-claim. |
| D9 | No new audit kinds. | The existing `profile.update` audit row's meta carries the changed-field names; that's enough. Adding `secondary_professions.add` would be over-instrumentation for a low-sensitivity field. |

---

## 🧪 HOW TO VERIFY

1. As an existing single-profession seeker, visit `/dashboard/profile`. Confirm the new "Also experienced in" picker appears empty by default. Confirm the new "Open to training" + "Cross-industry" chips appear in the Open-To section.
2. Add 2 secondary professions ("Barista", "Caregiver") + tick "Open to training". Save. Confirm `/p/[handle]` renders the chip row.
3. As an employer on `/search`, filter by `profession=barista`. Confirm the secondary-marked seeker appears in the results, ranking BELOW seekers whose primary is "Barista".
4. As an employer on `/employer/vacancies/[id]/match` for a vacancy targeting "Barista", confirm the seeker surfaces in the candidate list with the "matched via secondary profession" annotation.
5. On `/search?open_to=open_to_training`, confirm the seeker appears.
6. Existing single-profession seekers see no change to their `/p/[handle]` (no chip row when array is empty). Existing search queries for their profession behave unchanged.
7. Try to submit 4 secondaries from the form  the picker caps at 3.
8. Try to add a free-text "Astronaut" via the picker  the action refuses, points at the Phase 9.15 taxonomy queue.

---

## 📦 PROBABLE FOOTPRINT

- 1 new migration (1 column add + 1 GIN index).
- 1 schema diff.
- ~10 files via the typecheck cascade:
  - `lib/mock/types.ts` (OPEN_TO_TAGS extension + MyProfile / PublicProfile types)
  - `db/schema.ts` (column)
  - `db/queries/profiles.ts` (search filter widening + rank CASE)
  - `lib/profile/me.ts` (read mapping)
  - `lib/profile/actions.ts` (`updateProfileBasics` cross-validation + insert path)
  - `components/feature/profile/ProfileBasicsForm.tsx` (the picker)
  - `app/[locale]/(public)/p/[handle]/page.tsx` (public chip row)
  - `app/[locale]/(employer)/employer/vacancies/[id]/match/page.tsx` (the "via secondary" annotation)
  - `content/help/seeker/profile/employment-history-entry.tsx` (one paragraph)
  - Tests (if vitest-coverage for the search query path)
- 0 new audit kinds.
- 0 new notification kinds.
- 0 new platform flags.
- 2 new Open-To enum values (no migration; the column is text[]).

Comparable to Phase 13.9 in scope  a contained additive change with a clean type cascade driving the rest.

---

*Plan opens for Phase 13.10. Target: end-to-end ship within one working session. POPIA implications: none (profession-history is non-special-category). Trust posture: strengthened  the platform stops being editorially-monogamous about profession when the seeker's real history isn't.*
