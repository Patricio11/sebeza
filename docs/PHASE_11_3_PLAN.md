# PHASE 11.3 PLAN — SEEKER CONTROL + TRUST POSTURE
*Opens after Phase 11.2. Companion docs: `PHASE_11_PLAN.md` · `docs/popia/DPIA.md` · `docs/popia/RETENTION_POLICY.md` · `UX_UI_SPEC.md`.*

> **Thesis:** Sebenza's seeker product has strong consent surfaces + audit-log honesty. What it lacks is **agency**  the small daily-life controls that let seekers say *"not from this employer", "pause me for a quarter", "I want to see the actual vacancy before I respond"*. Phase 11.3 adds those controls without weakening the consent contract.

---

## 🎯 GOAL

After Phase 11.3 ships, a seeker has three new pieces of agency:

1. **Pause searchability**  a temporary three-state toggle (active / paused-until-DATE / off). Employed seekers who are tired of recruiter calls can pause without revoking consent.
2. **Block this employer**  a private, employer-invisible blacklist for cases where a single bad actor doesn't warrant the moderation hammer.
3. **Report this invite**  a one-click invitation-card report flow that builds the moderation signal without the seeker drafting their own complaint.

Two complementary trust surfaces also ship:

- **Vacancy snapshot in invitation detail**  the seeker sees the actual role spec the employer published, not just the employer's 200-char message.
- **Employer verification badge on the invitation card**  the seeker can tell at a glance whether this is the real Yoco or someone impersonating them.

One quieter addition completes the audit-trail honesty:

- **Employment-verification audit trail visibility**  when an admin verifies a seeker's current employment (Phase 9.23), the seeker sees the "verified by Sebenza admin on YYYY-MM-DD" chip + drill-down.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Six-purpose consent surface**  `/dashboard/privacy`. The `searchability` consent is one of the six.
- **Invitation lifecycle**  `lib/seeker/invitations.ts`. Multi-state machine: `invited / accepted / declined / accepted_with_notice / reconsidering / withdrawn / expired`.
- **Vacancy schema**  `vacancies` table (Phase 9.8). Carries the full role spec including description, skills, work availability, season window, salary band.
- **Employer KYC + verification badges**  Phase 9.10 / 9.22. Orgs carry `verification` enum: `unverified / pending / verified`. Used on `/p/[handle]` already.
- **Moderation queue**  Phase 7. Admin surface at `/admin/moderation`; `moderation_reports` table.
- **Employment verification flow**  Phase 9.23. `employment_verifications` table with states `none / pending / resolved`.
- **Audit log infra**  Phase 0. Every PII-touching action writes a row.

---

## 📋 TASKS

### Task 11.3.1: Pause searchability

**Scope.** Add a third state to the `searchability` consent: `paused_until`. Today the consent is binary (granted / not). The new state is granted-but-paused: the seeker stays in the system, their record is intact, their existing relationships hold, but for a defined window they don't appear in `/search` results and employers can't send them new invites.

**Why now.** Today employed seekers who get tired of recruiter calls have two options: revoke `searchability` (heavy; loses the freshness streak; existential feel) or just stop confirming their status (becomes stale → ranking drops). Neither is honest. The pause posture is honest: *"I'm here, I'm just not interested right now."*

**Data shape.**

```ts
// Migration: add nullable columns to consents
ALTER TABLE consents
  ADD COLUMN paused_until timestamp,
  ADD COLUMN paused_at timestamp,
  ADD COLUMN paused_reason text;
```

When `paused_until > now()` on the seeker's `searchability` consent row, the seeker is paused. The pause has an automatic expiry  the seeker picks a duration on grant (1 / 3 / 6 / 12 months) and the cron sweeps expired pauses back to fully-active nightly.

**Search-side enforcement.** The existing search query already filters by `searchability` consent. The query gains a `paused_until IS NULL OR paused_until < now()` clause; without changing the index strategy.

**Invitation-send enforcement.** The bulk-invite + single-invite server actions check the pause state before writing the row. A paused seeker silently skips on bulk-invite (no per-seeker error to the employer; matches the existing consent-revoke skip pattern).

**UI.** New `<SearchabilityPauseControl>` on `/dashboard/privacy` directly under the `searchability` toggle. Visual states:

