# PHASE 9.20 COMPLETE — PLACEMENTS LIFECYCLE (EMPLOYER "EMPLOYEES" VIEW)
*Shipped 2026-05-29. Plan: [`docs/completed/PHASE_9_20_PLAN.md`](./PHASE_9_20_PLAN.md). Extends Placement-Truth from "did you hire?" to "how did it work out?" — the platform's outcomes signal finally has a tail.*

> **One-line summary**: `/employer/placements` transforms from a flat hire log into a lifecycle view (Employees), with periodic 3/6/12-month-then-annual status check-ins, structured departure capture, org-private notes, a re-engage hook into the existing invite flow, and aggregate retention figures on `/insights`. Crucially: this is OUTCOMES capture, not HRIS — warnings, performance reviews, payroll, leave, contracts, and the dismissal *reason* are all deliberately out (D0).

Three independently shippable tiers, all in:

- **Tier 1** `1332920` — read surface (lifecycle list + detail page + nav rename)
- **Tier 2** `43a3d8d` — status check-ins + editable notes + cron
- **Tier 3** `d5ed3a1` — departure capture + re-engage + retention snapshot

---

## 🎯 WHAT SHIPPED — TIER 1 (read surface)

### A — Lifecycle columns on `placements`
Migration `0033_phase9_20_placement_lifecycle.sql` (bundles Tier 1 + Tier 2 schema per D10):
- `current_status placement_lifecycle_status NOT NULL DEFAULT 'active'` — enum of `active` / `departed` / `unknown`
- `last_check_at timestamptz` + `last_check_by_user_id text REFERENCES app_user(id)`
- `departure_date date`
- `internal_note text` — durable org-private context (1000-char cap at action layer)
- Partial-shape index `placements_active_check_due_idx` covering `(organization_id, last_check_at NULLS FIRST, hired_at) WHERE current_status = 'active'`
- New `placement_status_checks` ledger table (Tier 2 ships the writes; Tier 1 reads only)

### B — Read helpers
New `lib/employer/placement-lifecycle.ts`:
- `listEmployees({ tab, sort })` — tab in `active` / `departed` / `all`; sort in `recent_hire` / `longest_tenure` / `check_due`. Computes tenure months + the next-check-due date + the check-in-due flag against the 3/6/12-month-then-annual cadence (D2)
- `getEmployee(placementId)` — detail-page payload including the originally-hired-by + last-confirmed-by display names
- `listStatusChecksForPlacement(placementId)` — check ledger for the detail page
- `listPlacementAuditExcerpt(placementId, profileId)` — last 10 `placement.*` audit rows

### C — Nav label change (D11)
`components/layout/employerNav.ts` rename: "Placements" → "Employees". URL stays `/employer/placements` so every historic deep link (audit log meta, notification email links, ISR cache keys) keeps resolving.

### D — Lifecycle list page
`/employer/placements` transformed:
- Tab strip (Active / Departed / All) with live counts; state lives in the URL `?tab=&sort=` so deep-link + refresh preserve the view (no client island)
- Sort dropdown (Most recent hire / Longest tenure / Check-in due)
- Per row: avatar + name + role + tenure ("3 months" / "1 year 2 months") + soft "Check-in due" pill when a milestone has passed without a check
- A summary banner at the top of the Active tab counts how many employees are past a milestone

### E — Detail page
New `/employer/placements/[placementId]`:
- Person header (avatar + role + city + hired date + tenure + "logged as hired by …")
- Lifecycle timeline (hired → last confirmed → next check due / status check due / departed)
- Internal-note panel (read-only at Tier 1; Tier 2 makes it editable)
- Check-in history list (empty at Tier 1; populated as Tier 2 writes land)
- Source vacancy link (when the placement was logged with a `vacancyId`)
- Activity panel showing the last 10 `placement.*` audit rows

---

## 🎯 WHAT SHIPPED — TIER 2 (status check-ins + notes)

### F — Server actions
Tier 2 write half of `lib/employer/placement-lifecycle.ts`:
- `confirmPlacementStillEmployed({ placementId, note? })` — writes a `placement_status_checks` row + updates the denormalised `last_check_at` / `last_check_by_user_id` on the parent in one transaction. Optional 500-char note (PII-flagged in audit). Rejected when `current_status = 'departed'`
- `updatePlacementInternalNote({ placementId, note })` — 1000-char cap (D6); empty string clears to NULL; audit carries `noteLength` plus either the content (`notePii: true`) or a `noteCleared` boolean
- Both reuse `canEditVacancies` as the role gate — Viewer rejected

