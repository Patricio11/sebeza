# PHASE 9.21 PLAN — Seasonal work (chip + vacancy season window)

*Plan opened 2026-05-29. Companion: `docs/ROADMAP.md`. Targets sign-off before code lands.*

---

## 🎯 WHAT THIS PHASE IS

SA hospitality, tourism, agriculture and retail run on recurring season windows: chefs at Garden Route lodges from Dec to Feb, waitresses in KZN for Easter and July school holidays, citrus pickers from May to October, wine-harvest hands Jan to April, Christmas retail trade. Today the platform's `work_availability_kind` enum (Phase 9.18) has casual / part_time / contract / full_time / remote / hybrid — none of which says *"recurring December-to-January work."*

A casual chef and a seasonal chef look the same to the matcher, so the chef who'd happily do a fixed December-to-January run keeps getting "casual ad-hoc shifts" pings instead. And the lodge owner can't say *"I need someone for exactly Dec 1 – Jan 15, annually"* without burying it in free text the matcher can't see.

Phase 9.21 closes that gap in **one shippable change** (no tiers):

- **Seekers** opt in to seasonal work with one more chip on the same `work_availability` field they already use. No temporal commitment — they're saying "I'm open to this work pattern."
- **Vacancies** that pick the `seasonal` chip get an optional **season window** (start month + end month + recurring-annually boolean). The window rides along on the invitation notification so the seeker can decide before responding.

The chip joins the existing array-overlap match (Phase 9.19 D1 — vacancy + seeker share the same enum, the `&&` operator does the work). The window is informational — no new filter, no new sort, no regional season taxonomy.

---

## 🔒 LOCKED DECISIONS

### D0 — Vacancy is still the source of truth (carry-over from 9.19)

Phase 9.19 D0 holds verbatim here: every match axis is vacancy-optional, blank means the matcher ignores it, and the seeker is shown what the vacancy declared rather than the platform inferring something the employer didn't ask for.

Applied to 9.21: a vacancy that picks `seasonal` but leaves the window blank is treated as *"seasonal work, timing TBD"* — the matcher still array-overlaps on `seasonal`, the seeker just sees no window line in the invitation. A vacancy that picks `seasonal` AND fills the window gets the date-range surfaced verbatim.

### D1 — `seasonal` is the 7th value of `work_availability_kind`

Same enum, same array column on both sides (seeker `profiles.work_availability` + vacancy `vacancies.work_availability`), same `&&` array-overlap filter. No new column on the seeker side. No new enum. No new index.

Phase 9.18 added `remote` and `hybrid` to this enum without breaking anything; we use the same `ALTER TYPE … ADD VALUE 'seasonal'` migration shape.

### D2 — The season *window* lives ONLY on vacancies

Seekers don't tell us "I want July–August only." That's too brittle: it would shrink their match set artificially the moment they forgot to update it, and many seasonal workers genuinely don't have a fixed preferred window (they take work where it appears).

Instead, the seeker's chip says *"I'm open to seasonal work"* and the vacancy's window says *"this role runs Dec – Jan, annually."* The seeker inspects the window on the invitation and decides. This mirrors how 9.19 D0 / D2 / D3 work: the vacancy is the constraint, the seeker is the candidate, no false symmetry.

### D3 — The window is **two integer months + a recurring boolean**, not calendar dates

Three new columns on `vacancies`:

- `seasonal_window_start_month` `int` (1–12, NULL)
- `seasonal_window_end_month` `int` (1–12, NULL)
- `seasonal_window_recurring_annually` `boolean` (default `true`, NULL when window is unset)

Months not dates because seasonal patterns are inherently recurring. An exact date (`2026-12-01`) would falsely imply "this year only" and rot the moment 2027 rolls in. The `recurring_annually` boolean lets a one-off seasonal vacancy (e.g. *"Dec 2026 World Cup pop-up only, not repeating"*) opt out — defaulted on because most seasonal roles ARE recurring.

Both month columns are NULL or both are set — the Zod schema enforces this; the read code treats "one set, one NULL" the same as "neither set" (no implicit half-window).

### D4 — `start_month > end_month` means the window wraps the year

`start = 11, end = 2` = November through February. The notification renderer and any future calendar-aware match must respect the wrap. Same convention every quarter-year-rollover system uses; no new field needed.

A `start_month === end_month` value is treated as a single-month window (e.g. "December only"), not "all year except".

### D5 — The window is informational at the matcher level, not a filter

The `availableFor` filter (Phase 9.19 D1) array-overlaps on the chip, full stop. There is no new "is this month in the seeker's window" filter — because the seeker has no month preferences (D2). The window only shapes:

- the invitation notification body (D6 below),
- the public profile / search renderer (shown verbatim to the seeker, never used to gate them out).

If we ever introduce seeker-side month preferences, that's a separate phase with its own D0-style "no false symmetry" check.

### D6 — Notification body composer adds a single window line when set

The existing `vacancy.invite` notification body already names the employer + the role + the response window. Phase 9.21 adds one new line below that line when the vacancy has a populated window:

> *Seasonal window: Dec – Jan, annually.*

(Or *"Dec 2026 only, no recurrence"* when `recurring_annually = false`.)

No new notification kind. No new audit kind. Same email + in-app pipeline.

### D7 — Form UI: window inputs only render when `seasonal` is in the work-availability set

On the `VacancyForm`, the three new fields appear in a small sub-block below the existing work-availability chip strip, but only when `seasonal` is one of the picked chips. Untoggling `seasonal` clears the sub-block's draft state — we don't surface a hidden "stale window" if the employer changes their mind.

Form validation: when `seasonal` is picked, the window is *optional* (D3); when `seasonal` is NOT picked, the window inputs are gone, so this is unenforced.

