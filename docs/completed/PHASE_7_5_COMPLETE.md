# Phase 7.5 — Work-availability + Longitudinal outcomes · ✅ COMPLETE (2026-05-23)

Opened + shipped on the same day, mirroring the Phase 6.5 side-phase pattern. Full spec at `docs/completed/PHASE_7_5_PLAN.md` with every acceptance box ticked.

Two capabilities the student-positioning conversation surfaced, built the Sebenza way (honest, opt-in, POPIA-first):

1. **Work-availability dimension** — decouple "what work will you take" from `employmentStatus`. A `studying` person can signal `casual`; a `full_time` employee can signal `contract`.
2. **Longitudinal education-to-employment outcomes** — built with a dedicated opt-in consent purpose + a hard k-anonymity floor + complementary suppression, so it's a policy asset (Department pitch) instead of a profiling liability.

The career-pathing piece the same conversation raised is already shipped (Career Compass + Student lane in Phase 6 / 6.5). 7.5 doesn't rebuild it.

---

## What shipped

### Task 7.5.1 — Schema + model
- `work_availability_kind` pgEnum: `casual` · `part_time` · `contract` · `full_time`
- `profiles.work_availability` array column (`NOT NULL DEFAULT '{}'`)
- GIN index on the array for `&&` / `@>` containment predicates
- Drizzle schema + `WorkAvailabilityKind` type + `WORK_AVAILABILITY_KINDS` constant
- dataProvider parity (`PublicProfile.workAvailability` flows through mock + DB providers + `searchProfilesQuery` + `findProfileByHandleQuery` + `lib/profile/me.ts`)
- Mock backfill for all 8 seeded profiles
- Migration `0007_phase7_5_work_availability.sql`

### Task 7.5.2 — Surfacing work-availability
- **`/dashboard/profile`** — `<WorkAvailabilityEditor>` checkbox group (optimistic toggles, per-item Server Action call). New `updateWorkAvailability` action at [lib/profile/actions.ts](lib/profile/actions.ts).
- **`/sign-up/seeker`** — sibling toggle inside the student branch lets a student declare casual / part-time / contract / full-time availability at sign-up.
- **`/p/[handle]`** — "Available for:" chip row inside the trust dossier (via shared `<WorkAvailabilityChips>`).
- **`<TalentRosterItem>`** — compact availability indicator next to the status chip on every search-result card.
- **`/search`** — multi-select "Available for" filter in `SearchFilters`. URL state `?availableFor=casual,part_time`. Backed by `p.work_availability && ARRAY[...]::work_availability_kind[]` in `searchProfilesQuery`.

