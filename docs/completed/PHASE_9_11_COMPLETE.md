# PHASE 9.11 COMPLETE  VACANCY-OUTCOME LOOP + GROWTH NOTIFICATIONS
*Shipped 2026-05-25. Plan: [`docs/completed/PHASE_9_11_PLAN.md`](./PHASE_9_11_PLAN.md). Companion: `TO_START_EVERY_SESSION.md` · `ROADMAP.md`.*

> **One-line summary**: Marking a vacancy filled now captures *who was hired* in the same atomic action, and the candidates who weren't selected hear back with an honest, POPIA-clean growth signal that deep-links into Career Compass with the role's missing skills pre-highlighted.

---

## 🎯 WHAT SHIPPED

### A  Mark-as-Filled is now a single, hire-capturing action
The lifecycle button on `/employer/vacancies/[id]` no longer flips state directly. It opens `<MarkAsFilledModal>` (bottom-sheet on phones, centred on `md+`) which forces the employer to either:
1. Pick at least one hire from accepted invitees + outside-pipeline typeahead (the primary path), OR
2. Take the explicit *"Skip  log later"* escape hatch (audit-logged so admin can spot habitual skippers).

The new `markVacancyFilledAndLogHires` Server Action is wrapped in `db.transaction()`  placement inserts + state flip + outcome fan-out are atomic. If the vacancy is already `filled`, the action refuses with a clear message (D9 race protection). For batches of multiple invitee hires it shares a hire-date + optional salary band, but each placement row gets its own `placement.confirmed` notification + audit row, preserving the existing self-confirmation flow that respects seeker autonomy (Placement-Truth Rule).

### B  The candidates who weren't selected get honest closure
Every accepted invitee on the vacancy (excluding the hires, excluding declined / expired / withdrawn / reconsidering / still-pending  D5) gets a `vacancy.outcome.other-hired` notification + email when the placement is logged. The body is composed by `composeOutcomeNotification()` against the **vacancy requirements**  never the hired person's profile (D4 privacy invariant). It cites the role's published skills, names the recipient's overlap + gaps, optionally cites the dominant decline-reason from the Phase 9.8.7 cross-market aggregate (when above the k-floor), and deep-links to `/dashboard/grow?missing=<slugs>`.

The Career Compass page now reads the `?missing=<slugs>` searchParam: a top banner restates the role's gaps ("The role asked for X, Y, Z"), and recommendation rows whose skill matches one of the slugs get a "Vacancy gap" highlight chip with a stronger border. No personal lecture, just a structural pointer to the path forward.

---

## ✅ COMPLIANCE ASSERTIONS

| # | Assertion | Where verified |
|---|---|---|
| **a** | No `vacancy.outcome.other-hired` notification body ever names, attributes, or includes any field of the hired person. | `lib/seeker/vacancy-outcome.ts` only reads vacancy attrs + recipient's own profile + the 9.8.7 cross-market aggregate (k-floor suppressed)  no hired-profile data is in scope. |
| **b** | Mark-as-Filled requires either ≥1 hire OR explicit Skip  never silent. | `MarkAsFilledModal` Submit is `disabled` when `selected.size === 0`; Skip path writes a distinct `org.vacancy.filled.no-placement` audit row. |
| **c** | Race protection: a second Mark-as-Filled on the same vacancy is refused. | `markVacancyFilledAndLogHires` checks `vacancy.status` inside the transaction; subsequent hires go through the existing `VacancyPlacementsPanel` "Log this hire" CTAs. |
| **d** | The outside-pipeline typeahead is org-verified + scoped to the vacancy's province + excludes existing invitees. | `searchOutsideHireCandidates` calls `verifyOrgVerified()`, passes `province` to `searchProfilesQuery`, filters out `vacancy_invitations` rows for the vacancy. Audit row `search.outside-hire-lookup` lands on every call. |
| **e** | Fan-out cap honoured. | `OUTCOME_FANOUT_CAP = 100` constant in `lib/employer/vacancies.ts`. Audience beyond the cap is logged in audit meta but no notifications fire  protects the email rate limit. |
| **f** | Email default-ON respects the killswitch + per-recipient preferences. | New catalog entry `defaultEmail: true`; `createNotification` already gates on `feature_flag_email_notifications` + per-user `notification_preferences` rows. |
| **g** | Skip-link writes audit signal. | `markVacancyFilledNoPlacement` writes `org.vacancy.filled.no-placement` with vacancy id as subject  D10 fully satisfied. |

---

## 📦 FILES TOUCHED

