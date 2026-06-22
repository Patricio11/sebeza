# PHASE 13.9 PLAN  "ANY PROVINCE" OPTION FOR REMOTE / HYBRID VACANCIES

*Side-phase between Phase 13.8 (Invite-from-search) and Phase 12 (Testing & QA). Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `docs/completed/PHASE_9_8_COMPLETE.md` (the vacancies + reverse-match engine this builds on).*

> **Thesis:** A remote-Gauteng-based vacancy currently excludes a perfect KZN candidate from the reverse-match list because `vacancies.province_slug` is `NOT NULL`. That contradicts the spirit of "remote". Adding an "Any province" option (gated to vacancies that include `remote` or `hybrid` in `work_availability`) closes the gap honestly without breaking the location-aware ranking for in-person roles.

---

## 🎯 GOAL

After Phase 13.9 ships, an employer creating a vacancy:

- Sees an **"Any province (remote / hybrid)"** option in the province picker, surfaced only when `work_availability` includes `remote` or `hybrid`.
- Picking "Any" sets `province_slug = NULL` AND `city_slug = NULL` on the row.
- The reverse-match query (`matchVacancyCandidates`) skips the province filter when `vacancy.provinceSlug` is null; skill / years / NQF / work-availability filters still apply.
- The vacancy card + detail render "Remote · Any province" / "Hybrid · Any province" depending on the work-availability mix.
- Gov-side demand-by-province aggregates bucket null-province vacancies as a separate **"national / remote"** lane  never silently dropped, never double-counted.

Built honest: removing the location gate doesn't remove honest disclosure that the role is national / remote-only.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **`vacancies` table** (Phase 9.8.1)  `province_slug text NOT NULL` + `city_slug text NULL`. Migration `0015`.
- **`work_availability` array on vacancies** (Phase 9.18)  currently includes `remote` and `hybrid` as valid kinds.
- **`matchVacancyCandidates()`** (Phase 9.8.2)  the reverse-match composer that currently filters by `vacancy.provinceSlug` to scope the search.
- **`VacancyForm` component**  owns the province + city picker. Already wires `MultiSelectComboboxField` for work-availability.
- **`createVacancy` / `updateVacancy` server actions** in `lib/employer/vacancies.ts`  Zod-validated entry points.
- **Gov-side `demandVsCurriculumQuery`** + `demandVsCurriculumByModule` (Phase 9.13.3 + 13.6)  aggregate against `institutions.province_slug` (not vacancies); the change here doesn't break them directly but the **followed-employer vacancy-sweep cron** + the **Phase 13.8 Invite-from-search** modal need province-display awareness.

---

## 📋 TASKS

### Task 13.9.1: Schema  drop NOT NULL on `vacancies.province_slug`

**Migration `0047_phase13_9_vacancy_any_province.sql`** (additive, no data backfill):

```sql
ALTER TABLE vacancies
  ALTER COLUMN province_slug DROP NOT NULL;
```

`city_slug` is already nullable  no change there.

**Schema (`db/schema.ts`)**  `provinceSlug: text("province_slug").notNull()` → `provinceSlug: text("province_slug")`.

**Types**  `VacancyRow.provinceSlug: string` → `string | null`. Every consumer that destructures `provinceSlug` gets a typecheck failure until handled. Drives the rest of the work.

- [ ] Migration + schema column + `VacancyRow` interface update.

---

### Task 13.9.2: Form UX  conditional "Any" province option

**`VacancyForm.tsx`**  the province `<select>` (or `ComboboxField`) gains an "Any province (remote / hybrid)" option **only when** the form's current `work_availability` selection includes `remote` OR `hybrid`. Implementation:

- When `workAvailability` toggles off remote AND hybrid while province is set to "Any", the form auto-clears the picker back to "Select a province" (state convergence, not silent acceptance of a now-invalid combination).
- Picking "Any" disables / hides the city field  there's no "Any city in Any province".
- The picker's "Any" row carries a small hint chip explaining the implication: *Candidates from every province match; location filter is off.*

**Server actions**  `createVacancy` + `updateVacancy` Zod schemas accept `provinceSlug: string | null`. Server-side validation cross-checks: when `provinceSlug === null`, `workAvailability` MUST contain at least one of `remote` or `hybrid`. Refuse otherwise with a clear error message. The form should never let this state escape, but the server is the structural gate.

- [ ] Form-side conditional option + auto-clear on work-availability change.
- [ ] Server-side cross-validation in createVacancy / updateVacancy.
- [ ] Hidden / disabled city field when province is "Any".

---

### Task 13.9.3: Matcher  skip province filter when null

**`matchVacancyCandidates(vacancy)`** (Phase 9.8.2) currently composes search filters from vacancy fields. When `vacancy.provinceSlug` is null, drop the province filter entirely from the candidate query. Skill / years / NQF / work-availability filters still apply.