### G — New audit kinds
- `placement.status.check` — `subject = profileId`; meta carries `placementId`, `checkId`, `stillEmployed`, optionally `note + notePii: true`
- `placement.note.update` — same subject; meta carries `noteLength` + (PII-flagged content) or `noteCleared`
- `placement.status.check_due` — written by the cron when a milestone passes

### H — Client islands
- `ConfirmStatusIsland` — one-question modal ("Is X still employed in this role?") + optional 500-char note + character counter. Renders as a static button on the detail page Lifecycle panel + as the interactive "Check-in due" badge on list rows (Viewer mode keeps the static badge)
- `InternalNoteEditorIsland` — in-place edit on the detail page. Read-only display until the user hits "Edit" or "Add note"; switches to a 1000-char textarea + Save / Cancel

### I — Cron
New `/api/cron/placement-status-check-due/route.ts`:
- For every `current_status = 'active'` placement at least 3 months old, computes the most recent milestone (3 / 6 / 12 / annual)
- Skips placements where `last_check_at >= milestone_date`
- Fires `placement.status.check_due` to `org_members` of the owning org via `notifyOrgMembers`
- Cap: one notification per (placement × milestone) ever via NOT EXISTS on the notifications table
- Notification kind defaults: `defaultInApp: true, defaultEmail: false` — this is periodic, not transactional; email stays off until we observe cadence in practice

---

## 🎯 WHAT SHIPPED — TIER 3 (departure + re-engage + retention)

### J — Departure schema
Migration `0034_phase9_20_departure_and_retention.sql`:
- `placement_departure_category` enum: `resigned` / `contract_ended` / `dismissed` / `retrenched` / `moved_internally` / `mutual_separation` / `other` (D4 — categorical fact only; the *reason* is not captured)
- `placements.departure_category` column of that enum, nullable
- Partial index `placements_departed_category_date_idx WHERE current_status = 'departed'`
- New `placement_retention_snapshots` table for the nightly aggregate

### K — Departure server action
`markPlacementDeparted({ placementId, departureDate, category, note? })`:
- Date sanity check: cannot be in the future, cannot be before the hire date
- Sets `current_status='departed'`, `departure_date`, `departure_category` in one update
- Optional 500-char note is appended to the durable `internal_note` with a dated header (`Departure (YYYY-MM-DD, <category>): …`) so context never silently overwrites prior notes
- Hard cap on the combined note (1000 chars) — fails loudly rather than silently truncating
- Audit kind `placement.departed`; meta carries category + date + optional PII-flagged note

### L — `DepartureIsland` (two-step modal)
- Step 1 — date picker + category radios (with one-line descriptions of each SA labour-relations category) + optional 500-char note
- Step 2 — after a successful flip: lists the org's currently-open vacancies. Selecting one fires the existing `bulkInviteToVacancy({ vacancyId, profileIds: [departedProfileId] })` (D7 — no new consent gate, same `vacancy_matching` consent check as bulk invite)
- "Not now" closes cleanly; the departure is already logged

