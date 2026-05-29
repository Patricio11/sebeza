# PHASE 9.21 COMPLETE — SEASONAL WORK (CHIP + VACANCY SEASON WINDOW)
*Shipped 2026-05-29. Plan: [`docs/completed/PHASE_9_21_PLAN.md`](./PHASE_9_21_PLAN.md). Closes the gap where SA hospitality, tourism, agriculture, and retail seasonal patterns had nowhere to live in the matcher — `casual` and `contract` weren't quite right for recurring December-to-January lodge work, citrus pickers, or Christmas trade.*

> **One-line summary**: Add `seasonal` as the 7th value of the `work_availability_kind` enum (seeker chip + vacancy chip) plus an optional vacancy-side window (start month + end month + recurring-annually). The chip joins the existing array-overlap match; the window rides on the invitation notification so the seeker can decide before responding. Zero new tables, zero new audit kinds, zero new notification kinds.

One commit, one migration:

- **Phase 9.21** `fde99d5` — schema + form + matcher + notification body + seeker invitation page

---

## 🎯 WHAT SHIPPED

### A — Migration `0035_phase9_21_seasonal_work.sql`
Two `ALTER` statements, no new tables:

- `ALTER TYPE work_availability_kind ADD VALUE IF NOT EXISTS 'seasonal'` — same Postgres caveat as Phase 9.18 (must run outside a transaction; drizzle-kit treats each file as its own)
- `ALTER TABLE vacancies ADD COLUMN seasonal_window_start_month int` + `seasonal_window_end_month int` + `seasonal_window_recurring_annually boolean` (all nullable)

### B — Drizzle schema
`db/schema.ts`:
- `workAvailabilityKind` enum array appended with `'seasonal'`
- `vacancies` table gets the three new columns
- No new indexes — `availableFor` array-overlap already uses the GIN on `work_availability`; the new value is just another array element

### C — `WorkAvailabilityKind` + `WORK_AVAILABILITY_KINDS` widened
`lib/mock/types.ts`:
- Type union gains `'seasonal'`
- `WORK_AVAILABILITY_KINDS` constant reorders: `seasonal` slots between `casual` and `part_time` per D8 (groups the "non-traditional employment patterns" together)
- New `SeasonalWindow` interface (`{ startMonth, endMonth, recurringAnnually }`) for the nested read shape

### D — Vacancy form
`components/feature/employer/vacancies/VacancyForm.tsx`:
- New chip in `WORK_AVAILABILITY_CHOICES` (positioned between `casual` and `remote`)
- **Conditional sub-block (D7)** — only renders when `seasonal` is in the chip set:
  - Two `SelectField` month dropdowns (January–December)
  - "This window repeats every year" checkbox (default checked)
  - Inline hint covers D4 ("if the window crosses December — e.g. lodges Nov–Feb — set start to November and end to February")
- `VacancyFormValue` carries three flat fields (`seasonalWindow{Start,End}Month`, `recurringAnnually`) so the submit shape matches the Zod schema 1:1
- The `initial` prop widens to accept either the nested `seasonalWindow` (when called with a `VacancyRow`) OR the three flat fields — the form reads from whichever shape is present
- Untoggling the chip clears the displayed inputs but keeps the local state so re-toggling restores the draft; the `buildSeasonalWindowSubmit` helper guarantees no payload is sent when the chip is off

### E — Zod schema + paired-month guard
`lib/employer/vacancies.ts`:
- Three new optional fields on `vacancyInputSchema` (months coerced 1–12; recurring is `boolean().nullable().optional()`)
- `.refine()` enforces the pairing rule (D3): both months set or both blank, never one of each
- `pairedMonth()` helper at the insert/set boundary defensively folds half-windows to NULL — the belt to the refine's braces

