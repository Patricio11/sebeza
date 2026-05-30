# PHASE 11.3 COMPLETE — SEEKER CONTROL + TRUST POSTURE
*Shipped 2026-05-30. Third sub-phase of Phase 11 (Seeker Retention + Skill-Growth Conversion). Six tasks; seekers gain three agency surfaces (pause searchability, block employer, report invite) + two trust surfaces (vacancy snapshot, verification badge) + one POPIA-aligned audit-trail visibility surface.*

> **One-line summary**: Adds the small daily-life controls Sebenza's seeker product was missing — pause without revoking, block without escalating, report in-context, see the actual vacancy spec, verify the employer at a glance, trust the verification chain on your own employment. None of these weakens the consent contract; all of them strengthen the seeker's agency over their own data.

Commits:

- (this commit) — Phase 11.3 ship: 6 tasks, 1 new migration (5 sub-changes), 6 new audit kinds, 1 new notification kind, 1 new cron, 1 new table (`seeker_blocked_employers`), 4 new columns on `consents` + `reports` + `vacancy_invitations`

---

## 🎯 WHAT SHIPPED

### Task 11.3.1 — Pause searchability
- Migration `0040` adds three nullable columns to `consents`: `paused_until`, `paused_at`, `paused_reason`.
- New `lib/consent/pause.ts` with `pauseSearchability({ durationDays, reason? })` + `unpauseSearchability()` + `readMyPauseState()` Server Actions. Four canonical durations: 30 / 90 / 180 / 365 days.
- `db/queries/profiles.ts` — `searchProfilesQuery` gains a `NOT EXISTS` clause that excludes paused profiles. No index changes; cron-time auto-unpause keeps the WHERE clause cheap.
- `lib/employer/invitations.ts` — bulk-invite path checks pause state and silently skips paused seekers (matches the existing consent-revoke skip pattern). New `SkipReason` enum value: `searchability_paused`.
- New `<SearchabilityPauseControl>` component on `/dashboard/privacy` — duration radio set, optional 200-char private reason, "Unpause now" chip when paused.
- New nightly cron at `app/api/cron/searchability-pause-sweep` (45 5 * * * UTC = 07:45 SAST). Clears expired pauses + writes `consent.searchability.pause_expired` audit rows.
- Three new audit kinds: `consent.searchability.paused`, `consent.searchability.unpaused`, `consent.searchability.pause_expired`.
- New notification kind `consent.searchability.paused` (in-app default ON, email default OFF, no dedupe).
- Per D1 — pause is a state on the existing `searchability` consent, NOT a new consent purpose.

### Task 11.3.2 — Block this employer (private)
- Migration `0040` adds the new `seeker_blocked_employers` table (UNIQUE on `profile_id, org_id` + two indexes).
- New `lib/seeker/blocks.ts` with `blockEmployer({ orgId, reason? })` / `unblockEmployer(orgId)` / `listMyBlocks()` Server Actions.
- `db/queries/profiles.ts` — `searchProfilesQuery` gains a `NOT EXISTS` clause keyed on the caller's org id (new `callerOrgId` field on `SearchFilters`). Anonymous + gov + admin callers pass null; block enforcement is a no-op there.
- `lib/employer/invitations.ts` — bulk-invite path checks the block list and silently skips. New `SkipReason` enum value: `blocked_by_seeker`.
- New `<BlockedEmployersList>` section on `/dashboard/privacy` (server-loaded list + per-row Unblock).
- New `<BlockEmployerControl>` (button + confirm modal) on the invitation detail page.
- Two new audit kinds: `seeker.block.added`, `seeker.block.removed`.
- D2 invariant honored end-to-end: the employer is never notified, blocks never surface in any employer audit log row.

### Task 11.3.3 — Report this invite
- Migration `0040` — `report_reason` enum gains three new values (`irrelevant_role`, `bad_faith_company`, `off_platform_contact_request`); `reports.subject_profile_id` becomes nullable; two new nullable columns (`subject_org_id`, `subject_invitation_id`).
- New `lib/seeker/report-invite.ts` with `reportInvitation({ invitationId, reason, note? })` Server Action — verifies the reporter owns the invitation; writes a row pointing at the org + invitation; fans out to admins via the existing `moderation.reported` notification kind.
- New `<ReportInvitationControl>` (button + modal) on the invitation detail page. Seven-row reason radio set; 280-char free-text; D3 honored — reporting does NOT auto-decline the invitation.
- New audit kind: `moderation.invite_report.created`.
- Admin moderation queue (`/admin/moderation`) widens its `AdminOpenReport.reason` type union and its REASON_LABEL_KEY mapping. Legacy profile-flag reports continue to work unchanged.

