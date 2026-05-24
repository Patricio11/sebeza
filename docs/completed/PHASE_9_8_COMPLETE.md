# Phase 9.8  Vacancies & Demand-Driven Matching · ✅ COMPLETE (2026-05-24)

Side-phase between Phase 9.7 and Phase 10. Turns Sebenza from ad-hoc search-and-contact into a structured, demand-driven matching system: org-private vacancy specifications  reverse-match against the talent base  invite specific people  capture their accept / decline-with-reason  link the placement when filled  feed the "why roles go unfilled" labour-market intelligence layer.

Companion docs: `PHASE_9_8_PLAN.md` (this `/docs/completed/` directory), `docs/ROADMAP.md`, `docs/TO_START_EVERY_SESSION.md`, `docs/popia/DPIA.md` (no new R required  the consent + audit + suppression contracts inherit from earlier risk registers).

---

## The headline

Three things this is, structurally:

1. **Private, not a job board.** Vacancies are org-private specifications. There is no public listing, no "apply" button, no seeker-side browsing. The whole shape is the inverse of a job board: the employer reverse-matches into the talent base and invites specific people; the seeker accepts, declines, or declines with a reason.
2. **Highlight, not gate.** Nationality is a *displayed, optionally-filterable* attribute (Phase 9.7). It is **never** a barrier on invites. The originating chat proposed a per-vacancy "SA only" toggle; we explicitly do not build it (§CRITICAL in the plan). Compliance assertion (c) walks the codebase to keep that line.
3. **Decline-reason as labour-market intelligence.** No job board has the data to tell government *why* roles go unfilled. A (profession × province) salary-driven gap is a different policy signal from a supply-driven one. Cross-references the 9.7.3 Justification Index so the joint reading discipline is built in.

---

## What shipped

### 9.8.1  Vacancy schema + lifecycle ✅ (commit `1803676`)
- `vacancies` pgTable (org-private; FK CASCADE on `organizations.id`); `vacancy_status` enum [`draft`/`open`/`closed`/`filled`]; bounded state machine (`draft  open|closed`, `open  closed|filled`, `closed  open`, `filled  closed`).
- `lib/employer/vacancies.ts`  `listMyVacancies` / `getMyVacancy` / `getMyOrgRole` reads + `createVacancy` / `updateVacancy` / `transitionVacancyStatus` Server Actions. Every read filters by `organizationId`; every Server Action calls `requireEditRole()` then re-checks vacancy ownership before mutating  the privacy invariant is enforced three ways (read filter + write guard + structural import allow-list asserted by 9.8.8 check (a)).
- Role gating: Owner + Recruiter create/edit/change-status; Viewer is strictly read-only and salary band is stripped from their UI even though the read returns it.
- Surfaces: `/employer/vacancies` (list, mobile-first cards), `/employer/vacancies/new` (create form), `/employer/vacancies/[id]` (detail + edit form + lifecycle action row). New `Vacancies` entry in `EMPLOYER_NAV` (Briefcase icon) between Saved searches and Talent pools.
- Eight `vacancy.*` audit kinds reserved in `lib/audit/index.ts`; three used in 9.8.1 (`.create`, `.update`, `.status.change`). Migration `0015_phase9_8_vacancies.sql` applied to Neon.

### 9.8.2  Reverse-matching ("Find matches") ✅ (commit `a4e07d4`)
- `matchVacancyCandidates(vacancy)` composes via the **existing** `searchProfilesQuery` (Phase 4 ranking SQL  one source of truth, no parallel matcher). Profession + skill labels concatenated into the FTS `query`; province slug passes through; seniority normalised when canonical.
- New `countMatchesByCitizenship(filters)` query backs the **honest-supply line** *"N SA citizens · M candidates match this vacancy"* (D6 wording  "candidates," not "eligible"). No `LIMIT`  the figure is the true total across the platform, independent of the SEARCH_LIMIT-capped ranked list.
- `/employer/vacancies/[id]/match` page reuses `<TalentRosterItem>` with the existing `citizen_boost` for highlighting (no new gate  §CRITICAL respected). Sticky honest-supply header stays visible while scrolling on mobile.
- Find-matches CTA on the vacancy detail page is visible to **all roles**  reverse-matching is a redacted read of the public talent pool, so Viewers can browse matches even though they can't edit the vacancy.