### F — `VacancyRow` + `rowToVacancy` mapper
- Exposes the window as a nested `SeasonalWindow | null`
- The read mapper folds "one month set, the other NULL" to NULL so consumers never see a half-window (legacy / hand-edited rows can't smuggle partial state through)

### G — Vacancy detail page — Match Requirements strip
`/employer/vacancies/[id]`:
- Strip becomes 4-column when the vacancy picked `seasonal`, 3-column otherwise
- The fourth column shows the formatted window (e.g. "Nov–Feb, annually") or "No window declared" for chip-only vacancies
- `formatSeasonalWindowLabel(window)` handles D4 year-wrap + single-month windows (`startMonth === endMonth` renders as just the month label)

### H — Notification body composer
`lib/employer/invitations.ts:bulkInviteToVacancy` gains a one-line season-window suffix appended to the `vacancy.invite` notification body when present:

> `Seasonal window: Nov–Feb, annually.`

(Or `Seasonal window: Dec, this year only, no recurrence.` when `recurringAnnually = false`.)

Lives alongside the existing personal note line (Phase 9.19 D6). No new notification kind, no new audit kind — same delivery pipeline.

### I — Seeker side: sign-up form + dashboard editor
- `SeekerSignUpForm` step where work-availability is captured — `seasonal` chip joins the existing 6-checkbox grid (positioned between `casual` and `part_time`)
- `WorkAvailabilityEditor` (dashboard profile) — same chip added with a SA-contextual hint: *"Recurring window each year — lodges in Dec-Feb, citrus pickers May-Oct, Christmas trade."*
- `WorkAvailabilityChips` (read-only display) — label catalog learns the new value
- Sign-up Zod schema (`lib/auth/actions.ts`) and profile-action schema (`lib/profile/actions.ts`) extended with `'seasonal'`; the `max()` cap goes 6 → 7

### J — Seeker invitation detail page
`/dashboard/invitations/[id]` surfaces the window verbatim when present so the seeker can read the months before accepting / declining. `SeekerInvitationRow` extended with `seasonalWindow: SeasonalWindow | null`; the two reader functions (`listMyInvitations` + `getMyInvitation`) select the three columns and `toSeekerRow` folds them into the nested shape. Mirror of the employer-side `formatSeasonalWindowLabel` so the two helpers stay in lockstep.

### K — Duplicate-vacancy path preserves the window
The Phase 9.19 D7 duplicate-from-existing flow on `/employer/vacancies/new?duplicateFrom=` already passed `initial={vacancy}`; widening the form's `initial` type means the seasonal window survives a duplicate without any extra code at the page level.

---

## ✅ LOCKED DECISIONS HONOURED

| # | Decision | Where it lives |
|---|---|---|
| **D0** | Vacancy is source of truth; every match axis is vacancy-optional (carry-over from 9.19) | Empty chip-set or NULL window means the matcher / notification body simply skips the axis |
| **D1** | `seasonal` is the 7th value of `work_availability_kind` | One enum, one column on each side, `&&` array-overlap unchanged |
| **D2** | The season window lives ONLY on vacancies | Seekers have no month preference column; the chip says "yes to this work pattern", the vacancy says "this role runs ..." |
| **D3** | Window is two integer months + recurring boolean, not calendar dates | Three `int / boolean` columns; Zod refine + the `pairedMonth` helper enforce "both or neither" |
| **D4** | `start_month > end_month` means the window wraps the year | Helpers normalise (`Nov–Feb` is `{start: 11, end: 2}`) without rejection |
| **D5** | Window is informational at the matcher level, not a filter | `availableFor` still array-overlaps on the chip only; no month-based filter SQL |
| **D6** | Notification body composer adds a single window line when set | `formatSeasonalWindowLine` returns either the line or `""` |
| **D7** | Form UI shows window inputs only when `seasonal` is in the chip set | `workAvailabilitySet.has("seasonal")` gates the sub-block |
| **D8** | Seeker-side chip added to the same `WORK_AVAILABILITY_CHOICES` list | Sign-up + dashboard editor inherit the chip; same chip strip position |
| **D9** | One migration, one commit | `0035_phase9_21_seasonal_work.sql` is the entire schema change |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0035_phase9_21_seasonal_work.sql`
- `docs/completed/PHASE_9_21_PLAN.md` (moved from `docs/`)
- `docs/completed/PHASE_9_21_COMPLETE.md` (this doc)

**Edited**
- `db/schema.ts` — `seasonal` value on the enum array; three columns on vacancies
- `db/migrations/meta/_journal.json` — appended idx 35
- `lib/mock/types.ts` — `WorkAvailabilityKind` union + `WORK_AVAILABILITY_KINDS` constant + `SeasonalWindow` interface
- `lib/employer/vacancies.ts` — `VacancyRow.seasonalWindow`; `rowToVacancy` mapper; `vacancyInputSchema` + refine; `pairedMonth` helper; create + update calls
- `lib/employer/invitations.ts` — `formatSeasonalWindowLine` helper; appended to `vacancy.invite` notification body
- `lib/auth/actions.ts` — `'seasonal'` added to the sign-up Zod enum; max(6) → max(7)
- `lib/profile/actions.ts` — `'seasonal'` added to the profile-action Zod enum; max(6) → max(7)
- `lib/seeker/invitations.ts` — both reader functions select the three columns; `toSeekerRow` folds them
- `lib/seeker/invitations-types.ts` — `SeekerInvitationRow.seasonalWindow` field
- `components/feature/auth/SeekerSignUpForm.tsx` — chip + state union widened
- `components/feature/employer/vacancies/VacancyForm.tsx` — chip in `WORK_AVAILABILITY_CHOICES`; `MONTH_OPTIONS`; conditional sub-block; `buildSeasonalWindowSubmit` helper; `initial` prop widened to accept either shape
- `components/feature/profile/WorkAvailabilityChips.tsx` — label entry
- `components/feature/profile/WorkAvailabilityEditor.tsx` — label entry + SA-contextual hint
- `app/[locale]/(employer)/employer/vacancies/[id]/page.tsx` — Match Requirements 4th column + `formatSeasonalWindowLabel`
- `app/[locale]/(employer)/employer/vacancies/new/page.tsx` — duplicate flow passes the nested `seasonalWindow`; widened `initial` type
- `app/[locale]/(seeker)/dashboard/invitations/[id]/page.tsx` — Season window dl row + mirror `formatSeasonalWindowLabel`

**Verification**
- `tsc --noEmit` clean
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **No seeker-side month preferences.** A seeker who ticked "seasonal" doesn't say "but only July–August" (D2). Too brittle, would shrink the match set artificially. The seeker reads the window on each invitation and decides per-opportunity.

2. **No regional season calendars.** Cape Town high season ≠ KZN ≠ Garden Route ≠ citrus harvest. Modelling regional defaults is a multi-year editorial project; the vacancy declares its own window.

3. **No automatic re-invite next season.** A vacancy with `recurring_annually = true` doesn't auto-fire next December's invitations. The employer re-opens the vacancy when they're ready.

4. **No seasonal sort key on the match page.** Informational only (D5). If seekers start ignoring matches whose window doesn't fit, we'll add a filter chip in a future phase — not before.

5. **No predictive availability ("you'll likely be free next Dec").** Speculative; out of scope.

6. **No CHECK constraint on the paired months.** Postgres CHECK is heavier than we need here; the Zod refine + the action-layer `pairedMonth()` helper enforce the pairing at the only two write paths. Future direct-SQL inserts would need to remember.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/sign-up/seeker`** — work-availability step shows the new chip
- **`/dashboard/profile`** — `WorkAvailabilityEditor` shows the new chip with the SA-contextual hint
- **`/dashboard/invitations/[id]`** — surfaces the season window verbatim when the vacancy declared one
- **`/employer/vacancies/new`** — form gains the conditional season-window sub-block when `seasonal` is picked
- **`/employer/vacancies/[id]`** — Match Requirements strip grows a 4th column for seasonal vacancies
- **`/employer/vacancies/[id]/match`** — the existing chip-filter strip naturally gains "Seasonal" via the same `WORK_AVAILABILITY_CHIPS` array (no code change in the island)
- **`vacancy.invite` notification body** — gains the one-line window suffix when present
- **`/search` work-availability facet** — the existing facet array-overlaps on the enum; new value works without form-level edits

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved from the plan)