**`countMatchesByCitizenship`** (Phase 9.8.2's honest-supply line)  same fix; skip the province narrowing when null.

- [ ] `matchVacancyCandidates` honours null province.
- [ ] `countMatchesByCitizenship` honours null province.

---

### Task 13.9.4: Display  "Any province" rendering

Every surface that renders a vacancy's location string needs to handle null. The string is composed in a handful of places:

- `<VacancyCard>` / `<VacancyHeader>` (employer vacancy list + detail).
- `<VacancyInvitationsPanel>` row label (employer side).
- Seeker-side invitation card (`<InvitationCard>` on `/dashboard/invitations`).
- `<VacancySnapshotCard>` (Phase 11.3.4, the snapshotted vacancy on the invitation detail).
- Phase 13.8's `<InviteFromSearchButton>` modal picker  adds "Remote · Any" / "Hybrid · Any" / "Cape Town" subtitle under each vacancy title so the employer disambiguates two same-titled vacancies on different lanes.

**Helper**  new `formatVacancyLocation(v: { provinceSlug, citySlug, workAvailability })` in `lib/employer/vacancies-display.ts` (server-friendly, no React deps) returns:

- `"Any province · Remote"` when `provinceSlug` is null AND `workAvailability` includes `remote` only.
- `"Any province · Hybrid"` when `provinceSlug` is null AND `workAvailability` includes `hybrid` only.
- `"Any province · Remote / Hybrid"` when both are present.
- `"Cape Town, Western Cape"` when both city + province are set.
- `"Western Cape"` when only province is set.

Single source of truth so the eight render sites stop drifting.

- [ ] `formatVacancyLocation` helper + all eight call-sites switched to it.

---

### Task 13.9.5: Gov-side  "national / remote" lane on demand cuts

The demand-vs-curriculum surfaces (`/gov/curriculum`, the module-grain card, the CSV exports) aggregate by province dimension. Null-province vacancies need handling:

**Option taken (D5):** bucket them as a separate **"national / remote"** lane. NEVER:
- silently exclude (loses real demand signal),
- double-count across every province (overstates demand by 9×),
- attribute to the employer's HQ province (dishonest  the role doesn't constrain location).

**Implementation:**

- Existing queries `demandVsCurriculumQuery` + `demandVsCurriculumByModule` read `search_events` and `programme_skills` / `module_skills`. **These queries do NOT consume `vacancies.province_slug`** (verified by the survey). So they're unaffected.
- The only **vacancy-grouped** province cut is in **Phase 9.7 LMI / Justification Index** which uses `placements.city` indirectly. Audit those queries; if any group vacancies by province, add the "national / remote" bucket.
- New helper `vacancyProvinceBucket(provinceSlug: string | null): string` → returns `province_slug` when set, or the literal `"national-remote"` sentinel when null. Used only inside group-by clauses; never persisted.

**UI:** when a gov-side surface shows a province breakdown, the "national / remote" row renders with a small italic label so the analyst knows it's the catch-all lane.

- [ ] Audit every vacancy-grouped-by-province query. (Likely small  survey suggested none today; verify in implementation.)
- [ ] Helper `vacancyProvinceBucket`.
- [ ] Render the "national / remote" lane on any surface that surfaces vacancy province cuts.

---

### Task 13.9.6: Followed-employer vacancy-sweep cron