### Task 11.3.4 — Vacancy snapshot in invitation detail
- Migration `0040` adds `vacancy_invitations.vacancy_snapshot` (jsonb).
- `bulkInviteToVacancy` now captures the spec at send time + writes it to the new column. Frozen for the lifetime of the invitation row.
- New `<VacancySnapshotCard>` server component on the invitation detail page. Two paths: snapshot exists → frozen spec + captured-at annotation; snapshot is null → live-description fallback with a "may have changed" annotation (the path retires once the ~30-day backfill horizon passes).
- New `VacancySnapshot` shape + `isVacancySnapshot` runtime guard in `lib/seeker/invitations-types.ts`. The jsonb is stored opaquely; the read path narrows it through the guard.
- D4 honored — snapshot integrity beats freshness. The seeker evaluates what the employer **sent**, not what they later edited.

### Task 11.3.5 — Employer verification badge on the invitation card
- `SeekerInvitationRow` (in `lib/seeker/invitations-types.ts`) gains `orgVerification`. The read path joins `organizations.verification` directly.
- New `<EmployerVerificationChip>` (server component) with three render paths: verified (brand-tint pill), pending (accent-tint pill), self-registered (dashed border + optional honest-signal line below).
- Wired into both the inbox card (`/dashboard/invitations`) and the detail page header.
- D5 honored — surfaces existing data; no new badge tier.

### Task 11.3.6 — Employment-verification audit-trail visibility
- `<EmploymentVerificationPanel>` — the `<ResolvedStrip>` sub-component now renders an audit-trail line below the outcome on `verified` / `declined` / `disputed` rows: "Verified by {contactName} · {respondedAt} · Ref EV-{id-suffix}".
- POPIA s.23 alignment (right of access to personal information).
- No data shape change; reads from the existing `MyVerificationRow`.

---

## 📦 FILES TOUCHED

**New (10 files)**
- `db/migrations/0040_phase11_3_seeker_control.sql`
- `lib/consent/pause.ts`
- `lib/seeker/blocks.ts`
- `lib/seeker/report-invite.ts`
- `app/api/cron/searchability-pause-sweep/route.ts`
- `components/feature/privacy/SearchabilityPauseControl.tsx`
- `components/feature/privacy/BlockedEmployersList.tsx`
- `components/feature/seeker/BlockEmployerControl.tsx`
- `components/feature/seeker/ReportInvitationControl.tsx`
- `components/feature/seeker/invitations/VacancySnapshotCard.tsx`
- `components/feature/seeker/invitations/EmployerVerificationChip.tsx`
- `docs/completed/PHASE_11_3_COMPLETE.md` (this doc)

**Edited (10 files)**
- `db/schema.ts` — pause columns on `consents`; new `seeker_blocked_employers` table; 3 new `report_reason` values + 2 new `reports` columns + `subject_profile_id` nullable; `vacancy_snapshot` jsonb on `vacancy_invitations`.
- `lib/audit/index.ts` — 6 new audit kinds.
- `lib/notifications/catalog.ts` — `consent.searchability.paused` notification kind.
- `lib/mock/types.ts` — `SearchFilters.callerOrgId` added.
- `db/queries/profiles.ts` — pause + block NOT EXISTS clauses on `searchProfilesQuery`.
- `lib/employer/invitations.ts` — pause + block silent-skip gates; vacancy-snapshot capture at send time; 2 new `SkipReason` values.
- `lib/seeker/invitations.ts` + `invitations-types.ts` — `orgVerification` + `vacancySnapshot` threaded through; `VacancySnapshot` shape + runtime guard.
- `app/[locale]/(seeker)/dashboard/privacy/page.tsx` — pause control + blocked-employers section.
- `app/[locale]/(seeker)/dashboard/invitations/page.tsx` — verification chip on inbox cards.
- `app/[locale]/(seeker)/dashboard/invitations/[id]/page.tsx` — verification chip + snapshot card + report + block controls.
- `components/feature/profile/EmploymentVerificationPanel.tsx` — audit-trail line in `<ResolvedStrip>`.
- `lib/admin/moderation-query.ts` + `lib/admin/moderation.ts` + `app/[locale]/(admin)/admin/moderation/page.tsx` — widened type unions to support nullable subject_profile_id + new invite-report reasons.
- `vercel.json` — `searchability-pause-sweep` entry (17 cron jobs total).
- `README.md` — cron count updated.