### M — Retention snapshot cron
New `/api/cron/placement-retention-snapshot/route.ts`:
- Pulls every employer-confirmed placement (self-reported placements excluded — same posture as Phase 7.5's official outcomes)
- For each milestone in `[3, 6, 12, 24, 36, 48, 60]` months: counts `hired_in_cohort` (eligible to count toward this milestone) + `still_active_at_milestone` (numerator)
- "Still active at N" = `currentStatus='active'` OR (`currentStatus='departed'` AND `departure_date >= milestone_date`). A departed-after-N placement still counts as "made it to N"
- `currentStatus='unknown'` is conservative: in cohort but NOT counted as still active
- Per-cell k-floor of 10 applied at the cron — cells below the floor never reach the snapshot table

### N — `/insights` retention card
New "Did the hires stick?" card above the existing charts:
- Top-line per-milestone retention rate cards (3 / 6 / 12 / 24 / 36+ months) with cohort denominators
- "Roles where hires stick" leaderboard — 12-month retention by (profession × province), best first, cohort-size tiebreaker
- Capture date always shown so the recency of the figure is honest
- Suppression message + "k = 10 floor" explainer in the footer

### O — Retention read helper
New `lib/analytics/retention.ts:getLatestRetentionSnapshot()`:
- Picks the most recent `captured_at` in the snapshot table
- Aggregates national-by-milestone figures + the 12-month top-cells list
- Empty shape (zeros, empty arrays) when no snapshot exists yet — UI renders the "not enough cohort" copy

### P — Architecture refactor: lifecycle types module
`lib/employer/placement-lifecycle.ts` is `"use server"` — Next.js rejects non-async runtime exports from such files. Pulled the runtime label catalog + type unions into a plain module `lib/employer/placement-lifecycle-types.ts` so client islands can import them. Mirrors the `vacancies-types.ts` split Phase 9.8 introduced for the same reason.

---

## ✅ LOCKED DECISIONS HONOURED

| # | Decision | Where it lives |
|---|---|---|
| **D0** | Sebenza captures OUTCOMES, not HRIS management artefacts | No warnings, no ratings, no payroll, no leave, no contracts. Dismissal *category* is captured; *reason* is not. The free-text `internal_note` is the only review-shaped surface and it's deliberately unstructured |
| **D1** | Only Sebenza-tracked placements appear in the lifecycle view | `listEmployees` reads only from `placements`; no import-non-Sebenza-hires path |
| **D2** | Cadence: 3 / 6 / 12 months, then annual | `MILESTONE_MONTHS` constant + `ANNUAL_AFTER_MONTHS` shared between the read helper, the form, and the cron |
| **D3** | Two-sided truth, no forced reconciliation | Seeker `profiles.status` and employer `placements.current_status` are independent. Divergence shows in aggregate at /insights only |
| **D4** | Departure categories are SA labour-relations vocabulary, *without* reasons | `placement_departure_category` enum has 7 categorical values; no `reason` sub-enum or column |
| **D5** | `current_status` denormalised on `placements` for fast list reads | Single-table scan for the Active tab; the `placement_status_checks` ledger carries the per-event history |
| **D6** | Per-placement notes are org-private, PII-flagged in audit exports | `internal_note` + check-in notes + departure notes all PII-flagged via `meta.notePii: true` |
| **D7** | Re-engage uses the existing vacancy-invite path; no new consent surface | `DepartureIsland` calls `bulkInviteToVacancy` directly; no new audit kind, same skip-on-revoked-consent |
| **D8** | Tenure milestones on /insights are aggregate-only, k-thresholded | Suppression at k = 10 enforced at the cron; cells below the floor never reach the snapshot table |
| **D9** | No automatic seeker notifications on lifecycle events | The seeker isn't notified on check-ins, internal-note edits, or departures |
| **D10** | One migration for Tier 1+Tier 2, separate migration for Tier 3 | `0033` (lifecycle columns + checks ledger) + `0034` (departure enum + retention snapshot table) |
| **D11** | Nav label "Employees"; URL stays `/employer/placements` | One-line nav edit; URL untouched |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0033_phase9_20_placement_lifecycle.sql`
- `db/migrations/0034_phase9_20_departure_and_retention.sql`
- `lib/employer/placement-lifecycle.ts` — read helpers + write actions
- `lib/employer/placement-lifecycle-types.ts` — types + runtime label catalog
- `lib/analytics/retention.ts` — `/insights` retention read helper
- `app/api/cron/placement-status-check-due/route.ts`
- `app/api/cron/placement-retention-snapshot/route.ts`
- `app/[locale]/(employer)/employer/placements/[placementId]/page.tsx` — detail page
- `components/feature/employer/placements/ConfirmStatusIsland.tsx`
- `components/feature/employer/placements/InternalNoteEditorIsland.tsx`
- `components/feature/employer/placements/DepartureIsland.tsx`
- `docs/completed/PHASE_9_20_PLAN.md` (moved from `docs/`)
- `docs/completed/PHASE_9_20_COMPLETE.md` (this doc)

**Edited**
- `db/schema.ts` — `placementLifecycleStatus` enum + `placementDepartureCategory` enum; vacancies / placements lifecycle columns; `placementStatusChecks` table; `placementRetentionSnapshots` table
- `db/migrations/meta/_journal.json` — appended idx 33 + 34
- `lib/audit/index.ts` — `placement.status.check`, `placement.status.check_due`, `placement.note.update`, `placement.departed` kinds
- `lib/notifications/catalog.ts` — `placement.status.check_due` entry (in-app default ON, email default OFF until cadence is observed)
- `components/layout/employerNav.ts` — Placements → Employees label
- `app/[locale]/(employer)/employer/placements/page.tsx` — fully rewritten as the lifecycle view
- `app/[locale]/(public)/insights/page.tsx` — retention card above the existing charts

**Verification**
- `tsc --noEmit` clean at every tier boundary
- `npx vitest run` 50/50 green
- `npm run build` succeeds; both new cron routes registered in the manifest

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **No structured "review note" field on placements.** The free-text `internal_note` is the only review-shaped surface; adding a rating / fields / taxonomy would make it an HRIS artefact (D0). Future phases need to argue against D0 by name.

2. **No "your employer logged you as departed" seeker notification.** Departures don't fire a seeker-side ping (D9). The seeker already knows whether they're still employed; sending them a "we ticked the box" notification exposes internal employer workflow.

3. **No auto-promotion of `unknown` to `active` on first check.** A check confirms `still_employed = true` and moves the row to active — that's intentional, not silent.

4. **No CCMA / LRA integration.** Out of scope forever, not just deferred. This is the line that keeps Sebenza out of HRIS territory long-term.

5. **No re-engage suggestion for already-active vacancies the same org has.** Re-engage only fires post-departure. Suggesting reinvite-while-still-employed would be uncomfortable.

6. **No "compare retention across orgs" surface.** Suppression at k ≥ 10 holds at the cron — per-org breakdowns don't even exist in the snapshot table.

7. **Per-placement retention rates not exposed.** Only national + (profession × province) cells with k ≥ 10. An individual placement's outcome is inferable from the detail page; the retention math is publicly visible only in aggregate.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/employer/placements`** — fully rewritten lifecycle list
- **`/employer/placements/[placementId]`** — new detail page (was previously not a route)
- **`/insights`** — new "Did the hires stick?" card above the existing charts
- **Employer nav** — "Placements" label becomes "Employees" everywhere
- **Audit log** — 4 new kinds (`placement.status.check`, `placement.status.check_due`, `placement.note.update`, `placement.departed`)
- **Notification preferences** — 1 new kind (`placement.status.check_due`, audience: org_members)
- **Cron schedule** — 2 new nightly jobs (status-check-due + retention-snapshot)

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved from the plan)

