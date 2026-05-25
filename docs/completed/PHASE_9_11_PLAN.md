# PHASE 9.11 PLAN — VACANCY-OUTCOME LOOP + GROWTH NOTIFICATIONS
*Side-phase between Phase 9.10 and Phase 10. Opened 2026-05-25 from a system-review handoff: when a vacancy is marked filled, the system should (a) capture WHO was hired so a placement row + seeker-status update happens automatically, and (b) tell the candidates who weren't selected what the role wanted so the rejection is a learning event, not silence.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/PHASE_10_PLAN.md` · `docs/completed/PHASE_9_8_PLAN.md` (vacancies + invitations) · `docs/completed/PHASE_9_10_PLAN.md` (KYC gate).*

> **UX/UI quality bar:** smooth, beautiful, consistent with the Civic Editorial aesthetic, **mobile-first** by construction. The Mark-as-Filled modal is a bottom-sheet on phones, centred on `md+`. The growth notification reads cleanly in a phone inbox preview pane.

---

## 🎯 GOAL

Two related changes that close the vacancy lifecycle loop the way Sebenza's "honest signal" philosophy implies it should close.

**1. Mark-as-Filled becomes a single action that captures the hire.** Today the employer flips the vacancy to `filled` and then *might* remember to log the placement via the `VacancyPlacementsPanel` nudge. That two-step gap means filled vacancies can sit without placement data  defeating Placement-Truth + 9.8.7's "why roles go unfilled" intelligence layer. New design: clicking Mark-as-Filled opens a modal that requires the employer to pick at least one hire (from accepted invitees OR via inline search for someone outside the pipeline) before the state flip completes. Multi-hire batches supported (1 vacancy : 0..N placements per the existing cardinality).

**2. The candidates who weren't selected hear back honestly.** Accepted invitees who didn't get the role currently hear nothing  the silence is the worst possible signal. New design: when the placement is logged, every other accepted (or accepted-with-notice) invitee gets a `vacancy.outcome.other-hired` notification + email. The body compares the seeker's profile to the **vacancy requirements** (NOT to the hired person's profile  POPIA-clean) and deep-links to Career Compass with the missing skills pre-selected.

**Why now**: both changes are pre-launch hygiene. The mark-as-filled gap is a data-quality risk on day 1; the silent-rejection problem is a trust risk. Phase 10 (public launch) is explicitly "no new features"  these have to land in a side-phase before then.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **`transitionVacancyStatus` Server Action** (`lib/employer/vacancies.ts`)  bounded state machine including `open  filled`. Currently a pure state flip, no hire capture.
- **`markAsHired` Server Action** (`lib/employer/placements.ts`)  Owner/Recruiter writes a placement row with `vacancyId` optional, fires `placement.confirmed` notification to the seeker, updates seeker `profile.status = 'employed'` (already wired in Phase 5/7.5). The Phase 9.10 extension added `vacancyId` to the schema.
- **`VacancyPlacementsPanel`** (`components/feature/employer/vacancies/`)  surfaces accepted-invitee "Log this hire" CTAs on the vacancy detail. The modal will *replace* the path-to-placement these CTAs walk users through; the panel keeps its existing role (display + per-row "log this hire" for partial-batch follow-ups).
- **`searchProfilesQuery`** (`db/queries/profiles.ts`)  the same Phase 4 ranking SQL used by `/search`. We'll reuse it for the modal's inline "search outside pipeline" typeahead (org-scoping is implicit  the modal calls it from a Server Action that already verifies the employer).
- **Career Compass** (`db/queries/career-compass.ts`)  Phase 6 surface that returns skill recommendations per (profession × province) demand signal. The growth notification reuses these via deep-link to `/dashboard/grow`.
- **9.8.7 decline-reason aggregate** (`db/queries/decline-reasons.ts`)  cross-market view of why roles go unfilled. The growth notification cites the dominant decline-reason for the cell so the seeker gets honest context ("the local market often cites 'salary not competitive' for this role").
- **`vacancy.response` + `vacancy.invite*`** notification kinds  precedent for transactional vacancy lifecycle emails defaulting ON.
- **`<TalentRosterItem>` + the existing search-result UI**  reusable for the typeahead result rows inside the Mark-as-Filled modal.

