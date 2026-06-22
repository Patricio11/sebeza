# PHASE 9.20 PLAN  Placements lifecycle (employer "Employees" view)

*Plan opened 2026-05-29. Companion: `docs/ROADMAP.md`. Targets sign-off before code lands.*

---

## 🎯 WHAT THIS PHASE IS

Today the employer's `/employer/placements` is a flat hire log. Phase 9.11's `markVacancyFilledAndLogHires` writes a row, the `placement.confirmed` notification fires once, and after that the placement is frozen  Sebenza never sees how the role actually worked out. The platform's strongest data signal (Placement-Truth) only covers the moment of hire.

Phase 9.20 extends Placement-Truth from **"did you hire?"** to **"how did it work out?"** It adds:

- A **lifecycle view** (currently-employed list, sorted by tenure, with status-check-due indicators).
- **Periodic status check-ins** at 3 / 6 / 12 months then annually  a single-question prompt: "Is X still employed in this role?" backed by a notification cron.
- **Structured departure capture**  when a placement ends, the employer logs the date + category (resigned / contract ended / dismissed / retrenched / moved internally / mutual separation / other). The category lives in audit; the *reason* does not (we're not building disciplinary records).
- **Per-placement org-private notes**  durable internal context, never seeker-visible, PII-flagged in audit exports.
- **Re-engage hook**  when a placement is marked departed, surface a one-tap "Invite to your other open vacancies" affordance that reuses the existing bulk-invite path (vacancy-matching consent gate still applies).

The result: `/insights` finally gets a "hires that stuck" number (12-month retention by profession × province), and employers get a smooth way to keep their picture of their team honest without the platform becoming an HRIS.

Three tiers, all independently shippable.

- **Tier 1  Read surface.** Lifecycle view at `/employer/placements` (rename in nav to "Employees"), per-placement detail page, no new tables.
- **Tier 2  Status check-ins + notes.** New `placement_status_checks` ledger + denormalised current-status columns on `placements`. Server actions for check-in + note edit. Nightly cron for "check-in due" prompts.
- **Tier 3  Departure + re-engage.** Departure capture modal + categorical enum migration. "Invite to another vacancy" affordance on the departure confirmation.

---

## 🔒 LOCKED DECISIONS

### D0  Sebenza stays a talent-intelligence platform, not an HRIS

**Cross-cutting principle.** Phase 9.20 captures **employment lifecycle outcomes**, not employment management artefacts. Specifically, the platform does NOT  now or later via scope-creep  store: warnings (SA labour law Schedule 8 disciplinary records), performance reviews, salary/payroll runs, leave balances or sick-leave reasons, employment contracts, or any document that would make Sebenza a record-of-truth for an LRA / CCMA dispute.

These are deliberately someone else's product (BambooHR, Sage 300 People, SimplePay, etc.). The compliance + integration surface of HRIS is its own multi-year build; we will not take it on.

Practical implication for D1–D11 below: every field we add must be answerable with **"that's an outcomes signal"** rather than **"that's a management artefact."** "Is the person still employed?" is the former. "Why were they dismissed?" is the latter and is out of scope.

### D1  Only Sebenza-tracked placements appear in the lifecycle view

The new surface reads from the existing `placements` table. No "import your other hires" path; no manual employee creation. Reason: Placement-Truth  the platform's outcomes signal stays honest precisely because every row was confirmed via a Sebenza-side flow. Letting employers backfill phantom placements would dilute every aggregate the platform produces.

If an employer wants their non-Sebenza hires on Sebenza, they invite the person via the existing vacancy → invite flow once.

### D2  Status check-in cadence: 3 / 6 / 12 months, then annual

Cron-driven prompt to the org members of the placement's organisation: "It has been N months since you logged X as hired  are they still employed in this role?" One notification per (placement × milestone). The check-in form is one question (yes / no) plus an optional 500-char note.

3 / 6 / 12 is the standard "stuck the landing?" cadence; annual after that captures long-tenure outcomes without nagging.

### D3  Two-sided truth, no forced reconciliation

The seeker's `profiles.status` (employed / unemployed / etc.) is owned by the seeker. The employer's `placements.current_status` (active / departed / unknown) is owned by the employer. **They can disagree**, and that is fine: the platform doesn't push either side to capitulate.

`/insights` may, in aggregate (k ≥ 10), surface a "data divergence" signal (e.g. "12% of Western Cape placements logged as active have a seeker who shows unemployed") to help LMI analysts spot reporting drift. Never per-employer, never per-placement.

### D4  Departure categories are the SA labour-relations vocabulary, *without* reasons

`placement_departure_category` enum:
- `resigned`  seeker initiated
- `contract_ended`  fixed-term contract reached its natural end
- `dismissed`  employer-initiated termination (any cause; we do NOT record the cause)
- `retrenched`  operational requirements / restructuring
- `moved_internally`  same employer, different role
- `mutual_separation`  both sides agreed to part ways
- `other`  escape hatch

The category is the *fact*. The *reason*  the disciplinary detail, the performance gap, the personality conflict  is HRIS territory (D0) and is not captured. If the employer wants their own internal context, the per-placement note column carries it (org-private, PII-flagged, never on the seeker's side).

This split is the same posture Phase 9.8.5 took on decline reasons: the category is structured, the elaboration is free text and lives nowhere near a dispute-resolution surface.

### D5  `current_status` is denormalised on `placements` for fast list reads

We add `current_status` (active / departed / unknown), `last_check_at`, `last_check_by_user_id`, `departure_date`, `departure_category`, `internal_note` directly on `placements`. The check-in ledger (`placement_status_checks`) carries the per-event audit trail.

Rationale: the list view is "show me every active employee, sorted by tenure"  a single-table scan is cheaper than `MAX(checked_at)` aggregation per row. The denormalisation is safe because every write that changes a status goes through the same server action, which updates both rows in one transaction.

### D6  Per-placement notes are org-private, PII-flagged in audit exports

Free text, capped at 1000 chars (more than the 200-char vacancy-invite note because this is durable context, not a moment-of-invite gesture). Visible only to Owners + Recruiters in the placement's org. Never on the seeker's side. The audit row carries `meta.note + notePii: true`  same pattern as Phase 9.17 / Phase 9.19 Tier 3.

The note exists for the recruiter's own future memory ("hired into our Cape Town team; relocated from Joburg; her partner works at Capitec; review in 6 months for the Tech Lead role"). It is the closest thing to a "review" the platform will ever offer  and we deliberately do NOT structure it (no rating, no fields, no taxonomy). Per D0: structuring it would make it an HRIS artefact.

### D7  Re-engage uses the existing vacancy-invite path; no new consent surface

When a placement is marked departed, the post-departure confirmation panel offers: *"X is back on the market. Want to invite them to one of your other open vacancies?"* Tapping it lands on a tiny modal listing the org's `status='open'` vacancies; selecting one fires the existing `bulkInviteToVacancy` action with `profileIds = [X.profileId]`.

No new consent gate: the existing `vacancy_matching` consent check applies. If the seeker revoked vacancy-invite consent post-departure, the offer is shown but the send is skipped silently (D5 of Phase 9.8.4: per-seeker skip reason stays in audit, not in UI).

### D8  Tenure milestones on /insights are aggregate-only, k-thresholded

The new outcomes aggregate `placement_retention_snapshot` rolls up: percentage of placements still active at 3 / 6 / 12 months, by profession × province (Phase 9.7 k ≥ 10 threshold). Suppressed cells render as "" with the existing "Below disclosure threshold" tooltip. Never per-employer, never per-seeker.

This is the user-facing Sebenza-wide payoff: a national retention signal that today's labour market has nowhere honest to read. Hosted on `/insights` next to the existing outcomes panel.

### D9  No automatic seeker notifications on lifecycle events

The seeker is not notified when the employer:
- runs a 3/6/12-month check-in,
- writes/edits an internal note,
- marks them as departed.

Reason: the seeker already knows whether they're still employed; sending them a "we ticked the box" notification is paternalistic and would expose internal employer workflow. The one exception is **the original hire confirmation**  that already fires `placement.confirmed` per Phase 9.11 and is unchanged here.

If the employer marks a departure and the seeker's profile still says `status='employed'`, the platform does NOT message either side. The divergence shows up in aggregate at /insights (D3), where it belongs.

### D10  One migration for Tier 1, separate migrations for Tier 2 and Tier 3

`0033_phase9_20_placement_lifecycle_columns.sql` (Tier 1 + Tier 2): denormalised columns on `placements` + the `placement_status_checks` ledger + the partial index for "check-in due" cron.

`0034_phase9_20_departure_categories.sql` (Tier 3): the `placement_departure_category` enum + the FK / columns to use it.

Reason: Tier 3 needs the enum, Tier 1 + Tier 2 don't. Keeping them apart means Tier 1 + Tier 2 can ship the moment they're ready without waiting for Tier 3's decisions to stabilise.

### D11  Nav label changes to "Employees"; URL stays `/employer/placements`

The existing nav entry is "Placements." That word is the platform's internal term for the data; "Employees" is the recruiter's mental model. Phase 9.20 swaps the label without changing the URL  every deep-link in audit logs, notifications, and historic emails continues to resolve. The page itself transforms from "list of hires" to "list of employees + their lifecycle."

---

## 📦 TASK LIST

### Tier 1  Read surface (lifecycle view, no new write paths)

- **9.20.1.1 Migration**  first half of `0033_phase9_20_placement_lifecycle_columns.sql`:
  - `placements.current_status` enum('active','departed','unknown') NOT NULL DEFAULT 'active'
  - `placements.last_check_at` timestamptz NULL
  - `placements.last_check_by_user_id` text NULL REFERENCES users
  - `placements.departure_date` date NULL
  - `placements.internal_note` text NULL
  - Partial index `placements_check_due_idx` on `(last_check_at, hired_at) WHERE current_status = 'active'`
- **9.20.1.2 Schema**  extend the `placements` Drizzle table with the five new columns + the index.
- **9.20.1.3 Read helpers**  extend `getPlacementsForOrg()` (or add `listEmployees()`) returning `current_status`, `tenureMonths`, `nextCheckInDue` (computed: 3 / 6 / 12 / annual relative to `hired_at` and `last_check_at`).
- **9.20.1.4 Nav**  rename the existing "Placements" nav entry to "Employees" in `components/layout/employerNav.tsx`. URL stays `/employer/placements`.
- **9.20.1.5 List page**  transform `/employer/placements` from the flat hire log into the lifecycle view:
  - Default tab: "Active" (current_status='active')
  - Other tabs: "Departed", "All"
  - Sort dropdown: "Most recent hire" (default) / "Longest tenure" / "Check-in due"
  - Per row: avatar + display name + role + city + tenure ("3 months" / "1 year 2 months") + soft "Check-in due" pill when relevant
  - Per row CTA: "Open" → detail page
- **9.20.1.6 Detail page**  new `/employer/placements/[placementId]`:
  - Person card with link to existing dossier flow (audited reveal still required)
  - Tenure timeline (Hired Jul 2025 → 3-month check ✓ → next check due Jan 2026)
  - Status section (current_status pill + last_check_at date)
  - Internal note (read-only at Tier 1; editable at Tier 2)
  - Per-placement audit excerpt (last 10 `placement.*` rows)

### Tier 2  Status check-ins + notes

- **9.20.2.1 Migration**  second half of `0033`:
  - `placement_status_checks` table: id, placement_id (FK), checked_by_user_id (FK), checked_at (default now), still_employed (bool), note (text, nullable, ≤500 chars)
  - Unique-ish index on `(placement_id, checked_at)` so duplicate check-ins from a button-mash get caught
- **9.20.2.2 Schema**  add `placementStatusChecks` Drizzle table.
- **9.20.2.3 Server actions** in `lib/employer/placement-lifecycle.ts`:
  - `confirmPlacementStillEmployed(input: { placementId, note? })`  writes a check ledger row, updates `last_check_at` + `last_check_by_user_id`.
  - `updatePlacementInternalNote(input: { placementId, note })`  1000-char cap, PII-flagged audit row.
  - Both Owner+Recruiter only; Viewer rejected.
- **9.20.2.4 List page**  add inline "Confirm status" quick action per row (opens a small modal: "Is X still employed in this role?" yes / no / optional note). On submit, optimistic update + `router.refresh()`.
- **9.20.2.5 Detail page**  editable internal note (textarea, 1000-char counter, save button), full check-in history list.
- **9.20.2.6 Cron**  `/api/cron/placement-status-check-due` route (CRON_SECRET-guarded). For every `placements` row where `current_status='active'` and the next milestone (3 / 6 / 12 / annual) has passed without a check, fire one `placement.status.check_due` notification to the org members. Dedup via NOT EXISTS on the notifications table (same pattern as Phase 9.19 Tier 3's follow-up nudge cron).
- **9.20.2.7 Notification catalog**  add `placement.status.check_due` kind (audience: org_members, defaultInApp true, defaultEmail false  this fires periodically and we don't want to push it to email until we've watched the cadence in practice).

### Tier 3  Departure capture + re-engage hook

- **9.20.3.1 Migration**  `0034_phase9_20_departure_categories.sql`:
  - CREATE TYPE `placement_departure_category` ENUM('resigned','contract_ended','dismissed','retrenched','moved_internally','mutual_separation','other')
  - `placements.departure_category` column of that type, nullable
  - Partial index on `(departure_category, departure_date) WHERE current_status = 'departed'` for the retention snapshot cron
- **9.20.3.2 Schema**  extend `placements` with the new enum column.
- **9.20.3.3 Server action**  `markPlacementDeparted(input: { placementId, departureDate, category, note? })`:
  - Owner+Recruiter only
  - Sets `current_status='departed'`, `departure_date`, `departure_category`
  - Appends to `internal_note` if a note was provided (preserves the prior note context)
  - Writes audit kind `placement.departed` with the category in meta
- **9.20.3.4 Detail page modal**  "Mark as departed" button → modal with date picker, category dropdown, optional 500-char note. On success, surface the re-engage panel (D7).
- **9.20.3.5 Re-engage panel**  shown after a successful departure confirmation. Lists the org's `status='open'` vacancies; selecting one fires the existing `bulkInviteToVacancy({ vacancyId, profileIds: [departed.profileId] })`. No new audit kind  the existing `vacancy.invite` audit row carries it.
- **9.20.3.6 Retention snapshot**  `/api/cron/placement-retention-snapshot` route. Nightly aggregate of `placements` rolled up to (profession × province × milestone window), thresholded at k ≥ 10. Writes to a new `placement_retention_snapshots` table (small; one row per (cell, week-of-capture)).
- **9.20.3.7 /insights surface**  render the retention figures on `/insights` alongside the existing outcomes panel. Suppressed cells use the existing "Below disclosure threshold" idiom.

---

## 🚫 OUT OF SCOPE

The explicit "we said no" list. Future phases that want to reach into this territory must justify the trade against D0.

- ❌ **Warnings / disciplinary records**  SA labour law artefact, HRIS territory (D0).
- ❌ **Performance reviews / ratings**  structured review data is HRIS (D0). The free-text internal note (D6) is the only review-shaped surface and it is deliberately unstructured.
- ❌ **Salary / payroll**  Phase 5's `placements.salary_band` is the org-private hire-time band; we are not adding payroll runs, raises, or comp history.
- ❌ **Leave management**  sick / annual / unpaid leave is HRIS, with its own POPIA-heavy data model (medical reasons).
- ❌ **Contract documents**  employment contracts are a record-of-truth surface for LRA / CCMA disputes; we do not want to be that record.
- ❌ **The dismissal *reason***  the *category* is captured (D4); the *reason* is not. No "performance" / "misconduct" / "absenteeism" sub-enum.
- ❌ **Importing non-Sebenza hires**  would dilute Placement-Truth (D1).
- ❌ **Per-employer retention rankings**  aggregate-only, k-thresholded (D8).
- ❌ **Forced reconciliation between seeker and employer status views**  divergence is information, not a problem to fix (D3, D9).

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

Three reasons it's one phase, not three:

1. **It strengthens Sebenza's core data signal rather than starting a new product.** Placement-Truth was always going to need a tail  a hire confirmed at month 0 tells us less than a hire still confirmed at month 12. Without the tail, the platform's outcomes story is "we know who *got* hired" which is half the truth. With it, the story is "we know which hires *stuck*," and that's the line government and serious employers care about.

2. **The HRIS line is held by the locked decisions, not by us getting tired.** D0 is explicit, D4 is explicit about the category-vs-reason split, D6 is explicit about why the note is unstructured. Future phases that want to add a "warning" or a "review rating" will have to argue against named locked decisions, not against vibes. That's how this stays out of HRIS territory long-term.

3. **The user-side payoff is per-tier, but the trust-posture payoff is cumulative.** Tier 1 alone gives employers a smoother view of who they hired. Tier 2 makes the data honest over time. Tier 3 closes the loop and gives /insights a retention signal nobody else has. Splitting the tiers across three phases would mean three rounds of "what's this for again?"  bundling them lets the cumulative story land at the end.

---

*Plan opened 2026-05-29. Target: complete before Phase 10 (public launch) opens. Bounded scope (~1 focused day across the three tiers, given the existing infrastructure: `placements` table, the Phase 9.19 audit + notification catalog patterns, the Phase 9.8 invite-flow seam to reuse for re-engage).*