The Phase 11.4.2 cron fires `employer.opened_vacancy.in_your_pool` per (followed-org × matching new vacancy)  currently keyed off vacancy.provinceSlug matching seeker.provinceSlug. A null-province vacancy should match every seeker who follows the org regardless of their province (since the role doesn't constrain location).

- [ ] Cron query: when `vacancy.provinceSlug IS NULL`, drop the province join from the seeker-follower match.

---

### Task 13.9.7: Help article touch-up

One small editorial pass to keep help honest:

- `content/help/employer/vacancies/creating-a-vacancy.tsx` (or whichever existing employer help article covers vacancy creation): add a one-paragraph block "Posting a remote or hybrid role" explaining the "Any province" option + the exact gating (remote / hybrid required).

No new article  the existing creating-a-vacancy article is the right home.

- [ ] One help article paragraph + meta `updatedAt` bump.

---

## 🚫 OUT OF SCOPE FOR PHASE 13.9 (explicit guardrails)

- ❌ **"Any country"**  Sebenza is SA-focused. "Any" means any SA province, not cross-border. The Location-Not-Nationality Rule + the platform's national-system thesis don't change.
- ❌ **Cross-border remote vacancies** (e.g. SA company hiring globally)  separate phase if ever. The current schema (`profiles.province_slug`) anchors candidates to SA provinces only; opening the talent pool to non-SA-residents is a different problem with different POPIA implications.
- ❌ **A new "national" employer-side workspace surface**  the existing vacancy detail page handles the rendering; no new page.
- ❌ **Retroactive backfill**  existing vacancies stay as they are. The form only exposes "Any" for fresh creates / edits.
- ❌ **Per-city Any**  there's no "Any city in Western Cape" option. Province + city is the right grain.
- ❌ **Schema sentinel value `'any'`**  explicitly rejected per D2 in favour of nullable column.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | `NULL` on `province_slug` means "Any province (remote / hybrid)". | Clean SQL semantics: `WHERE (vacancy.province_slug IS NULL OR vacancy.province_slug = $1)`. A sentinel string `'any'` would force every reader to know the magic value + would break the FK-style invariant that every non-null slug must exist in `provinces`. |
| D2 | "Any" is gated to vacancies whose `work_availability` includes `remote` **OR** `hybrid`. | Hybrid roles can also be national in practice ("come to the Cape Town office once a quarter from anywhere in SA"). Gating on both keeps the affordance honest without over-restricting. Server-side cross-validation enforces. |
| D3 | When `province_slug` is NULL, `city_slug` is NULL too. | "Any city in Any province" is incoherent. Form clears city; server validation refuses non-null city when province is null. |
| D4 | Existing data stays unchanged (no backfill). | All existing rows have non-null province; the migration just relaxes the constraint. Honest about the past + zero risk. |
| D5 | Gov-side: bucket null-province vacancies as a separate "national / remote" lane. | Excluding loses demand signal; double-counting inflates it; attributing to employer HQ is dishonest. A separate lane tells the analyst exactly what they're looking at. |
| D6 | The form auto-clears province back to unset when the user toggles off both `remote` and `hybrid` while province is "Any". | State convergence: never let the form sit in a now-invalid combination. The user can re-pick a province explicitly. |
| D7 | Display label is `"Any province · Remote / Hybrid"` (joined by " / " when both are present). | Editorial: capitalises the work-mode noun, never says "anywhere" (which would imply cross-border). |
| D8 | The `Phase 13.8 Invite-from-search` modal's picker subtitle uses the same `formatVacancyLocation` helper. | Single source of truth; same wording everywhere. |

---

## 🧪 HOW TO VERIFY

1. As a verified employer, create a vacancy with `work_availability = ["full_time"]` only. Confirm the province picker does NOT offer "Any". The existing required-province behaviour stands.
2. Toggle `work_availability` to include `remote`. Confirm "Any province (remote / hybrid)" appears in the picker. Pick it. Confirm the city field disables.
3. Untick `remote`. Confirm the form auto-clears the "Any" selection (D6).
4. Submit a vacancy with `province_slug = NULL` and `work_availability = ["remote"]`. Confirm the row persists.
5. Try to submit a vacancy with `province_slug = NULL` and `work_availability = ["full_time"]` via crafted form payload (or curl directly to the action). Confirm the server-side validation refuses.
6. On `/employer/vacancies/[id]/match` for the null-province vacancy, confirm the candidate list includes seekers from every province (province filter dropped). Skill / years / NQF still narrow.
7. On `/employer/vacancies` list + detail, confirm the location string reads "Any province · Remote" (or "/ Hybrid" when both).
8. On the seeker's `/dashboard/invitations` for an invitation to a null-province vacancy, confirm the snapshot card + the invitation row both render "Any province · Remote" honestly.
9. On `/gov/curriculum`, confirm null-province vacancies surface in a "national / remote" row on whichever surface aggregates by province (likely none break today  the existing queries don't read `vacancies.province_slug`; the new `vacancyProvinceBucket` helper is there for the next gov surface that does).
10. Phase 13.8 Invite-from-search modal: confirm each vacancy in the picker shows its location string under the title, including "Any province · Remote" for the null-province ones.

---

## 📦 PROBABLE FOOTPRINT

Rough order-of-magnitude estimate:

- 1 new migration (drop NOT NULL on `vacancies.province_slug`).
- 1 schema diff (the column on `db/schema.ts`).
- 1 type change cascading through ~8 files via typecheck.
- 1 form change (conditional "Any" option + state convergence).
- 2 server-action validation extensions (createVacancy + updateVacancy).
- 2 query changes (matchVacancyCandidates + countMatchesByCitizenship  drop province filter when null).
- 1 cron change (followed-employer vacancy-sweep).
- 1 new helper (`formatVacancyLocation`) + 1 new helper (`vacancyProvinceBucket`).
- 8 render-site switches to `formatVacancyLocation`.
- 1 help article paragraph.
- 0 new audit kinds.
- 0 new notification kinds.
- 0 new platform flags.

Comparable to Phase 11.5 polish tasks  a contained schema-shape change with a clean cascading typecheck driving the rest.

---

*Plan opens for Phase 13.9. Target: end-to-end ship within one working session. POPIA implications: none (work-mode + location are non-special-category fields). Trust posture: strengthened  the platform stops silently filtering candidates out of legitimately-remote vacancies.*
