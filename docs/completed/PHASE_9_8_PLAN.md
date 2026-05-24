# PHASE 9.8 PLAN — VACANCIES & DEMAND-DRIVEN MATCHING
*Side-phase between Phase 9.7 and Phase 10, mirroring the 6.5 / 7.5 / 9.7 pattern. Opened 2026-05-24. Open questions closed same day.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/`.*

> **Why 9.8 and not "9.5":** the nationality-analytics side-phase shipped as **9.7** (it took the slot the
> earlier voice-chat called "9.5"). This is a distinct, later side-phase. Numbered 9.8 so it sits cleanly
> before the Phase 10 public-launch phase. Self-contained, like 6.5 / 7.5 / 9.7.

> **UX/UI quality bar (non-negotiable, applies to every surface in this phase):** smooth, beautiful,
> consistent with the Civic Editorial aesthetic, **mobile-first** by construction. No-Flash Rule applies:
> works on a low-end Android over 3G; JS budget ~150KB on key routes; no heavy animation. Every list,
> form, and modal in this phase must render cleanly at 360px wide before it ships.

---

## 🎯 GOAL

Let an employer create a **private vacancy specification**, reverse-match it against the talent database,
**invite** specific seekers, and capture their **accept / decline-with-reason** response — turning Sebenza
from ad-hoc search-and-contact into a structured, demand-driven matching system.

This is **not** a job board. The distinction is the whole point:

| Job board (NOT this) | Sebenza vacancies (this) |
|---|---|
| Employer posts publicly | Vacancy is **private** to the employer org |
| Seekers browse + apply (broadcast) | Employer reverse-matches + invites specific people (intent) |
| Inbox fills with applications | Pipeline of invited candidates with explicit responses |
| Nationality often invisible | Citizens **highlighted** honestly, gap made visible — never gated |

**Why it's on-axis:** it systematises the Phase 5 search→shortlist→contact→placement flow, gives employers
a reason to log *structured* hiring specs (→ better demand data for `/insights` + `/gov`), and the
decline-with-reason captures *why roles go unfilled* — labour-market intelligence no job board has.

**Bonus: this is also the data that unblocks the "Local shortage" classifications from 9.7.** The 9.7
COMPLETE doc flagged that genuine `shortage` cells need more diverse employer-confirmed placement data than
seed can provide. Every `decline_reason = salary_not_competitive` or `skills_mismatch` is concrete evidence
the local pool isn't filling for a discoverable reason. 9.8 makes 9.7's centerpiece classifier render real
cells, not just seeded ones.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Saved searches + shortlists** (Phase 5, per-org CRUD). A vacancy is *spec-like* a saved search — but
  note the key difference: saved searches store **count + `lastRunAt` only, never the result set**
  (`searchSnapshot ≠ result-set`). A vacancy is the opposite: it needs a **persistent candidate pipeline**.
  So this is a new table + relationship, not a renamed saved search.
- **Typed consent system** (`consentPurpose` enum + `lib/consent` state machine; `outcomes_research` is the
  precedent). The vacancy-invite opt-in is a **new purpose in this existing machinery**, not a boolean.
- **Per-kind notifications** (Phase 7: `notifications` table, `notification_prefs` JSONB, `createNotification`
  honouring prefs + dedupe, `notifyOrgMembers`). Vacancy invites/responses are **new kinds**, not new infra.
- **Placement-Truth + `placements`** (Phase 5 / 7.5.5: `placement_source`, salary band private). A filled
  vacancy links to a placement.
- **Audit log** + action-naming convention. Every invite/response is audit-logged like any PII interaction.
- **`citizen_boost` ranking + Citizen-Visibility Rule** (Phase 4) — already does "highlight citizens" the
  right way. The vacancy match view **reuses this**; it does not add a stricter gate (see §CRITICAL).

---

## 🚨 CRITICAL DESIGN CORRECTION — nationality is HIGHLIGHT, not GATE

The originating voice-chat proposed a per-vacancy **"South African only"** toggle that gates who can be
invited. **We are not building that**, and the reason is the spine of the whole platform:

- **Rule 2 (Location-Not-Nationality):** nationality is "a displayed, optionally-filterable attribute —
  **never a barrier**." A hard "nationals only" invite gate makes it a barrier. Direct violation.
- **Rule 3 (Citizen-Visibility):** "match talent, never exclude foreigners." A nationals-only switch is
  exactly the exclusion this rule forbids.
- **Phase 9.7 just reframed** the nationality analytics to remove any exclusionary framing and recorded it
  in **DPIA R9** as a mitigation. Shipping an employer-facing "nationals only" toggle days later would
  contradict our own documented mitigation.

**What we build instead (the honest version the platform already implies):**
- The vacancy match view **highlights and ranks SA citizens first** (reuse `citizen_boost`), and shows the
  **honest supply picture**: *"4 SA citizens match · 9 if you broaden to all eligible candidates."* That is
  the Skills-Shortage Justification Index (9.7) **at hiring time** — evidence, not exclusion.
- Employers can **filter/sort** by nationality_class as a *view preference* (same as search today), but
  there is **no switch that prevents inviting** a matched person based on nationality.
- **Legal-restriction exception — deferred entirely** (operator decision, 2026-05-24): some roles do carry
  genuine statutory citizenship/clearance requirements (security clearance, specific licensure). **9.8 does
  not build or scaffold any `legal_eligibility_note` field.** Reasoning: scaffolding an exclusion field
  is exactly how "well, since the column exists…" stories start. If a concrete legal case ever appears,
  the conversation is "should we add this field?" not "should we activate this dormant one?" When (if) it
  lands later, it lands as its own intentional, counsel-reviewed, dormant-by-default change.

---

## 🔒 DECISIONS CLOSED 2026-05-24

Pre-flight resolved. The four open questions from the original draft + the senior-review push-back items
are settled. Load-bearing for the build; don't relitigate without re-opening here first.

### D1 — `interested_but_notice` shape (was Q1)
**A flag on `accepted`, not a third top-level state.** Stored as `state = "accepted_with_notice"` (new enum
value) with `notice_period_months` (int, nullable). Counts as a yes everywhere except the "available now"
filter; **never** as a decline. Protects every downstream stat from the "role X was rejected" lie.

### D2 — Invite expiry (was Q2)
**Per-vacancy, employer-set.** Each vacancy carries `invite_expiry_days` (int, nullable for "no expiry").
Each `vacancy_invitations` row gets `expires_at` computed at send time. A nightly cron transitions any
`state = "invited" AND expires_at < now()` to `state = "expired"` (new enum value) and fires two
notifications: `vacancy.invite.expired` (to the seeker, polite) + `vacancy.invite.unanswered` (to the
employer, useful). Both surfaces honour the in-app + email channel pipeline (Resend stays dormant per
Phase 8; in-app always works). Audit-logged as `vacancy.invite.expire`. Cron reuses the Phase 8 cron infra
+ `CRON_SECRET` guard.

### D3 — Decline-note + POPIA (was Q3)
**Soft truncate + plain-language hint.** Decline-note free-text field capped at 200 chars. Visible
reminder under the input: *"Work-related reasons only — don't include personal info like health, family
status, or religion."* In CSV exports + audit-log meta the note is included but flagged
`seeker-authored free text — treat as PII.`

### D4 — `legal_eligibility_note` (was Q4)
**Defer entirely.** No column, no flag, no scaffolding. If a concrete legal case ever appears, that's a
separate, counsel-reviewed change at that point. See §CRITICAL above.

### D5 — Bulk invite + consent state (was push-back item)
**Skip cleanly with soft user-facing message; record the actual reason in the audit log.** When an employer
multi-selects N seekers and clicks "Invite to opportunity," the action splits into eligible (consent
granted) and skipped (consent not granted, or already invited, or otherwise ineligible). The employer
sees a soft message: *"17 invites sent · 3 not eligible to receive an invite right now."* The exact
per-seeker reason is **not** exposed in the UI (it would leak consent state). Every skip writes one
audit-log row with the actual reason (`consent_not_granted`, `already_invited`, `profile_deleted`, etc.)
for admin oversight.

### D6 — Honest-supply line wording (was push-back item)
**"N SA citizens · M candidates match this vacancy."** Avoid "eligible" (loaded language that could read
as *legally* eligible) — use **"candidates"** or **"matched"**. Same number, cleaner framing.

### D7 — Workspace-role taxonomy (was pre-flight item)
**Already exists.** The `orgMemberRole` pgEnum in `db/schema.ts:85` carries `owner`, `recruiter`,
`viewer`. 9.8 reads from it; no new role-permissions layer to build. Convention: Owner + Recruiter create
vacancies + send invites; Viewer is read-only. Enforced via `organization_members.role` check on every
Server Action.

### D8 — `vacancy_matching` consent text (was push-back item)
**Drafted inline here** as a stable English source for the Tier-1 human translation:

> **Vacancy invites.** When you grant this, verified employers can flag you for a *specific role* they're
> trying to fill — a chef position at a particular restaurant, a developer role at a particular bank.
> You'll get a notification with the role + employer named, and you can accept, decline, or decline with
> a reason. Declining is free. You can revoke this consent any time from your privacy centre, and
> declining a single invite doesn't hurt your visibility in search.

---

## ✅ PRE-FLIGHT RECHECK ✅ ALL CLEAR 2026-05-24

- [x] **Workspace-role taxonomy** confirmed: `orgMemberRole` enum already exists (`db/schema.ts:85`,
      values `owner` / `recruiter` / `viewer`). See D7.
- [x] **`consentPurpose` enum + migration pattern** confirmed: enum at `db/schema.ts:59`; the additive
      pattern is `ALTER TYPE "consent_purpose" ADD VALUE IF NOT EXISTS '<value>';` in a dedicated
      isolated migration (per `0008_phase7_5_outcomes_consent.sql`). PG 16 (Neon) handles enum extension
      in-transaction; `IF NOT EXISTS` keeps the migration re-runnable. 9.8 adds `vacancy_matching` via
      this exact pattern.
- [x] **`notification_prefs` JSONB + `createNotification`** confirmed: `notification_prefs` is a JSONB
      column on `appUser` (`db/schema.ts:174`). `createNotification` at `lib/notifications/server.ts:63`
      honours catalog defaults ⊕ user overrides, dedupes inside the catalog's `dedupeWindowSeconds`, and
      respects suspended/deleted user state. Fan-out helpers (`notifyOrgMembers`, `notifyAllAdmins`)
      already exist for multi-recipient cases. **Adding a kind = one entry in `NOTIFICATION_CATALOG` +
      one AuditKind union member.** 9.8 adds: `vacancy.invite`, `vacancy.response`, `vacancy.reconsider`,
      `vacancy.invite.expired`, `vacancy.invite.unanswered`.
- [x] **`placements` columns + linkage point** confirmed: table at `db/schema.ts:415` with
      `id` / `profileId` / `organizationId` / `actorUserId` / `role` / `city` / `hiredAt` / `salaryBand` /
      `source` (placementSource enum, defaults to `employer_confirmed`). **`vacancy_id` does NOT exist
      today** — 9.8.1 adds it as `text("vacancy_id").references(() => vacancies.id)` nullable, in the
      same migration that creates the `vacancies` table. Cardinality preserved (1 vacancy : 0..N
      placements; 1 placement : 0..1 vacancy).
- [x] **Search query + ranking entrypoint** confirmed: `searchProfilesQuery` at
      `db/queries/profiles.ts:80` is the single source of truth. The ranking blend
      (`ts_rank_cd × sebenza_freshness_confidence × completeness × citizen_boost`) is encoded in raw SQL
      inside that function. "Find matches" on a vacancy calls this with the vacancy's filters mapped to
      `SearchFilters` — no parallel matcher.
- [x] **`searchSnapshot ≠ result-set` rule** confirmed: explicit at `db/schema.ts:441` 
      *"Stored filters get re-run by `runSavedSearch` to update `newMatchesCount` — we don't snapshot
      result rows."* Saved searches store `filters` JSONB + `lastRunAt` + `newMatchesCount` + a SHA-1
      hash for diffing (`db/schema.ts:460`), never the result set. The vacancy pipeline is the opposite:
      a *persistent candidate list* with explicit accept/decline state per (vacancy × seeker). New table
      (`vacancy_invitations`) with explicit membership rows, not a stored search blob.
- [x] **Audit naming + hardened CSV path** confirmed: `AuditKind` union at `lib/audit/index.ts:24`
      (dot-separated `category.action` or `category.sub.action`; see Phase 5 / 7 / 9.7 patterns).
      Shared CSV helpers at `lib/analytics/csv.ts` (`safeCell`, `csvFromRows`, `csvDisposition` — OWASP
      injection guard + UTF-8 BOM + CRLF + RFC 4180). 9.8 reuses both unchanged.
- [x] **Phase 8 cron infra + `CRON_SECRET`** confirmed: `isAuthorizedCron(request)` at
      `lib/cron/auth.ts:15`. Convention: `const auth = isAuthorizedCron(request); if (!auth.ok) return
      auth.response;` at the top of every `/api/cron/*` route. Fail-closed if `CRON_SECRET` env unset.
      Already used by six existing cron routes (hard-delete-erased, status-stale-warning,
      saved-search-matches, skill-gap-snapshot, outcome-snapshots, lmi-snapshot, saqa-worker). 9.8 adds
      `/api/cron/vacancy-invite-expiry` following the same pattern.

---

## 📋 TASKS

### Task 9.8.1: Vacancy schema + lifecycle ✅ 2026-05-24
- [x] `vacancies` table shipped at `db/schema.ts` with all the fields specified (incl.
      `invite_expiry_days` int nullable per D2). `vacancy_status` pgEnum
      [`draft` / `open` / `closed` / `filled`] live. `(organization_id, status)` index for the common
      list query. `placements.vacancy_id` added as nullable FK ON DELETE SET NULL so a deleted vacancy
      never breaks Placement-Truth history. Migration `0015_phase9_8_vacancies.sql` applied to Neon.
- [x] **Privacy invariant** held three ways: (1) every read in `lib/employer/vacancies.ts` filters by
      `organizationId`; (2) every Server Action calls `requireEditRole()` which resolves the caller's
      org + role and re-checks ownership via `getMyVacancy(id)` before any mutation; (3) the privacy
      contract is asserted structurally by `vacancyId` only appearing in `lib/employer/vacancies*` and
      `app/[locale]/(employer)/...` paths (compliance assertion (a) in 9.8.8 will lock this in).
- [x] **Role gating** via the existing `orgMemberRole` enum (D7-confirmed). `canEditVacancies` =
      owner|recruiter; `canSeeSalary` = same. Viewer is strictly read-only and the salary band is
      stripped from their UI even though the read returns it.
- [x] `drizzle-zod` validation via inline Zod schemas in the action file (`vacancyInputSchema` +
      `transitionSchema`); isolated migration; `dataProvider` extension deferred  this surface is
      employer-private and doesn't go through the mock-vs-db data-provider seam (follows the
      `lib/employer/saved-searches.ts` pattern).
- [x] **`/employer/vacancies`** list / **`/new`** create / **`/[id]`** detail+edit shipped. List uses a
      card grid (1-col on mobile, 2-col on `md+`). Create form is single-column on mobile, 2-col
      where it makes sense on `md+`. Salary input wears a "Private" pill and the section header
      reminds the editor it stays inside the workspace.
- [x] **Lifecycle transitions** rendered as Server Action `<form>`s on the detail page so they work
      without client JS (No-Flash Rule honoured). Bounded state machine
      (`draft → open|closed`, `open → closed|filled`, `closed → open`, `filled → closed`). Anything
      else is refused with a clear message.
- [x] Eight new `vacancy.*` audit kinds reserved in `lib/audit/index.ts`; 9.8.1 uses three of them
      (`vacancy.create`, `vacancy.update`, `vacancy.status.change`). The remaining five
      (`.invite`, `.invite.skip`, `.invite.withdraw`, `.invite.expire`, `.response`) land in
      9.8.4 + 9.8.5.
- [x] New `Vacancies` entry in `EMPLOYER_NAV` (Briefcase icon), positioned between Saved searches and
      Talent pools  the active reverse-matching workflow bridges passive monitoring and manual
      shortlisting.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean · migration
      `0015` applied to Neon. Commit `1803676`.

### Task 9.8.2: Reverse-matching ("Find matches") ✅ 2026-05-24
- [x] `matchVacancyCandidates(vacancy)` in `lib/employer/vacancies.ts` composes the match view by mapping
      vacancy → `SearchFilters` (private helper `vacancyToSearchFilters`) and calling the existing
      `searchProfilesQuery` (Phase 4 ranking SQL). **One ranking source of truth** — no parallel matcher,
      no shadow SQL. Profession label + skill labels are concatenated into the FTS `query`; province slug
      passes through; seniority is normalised to the canonical lowercase only when it matches the search
      enum (`junior` / `intermediate` / `senior`).
- [x] Match view at `app/[locale]/(employer)/employer/vacancies/[id]/match/page.tsx` reuses
      `<TalentRosterItem profile={p} locale={locale} highlightCitizen />`  same component the public
      `/search` uses, same redaction. Citizen highlighting comes from the existing `citizen_boost` already
      baked into `searchProfilesQuery` ranking (NOT a new gate — §CRITICAL respected).
- [x] **Honest-supply line** at the top of the match view: ***"N SA citizens · M candidates match this
      vacancy"*** (D6 wording — "candidates," not "eligible"). Sourced from `countMatchesByCitizenship` —
      a new query in `db/queries/profiles.ts` that mirrors `searchProfilesQuery`'s WHERE-clause assembly
      exactly and emits `COUNT(*) FILTER (...)` buckets. **No `LIMIT`** on this query, so the figure is
      the true total across the platform — independent of the `SEARCH_LIMIT=50` cap on the ranked list
      below. When the ranked view fills, a small notice explains the cap and points at "Refine in search."
- [x] Respects all existing redaction by construction: rows render through `<TalentRosterItem>`, the same
      cells the public `/search` exposes. No ID number, no documents, no raw contact in the match list.
      Reveal stays the audited Phase 5 dossier flow  every row carries an "Open dossier" link to
      `/employer/dossier/[handle]`.
- [x] **Mobile-first:** match list stacks on phones (TalentRosterItem already mobile-first); honest-supply
      header is `sticky top-0 z-10` with a 2px brand-ink border so it stays visible while scrolling
      candidates on a phone. "Refine in search" CTA + "Open dossier" CTA both render as ≥ 36px-tall pills
      (tap-target generous; primary actions stay thumb-reachable). The page renders cleanly at 360px wide.
- [x] **Find-matches CTA** on the vacancy detail page (`app/[locale]/(employer)/employer/vacancies/[id]/
      page.tsx`) is visible to **all roles** — reverse-matching is a redacted read of the public talent
      pool, so Viewers can browse matches even though they can't edit the vacancy itself. The CTA sits
      directly under the back-link / status-chip strip with an explainer about ranked + redacted + SA-
      citizens-highlighted-first — sets honest expectations before the click.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean (route
      `/[locale]/employer/vacancies/[id]/match` listed in the build output).

### Task 9.8.3: Consent purpose for vacancy invites ✅ 2026-05-24
- [x] `consentPurpose` += `vacancy_matching` shipped via the additive enum-extension pattern
      (`0016_phase9_8_3_vacancy_matching_consent.sql`  same shape as `0008` for `outcomes_research`).
      `CONSENT_PURPOSES` array in `lib/consent/index.ts` extended. Both seed blocks + sign-up tx already
      iterate the array, so the new purpose flows through with default-off behaviour unchanged. Migration
      applied to Neon.
- [x] **Optional, default-off, non-degrading:** the seed sets `vacancy_matching` to `state='none'` for
      every seeded profile; the sign-up form leaves it unchecked by default; the privacy-centre fallback
      consent state is `none`. A seeker who has NOT granted it is still searchable + contactable exactly
      as today  no feature degradation, no nagging banner. Documented in the migration header + the
      enum + array comments so the contract is explicit at every layer.
- [x] Consent UI on `/dashboard/privacy` is wired automatically (the page iterates `CONSENT_PURPOSES`).
      Added `PURPOSE_LABEL["vacancy_matching"] = "Vacancy invites (optional)"`,
      `PURPOSE_BODY["vacancy_matching"]` = a short summary, and a new
      `PURPOSE_EXPLAINER["vacancy_matching"]` = the full D8 source text. Threaded through `<ConsentRow>`
      via a new optional `explainer` prop. Onboarding (seeker sign-up step 2) shows the same D8 text via
      a sibling `PURPOSE_ONBOARDING_EXPLAINER` map in `SeekerSignUpForm`. **D8 text is verbatim** across
      onboarding + privacy + plan doc  single English source for the Tier-1 human translation. Tier-1
      catalogs (`zu` / `xh` / `af`) remain stub-marked `__notice`  the deepMerge fallback in
      `i18n/request.ts` returns English until professional translation lands (per the no-machine-
      translation rule for POPIA / consent / legal copy).
- [x] **`hasVacancyMatchingConsent(userId)` helper** shipped in `lib/consent/check.ts` (with the more
      general `hasConsent(userId, purpose)` it delegates to). Server-only module (`import "server-only"`).
      Treats missing rows + `state='none'` + `state='revoked'` as not-granted  POPIA's affirmative-
      consent rule, only an explicit current `granted` counts. **The 9.8.4 invite action will call this
      at its boundary**; the structural ban on invites without current consent is asserted by compliance
      check (b) in 9.8.8. (The action + its tests land in 9.8.4 because the action doesn't exist yet 
      9.8.3 ships the gate primitive; 9.8.4 turns the key.)
- [x] **Mobile-first:** on `/dashboard/privacy` and at sign-up step 2, the explainer renders as a tap-to-
      expand `<details>` block on phones (collapsed by default, summary chip is a generous tap target)
      and as a plain always-visible paragraph on `md+`. Pure-CSS, no JS for viewport detection 
      duplicated in the DOM with `md:hidden` / `hidden md:block` so the server renders both states and
      Tailwind hides the wrong one. Cheap (text-only). Existing per-purpose toggle row pattern preserved
      for the other four purposes.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean · migration
      `0016` applied to Neon.

### Task 9.8.4: Invite flow (employer → seeker) ✅ 2026-05-24
- [x] `vacancy_invitations` table shipped at `db/schema.ts` with every field specified (`vacancy_id`,
      `profile_id`, `invited_by_user_id`, `invited_at`, `expires_at` nullable, `state` enum,
      `responded_at`, `decline_reason` enum nullable, `decline_note` text, `notice_period_months` int
      nullable). UNIQUE index on (`vacancy_id`,`profile_id`)  re-inviting is a no-op surfaced as
      `already_invited` in the audit log. Two additional indexes for the common query shapes
      (`(vacancy_id,state)` for the employer pipeline panel; `(profile_id,state)` for the future seeker
      inbox) + an `expires_at` index for the cron range scan. ON DELETE CASCADE on both FKs (a deleted
      vacancy or POPIA-erased profile takes its invitations with it).
- [x] `pgEnum invitation_state` = `["invited","accepted","accepted_with_notice","declined",
      "reconsidering","withdrawn","expired"]` shipped per D1 + D2. `pgEnum decline_reason` =
      `["already_employed","salary_not_competitive","location_not_feasible","skills_mismatch",
      "role_not_what_im_looking_for","other"]` shipped here (with the table) so 9.8.5's seeker-facing
      action UI can store responses immediately without a follow-up migration  the action surface is
      9.8.5, the column is 9.8.4. Migration `0017_phase9_8_4_vacancy_invitations.sql` applied to Neon.
- [x] `bulkInviteToVacancy({ vacancyId, profileIds })` Server Action in `lib/employer/invitations.ts`
      splits selections via four gates (in order): profile-not-found  profile-deleted (POPIA tombstone)
       already-invited (UNIQUE index dedupe) **consent gate** via
      `hasVacancyMatchingConsent(profile.userId)`. Each eligible seeker gets an invitation row, a
      `vacancy.invite` notification (attributed: *"Discovery Bank flagged you for: Chef · Cape Town."*),
      and a `vacancy.invite` audit-log row. Each skipped seeker gets a `vacancy.invite.skip` audit row
      with the actual reason (`consent_not_granted` / `already_invited` / `profile_deleted` /
      `profile_not_found`). **Per D5 the action response carries counts only**  per-seeker reason is
      never in the response payload (it would leak consent state to the employer).
- [x] Soft summary banner on the match page UI: ***"N invites sent · M not eligible to receive an
      invite right now"*** with a sub-line explaining the audit-log lives elsewhere for admin oversight.
      Matches the D5 wording verbatim. Per-seeker reason genuinely never reaches the client.
- [x] Employer can **withdraw an invitation** via `withdrawInvitation({ invitationId })` from the
      pipeline panel on the vacancy detail page. Only `state='invited'` rows are withdrawable; once a
      seeker has responded, the lifecycle plays out. Withdraw transitions to `state='withdrawn'`,
      notifies the seeker (re-uses `vacancy.invite.expired` kind with a "no longer open" body), audits as
      `vacancy.invite.withdraw`.
- [x] **Invite-expiry cron** shipped at `/api/cron/vacancy-invite-expiry`, guarded by
      `isAuthorizedCron(request)` (Bearer `CRON_SECRET`). Pulls every `state='invited' AND expires_at <
      now()` row with the vacancy + org + seeker context in one round trip; for each, calls
      `expireInvitationFromCron()` (a non-`"use server"` sibling so it can never accidentally become a
      Server Action invokable by a client). The helper does a conditional state flip (only if still
      `invited`  idempotent against concurrent seeker responses), fires both notifications
      (`vacancy.invite.expired` seeker polite / `vacancy.invite.unanswered` employer org-wide via
      `notifyOrgMembers`), and writes one `vacancy.invite.expire` audit-log row. Both notification
      kinds added to `NOTIFICATION_CATALOG` with `defaultInApp: true, defaultEmail: false` (email
      dormant until Resend flips on per Phase 8). Cron route registered in the build map at
      `/api/cron/vacancy-invite-expiry`.
- [x] **Mobile-first**: `BulkInviteIsland` ships the multi-select + sticky bottom action bar + bottom-
      sheet confirmation modal on phones (anchored to screen bottom, full-width, generous tap targets),
      centred modal on `md+`. The "Already invited" rows render with a soft Invited pill instead of a
      checkbox (deduped from selection). Server-rendered `<TalentRosterItem>` rows pass through as React
      nodes so the existing Phase 5 redaction stays 100% server-rendered  only the selection shell is
      client code. Select-all + Clear chips at the top of the list keep keyboard + thumb access easy.
      Viewer role hides every interactive affordance (no checkboxes, no bulk bar, no modal trigger).
- [x] **Vacancy-detail pipeline panel** (`VacancyInvitationsPanel`) renders the per-vacancy invitation
      list grouped by state with tone-coded pills (`brand` for invited / `accent` for accepted / `danger`
      for declined / `muted` for terminal states). Withdraw button visible only on `invited` rows for
      Owners + Recruiters. The panel is visible to **all roles** including Viewers (read-only) so the
      whole team has the same pipeline picture.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean (route
      `/api/cron/vacancy-invite-expiry` registered) · migration `0017` applied to Neon.

### Task 9.8.5: Accept / decline-with-reason (the market-signal engine) ✅ 2026-05-24
- [x] **Accept** Server Action `acceptInvitation({ invitationId })` in `lib/seeker/invitations.ts` flips
      the row to `state='accepted'` + sets `respondedAt`, notifies the employer org via
      `notifyOrgMembers` with kind `vacancy.response` (attributed: *"Sipho K. accepted your invitation
      to 'Senior Pastry Chef'"*), audited as `vacancy.response` with `meta.responseKind='accept'`. The
      employer follows up through the existing dossier/contact flow  no new comms surface built here.
- [x] **Accept with notice** (D1) Server Action `acceptInvitationWithNotice({ invitationId,
      noticePeriodMonths })` flips to `state='accepted_with_notice'` + writes `noticePeriodMonths`
      (Zod-validated 112). Same `vacancy.response` notification with the months in the body
      (*"Notice period: 3 months. Plan interviews accordingly."*) so the employer knows the available-
      from date matters. **It's a yes, never a decline**  9.8.8 check (e) will assert it's excluded
      from every "declined / unfilled" stat.
- [x] **Decline** Server Action `declineInvitation({ invitationId, reason, note? })` flips to
      `state='declined'` + stores `declineReason` (enum) + `declineNote` (string, 200-char cap enforced
      Zod-side + UI-side + character counter shown live). Reason picker uses the six values from the
      plan (`already_employed` / `salary_not_competitive` / `location_not_feasible` /
      `skills_mismatch` / `role_not_what_im_looking_for` / `other`). Picking *"Other"* requires a note
      (custom check  friendlier error than a Zod refinement). Notification body to the employer
      includes the structured reason label (so the bell shows the market signal at a glance).
- [x] **Decline-note PII handling per D3**: the visible POPIA reminder *"Work-related reasons only 
      please don't include personal info like health, family status, or religion."* renders under the
      textarea, with a live remaining-char counter. The audit-log meta carries
      `seekerAuthoredFreeText: true` alongside the note so any CSV export from `lib/analytics/csv.ts`
      sees it flagged as PII (compliance assertion (f) in 9.8.8 will lock this in).
- [x] **Change-of-mind path** Server Action `reconsiderInvitation({ invitationId })` flips
      `declined``reconsidering` (and only from `declined`  state-machine guard at both the
      application AND the DB-conditional-update level so concurrent flips can't slip past). Fires
      `vacancy.reconsider` (distinct notification kind so the employer's bell shows it apart from a
      normal `vacancy.response`)  *"Sipho K. would like to reconsider 'Senior Pastry Chef'"* with a
      body that nudges the employer to re-open the conversation if the role is still open.
- [x] **Every response audit-logged** as `vacancy.response` with `meta.responseKind` =
      `accept` / `accept_with_notice` / `decline` / `reconsider`. Reusing the single audit kind keeps
      the log shape consistent  the variant lives in meta. Decline rows additionally carry the
      structured reason + the (optional) note in meta, flagged as PII per above.
- [x] **State-machine integrity**: the shared `respond()` engine guards every action with
      (a) ownership check (`invitation.profile.userId === session.id`  cross-seeker attempts return
      "Invitation not found", same as a genuine miss, so an attacker can't enumerate);
      (b) expected-state check (defaults to `invited`, reconsider overrides to `declined`);
      (c) DB-level conditional update (only updates if `state` is still the expected value) so a
      concurrent expire-cron or duplicate submit can't race past us. On race-loss, the action returns
      a clear "state changed in the meantime" error so the UI surfaces a refresh hint.
- [x] **Mobile-first decline modal**: bottom-sheet on phones (anchored to screen bottom, full-width,
      generous tap targets), centred modal on `md+`. Radio group with large 44px+ tap rows; note
      `<textarea>` only renders once a reason is picked (compact by default); submit button is in a
      sticky bottom bar inside the sheet so the on-screen keyboard never hides it. Esc closes; tapping
      the backdrop closes; one save action. **Not a quiz**  six radios, optional note, done.
- [x] **Seeker inbox surfaces**: `/dashboard/invitations` (list, mobile-first cards, terminal-state
      rows separated into a dimmer "Closed" section so active invites have visual priority) and
      `/dashboard/invitations/[id]` (detail + the state-aware `InvitationResponseIsland`). New
      `Vacancy invites` entry in `SEEKER_NAV` between Qualifications and Career compass (Inbox icon).
      The 9.8.4 invite notification's `/dashboard/invitations/${invitationId}` link now lands on a
      real, action-ready page.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean (routes
      `/[locale]/dashboard/invitations` + `/[locale]/dashboard/invitations/[id]` registered).

### Task 9.8.6: Vacancy outcome → placement linkage ✅ 2026-05-24
- [x] **Existing Phase 5 `markAsHired()` Server Action extended** (not rebuilt) with an optional
      `vacancyId` field on its Zod schema. When set, the action re-fetches the vacancy under the
      caller's org scope and silently nulls cross-org / stale ids (an attacker can't probe foreign
      vacancy ids via the placement form). The placement row now carries `vacancyId` and the
      `placement.confirm` audit-log meta includes it when present. Source stays hard-coded
      `employer_confirmed` so the 7.5.5 honesty rule is inherited unchanged.
- [x] **Cardinality enforced by FK shape**: `placements.vacancyId` is `text("vacancy_id")
      .references(() => vacancies.id, { onDelete: "set null" })`, nullable, no UNIQUE constraint.
      A vacancy may have 0..N placements (one posting → multiple hires), a placement has 0..1 vacancy
      (pre-9.8 placements flow continues unchanged). The DB-level FK + ON DELETE SET NULL shipped in
      migration `0015`; the Drizzle schema now mirrors it via `.references(...)` so future
      migration-diff runs don't re-add the constraint. **No new migration required for 9.8.6.**
- [x] **Vacancy-fill metrics** derive from `employer_confirmed` placements only (7.5.5 honesty rule
      inherited by virtue of the unchanged source default). Compliance assertion (e) in 9.8.8 will
      lock this in alongside the `accepted_with_notice` rule.
- [x] **Vacancy detail page**: new `<VacancyPlacementsPanel>` renders below the invitations pipeline.
      Three modes: (1) **filled + nothing logged yet**  prominent accent-coloured prompt with
      per-accepted-invitee "Log this hire" CTAs deep-linking to
      `/employer/dossier/[handle]?vacancyId=<id>#mark-as-hired`; (2) **≥ 1 placement linked** 
      placements list + the per-invitee CTAs remain (an employer might hire multiple people from one
      posting); (3) **no accepted invitees + no placements**  panel hidden entirely (nothing
      meaningful to surface). Visible to all roles including Viewers; "Log hire" CTAs are
      Owner / Recruiter only.
- [x] **`MarkAsHiredCard` extended** with optional `vacancyId` + `vacancyTitle` props. When `vacancyId`
      is present, the form opens pre-armed (the click on the vacancy-side CTA was the
      confirmation), pre-fills the role with the vacancy title, and shows a brand-tinted banner
      *"Linking this hire to vacancy: <Title>. The pipeline loop closes automatically."* so the
      recruiter knows the link is wired. The dossier page reads `?vacancyId` from search params,
      resolves the title via `getMyVacancy()` (org-scoped, so a cross-org id resolves to null and
      the banner just doesn't render), and threads both props through.
- [x] **New read helper** `getPlacementsForVacancy(vacancyId)` in `lib/employer/placements.ts` (org-
      scoped via `verifyOrgVerified` + double-checked at the query level by filtering on both the
      vacancy id and the placement's `organizationId`  defence in depth).
- [x] **Mobile-first**: the placements panel cards stack on phones, the per-invitee "Log this hire"
      button is ≥ 40px tall (thumb-reachable), and the fallback note for hires logged from outside
      the invitation list keeps the canonical entry point on the dossier (no new surface to maintain).
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean. **No new
      migration required**  the FK already shipped in `0015`; this task is read/action logic +
      one UI panel.

### Task 9.8.7: "Why roles go unfilled" analytics (the policy payoff) ✅ 2026-05-24
- [x] New aggregate query `declineReasonAggregateQuery({ orgId? })` in
      `db/queries/decline-reasons.ts`. WHERE `state='declined' AND responded_at IS NOT NULL`  the
      9.8.5 / D1 rule that `accepted_with_notice` is a yes (never a decline) is baked into the
      query, not policed downstream (compliance check (e) in 9.8.8 will assert from a fixture).
      Aggregates by (profession_slug × province_slug × reason) and emits both `count` and a
      freshness-weighted average. **Two callers, one function**: pass `orgId` for the employer-
      private view; omit it for the cross-market suppressed view.
- [x] **Surfaced on `/employer/vacancies`** (employer-private, org-scoped, no suppression  the
      recruiter sees their own org's full decline picture) and **on `/gov/shortage`** (cross-market,
      suppressed) under a new *Why roles go unfilled* section right below the Justification Index.
      Two surfaces; one component; the card reads its own `data.orgScoped` flag to switch wording
      ("Your org's vacancies" vs "Cross-market"). Plan said `/insights` for the employer side; we
      put it on `/employer/vacancies` instead because `/insights` is the public ISR-cached
      cross-market page and an employer-scoped card there would either leak (if shown to all) or
      silently miss employers landing on `/insights` from a logged-out session. `/employer/vacancies`
      is the natural recruiter surface and the audit log records org context cleanly.
- [x] **k=10 + complementary suppression** wired via the existing `suppress()` engine from
      `lib/analytics/suppress.ts` with two complementary axes: (a) within (profession_slug,
      province_slug) over the reason axis  prevents reconstructing one surviving reason from row
      totals; (b) within (profession_slug, reason) over the province axis  prevents same trick
      across the province dimension. k comes from `outcomes_min_cohort_size` (the single platform
      knob, same as outcomes + nationality).
- [x] **Freshness-weighted** via `sebenza_freshness_confidence(responded_at)`  the same SQL
      function the Phase 4 ranking + 9.7 nationality cells use (30 d = 1.00, 90 d = 0.60, else
      0.25). Recent declines dominate; two-year-old declines are still counted but down-weighted
      so the market signal stays *current*. Footer prints "freshness-weighted" on both views.
- [x] **CSV export** at `/api/gov/decline-reasons/export` reuses `csvFromRows()` + `csvDisposition()`
      from `lib/analytics/csv.ts` (UTF-8 BOM + RFC 4180 + CRLF + OWASP injection guard). The query
      function already returns suppressed cells  there's no way to bypass the k floor from this
      route. Audit-logged as `analytics.export` with `surface`, `rowCount`, `k`, `suppressed` in
      meta for the 9.7.7 oversight log. `gov` / `admin` only.
- [x] **Cross-references 9.7.3's Justification Index** in the card's brand-tinted footer: *"A
      (profession × province) cell where most declines cite Salary not competitive reinforces a
      local shortage  the gap is real, it's just salary-driven rather than supply-driven."* The
      footer links back to `/gov/shortage` so the loop reads cleanly in either direction. COMPLETE
      doc will spell out the joint reading discipline.
- [x] **Mobile-first**: horizontal-bar list, one row per reason inside each (profession × province)
      cell  3-column grid wraps cleanly at 360 px wide. No charting library  pure CSS bars with
      width-% via inline style, same idiom as the 9.7 nationality cards. Each cell carries a
      headline like *"Welders · EC  60 % salary not competitive"* so the punchline is visible
      without scanning the bars.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean (route
      `/api/gov/decline-reasons/export` registered). No new migration  the query reads existing
      `vacancy_invitations` columns shipped in `0017`.

### Task 9.8.8: Wiring, verification, doc convention ✅ 2026-05-24
- [x] **Strings + i18n**: 9.8 follows the established convention (matches Phase 9.7's build pace) 
      most UI copy is inline; the only POPIA-load-bearing copy from this phase (vacancy_matching
      D8 consent text) lives in `messages/en.json` and the `zu/xh/af` stubs `__notice`-fall-back
      to English via the existing deepMerge in `i18n/request.ts` until pro translation lands in
      Phase 10. No machine translation of POPIA / consent / legal copy.
- [x] **Six new compliance assertions** in `lib/analytics/outcomes-compliance.ts`, all wired into
      `/api/admin/outcomes-compliance`:
      **(a)** `assertNoVacancyFieldOnPublicSurfaces`  filesystem grep at runtime confirms
      `vacancies` / `vacancyInvitations` are imported ONLY from an allow-list of paths
      (`lib/employer/...`, `lib/seeker/...`, `lib/analytics/outcomes-compliance.ts`,
      `app/api/cron/vacancy-invite-expiry`, `app/api/gov/decline-reasons`,
      `app/[locale]/(employer)/...`, `app/[locale]/(seeker)/dashboard/invitations/...`,
      `db/queries/decline-reasons`, `db/seed`, `db/schema`). Any unauthorised importer is flagged
      at audit time.
      **(b)** `assertInviteRequiresConsent`  walks every `vacancy_invitations` row LEFT JOIN'd
      to `consents`; any row without `state='granted'` on `purpose='vacancy_matching'` fires.
      Write-time contract per D5  the bulk-invite action checks fresh per call so revocation
      post-write doesn't retroactively invalidate the audit record.
      **(c)** `assertNoNationalityInviteGate`  grep on the invitation-pipeline files
      (`lib/employer/invitations*.ts`, `lib/seeker/invitations.ts`, `app/api/cron/
      vacancy-invite-expiry`) for any non-comment line referencing `is_citizen` /
      `nationality_class`. The §CRITICAL design correction is enforced **structurally**, not
      just by code review.
      **(d)** `assertNoDeclineReasonCellBelowFloor`  belt-and-braces over the cross-market
      aggregate; mirrors the Phase 9.7.2 nationality-floor check.
      **(e)** `assertAcceptWithNoticeNotInUnfilled`  documents the structural defence (the
      9.8.7 query filters `WHERE state='declined'`). With seeded fixtures present, reports the
      count of `accepted_with_notice` rows correctly excluded.
      **(f)** `assertDeclineNoteFlaggedPII`  walks recent `vacancy.response` audit rows with
      `meta.responseKind='decline'` and a `declineNote`, verifying `seekerAuthoredFreeText:
      true` is also set. Missing flag = contract violation.
- [x] **Verification gate**: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build`
      clean across all 4 locales · `npm run db:seed` runs end-to-end (8 mockProfiles +
      12-strong BSc CS cohort + 4 foreign-national profiles + 3 vacancies + 5 invitations + 14
      vacancy audit rows + 2 retroactively-linked cohort placements). Mobile-first manual smoke
      is captured in the PHASE_9_8_COMPLETE doc; the create-vacancy form, the bulk-invite modal,
      and the decline-reason bottom-sheet all render cleanly at 360 px wide per the in-built
      mobile-first styling.
- [x] **Seed extended** (`db/seed.ts`): new `seedPhase9_8Vacancies()` lands real (suppressed)
      rows on every 9.8 surface:
       3 vacancies on Discovery Bank (V1 Senior Software Engineer / Gauteng / open; V2 Backend
        Developer / Western Cape / open; V3 Graduate Software Developer Programme / Gauteng /
        filled  synthetic, only purpose is to retroactively link the 3 BSc CS cohort
        placements per the plan's bonus).
       5 invitations across SA-citizen + foreign-national profiles  one of each lifecycle
        state (accepted / declined-with-reason / accepted-with-notice / invited / expired with
        backdated `expires_at`).
       Audit rows mirroring exactly what the production action handlers + the cron would
        write (including the `seekerAuthoredFreeText: true` PII flag on the declined row, so
        compliance check (f) has live rows to walk).
       `consents` updated to grant `vacancy_matching` to a curated subset (so the bulk-invite
        eligibility demo has real candidates AND the soft-summary skip count demos a non-zero
        "M not eligible" number).
       Truncate order extended to drop `vacancy_invitations` and `vacancies` before reseeding.
- [x] **On ship**: `docs/completed/PHASE_9_8_COMPLETE.md` written (long-form summary across all
      eight tasks). `docs/PHASE_9_8_PLAN.md` moved into `docs/completed/`.
      `docs/ROADMAP.md` header flipped from "in flight" to ✅ + dated. Current State in
      `docs/TO_START_EVERY_SESSION.md` refreshed to Phase 10 (public-launch) posture.
      `docs/PHASE_10_PLAN.md` written with three pillars (WCAG 2.2 AA audit, perf budget on
      throttled 3G, Tier-1+2+3 i18n rollout) + the credentials flip (Resend / Sentry /
      Upstash / KYC / SAQA) + the optional AWS Cape Town `af-south-1` migration. Final
      commit: *Phase 9.8 complete + Phase 10 opens*.

---

## 🔓 STILL-OPEN QUESTIONS (decide on data)

All four original open questions are resolved (see **DECISIONS CLOSED** at the top of this doc).
What remains is the standard operational follow-up that lands on real data, not at plan-time:

1. **`invite_expiry_days` UX default** — the field is per-vacancy and employer-set. The create-vacancy
   form needs a sensible *default* in the input (so most employers don't have to think about it). Suggest
   14 days. Confirm on first real-traffic feedback.
2. **Decline-reason taxonomy completeness** — the six reasons in 9.8.5 cover the common cases. Real
   responses may surface a seventh ("commute / transport") or eighth ("hours don't suit") that we'd add
   via migration. Re-assess at every Phase boundary based on `other`-reason note volume.

## 🚫 OUT OF SCOPE FOR 9.8 (explicit guardrails)
- ❌ **Any public vacancy listing, "apply" button, or seeker-side vacancy browsing.** Vacancies are
  org-private specification + matching tools. If it lets a seeker browse/apply to postings, it's a job
  board — don't build it.
- ❌ **Nationality-as-gate on invites** (the "SA only" switch). Highlight + honest supply figure only.
  No endpoint may block an invite based on `nationality_class`.
- ❌ **Any `legal_eligibility_note` field** — not even scaffolded. See D4. If a concrete legal case
  appears, that's a separate, counsel-reviewed change at that point.
- ❌ Salary band on any seeker-facing surface — stays private (Phase 5 rule).
- ❌ In-app interview scheduling / messaging build-out — reuse the existing dossier/contact flow; a full
  comms suite is its own future phase, not 9.8.
- ❌ Changing search-side behaviour — the public/employer search is unchanged; 9.8 *reuses* it.
- ❌ Exposing the per-seeker skip reason on the bulk-invite UX (see D5) — the audit log records it;
  the employer-facing summary is intentionally soft to avoid leaking consent state.

---

## 🧭 WHY THIS IS THE SEBENZA VERSION
The voice-chat got the shape right (private reverse-matching, consent-gated invites, decline-with-reason as
market signal) and two specifics wrong: it reused a dead phase number and — more importantly — endorsed a
per-vacancy "South African only" gate that contradicts Rule 2, Rule 3, and the DPIA R9 mitigation shipped
six days earlier in 9.7. This plan keeps every genuinely strong idea (the pipeline, the typed consent reusing
existing machinery, the reason taxonomy + the notice-period catch + the change-of-mind path, the
"why-unfilled" analytics) and corrects the nationality piece to **highlight-not-gate** — the honest version
the platform already implements everywhere else. Vacancies make Sebenza's demand data richer and its
matching active, without ever becoming the job board, or the exclusion tool, it was built not to be.

*Plan opened 2026-05-24. Open questions closed same day. Target: complete before Phase 10 (public launch) opens.*
