# PHASE 13.9 COMPLETE  "ANY PROVINCE" OPTION FOR REMOTE / HYBRID VACANCIES

*Shipped 2026-06-04. Side-phase between Phase 13.8 and Phase 12 (Testing & QA).*

> **One-line summary**: `vacancies.province_slug` becomes nullable. NULL = "Any province (remote / hybrid)" and the matcher drops the province filter entirely. Closes the structural gap where a remote-Gauteng-posted vacancy excluded the perfect KZN candidate from the reverse-match list. Gated to vacancies whose `work_availability` includes `remote` or `hybrid`; gov-side surfaces bucket null-province vacancies under a separate "national / remote" lane so the demand signal is neither lost nor double-counted.

Commits:

- `7f11602`  docs: Phase 13.9 plan
- `682e0f9`  Phase 13.9: "Any province" option for remote / hybrid vacancies

---

## 🎯 WHAT SHIPPED

### Schema (migration 0047)
- `ALTER TABLE vacancies ALTER COLUMN province_slug DROP NOT NULL`.
- `VacancyRow.provinceSlug: string → string | null`.
- `VacancySnapshot.provinceSlug + SeekerInvitationRow.provinceSlug` become `string | null` (snapshots captured pre-13.9 stay non-null per D4).

### Form (VacancyForm)
- "Any province (remote / hybrid)" option **only listed** when `workAvailability` includes `remote` OR `hybrid` (D2).
- Picking it disables the city field + surfaces an inline hint (*"Candidates from every province match; location filter is off"*).
- **State convergence** (D6): toggling off both `remote` AND `hybrid` while the picker sits on Any auto-clears it back to "Select…".
- Submit translates the `"__any"` local sentinel to `NULL`; refuses if `workAvailability` lacks `remote`/`hybrid` (server-side gate is the structural backstop).

### Server actions (createVacancy + updateVacancy)
- Zod `provinceSlug: z.string().min(1).nullable()`.
- Two new `.refine()` checks:
  - **D2**: NULL province requires `remote` or `hybrid` in `workAvailability`.
  - **D3**: NULL province forces NULL city.
- Bypass-the-form payloads (curl, scripted) refused with clear error messages.

### Matcher
- `searchProfilesQuery` already treats falsy province as "no filter" (`if (filters.province)`)  so `vacancyToSearchFilters` carrying `province: null` automatically drops the province scope. Skill / years / NQF / work-availability still apply.

### Display (lib/employer/vacancies-display.ts  new module)
- `formatVacancyLocation(v)` returns:
  - `"Any province  Remote"` when null province + workAvailability includes `remote` only.
  - `"Any province  Hybrid"` for hybrid only.
  - `"Any province  Remote / Hybrid"` when both.
  - `"Cape Town, Western Cape"` when both city + province are set.
  - `"Western Cape"` when only province is set.
- **8 render sites** switched to the helper: vacancy list + detail + match page (employer); invitations list + detail (seeker); `VacancySnapshotCard`; `InviteFromSearchButton` picker subtitle (Phase 13.8); `creating-a-vacancy` help article reference.
- `vacancyProvinceBucket / NATIONAL_REMOTE_BUCKET / isNationalRemoteBucket / nationalRemoteBucketLabel`  helpers for the gov-side "national / remote" lane.

### Gov-side (D5)
- `declineReasonAggregateQuery` COALESCEs null province to `'national-remote'` in both SELECT and GROUP BY so the GROUP BY produces a distinct cell instead of silently dropping or double-counting.
- `DeclineReasonsCard` recognises the sentinel + renders **"National / remote"** as the friendly label.
- `markVacancyFilledAndLogHires` uses `vacancyProvinceBucket()` so the dominant-decline-reason lookup matches the bucketed cell when the vacancy is null-province.

### Cron (followed-employer-vacancy-sweep)
- When `vacancy.provinceSlug IS NULL`, drop the seeker-profile province join from the match condition + drop the `&province=` query param from the notification deep-link.

### Help (content/help/employer/vacancies/creating-a-vacancy.tsx)
- One-paragraph block **"Posting a remote or hybrid role"** + Callout reaffirming Sebenza is SA-bounded (Any means any SA province, not any country).
- Province field description extended with one-sentence cross-ref.

---

## 🛡️ NEW DATA / FLAGS / KINDS

- 1 migration (0047  drop NOT NULL on `vacancies.province_slug`).
- 0 new audit kinds.
- 0 new notification kinds.
- 0 new platform flags.

---

## 🧭 KEY DECISIONS (LOCKED)

- **D1** `NULL` on `province_slug` means "Any province"  not a sentinel string.
- **D2** Gated to `remote` OR `hybrid` in `work_availability` (both unlock the option; user choice over remote-only).
- **D3** NULL province forces NULL city.
- **D4** Existing data stays unchanged (no backfill).
- **D5** Gov-side: separate "national / remote" lane in province-grouped aggregates.
- **D6** Form auto-clears province when both `remote` + `hybrid` toggle off while Any is selected.
- **D7** Display label uses ` / ` separator when both work modes present.
- **D8** Phase 13.8 Invite-from-search modal picker uses the same `formatVacancyLocation` helper.

---

## 🧪 VERIFICATION

1. Vacancy with `workAvailability = ["full_time"]` only → province picker does NOT offer "Any". Existing required-province behaviour stands.
2. Toggle on `remote` → "Any province (remote / hybrid)" appears. Pick it → city field disables.
3. Untick `remote` → form auto-clears the "Any" selection (D6).
4. Submit a vacancy with `province_slug = NULL` and `work_availability = ["remote"]` → persists.
5. Try to submit `province_slug = NULL` with `work_availability = ["full_time"]` via curl → server refuses with clear error.
6. On `/employer/vacancies/[id]/match` for a null-province vacancy → candidate list includes seekers from every province.
7. On `/employer/vacancies` list + detail → location string reads "Any province · Remote" (or "/ Hybrid" when both).
8. On `/gov/shortage` → `DeclineReasonsCard` renders a "National / remote" cell when any null-province vacancies declined.

---

## 📦 FOOTPRINT

| Metric | Value |
|---|---|
| Migrations | 1 (0047) |
| Files changed | 19 |
| New helper module | 1 (`lib/employer/vacancies-display.ts`) |
| Render sites switched to helper | 8 |
| Audit kinds | 0 new |
| Platform flags | 0 |
| Lines added / removed | +564 / -69 |

*Phase 13.9 closes the structural gap where the platform silently excluded perfect candidates from legitimately-remote vacancies. Trust posture: strengthened.*