- **Active**: toggle on; below the toggle, a text link "Pause for a while →"
- **Paused**: toggle stays on; below it, a chip "Paused until 2026-09-30 · Unpause →"
- **Off**: toggle off; pause control hidden (you'd revoke, not pause).

**Notification.** New kind `consent.searchability.paused` (in-app default on, email default off). Also fires the existing `status.stale.warning` cron with a paused-aware exemption — paused seekers don't get stale warnings.

**Audit posture.** Every pause / unpause / auto-expire writes one `consent.searchability.paused` / `consent.searchability.unpaused` / `consent.searchability.pause_expired` audit row.

**POPIA touch.** This isn't a new consent purpose; it's a state on an existing one. DPIA gets a one-line update describing the temporal modifier.

- [ ] Migration to add the three columns.
- [ ] New helper `lib/consent/pause.ts` with `pauseSearchability({ until, reason? })` + `unpauseSearchability()` server actions.
- [ ] Update search-query `WHERE` clause in `db/queries/profiles.ts`.
- [ ] Update bulk-invite + single-invite server actions to check pause state.
- [ ] New `<SearchabilityPauseControl>` component.
- [ ] New nightly cron at `app/api/cron/searchability-pause-sweep/route.ts` (auto-unpause expired).
- [ ] Notification kind.
- [ ] One help article: `content/help/seeker/privacy/pausing-searchability.md`.
- [ ] DPIA + Retention Policy line updates.

---

### Task 11.3.2: Block this employer (private)

**Scope.** A seeker can block any employer org from viewing their profile + sending them invites. The block is **private to the seeker**: the employer is not notified, not visible on any employer surface, not exposed in audit logs the employer can read. The employer's view of `/search` silently excludes blocked-seeker profiles (matches consent-revoke skip pattern). The employer's bulk-invite silently skips blocked seekers.

**Why now.** Today the only path to "I don't want to hear from this employer again" is `/report-employer` (moderation escalation). That's a sledgehammer for what's often a routine "no thanks". The block is the right surface for the routine case; report stays for the escalation case.

**Data shape.**

```sql
CREATE TABLE seeker_blocked_employers (
  id            text PRIMARY KEY,
  profile_id    text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id        text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blocked_at    timestamp NOT NULL DEFAULT now(),
  reason        text,
  UNIQUE(profile_id, org_id)
);

CREATE INDEX idx_blocked_employers_by_profile ON seeker_blocked_employers(profile_id);
```

**UI surfaces.**

- **Public profile of any org (`/p/{org-handle}` if it ever ships, or via the employer card on invitation detail)**: a small "Block this employer" menu item. Confirm modal: "{Org} won't be able to view your profile or send you new invites. They won't be told. You can unblock from your privacy settings any time."
- **On invitation detail page**: same menu item. Blocking when an active invitation exists declines the invitation (with reason `withdrawn_by_seeker_block`) atomically.
- **Privacy page**: a new "Blocked employers" section listing current blocks with an unblock control.

**Search-side enforcement.**

```ts
// db/queries/profiles.ts - searchProfilesQuery
.where(
  notExists(
    db.select().from(seekerBlockedEmployers)
      .where(
        and(
          eq(seekerBlockedEmployers.profileId, profiles.id),
          eq(seekerBlockedEmployers.orgId, callerOrgId),
        ),
      ),
  ),
);
```

The query becomes one additional `NOT EXISTS` clause. Negligible cost on the indexed sub-query.

**Audit log.** Every block / unblock writes a `seeker.block.added` / `seeker.block.removed` audit row scoped to the seeker. The employer never sees these rows in their org's audit log.

**POPIA touch.** Add to DPIA + the help article. The block list is a new data category (seeker  org references) under POPIA s.16; processing purpose is "seeker safety / autonomy" with the seeker's account-creation consent as the lawful basis.

- [ ] Migration: new table.
- [ ] New `lib/seeker/blocks.ts` with `blockEmployer({ orgId, reason? })` / `unblockEmployer({ orgId })`.
- [ ] Update `searchProfilesQuery` (the search SQL) to add the `NOT EXISTS` exclusion.
- [ ] Update bulk-invite + single-invite to check the block list.
- [ ] New menu item on `<InvitationDetail>` + a stub on the seeker-side employer-profile (if one exists).
- [ ] New "Blocked employers" section on `/dashboard/privacy`.
- [ ] One help article: `content/help/seeker/privacy/blocking-employers.md`.
- [ ] DPIA row + Retention Policy line.

---

### Task 11.3.3: Report this invite

**Scope.** A one-click "Report this invite" menu item on every invitation card / invitation detail. Opens a small modal with structured reason codes (harassment, spam, irrelevant role, bad-faith company, off-platform contact request, other) + an optional 280-char free-text field. Submits as a `moderation_reports` row pointing at the org + invitation. Admin queue at `/admin/moderation` already handles the rest.

**Why now.** Today reporting an inappropriate invite requires the seeker to find the moderation report flow (deep in help), write their own complaint, link to the relevant context themselves. That's friction. One-click in-context reporting is the right contract.

**Data shape.** Existing `moderation_reports` table is sufficient. Add a `subject_invitation_id` nullable column to link the report to the specific invitation (vs the org overall):

```sql
ALTER TABLE moderation_reports
  ADD COLUMN subject_invitation_id text REFERENCES vacancy_invitations(id) ON DELETE SET NULL;
```

The new column is queryable but optional  the existing `subject_org_id` stays the load-bearing reference.

**Reason codes** (extend `moderation_report_reason` enum):

- `harassment` (existing)
- `spam` (existing)
- `inappropriate` (existing)
- `irrelevant_role` (new — the role doesn't match what was advertised)
- `bad_faith_company` (new — MLM, scam, "pay to apply" patterns)
- `off_platform_contact_request` (new — employer asked to take it to WhatsApp / personal email)
- `other` (existing)

**UI.** Three-dot menu on the invitation card opens a popover; "Report this invite" lands on a modal with the reason radio group + the optional free-text. Submit → server action → row in `moderation_reports` → admin notification fires. Page revalidates to show "Reported" state on the card.

**Anti-pattern guard.** Reporting does **not** auto-decline the invitation. Decoupling is correct: the seeker can report an inappropriate-tone invitation and still accept the role if it's genuinely interesting. Two different decisions.

**Audit log.** `moderation.report.created` row with the seeker, the org, the invitation_id, the reason code.

- [ ] Migration: enum additions + nullable column.
- [ ] New server action `reportInvitation({ invitationId, reason, note? })`.
- [ ] New menu item on `<InvitationCard>` + `<InvitationDetail>`.
- [ ] Update `/admin/moderation` queue to surface the invitation context.
- [ ] One help article update: existing help / report flow doc.

---

### Task 11.3.4: Vacancy snapshot in invitation detail

**Scope.** Today the invitation detail page shows the employer name + the employer's 200-char personal message + the role title + the response action panel. The seeker accepts / declines without seeing the **actual vacancy spec** the employer published (description, required skills, work availability, season window if applicable, salary band where visible).

This task adds a read-only vacancy snapshot card on the invitation detail page  the exact spec frozen at invitation-send time. If the employer subsequently edits the vacancy, the snapshot stays.

**Why now.** Trust + decision-quality. Today the seeker accepts blind based on a 200-char message. A real vacancy is 50100 words of spec. The seeker deserves to see what they're signing up to evaluate.

**Data shape.** A new column on `vacancy_invitations`:

```sql
ALTER TABLE vacancy_invitations
  ADD COLUMN vacancy_snapshot jsonb;
```

`vacancy_snapshot` is populated at invitation-send time with the relevant subset of the vacancy spec (title, description, required skills slugs + labels, work availability, season window, salary band if seeker-visible, profession + province / city). Frozen at that moment; never auto-updates.

**Migration backfill.** For invitations that exist before the migration runs, the snapshot is null + the UI falls back to live-querying the vacancy (with a "Live  may have changed" annotation). After ~30 days the backfill cron retires the live-fallback path; only new invites have snapshots.

**UI.** A collapsed-by-default `<VacancySnapshotCard>` on the invitation detail, below the employer message + above the action panel. Click to expand. Shows the snapshot fields in Civic-Editorial typography. The annotation strip carries the snapshot date.

- [ ] Migration: add `vacancy_snapshot` column.
- [ ] Update the invitation-send Server Actions (bulk + single) to populate the snapshot.
- [ ] Backfill cron for pre-migration invitations.
- [ ] New `<VacancySnapshotCard>` component on `app/[locale]/(seeker)/dashboard/invitations/[id]/page.tsx`.
- [ ] One help article: `content/help/seeker/invitations/reading-the-vacancy-spec.md`.

---

### Task 11.3.5: Employer verification badge on the invitation card

**Scope.** Today the invitation card shows the employer name + logo (maybe). It does **not** show the employer's verification status. The seeker has no surface signal whether this is the real Yoco (KYC'd, Sebenza-verified) or a fly-by-night account claiming the name.

This task surfaces the existing employer verification badge directly on the invitation card. The badge mirrors the badge on `/p/{org-handle}`:

- **Sebenza-verified** (KYC + admin review) — `verified` tier
- **Self-registered** (account exists but no KYC) — `unverified` tier
- **Pending verification** — `pending` tier (visible chip)

**Why now.** Trust + safety. Cheap surfacing of data that already exists.

**Edge case.** When the inviting org is `unverified`, the card adds a subtle line: *"This employer hasn't completed our verification process. Consider the request carefully."* No moralising; just an honest signal.

- [ ] Update `<InvitationCard>` + `<InvitationDetail>` to render the verification chip from the existing `organizations.verification` enum.
- [ ] One help article update: `vacancy-invitations-explained.md` mentions the badge.
- [ ] No data shape change.

---

### Task 11.3.6: Employment-verification audit-trail visibility

**Scope.** When an admin verifies a seeker's current employment via Phase 9.23 (the opt-in flow that sends a one-shot verification email to the seeker's employer), the seeker's profile shows the new verified state but doesn't surface the **provenance**: who verified, when, what was confirmed.