### D8 — Seeker-side: chip added to the same `WORK_AVAILABILITY_CHOICES` list used by sign-up and profile edit

`SeekerSignUpForm` + the dashboard profile editor both render the work-availability chips by mapping over `WORK_AVAILABILITY_KINDS` (Phase 9.18). Phase 9.21 adds `seasonal` to that constant; both surfaces inherit the new chip without per-form edits, exactly like 9.18 did for `remote` / `hybrid`.

Position in the chip strip: between `casual` and `remote` (groups the "non-traditional employment patterns" together — casual, seasonal, remote, hybrid).

### D9 — One migration, one commit

Migration `0035_phase9_21_seasonal_work.sql`:

- `ALTER TYPE work_availability_kind ADD VALUE 'seasonal'` (Postgres enum extension; can be applied without rebuilding the column index)
- `ALTER TABLE vacancies ADD COLUMN seasonal_window_start_month int`
- `ALTER TABLE vacancies ADD COLUMN seasonal_window_end_month int`
- `ALTER TABLE vacancies ADD COLUMN seasonal_window_recurring_annually boolean`

No new index. The `availableFor` array-overlap query already uses the GIN index on `work_availability`; the new `seasonal` value is just another array element. The window columns are read-only filtered by the small number of vacancies that have one — no scan-path optimisation needed yet.

---

## 📦 TASK LIST

- **9.21.1 Migration** `0035_phase9_21_seasonal_work.sql` — enum ADD VALUE + three vacancy columns.
- **9.21.2 Schema** — extend `db/schema.ts:vacancies` with the three new columns. The enum is auto-extended by the `ALTER TYPE` — Drizzle's `pgEnum` already declares `seasonal`-adjacent values; we add `seasonal` to the array literal.
- **9.21.3 Types** — extend `WorkAvailabilityKind` + `WORK_AVAILABILITY_KINDS` in `lib/mock/types.ts` to include `"seasonal"`. Add a `SeasonalWindow` shape (`{ startMonth, endMonth, recurringAnnually }`) to the same module.
- **9.21.4 Vacancy form + label catalogs** — extend the existing `WORK_AVAILABILITY_CHOICES` in `VacancyForm.tsx` with the new chip. Add the conditional season-window sub-block (two SelectField month pickers + a checkbox). Wire into `VacancyFormValue` + `VacancyDraft` + the submit closure. The Zod schema in `lib/employer/vacancies.ts:vacancyInputSchema` gains three matching optional fields; both `createVacancy` insert + `updateVacancy` set() persist them.
- **9.21.5 VacancyRow + read helpers** — add `seasonalWindow: SeasonalWindow | null` to `VacancyRow` + the `rowToVacancy` mapper. Detail page renders it in the existing "Match requirements" strip (D0 — show "No seasonal window" when unset and `seasonal` is picked; hide the row entirely when `seasonal` isn't picked).
- **9.21.6 Seeker form** — extend the `WORK_AVAILABILITY_CHOICES` in the seeker chip pickers (`SeekerSignUpForm`, dashboard profile editor) with the new chip. Position per D8 (between `casual` and `remote`). No schema change on the seeker side; the existing `work_availability_kind[]` column accepts the new value the moment the migration runs.
- **9.21.7 Notification body composer** — extend `bulkInviteToVacancy` in `lib/employer/invitations.ts` so the vacancy.invite notification body includes the season window line (D6) when present. Single helper `formatSeasonalWindowLine(window)` returns the rendered string or empty.
- **9.21.8 Public renderers** — the season window also surfaces on the seeker-facing invitation detail page (`/dashboard/invitations/[id]`) and the existing employer vacancy detail. Both read the field off the existing payload — no new query.
- **9.21.9 Typecheck + tests + build + commit** — single commit, full verification.

---

## 🚫 OUT OF SCOPE

- ❌ **Regional season calendars** (Cape Town vs KZN vs Garden Route vs citrus harvest). The vacancy declares its own window — modeling regional defaults is a separate, much harder problem (and an editorial one, not a data one).
- ❌ **Seeker-side month preferences** — D2. False symmetry shrinks the match set artificially.
- ❌ **Automatic re-invite next season** — tempting but premature. A vacancy with `recurring_annually=true` doesn't auto-fire next December's invitations; the employer re-opens the vacancy when they're ready.
- ❌ **Predictive availability ("you'll likely be free next Dec")** — speculative; out of scope.
- ❌ **A separate `seasons` taxonomy table** with named seasons (`summer_high`, `easter`, `july_holidays`, `citrus`, etc.). The two-month integer window covers every concrete case without a curation overhead.
- ❌ **Season as a sort key on the match page** — informational only (D5). If seekers start ignoring matches whose window doesn't fit, we'll add a filter chip in a future phase; not before.

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

Three reasons it's one phase, not a separate seekers-only change and a separate vacancies-only change:

1. **It's the same conversation on both sides.** A seasonal chef and a seasonal-chef vacancy need to find each other; shipping the chip on one side without the matching surface on the other would create the exact mismatch we're trying to fix.

2. **The window pays for the chip.** Without the date range, the chip would just be a fuzzier `casual` — seekers would say yes to "seasonal" the same way they say yes to "casual" and the matching would feel no sharper. The window is what makes the chip useful.

3. **The locked decisions ARE the protection against feature creep.** D2 (no seeker-side window), D4 (year-wrap convention), D5 (informational, not a filter), and the out-of-scope list together stop this from drifting into "let's model SA's entire seasonal-labour economy" — which is a multi-year research project nobody has solved yet.

---

*Plan opened 2026-05-29. Target: complete within one focused day. Bounded scope (~5 small edits + 1 migration), zero new tables, zero new audit kinds, zero new notification kinds — pure additive change to existing surfaces.*