- ❌ Regional season calendars (Cape Town vs KZN vs Garden Route vs citrus harvest)
- ❌ Seeker-side month preferences (D2)
- ❌ Automatic re-invite next season
- ❌ Predictive availability
- ❌ A separate `seasons` taxonomy with named seasons
- ❌ Season as a sort key on the match page (D5)

---

## 🧪 HOW TO VERIFY

1. Run migrations: `npm run db:migrate` to land 0035.
2. Sign up a new seeker and tick the `Seasonal` chip; confirm it persists on `/dashboard/profile` and is editable from `WorkAvailabilityEditor`.
3. Create a vacancy on `/employer/vacancies/new`. Pick `Seasonal` from the chip strip; confirm the season-window sub-block appears with two month dropdowns + the recurring checkbox.
4. Set start = November, end = February, leave recurring on; save. Open the detail page; confirm the Match Requirements strip now has 4 columns and shows "Nov–Feb, annually".
5. Send an invite to a seeker who has `seasonal` in their `work_availability`. Check the seeker's notification body — it should include `Seasonal window: Nov–Feb, annually.`
6. Open the invitation on `/dashboard/invitations/[id]` as the seeker; confirm the "Season window" row appears in the attribution dl.
7. Try a single-month window (start === end) — should render as just `Dec` (no en-dash).
8. Try a recurring-off window — should render as `Dec, one-off` on the detail strip and `Seasonal window: Dec, this year only, no recurrence.` in the notification body.
9. Untick the `Seasonal` chip on the form — the sub-block should disappear; saving should clear all three columns to NULL.
10. Duplicate a seasonal vacancy via the list-card button — the duplicate form should pre-fill with the window intact.

---

*Phase 9.21 was a one-day, additive change with zero new structural surfaces — exactly the kind of phase the platform is now positioned to absorb cleanly. The discipline of D0 / D5 / the explicit out-of-scope list kept it from drifting into a regional-season modelling project nobody has solved.*