This task adds a "Verified by Sebenza admin · 2026-05-28 · Reference: EV-2026-08291" line under the employment-verification chip on `/dashboard/profile`. Tap reveals the small read-only audit chain (resolved date, admin handle anonymised as "Sebenza admin", reference number from `employment_verifications.id`).

**Why now.** Trust. Today the chip transitions from `pending` to `resolved` silently. The seeker doesn't see when, why, or by whom — undermining the verification's own credibility.

- [ ] Update `<EmploymentVerificationPanel>` to render the audit chain when state is `resolved`.
- [ ] One help article update: `content/help/seeker/profile/employment-history-entry.md` mentions the audit trail.
- [ ] No data shape change.

---

## 🚫 OUT OF SCOPE FOR PHASE 11.3 (explicit guardrails)

- ❌ **Public block list (visible to other seekers).** Blocks are private. Sebenza is not a Glassdoor-style review platform; that's a different product.
- ❌ **Auto-reporting on threshold patterns.** If an org's block count crosses a threshold, **no** auto-moderation triggers. Admin review is the only path. Pattern-detection is in scope for the existing admin moderation surface, not this phase.
- ❌ **Notifying the employer when blocked.** Privacy invariant: blocks are silent. The employer sees the seeker disappear from their search results + bulk invites silently skip; same UX as a consent revoke.
- ❌ **Allowing employers to "appeal" a block.** Same invariant.
- ❌ **Sharing vacancy snapshots publicly.** The snapshot is private to the invitation. If the employer wants a public posting, that's a different feature (Sebenza deliberately doesn't have public postings — see PHASE_10_1 employer help).

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Pause is a state on existing consent, not a new consent purpose. | Avoids consent proliferation. Pause is a temporal modifier on `searchability` — semantically clean. |
| D2 | Blocks are private + employer-invisible. | Trust invariant: a seeker's no must be honestly silent. Telling the employer "you've been blocked by N seekers" creates a perverse incentive + invites retaliation off-platform. |
| D3 | Reporting does not auto-decline. | Two decisions. Decoupling them keeps the seeker honest about their preferences. |
| D4 | Vacancy snapshot is frozen at invitation-send, not live. | Snapshot integrity. The seeker is evaluating the spec the employer **sent**, not the spec the employer subsequently edited. Matches the integrity contract used on KYC document snapshots. |
| D5 | Verification badge surfaces existing data; no new badge tier. | Cheap surfacing. The three-tier badge from Phase 9.10 / 9.22 is sufficient. |
| D6 | Employment-verification audit chain is a read-only seeker-side surface. | Trust posture: the seeker sees what we know about the verification of their own data. POPIA s.23 alignment is automatic. |

---

## 🧪 HOW TO VERIFY

1. On `/dashboard/privacy`, toggle searchability pause for 3 months. Confirm the pause chip renders + auto-expiry is scheduled. As an employer, run a `/search` for the seeker's profession + province — confirm the seeker is excluded.
2. As the same seeker, run the auto-unpause cron with system-time fake-forwarded to past the expiry. Confirm the seeker returns to search results.
3. As a seeker, block an employer org. Confirm an audit row writes. As the employer, search for the seeker — confirm exclusion. Attempt bulk-invite including the seeker — confirm silent skip.
4. Receive an invitation. Use the three-dot menu → "Report this invite" → reason `off_platform_contact_request`. Confirm row in `moderation_reports` with the invitation reference + the seeker is admin-queue-visible.
5. Open the invitation detail; confirm the `<VacancySnapshotCard>` renders with the full spec snapshot.
6. As a seeker, receive an invitation from an `unverified` org. Confirm the verification chip + the honest-signal line render.
7. After Phase 9.23 verification resolves, view `/dashboard/profile` — confirm the audit chain line renders below the employment chip.

---

*Plan opened with Phase 11. Target: ship within 8 working days of Phase 11.2 completion.*