**New**
- `lib/seeker/vacancy-outcome.ts`  pure `composeOutcomeNotification()` helper. Privacy invariant in module docstring (D4). Pulls SKILL slug labels, joins human-readably, degrades gracefully when decline-reason cell is below k-floor.
- `components/feature/employer/vacancies/MarkAsFilledModal.tsx`  client island. Three sections (accepted invitees checkbox list, outside-pipeline typeahead with 300ms debounce, selected-hires summary + shared hire details). Bottom-sheet on phones, centred on `md+`. Sticky footer with Skip link + Cancel + Submit.
- `docs/completed/PHASE_9_11_COMPLETE.md` (this doc).

**Edited**
- `lib/employer/vacancies.ts`  three new Server Actions: `markVacancyFilledAndLogHires` (transactional batch + fan-out + reveal-gate carve-out for accepted invitees per D6 inheritance), `markVacancyFilledNoPlacement` (explicit skip), `searchOutsideHireCandidates` (typeahead).
- `lib/audit/index.ts`  `AuditKind` union extended: `org.vacancy.filled.batch`, `org.vacancy.filled.no-placement`, `search.outside-hire-lookup`, `vacancy.outcome.other-hired`.
- `lib/notifications/catalog.ts`  new entry `vacancy.outcome.other-hired` (audience `seeker`, `defaultInApp: true`, `defaultEmail: true`, dedupe 0  every outcome is unique by vacancy).
- `lib/email/templates/notifications.ts`  wired `vacancy.outcome.other-hired` to `genericTemplate()` with eyebrow *"Vacancy outcome"* and CTA *"Open Career Compass"*.
- `app/[locale]/(employer)/employer/vacancies/[id]/page.tsx`  replaces the simple `filled` lifecycle button with `<MarkAsFilledModal>`, passing pre-loaded accepted invitees so no extra round trip.
- `app/[locale]/(seeker)/dashboard/grow/page.tsx`  reads `?missing=<slugs>` searchParam, renders the deep-link banner, threads `highlight` into `<RecommendationItem>` so the matching skills get the "Vacancy gap" treatment.

**Verification**
- `npm run typecheck` clean.
- Existing Phase 9.8 seed (Discovery V3  Graduate Software Developer Programme, 3 BSc CS hires) already mirrors the multi-hire shape; smoke-tested against existing fixtures.

---

## ⚠️ KNOWN COMPROMISE (acceptable for v1; lands in 9.11.x follow-up if employer feedback asks)

The outside-pipeline typeahead returns the `PublicProfile` shape (which doesn't carry the row's internal `profileId`). The modal sidesteps this by routing outside-pipeline picks to the existing `/employer/dossier/[handle]?vacancyId=…#mark-as-hired` flow on submit instead of bundling them into the batch. In practice:
- **Only invitees picked**: goes through the new batch action atomically. Best path.
- **Only outside-pipeline picks**: modal deep-links to the dossier flow for the first one (single-hire) and the employer completes any additional ones via dossier.
- **Mixed**: invitees go through the batch; the first outside pick gets the dossier deep-link with the vacancy linkage intact.

Either way, the placement row carries `vacancyId`, so the Vacancy Placements Panel + 9.7.3 Justification Index + 9.8.7 outcome analytics see the linkage. Resolving the typeahead → `profileId` lookup so all picks can bundle into one transaction is a future ergonomic improvement, not a correctness fix.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/employer/vacancies/[id]`**  Lifecycle action row now opens the modal for `filled`, retains the simple form for `closed` / `open`.
- **`/dashboard/grow`**  Now context-aware when entered from the vacancy-outcome notification. Untouched otherwise.
- **`/admin/audit-log`**  Four new audit kinds searchable: filtering by `org.vacancy.filled.batch` surfaces every multi-hire batch; `org.vacancy.filled.no-placement` surfaces every skip (Placement-Truth visibility).
- **9.8.7 outcome analytics**  Gains a stronger signal because every `filled` vacancy now defaults to having placement linkage.
- **Phase 10 launch**  Pre-launch hygiene goal met: no more silent rejections + no more `filled` vacancies without ground-truth placements.

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved guardrails)

- ❌ Comparing recipient to the hired person (D4).
- ❌ Notifying declined / expired / withdrawn / reconsidering / still-pending invitees (D5).
- ❌ Per-hire employer-customisable growth-notification body  the composed body is the body.
- ❌ Re-running mark-as-filled on a `filled` vacancy  additional hires go through `VacancyPlacementsPanel`.
- ❌ Suggesting specific alternative employers / vacancies to the not-selected seeker  that's a post-launch surface.

---

*Phase 9.11 closed the vacancy lifecycle loop end-to-end: hire captured + closure delivered, both POPIA-clean and Placement-Truth aligned. Next: Phase 10 launch readiness.*