### 9.8.3  Consent purpose for vacancy invites ✅ (commit `27ab038`)
- `consentPurpose` += `vacancy_matching` via additive migration `0016` (same pattern as `0008` for `outcomes_research`). Migration applied to Neon.
- **Optional, default-off, non-degrading**: a seeker who has NOT granted `vacancy_matching` is still searchable + contactable exactly as today; they just don't receive vacancy invites. Documented at every layer (migration header, enum comment, `CONSENT_PURPOSES` array, privacy-page fallback, sign-up explainer).
- D8 source text wired **verbatim** into onboarding (seeker sign-up step 2) + `/dashboard/privacy`  single English source for Tier-1 human translation. Tier-1 catalogs (`zu` / `xh` / `af`) continue to fall back to English via the existing deepMerge (no machine-translation of POPIA/consent/legal copy).
- Mobile-first explainer rendering: tap-to-expand `<details>` on phones (collapsed by default), always-visible paragraph on `md+`. Pure CSS, no JS for viewport detection.
- `lib/consent/check.ts` ships `hasConsent(userId, purpose)` + `hasVacancyMatchingConsent(userId)` server-only helpers (`import "server-only"`). Treats missing rows + `state='none'` + `state='revoked'` as not-granted (POPIA affirmative-consent rule). The 9.8.4 invite action calls these at its boundary; compliance assertion (b) walks the contract from live rows.

### 9.8.4  Invite flow (employer  seeker) ✅ (commit `0f7a81f`)
- `vacancy_invitations` table + `invitation_state` enum + `decline_reason` enum shipped via migration `0017`. UNIQUE (vacancy_id, profile_id) dedup; (vacancy_id, state) / (profile_id, state) / (expires_at) secondary indexes. ON DELETE CASCADE on both FKs.
- `bulkInviteToVacancy({ vacancyId, profileIds })` Server Action splits selections through four gates: profile-not-found  profile-deleted (POPIA tombstone)  already-invited (UNIQUE dedup)  consent gate via `hasVacancyMatchingConsent()`. Eligible: write row + fire `vacancy.invite` notification (attributed: *"Discovery Bank flagged you for: Senior Software Engineer."*) + audit. Skipped: `vacancy.invite.skip` audit row with actual reason  **never in the response payload** per D5 (would leak consent state).
- Soft summary banner verbatim: *"N invites sent · M not eligible to receive an invite right now."*
- `withdrawInvitation` flips `invited``withdrawn`; only `invited` rows are withdrawable.
- `/api/cron/vacancy-invite-expiry` guarded by `isAuthorizedCron(request)` (Bearer `CRON_SECRET`). Conditional state flip (idempotent against concurrent seeker responses). Fires `vacancy.invite.expired` (seeker, polite) + `vacancy.invite.unanswered` (employer org-wide via `notifyOrgMembers`). Cron-only helper kept in non-`"use server"` `lib/employer/invitations-cron.ts` so it can never accidentally become a Server Action invokable by a client.
- Three new `NOTIFICATION_CATALOG` kinds: `vacancy.invite`, `vacancy.invite.expired`, `vacancy.invite.unanswered`.
- Match-page client island `BulkInviteIsland` (mobile-first: bottom-sheet modal on phones, centred on `md+`, sticky action bar, select-all/clear chips, "Already invited" pill instead of checkbox for dedup, Viewers see no interactive invite affordances).
- Vacancy-detail pipeline panel `VacancyInvitationsPanel` shows invitations grouped by tone-coded state pills with per-row withdraw for Owners + Recruiters on `invited` rows.