**Verification**
- `tsc --noEmit` clean
- `npm run build` succeeded (280 routes)
- `vitest run` 50/50 green

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **Pause is a state on existing consent, not a new purpose** (D1). Avoids consent proliferation; semantically clean.
2. **Blocks are private + employer-invisible** (D2). The employer sees the seeker disappear from search + bulk-invite silently skips. No notification, no per-org block count, no appeal path.
3. **Reporting does not auto-decline** (D3). Two decisions, deliberately decoupled.
4. **Vacancy snapshot is frozen at send time, not live** (D4). The seeker evaluates the spec the employer **sent**, not the spec they later edited.
5. **Verification chip uses the existing 3-tier badge** (D5). No new tier introduced.
6. **Audit-trail line on the seeker's own verification** (D6). Aligns with POPIA s.23.
7. **Card-level three-dot menu deferred**. The plan called for a popover menu on the inbox card too; that would require unwrapping the card's single-Link wrapper (a deeper refactor). The detail page is the canonical surface for report + block; the inbox card carries the verification chip + a tap-through to the detail page. Card-level menus can land in Phase 11.5 polish.
8. **Pre-migration vacancy snapshots are not backfilled**. The UI falls back to the live description with a "may have changed" annotation; new invites after the migration carry frozen snapshots. The plan mentioned a backfill cron; deferred because (a) the snapshot is informational, not load-bearing, and (b) the fallback path is already correct.
9. **No new admin help articles for the three invite-specific reasons**. The REASON_LABEL_KEY in `/admin/moderation` falls back to the existing "other" translation key; bespoke labels can land in Phase 11.5.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Privacy page** (`/dashboard/privacy`) — pause control under the searchability toggle; new "Blocked employers" section between consents + data.
- **Invitations inbox** (`/dashboard/invitations`) — verification chip next to every org name on every card.
- **Invitation detail** (`/dashboard/invitations/[id]`) — verification chip + signal line in the header; vacancy snapshot card below; report + block controls in the agency-controls strip above the closing note.
- **Profile page** (existing employment-verification panel) — audit-trail line on resolved rows.
- **Search** — paused seekers excluded everywhere; org-blocked seekers excluded for that org's verified-employer searches.
- **Bulk invite** — paused + blocked seekers silently skip; same UX as consent-not-granted.
- **Admin moderation queue** — picks up the new `report_reason` values automatically; widened to handle nullable `subject_profile_id` for invite reports.
- **Cron surface count** — one new entry (`searchability-pause-sweep`).
- **vercel.json** — 17 cron jobs total now.

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ Public block list (visible to other seekers) — blocks are private by design.
- ❌ Auto-reporting on threshold patterns — admin review is the only path.
- ❌ Notifying the employer when blocked — privacy invariant.
- ❌ Allowing employers to "appeal" a block — same invariant.
- ❌ Sharing vacancy snapshots publicly — snapshot is private to the invitation.
- ❌ A help article per new sub-feature — deferred to Phase 11.5 polish.
- ❌ Card-level three-dot menu — deferred (card stays a single Link; detail page carries the agency controls).
- ❌ Vacancy-snapshot backfill cron — fallback path is correct; new invites carry snapshots from day one.

---

## 🧪 HOW TO VERIFY

1. On `/dashboard/privacy`, toggle searchability pause for 3 months. Confirm the pause chip renders + an audit row writes. Manually trigger the cron with system-time fake-forwarded past the expiry → confirm the row clears.
2. As an employer, run `/search` for a profession × province where a paused seeker would appear. Confirm they're excluded.
3. As a seeker, block an employer org from the invitation detail page. Confirm the block lands in `seeker_blocked_employers` + the `<BlockedEmployersList>` on `/dashboard/privacy` shows it.
4. As that employer, search for the seeker — confirm exclusion. Attempt bulk-invite including the seeker — confirm silent skip + `vacancy.invite.skip` audit row with reason `blocked_by_seeker`.
5. From an invitation detail page, click "Report this invite" → pick `off_platform_contact_request` + a short note → submit. Confirm a row in `reports` with the org + invitation references + an admin notification fires. Confirm the invitation state is unchanged (D3).
6. Inspect an invitation row created post-migration. Confirm `vacancy_snapshot` is populated. Open the detail page → confirm `<VacancySnapshotCard>` renders the frozen spec + captured-at annotation.
7. Inspect a pre-migration invitation (snapshot is null). Confirm the fallback "Live  may have changed" path renders the live description.
8. Receive an invitation from an `unverified` org — confirm the chip + the honest-signal line render on the detail page. Receive one from a `verified` org — confirm the verified chip renders inline.
9. Resolve an `employment_verifications` row to `verified`. View `<EmploymentVerificationPanel>` — confirm the audit-trail line renders below the outcome strip with contact name + responded date + Ref EV-{suffix}.

---

*Phase 11.3 closes the seeker control + trust posture arc. Next: Phase 11.4 (SA distribution surface  profile share card with WhatsApp deep-link, follow employer, data-saver mode, SMS / WhatsApp channel gated rollout, recommended employers).*