- ❌ Warnings / disciplinary records (D0)
- ❌ Performance reviews / ratings (D0)
- ❌ Salary / payroll runs (D0 — Phase 5's `salary_band` stays the hire-time figure)
- ❌ Leave management
- ❌ Contract documents
- ❌ The dismissal *reason* (D4 — only the category)
- ❌ Importing non-Sebenza hires (D1)
- ❌ Per-employer retention rankings (D8)
- ❌ Forced reconciliation between seeker + employer status (D3, D9)

---

## 🧪 HOW TO VERIFY

1. Run migrations: `npm run db:migrate` to land 0033 + 0034.
2. Open `/employer/placements`: confirm the nav label is "Employees", the tabs render with counts, and the URL state preserves on refresh.
3. Open a placement detail page; confirm the Lifecycle / Internal Note / Check-in history panels render.
4. (Owner / Recruiter) Click "Confirm still employed" — confirm a check ledger row lands + `last_check_at` updates + the "Check-in due" pill disappears.
5. Edit the internal note (≤ 1000 chars) — confirm save + audit row with `noteLength` + the empty-clears-to-NULL path.
6. Mark a placement as departed: pick a category, enter a date in range (≥ hire, ≤ today); confirm the re-engage modal opens with the org's open vacancies + selecting one fires a `vacancy.invite`.
7. Hit `/api/cron/placement-status-check-due` with `Bearer ${CRON_SECRET}` against a fixture where an active placement is past its 3-month mark — confirm a single `placement.status.check_due` fires, second invocation is silent (dedupe).
8. Hit `/api/cron/placement-retention-snapshot` — confirm cells below k = 10 are suppressed; check `/insights` shows the new card after the cron runs.

---

*Phase 9.20 took the placement from a frozen moment-of-hire into a living lifecycle record. The platform now answers a question nobody else in SA has good data on: of all confirmed hires, how many stuck? Without becoming an HRIS or stepping anywhere near the labour-law compliance surface of warnings / discipline / payroll.*