### 9.8.5  Seeker accept / decline-with-reason / accept-with-notice / reconsider ✅ (commit `7e32563`)
- `lib/seeker/invitations.ts` ships four Server Actions wrapping a shared `respond()` engine that enforces ownership + expected-state + DB-conditional-update guards (concurrent flips can't race past): `acceptInvitation`, `acceptInvitationWithNotice` (D1, `noticePeriodMonths` 112), `declineInvitation`, `reconsiderInvitation`.
- `accepted_with_notice` is a yes everywhere; the 9.8.7 aggregate filters `WHERE state='declined'` so it's excluded from "declined/unfilled" stats by query construction (compliance check (e)).
- Decline modal: bottom-sheet on phones, centred on `md+`, six reasons + optional 200-char note with live char counter + POPIA reminder *"Work-related reasons only  please don't include personal info like health, family status, or religion."* Audit-meta carries `seekerAuthoredFreeText: true` flag (compliance check (f)).
- Reconsider (only valid from `declined`) fires `vacancy.reconsider` (distinct notification kind so the employer's bell shows it apart); accept/decline fire `vacancy.response`. Every response audit-logged as `vacancy.response` with `meta.responseKind` variant.
- Two new `NOTIFICATION_CATALOG` kinds: `vacancy.response`, `vacancy.reconsider`.
- Seeker surfaces at `/dashboard/invitations` (list, active vs closed sections) + `/dashboard/invitations/[id]` (detail with state-aware `InvitationResponseIsland`)  the 9.8.4 invite notification's link is now an action-ready landing page (not a 404).
- New `Vacancy invites` entry in `SEEKER_NAV` (Inbox icon).
- Labels/types split into `lib/seeker/invitations-types.ts` (non-`"use server"`) so client islands can import canonical labels without dragging a server boundary.

### Vacancy emails wired end-to-end ✅ (commit `b4e3f75`)
- Five new templates in `lib/email/templates/notifications.ts` for `vacancy.invite` / `.expired` / `.unanswered` / `.response` / `.reconsider`  reuse the existing `genericTemplate()` shell that Phase 7/8 already uses for `contact.revealed`, `placement.confirmed`, etc.
- `defaultEmail: true` on all five (transactional lifecycle events; read like verification in intent). Recipients can opt out per kind in `/dashboard/notifications/preferences`. Sending stays gated by `feature_flag_email_notifications` (admin killswitch).
- The earlier "email dormant per Phase 8" wording in the plan was misleading: Resend was always live (Better Auth verification uses it). The vacancy kinds were silently no-op'ing because the `TEMPLATES` allowlist had no entries  `emailContentFor()` returned `null` and the email branch in `createNotification()` skipped. Templates fill that gap.

### 9.8.6  Vacancy  Placement linkage ✅ (commit `69546bb`)
- Existing Phase 5 `markAsHired()` Server Action **extended** (not rebuilt) with optional `vacancyId` field. Re-fetches the vacancy under the caller's org scope before writing  cross-org / stale ids silently nulled out (prevents probing for foreign vacancy ids via the placement form). Source stays hard-coded `employer_confirmed` so Placement-Truth + 7.5.5 honesty rule inherited unchanged. `placement.confirm` audit meta carries the link.
- Cardinality enforced by FK shape: 1 vacancy : 0..N placements; 1 placement : 0..1 vacancy. No UNIQUE constraint. `placements.vacancyId.references(() => vacancies.id, { onDelete: "set null" })` in the Drizzle schema mirrors the DB FK already shipped in `0015` (no new migration for 9.8.6).
- New `<VacancyPlacementsPanel>` on the vacancy detail page renders three modes: filled-but-nothing-logged = prominent prompt; ≥1 placement = list + per-accepted-invitee "Log this hire" CTAs; nothing = hidden. Per-invitee CTAs deep-link to `/employer/dossier/[handle]?vacancyId=<id>#mark-as-hired`; the dossier resolves the title server-side + `MarkAsHiredCard` banner *"Linking this hire to vacancy: <Title>"* confirms.
- New read helper `getPlacementsForVacancy(vacancyId)` with double org-scoping (`verifyOrgVerified` + `placement.organizationId` filter).

### 9.8.7  "Why roles go unfilled" analytics ✅ (commit `f8fdf5f`)
- New `declineReasonAggregateQuery({ orgId? })` over `vacancy_invitations` in `state='declined' AND responded_at IS NOT NULL`  the D1 rule that `accepted_with_notice` is a yes (never a decline) is baked into the WHERE. Grouped by (`profession_slug` × `province_slug` × `reason`). Freshness-weighted via `sebenza_freshness_confidence(responded_at)` (same SQL function the Phase 4 ranking + 9.7 nationality cells use  recent declines dominate).
- **Two callers, one function**: pass `orgId` for the employer-private view (no suppression  recruiter's own data); omit for the cross-market suppressed view (`suppress()` engine with k=10 from `outcomes_min_cohort_size` + two complementary axes: reason within (profession, province), province within (profession, reason)).
- New `<DeclineReasonsCard>` (mobile-first horizontal bars, mirrors the 9.7 nationality-card idiom). Reads `data.orgScoped` to switch wording + footer between modes. Cross-market mode adds a brand-tinted footer cross-referencing `/gov/shortage`  *"a (profession × province) salary-driven gap reads differently from a supply-driven one."*
- Shipped on `/employer/vacancies` (employer-private) and `/gov/shortage` (cross-market, suppressed; new *Why roles go unfilled* section below the Justification Index).
- CSV export at `/api/gov/decline-reasons/export` reuses hardened `csvFromRows()` + `csvDisposition()`  query function returns suppressed cells, so there's no way to bypass the k-floor from this route. Audit-logged as `analytics.export` with `surface`, `rowCount`, `k`, `suppressed` in meta for the 9.7.7 oversight log.
- **Plan deviation**: plan said `/insights` for the employer-private surface, but `/insights` is the public ISR-cached page  an employer-scoped card there would leak / break for logged-out visitors. `/employer/vacancies` is the natural recruiter surface and the audit log records org context cleanly.

### 9.8.8  Wiring, verification, doc convention ✅ (this commit)
- **Six new compliance assertions** in `lib/analytics/outcomes-compliance.ts`, all wired into `/api/admin/outcomes-compliance`:
  - **(a)** `assertNoVacancyFieldOnPublicSurfaces`  filesystem grep at runtime: confirms `vacancies` / `vacancyInvitations` are imported ONLY by allow-listed paths (`lib/employer/...`, `lib/seeker/...`, `lib/analytics/outcomes-compliance.ts`, `app/api/cron/vacancy-invite-expiry`, `app/api/gov/decline-reasons`, `app/[locale]/(employer)/...`, `app/[locale]/(seeker)/dashboard/invitations/...`, `db/queries/decline-reasons`, `db/seed`, `db/schema`). Any unauthorised importer is flagged at audit time.
  - **(b)** `assertInviteRequiresConsent`  walks every `vacancy_invitations` row LEFT JOIN'd to `consents`; any row without `state='granted'` on `purpose='vacancy_matching'` fires. Write-time contract (revocation post-write doesn't retroactively invalidate the audit record; the action checks fresh per call).
  - **(c)** `assertNoNationalityInviteGate`  grep on the invitation-pipeline files (`lib/employer/invitations*.ts`, `lib/seeker/invitations.ts`, `app/api/cron/vacancy-invite-expiry`) for any non-comment line referencing `is_citizen` / `nationality_class`. The §CRITICAL design correction is enforced structurally.
  - **(d)** `assertNoDeclineReasonCellBelowFloor`  belt-and-braces over the cross-market aggregate; mirrors the Phase 9.7.2 nationality-floor check.
  - **(e)** `assertAcceptWithNoticeNotInUnfilled`  documents the structural defence (query filters `WHERE state='declined'`). When seeded fixtures exist, reports the count of `accepted_with_notice` rows that are correctly excluded.
  - **(f)** `assertDeclineNoteFlaggedPII`  walks recent `vacancy.response` audit rows with `meta.responseKind='decline'` and a `declineNote`, verifying `seekerAuthoredFreeText: true` is also set. Any missing flag is a contract violation.
- **Seed extended** (`db/seed.ts`): new `seedPhase9_8Vacancies()` lands real (suppressed) rows on every 9.8 surface:
  - 3 vacancies on Discovery Bank (V1 Senior Software Engineer / Gauteng / open; V2 Backend Developer / Western Cape / open; V3 Graduate Software Developer Programme / Gauteng / filled  synthetic, only purpose is to retroactively link the 3 BSc CS cohort placements per the plan's bonus).
  - 5 invitations across SA-citizen + foreign-national profiles  one of each lifecycle state (accepted / declined-with-reason / accepted-with-notice / invited / expired with backdated `expires_at`).
  - Audit rows mirroring exactly what the production action handlers + the cron would write (including the `seekerAuthoredFreeText: true` PII flag on the declined row).
  - `consents` updated to grant `vacancy_matching` to a curated subset (so the bulk-invite eligibility demo has real candidates AND the soft-summary skip count demos a non-zero "M not eligible" number).
- **Tier-1 i18n note**: 9.8 follows the established convention  most UI copy is inline (matches Phase 9.7 build); the consent text (the only POPIA-load-bearing copy from this phase) lives in `messages/en.json` and the zu/xh/af stubs `__notice`-fall-back to English until pro translation lands. No machine translation.
- **Verified**: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean · `npm run db:seed` runs end-to-end (8 mockProfiles + 12-strong BSc CS cohort + 4 foreign-national profiles + 3 vacancies + 5 invitations + 14 vacancy audit rows). Migration `0017` applied to Neon.

---

## Out-of-scope (explicit guardrails kept)

| Not built | Why |
|---|---|
| Public vacancy listing / "apply" button / seeker-side browsing | A job board. The whole product call is the inverse. |
| Nationality-as-gate on invites ("SA only" toggle) | Direct violation of Rule 2 + Rule 3 + DPIA R9 mitigation. §CRITICAL. |
| `legal_eligibility_note` field | Not even scaffolded (D4). If a concrete legal case ever appears, that's a separate counsel-reviewed change. |
| Salary band on any seeker-facing surface | Inherited from Phase 5  stays org-private. |
| In-app interview scheduling / messaging build-out | Reuses Phase 5 dossier/contact flow. A full comms suite is its own future phase. |
| Per-seeker skip reason exposed in bulk-invite UX | D5  would leak consent state. Audit log records the per-seeker reason; UI shows only the soft summary. |

---

## Migrations applied

- `0015_phase9_8_vacancies.sql` (9.8.1)  `vacancy_status` enum + `vacancies` table + `placements.vacancy_id` FK.
- `0016_phase9_8_3_vacancy_matching_consent.sql` (9.8.3)  `consent_purpose` += `vacancy_matching`.
- `0017_phase9_8_4_vacancy_invitations.sql` (9.8.4)  `invitation_state` + `decline_reason` enums + `vacancy_invitations` table.

---

## Why this is the Sebenza version

The voice-chat got the shape right (private reverse-matching, consent-gated invites, decline-with-reason as market signal) and two specifics wrong: it reused a dead phase number, and  more importantly  endorsed a per-vacancy "South African only" gate that contradicts Rule 2, Rule 3, and the DPIA R9 mitigation shipped six days earlier in 9.7.

This phase keeps every genuinely strong idea  the pipeline, the typed consent reusing the existing machinery, the reason taxonomy + the notice-period catch + the change-of-mind path, the "why-unfilled" analytics  and corrects the nationality piece to **highlight-not-gate**: the honest version the platform already implements everywhere else. Vacancies make Sebenza's demand data richer and its matching active, without ever becoming the job board, or the exclusion tool, it was built not to be.

The decline-reason aggregate is the policy payoff. A (profession × province) cell where 60 % of declines cite *salary not competitive* reinforces the local-shortage classification from 9.7.3  the gap is real, it's just *salary-driven*. That's the kind of intelligence no job board in South Africa has, and it lands the moment the first real declines flow in.

Plan opened 2026-05-24. Eight tasks shipped, eight commits, three migrations, twelve compliance assertions on the runtime suite (six new, six inherited from 7.5 / 9.7). Phase 10 opens.