---

## 🔒 LOCKED DECISIONS

### D1  Modal is mandatory; "skip" is a small text link, not a button
Marking a vacancy filled opens the modal. The primary path is **pick at least one hire**. A small text link *"Skip  log the placement later"* sits in the modal footer as an escape hatch (preserves today's behaviour for edge cases), but the visual hierarchy nudges hard toward logging. **Trade-off**: forced friction at state transition; some employers may resist. The pay-off is data-quality at launch.

### D2  Multi-hire support  checkbox list, batch-submit
Per the existing cardinality (1 vacancy : 0..N placements), the modal supports selecting multiple accepted invitees in one batch. A "shared salary band" optional input applies to all (most batches  e.g. 3 graduate developers from one posting  hire at the same band). Hire-date defaults to today, optional override. Each selected hire becomes one placement row + one `placement.confirmed` notification.

### D3  "Hired outside the pipeline" = inline typeahead search inside the modal
Don't redirect to `/search` and lose modal context. The modal has a *"Hired someone not in this list"* expander that reveals a name/handle typeahead. The typeahead calls a new lightweight Server Action `searchOutsideHireCandidates(query)` that returns a capped `PublicProfile[]` (5 results) using the existing `searchProfilesQuery` filtered to the org's province. Pick one  it joins the selected-hires list. Same submit flow as accepted-invitee picks.

### D4  Comparison is to the **vacancy**, not to the hired person
The growth notification body composes from:
1. **Vacancy data**  `professionSlug`, `seniority`, `skillSlugs`. These are admin-set, public-to-the-org. No cross-user PII.
2. **Recipient's own profile**  `topSkills`, `yearsExperience` (Phase 9.9). They already own this.
3. **Phase 9.8.7 decline-reason cross-market data**  *"In this cell, declines most often cite X."* Aggregated + suppressed. Already public on `/gov/shortage`.

**Never** mentions the hired person's name, handle, profile attributes, or anything else. The hired person's data stays inside the placement row  not exposed downstream.

### D5  Notification audience scope
`vacancy.outcome.other-hired` fires to:
- Every invitation with `state IN ('accepted', 'accepted_with_notice')` on this vacancy
- EXCLUDING any whose `profileId` is in the hired-set for this batch
- EXCLUDING `declined` (they opted out  the closure was their own)
- EXCLUDING `expired` / `withdrawn` (no two-way engagement)
- EXCLUDING `reconsidering` (still in flux; the employer hasn't responded yet)
- EXCLUDING `invited` (still pending; we don't pre-empt their response with "you lost")

### D6  Hired seeker profile status update
The existing `markAsHired` Server Action already updates the seeker's profile via the `placement.confirmed` notification + the seeker's "I'm employed now" status-confirmation flow. Phase 9.11 doesn't change this. The new combined action `markVacancyFilledAndLogHires` calls the existing `markAsHired` logic internally (per hire) to inherit the status-update behaviour.

### D7  Notification + email default ON
`vacancy.outcome.other-hired` defaults to `defaultInApp: true, defaultEmail: true`  same convention as `vacancy.response` + `vacancy.reconsider` (transactional lifecycle, recipient opts out per kind in `/dashboard/notifications/preferences`). Sending is still gated by `feature_flag_email_notifications`.

### D8  Career Compass deep link  `/dashboard/grow?missing=<comma-separated-skill-slugs>`
The compass already accepts profile context implicitly (via the signed-in seeker). The new query param is a hint to pre-select / pre-highlight the missing skills the notification flagged. If the compass page doesn't read the param yet, it's a one-line addition to its server component.

### D9  Race protection
The combined action is server-side transactional (Drizzle `db.transaction`). If the vacancy is already `filled`, the action refuses with a clear "this vacancy is already filled  use the panel for additional hires" message. Idempotency anchor on the audit log: `org.vacancy.filled.batch` audit row carries the placement IDs created in this batch.

### D10  Skip-link audit signal
When the employer chooses *"Skip  log later"*, the state flip still happens but an explicit audit row `org.vacancy.filled.no-placement` is written. Future admin analytics can flag orgs that habitually skip  Placement-Truth Rule visibility.

---

## ✅ PRE-FLIGHT CHECKLIST (run before writing code)

- [ ] Confirm `markAsHired` (`lib/employer/placements.ts`) ALREADY flips the seeker's profile to `status='employed'` post-placement  if not, this needs to land here.
- [ ] Confirm `transitionVacancyStatus` can be wrapped in a transaction with multiple `markAsHired` calls without re-verifying auth N times (verify once outside the loop).
- [ ] Confirm `searchProfilesQuery` accepts a `province` filter that can scope the inline typeahead to the org's province.
- [ ] Confirm Career Compass page reads from URL params today  if not, the deep-link `?missing=...` needs the page to know about it.
- [ ] Confirm `notifyOrgMembers` is the wrong fan-out for this  this is **seeker-audience**, not org. We need to fan out per-seeker via `createNotification` in a loop.

---

## 📋 TASKS

### Task 9.11.1: Server-side action  combined Mark-Filled + log hires
- [ ] New Server Action `markVacancyFilledAndLogHires` in `lib/employer/vacancies.ts`:
      - Inputs: `vacancyId`, `hires: { profileId, hiredAt?, salaryBand? }[]`
      - Owner/Recruiter only; vacancy must belong to caller's org; org must be `verified` (existing gate via `verifyOrgVerified()`); vacancy must be in `open` or `draft` state.
      - Per hire: insert one `placements` row with `vacancyId` set, `actorUserId`, `source: 'employer_confirmed'`; fire `placement.confirmed` notification; update seeker `profile.status='employed'` if it's not already; audit `placement.confirm`.
      - Transition vacancy `status = 'filled'`, `closedAt = now`, audit `vacancy.status.change`.
      - After all per-hire placements land: enumerate the `vacancy.outcome.other-hired` audience (D5) and fan out the growth notification.
      - All wrapped in `db.transaction()`  any failure rolls back.
- [ ] New Server Action `markVacancyFilledNoPlacement` (the explicit skip path)  flips the state, writes an `org.vacancy.filled.no-placement` audit row (new audit kind), fires NO notifications.
- [ ] New audit kinds: `org.vacancy.filled.batch`, `org.vacancy.filled.no-placement`.

### Task 9.11.2: Inline typeahead search for outside-pipeline hires
- [ ] New Server Action `searchOutsideHireCandidates(query, vacancyId)`:
      - Owner/Recruiter only; vacancy must belong to caller's org; org must be `verified`.
      - Calls `searchProfilesQuery` with the typeahead string + vacancy's province + a tight `LIMIT 5`. Excludes profiles already in `vacancy_invitations` for this vacancy (the modal handles those separately).
      - Returns the same `PublicProfile` shape `/search` uses  no extra fields, no cross-org leakage.
- [ ] Audit-logged as `search.outside-hire-lookup` (new audit kind) with the vacancy id + query in meta so the oversight log can spot misuse.

### Task 9.11.3: Growth-notification composition
- [ ] New helper `composeOutcomeNotification(vacancy, seekerProfile)` in `lib/seeker/vacancy-outcome.ts`:
      - Reads vacancy's `skillSlugs` + seniority.
      - Reads seeker's `topSkills` + `yearsExperience`.
      - Computes `missingSkills = vacancySkills \ seekerSkills`.
      - Reads 9.8.7 cross-market decline-reason aggregate for the vacancy's `(profession × province)` cell  picks the dominant reason if any (when above the k-floor).
      - Returns `{ title, body, link }` for `createNotification`:
        - **title**: *"{orgName} hired someone else for {vacancyTitle}"*
        - **body**: *"Honest read: the role wanted {top 3 vacancy skills}. Your profile shows {seekerSkills overlap}; missing: {missingSkills}. Across {profession} roles in {province}, declines most often cite {dominantReason}. Career Compass has a path to add {missingSkills}."*
        - **link**: `/dashboard/grow?missing={comma-separated slugs}`
- [ ] When `missingSkills` is empty (seeker has every skill the role asked for), the body shifts: *"Honest read: your profile matches every skill this role asked for  the decision came down to factors not on your profile. Keep your status fresh in search."*

### Task 9.11.4: NOTIFICATION_CATALOG + email template
- [ ] New `vacancy.outcome.other-hired` catalog entry (audience: `seeker`, `defaultInApp: true`, `defaultEmail: true`, dedupeWindowSeconds: 0).
- [ ] Template wired into `lib/email/templates/notifications.ts` via `genericTemplate()`:
      eyebrow *"Vacancy outcome"*, CTA label *"Open Career Compass"*.
- [ ] AuditKind union extended: `vacancy.outcome.other-hired` (notification-only; the audit row for the per-fan-out is implicit in the batch audit from 9.11.1).

### Task 9.11.5: Mark-as-Filled modal client island
- [ ] New `<MarkAsFilledModal>` in `components/feature/employer/vacancies/`:
      - Trigger: replaces the existing *"Mark as filled"* lifecycle button on `/employer/vacancies/[id]`. Clicking shows the modal instead of immediately transitioning.
      - **Header**: vacancy title + state pill.
      - **Section A  Accepted invitees**: checkbox list per accepted / accepted-with-notice invitee. Each row carries display name, handle, accepted date, notice-period chip (when applicable). Empty-state: *"No accepted invitees on this vacancy. Use the search below or skip."*
      - **Section B  Hired someone else**: expander with a name/handle typeahead (debounced 300ms). Results shown as 5-row max picker. Selecting adds to the selected-hires list above (Section A becomes a unified list).
      - **Section C  Hire details**: shared `hiredAt` date (defaults to today) + optional shared salary band textfield. Per-hire override link if the employer needs different dates/bands.
      - **Submit**: *"Mark filled + log {n} hire{s ? 's' : ''}"*. Submits via `markVacancyFilledAndLogHires`. On success, router.refresh() so the vacancy detail re-renders with the filled state + placement panel.
      - **Skip link** (footer, small): *"Skip  log the placement later."* Submits via `markVacancyFilledNoPlacement`.
      - Mobile-first: bottom-sheet on phones (full-width, sticky submit), centred dialog on `md+`. Esc + backdrop tap close. One save action.

### Task 9.11.6: Career Compass deep-link awareness
- [ ] `/dashboard/grow` page reads `?missing=<slugs>` from search params and pre-highlights / pre-selects those skills in the recommendations grid (visual nudge, not a hard filter). One-line server-component addition.
- [ ] A small banner at the top of the compass: *"You're here from a vacancy outcome  the role wanted {missingLabels}. Here's how to get there."* Renders when `?missing=...` is present.

### Task 9.11.7: Wiring, verification, doc convention
- [ ] `npm test` green; `npm run typecheck` clean; `npm run build` clean. Manual smoke at 360 px wide for the modal + the growth-notification email preview.
- [ ] Seed update: ensure at least one seed vacancy walks the new flow  the existing V3 (Graduate Software Developer Programme  3 BSc CS placements) already mirrors the multi-hire shape, so the new modal can be smoke-tested against the existing fixtures without seed changes.
- [ ] Compliance assertion (h)  *no `vacancy.outcome.other-hired` notification ever names or attributes the hired person.* Walk the audit log for recent notifications of this kind + grep the body strings for the hired profileId.
- [ ] On ship: `docs/completed/PHASE_9_11_COMPLETE.md`; move this plan to `docs/completed/`; tick 9.11 in `ROADMAP.md` ✅; refresh **Current State** in `TO_START_EVERY_SESSION.md`; commit *"Phase 9.11 complete  vacancy-outcome loop + growth notifications"*.

---

## 🚫 OUT OF SCOPE FOR 9.11 (explicit guardrails)

- ❌ **Comparing to the hired person's profile.** D4  POPIA-grey + brittle. Compare to the vacancy requirements only.
- ❌ **Notifying declined / expired / withdrawn invitees.** D5  they already had closure (their choice or the cron). Re-pinging is noise.
- ❌ **Notifying invitees still in `invited` state.** D5  they haven't responded yet. Pre-empting them with "you lost" is rude + might race their own decision.
- ❌ **Per-hire individual notification UI** for the employer to customise the growth-notification body. The composed body is the body. Customisation lands post-launch if employers ask.
- ❌ **Re-running mark-as-filled to add more hires later.** The post-filled additional-hire path goes through the existing `VacancyPlacementsPanel` "Log this hire" CTAs  D9 refuses re-runs.
- ❌ **Suggesting specific employers / vacancies to the not-selected seeker.** That's a future "alternative roles" feature; for v1 we just link to Career Compass.

---

## ⚠️ RISK AREAS

1. **The audience query for `vacancy.outcome.other-hired` could fan out to a large number of recipients** for a vacancy with many accepted invitees. Cap the fan-out at a sensible limit (e.g. 100). Beyond that, the recipient list is logged but not all notifications fire  prevents a single Mark-as-Filled from burning the email rate-limit.
2. **The vacancy-comparison body could read as patronising** ("you lack X, here's how to get X"). The copy needs careful editing  this is the moment we tell someone they didn't get the job. Lean honest, not lecturing. The body says *"the role wanted X"*, never *"you don't have X"*.
3. **Decline-reason cell may not have data yet** (post-launch, before enough declines accumulate). The composition helper degrades gracefully  if no dominant reason, the body omits that sentence entirely.
4. **The outside-pipeline typeahead could be used to scrape profiles**  audit log + rate limit per user per minute. The typeahead is org-verified employers only, but a bad actor with a verified employer account could still abuse. The existing per-user rate limit on search events covers this.
5. **The seeker who got the role might also be on another vacancy's not-selected list elsewhere**  they should still get growth notifications for those (different vacancy = different cell = different signal). No suppression on this axis.

---

## 🧭 WHY THIS IS ON-AXIS

The Phase 9.10 launch readiness review surfaced a quiet truth: a vacancy could be marked `filled` without a placement, and the accepted candidates who weren't chosen heard nothing. Both gaps undermine the platform's foundational claim  honest market signal, not silence. Phase 9.11 closes them.

The hire-capture change is small structurally (one new action, one modal) but big in data-quality terms: every `filled` vacancy now defaults to having placement data, which feeds Placement-Truth, the 9.7.3 Justification Index, and the 9.8.7 decline-reason analytics with real ground truth instead of probabilistic inference.

The growth-notification change is the smaller-coded but more thoughtful piece: it converts every non-selection from a silent rejection into a structured learning signal, with Career Compass as the bridge. No cross-user PII  the comparison is to the vacancy, not the hired person. POPIA-clean, philosophically aligned, reuses Phase 6 + 9.8.7 infrastructure.

The change is bounded: ~5 new files + ~3 existing-file edits + 1 new notification kind + 1 new email template + 4 new audit kinds. Roughly 1 focused session, comparable to Phase 9.9 in size. Won't push Phase 10.

*Plan opened 2026-05-25. Target: complete same week as Phase 9.10 + Phase 10 prep so launch ships with the full vacancy lifecycle loop closed.*