### Task 7.5.3 — Dedicated consent purpose
- Extended `consent_purpose` enum with `outcomes_research` via isolated migration `0008_phase7_5_outcomes_consent.sql` (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`, runs outside transaction-sensitive territory).
- Optional + default-off + **non-degrading** — documented at the enum site + the privacy page copy.
- `lib/consent/index.ts` `CONSENT_PURPOSES` extended.
- `/dashboard/privacy` lists the new purpose with full explainer: what's shared (cohort-level numbers, never under 10 people per cell), what's never shared (any individual record), and that withholding doesn't weaken job-search.
- Versioned in `consents` like the others; revoke/regrant uses the same audit-logged actions.
- English copy ships now; Tier-1 languages land in Phase 10 (per user decision).

### Task 7.5.5 — Placement-logging completeness + Lever C
- `placement_source` enum + `placements.source` column (`employer_confirmed` default).
- **Honesty rule**: only `employer_confirmed` counts in `confirmedHiresThisMonth`, the trend chart, and the 7.5.4 outcomes dataset. `seeker_reported` shows on the seeker's profile flagged as such, excluded from official aggregates.
- New audit kind `placement.self_report`.
- **`<SelfReportPlacementCard>`** on the seeker dashboard, shown when `status === "employed"`. Calls new `selfReportPlacement` Server Action at [lib/profile/actions.ts](lib/profile/actions.ts).
- **Lever C — contextual "Did you hire?" nudge** on the employer dossier when a reveal hits day ≥ 21 of the 30-day window with no logged placement. New `lib/employer/placement-nudge.ts` query + `<PlacementNudgeBanner>` component. One tap scrolls to the `MarkAsHiredCard`. Lever A (analytics value-exchange) deferred to Phase 9; Lever B (verified-status gating) rejected per decision recorded in the plan.

### Task 7.5.4 — Longitudinal analytics with k-anonymity
- New `outcomes_min_cohort_size` platform setting (default 10, range 5–200).
- `lib/analytics/outcomes.ts` — the cohort query. Cohort dimensions: `programme × institution × province × graduation_year`. Metrics: cohort size, employer-confirmed placements, placement rate, median time-to-hire (PG `percentile_cont`), top destination profession (PG `mode()`).
- **Primary suppression** — drop any cell where `cohort_size < k`.
- **Complementary suppression** — for each (programme × institution × graduation_year) row AND each (programme × institution × province) column, drop the lone survivor when a sibling was suppressed (otherwise the visible cell's value is recoverable from the row/column total).
- Consented-only: source restricted via `INNER JOIN consents ON purpose='outcomes_research' AND state='granted'`.
- Employer-confirmed-only: `LEFT JOIN placements ... AND pl.source = 'employer_confirmed'`.
- **`/insights`** — new "Education-to-employment outcomes" section with a desktop table + honest empty-state copy when no cohort clears the floor. Renders the source-pool size + suppression count for transparency.
- **CSV export** at `/api/insights/outcomes/export` — same `outcomesQuery()` source, so the suppression filter is structurally identical. RFC-4180 + OWASP injection guard + UTF-8 BOM + CRLF. Audit-logged as `analytics.export`.
- Snapshot table for time-series (`outcome_snapshots`) is a Phase 8 cron add — the query is ready to feed it.

### Task 7.5.6 — Wiring, verification, doc convention
- All new UI copy in `messages/en.json` (Tier-1 deepMerge fallback per existing rule; full Tier-1 translation in Phase 10).
- `npm run typecheck` clean.
- `npm run build` ✓ (after `npm run db:migrate` + `npm run db:seed`).
- **Compliance assertions** in `lib/analytics/outcomes-compliance.ts`:
  - `assertNoCohortBelowFloor` — primary k-anonymity guarantee
  - `assertUnconsentedNeverAppears` — every source-pool profile has granted consent
  - `assertSeekerReportedExcluded` — `seeker_reported` rows never bleed into the visible cohort tally (Placement-Truth)
  - `assertWorkAvailabilityPubliclySafe` — no schema-drift values in the publicly-exposed array
  Runnable via admin-only API at `/api/admin/outcomes-compliance`. Phase 11.4 wires them into the Vitest runner.
- **Seed cohort**: 12 synthetic seekers in BSc Computer Science × Wits × Gauteng × 2026, all with `outcomes_research` granted, 3 with employer-confirmed placements at Discovery Bank — so the /insights outcomes section renders a real row out of the box (cohort=12, placed=3, rate=25%).
- Three real seekers also flipped to `outcomes_research = granted` (`andile-z`, `lerato-n`, `zinhle-m`) so the system has both real and synthetic consented profiles.

---

## Migrations applied

| Migration | What |
|---|---|
| `0007_phase7_5_work_availability` | `work_availability_kind` enum · `profiles.work_availability` array + GIN index · `placement_source` enum · `placements.source` + partial index |
| `0008_phase7_5_outcomes_consent` | `ALTER TYPE consent_purpose ADD VALUE IF NOT EXISTS 'outcomes_research'` (own file to keep enum extension isolated from transaction-sensitive territory) |

Both applied cleanly to Neon (PG 16) at 2026-05-23.

---

## Decisions recorded during build

### Placement-incentive lever (open question #1)
**Chosen: Lever C primary, Lever A deferred to Phase 9, Lever B rejected.**
- **C — contextual "Did you hire?" nudge**: ships now. Lowest friction, no penalty, aligns with the existing 30-day reveal gate. Banner at day ≥ 21 without a logged placement.
- **A — analytics value-exchange (employer hiring funnel)**: deferred to Phase 9 when the employer funnel page exists. Natural self-enforcement once that surface lands.
- **B — "verified in good standing" gate**: rejected. Conflates KYC (who you are) with behavioural compliance (whether you log) and creates an operationally-hairy auto-demotion engine. Different category of trust signal.

### Consent translation (open question on Tier-1)
**English now, Tier-1 (`zu` / `xh` / `af`) lands in Phase 10** alongside the full localization rollout. Acceptable per user decision; documented in 7.5.6 + the ROADMAP so the localization pass picks it up.

### Suppression floor value (open question #2)
**N = 10 default; admin-tunable via `outcomes_min_cohort_size` setting** (5–200 range, schema enforces). Lower with care: a 5-person cell still allows re-identification of small SA programmes.

### Availability vs. status coupling (open question #3)
**Fully independent**, per the plan's lean. A `full_time` employee can be open to `contract`; a `studying` person can signal `casual`. Clarity beats cleverness.

### Student casual filter consent (open question #4)
**No separate consent needed** — self-set availability is itself the opt-in (it's a preference, not PII).

---

## Files added / changed

**Schema + migrations**
- `db/schema.ts` (work_availability + placement_source enums + columns; consent_purpose enum extended)
- `db/migrations/0007_phase7_5_work_availability.sql`
- `db/migrations/0008_phase7_5_outcomes_consent.sql`
- `db/migrations/meta/_journal.json`

**Core logic**
- `lib/mock/types.ts` (WorkAvailabilityKind + SearchFilters.availableFor + PublicProfile.workAvailability)
- `lib/mock/profiles.ts` (backfill on 8 mock profiles)
- `lib/consent/index.ts` (CONSENT_PURPOSES extended)
- `lib/profile/actions.ts` (`updateWorkAvailability`, `selfReportPlacement`)
- `lib/profile/me.ts` (surface workAvailability on MyProfile)
- `lib/employer/placements.ts` (markAsHired sets `source: 'employer_confirmed'` explicitly)
- `lib/employer/placement-nudge.ts` (Lever C query)
- `lib/audit/index.ts` (`placement.self_report` kind)
- `lib/admin/settings.ts` + `lib/admin/settings-actions.ts` (`outcomes_min_cohort_size`)
- `lib/analytics/outcomes.ts` (cohort query + primary + complementary suppression)
- `lib/analytics/outcomes-compliance.ts` (4 runnable assertions)
- `db/queries/profiles.ts` (availableFor filter + workAvailability in select)
- `db/queries/analytics.ts` (filter `employer_confirmed` only)
- `lib/auth/actions.ts` (signUpSeeker accepts workAvailability)

**UI**
- `components/feature/profile/WorkAvailabilityChips.tsx`
- `components/feature/profile/WorkAvailabilityEditor.tsx`
- `components/feature/profile/SelfReportPlacementCard.tsx`
- `components/feature/employer/PlacementNudgeBanner.tsx`
- `components/ui/TalentRosterItem.tsx` (chips next to status)
- `components/feature/SearchFilters.tsx` (multi-select availability group)
- `components/feature/auth/SeekerSignUpForm.tsx` (student-branch toggle)
- `components/feature/admin/SettingsForm.tsx` (cohort-size row)

**Pages**
- `app/[locale]/(public)/p/[handle]/page.tsx` (Available for row in dossier)
- `app/[locale]/(public)/search/page.tsx` (parses availableFor)
- `app/[locale]/(public)/insights/page.tsx` (outcomes section)
- `app/[locale]/(seeker)/dashboard/page.tsx` (self-report card when employed)
- `app/[locale]/(seeker)/dashboard/profile/page.tsx` (WorkAvailabilityEditor)
- `app/[locale]/(seeker)/dashboard/privacy/page.tsx` (outcomes_research row)
- `app/[locale]/(auth)/sign-up/seeker/page.tsx` (passes professions; form now includes availability)
- `app/[locale]/(employer)/employer/dossier/[handle]/page.tsx` (nudge banner + mark-as-hired anchor)

**API routes**
- `app/api/insights/outcomes/export/route.ts` — CSV export with same suppression
- `app/api/admin/outcomes-compliance/route.ts` — admin-only assertion runner

**Seed**
- `db/seed.ts` — workAvailability backfill on existing profiles; `outcomes_research` grants for 3 named seekers; synthetic 12-person Wits BSc CS cohort with 3 employer-confirmed placements.

---

## How to verify locally

```bash
npm run db:migrate                                    # apply 0007 + 0008
npm run db:seed                                       # backfill + cohort
npm run typecheck                                     # clean
npm run build                                         # ✓ compiled
# After signing in as admin, visit:
#   /api/admin/outcomes-compliance                    # JSON { ok: true, checks: […] }
#   /insights                                         # Education-to-employment outcomes section
#   /search?availableFor=casual,part_time             # availability filter
#   /dashboard/profile                                # availability editor (signed in as seeker)
#   /dashboard/privacy                                # outcomes_research consent row
#   /employer/dossier/andile-z                        # availability chips visible
```

---

## What's next

Phase 8 (`docs/PHASE_8_PLAN.md`) opens. The 7.5 hand-offs Phase 8 picks up:

- **`outcome_snapshots` nightly cron** — schedule `outcomesQuery()` to write a daily snapshot for time-series.
- **Email channel for `outcomes_research` revocations** — when a seeker revokes the consent, send a confirmation email (current behaviour: in-app only). Same hook as the rest of the Phase 8 Resend templates.
- **SAQA + Home Affairs adapters** — when ID + qualification verifications are real signals, the consent copy can promise more.
