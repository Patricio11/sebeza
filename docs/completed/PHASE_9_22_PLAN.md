# PHASE 9.22 PLAN — Seeker employer picker + organisation suggestion queue

*Plan opened 2026-05-29. Companion: `docs/ROADMAP.md`. Targets sign-off before code lands.*

---

## 🎯 WHAT THIS PHASE IS

Today a seeker who declares `status='employed'` at sign-up tells the platform *that* they're employed but nothing about *where*. The matcher / outcomes / national LMI numbers have no idea that 12 of our open seekers actually work at Capitec, or that "Acme Lodge" hires three of our seasonal chefs each December. Equally, the recruiter side has no way to tell, when they invite Thandeka to a Pick n Pay vacancy, that she's already at Shoprite — because we never asked.

Phase 9.22 closes that gap in **one shippable change** that reuses the Phase 9.15 "Other"/`taxonomy_suggestions` pattern wholesale:

- When the seeker picks `employed` or `self_employed` at sign-up (or on the dashboard editor), optional fields appear: **employer** (searchable combobox), **start date** (year + month), **city** (existing taxonomy).
- The employer picker spans the existing `organizations` table — both Sebenza-recruiting employers (Phase 9.10 KYC'd) AND seeker-named organisations that have been admin-verified. Picker visually distinguishes the two so we never lie about verification state.
- "Other" creates a pending `organizations` row + a `taxonomy_suggestions` row with `kind='organisation'` — same lifecycle as 9.15's profession / institution path.
- Admin queue at `/admin/taxonomy/suggestions` gains an Organisations tab. Admin verification is **real work** (D4): admin looks up the company, contacts them if needed, fixes typos in the name + city before promoting. Promote / Merge / Reject mirror 9.15 exactly.
- Promotion of a seeker-named org to "verified seeker-named" makes it appear in future pickers. It does NOT grant vacancy-posting rights — that still requires the org to sign up via the existing Phase 9.10 KYC flow (D7).

Phase 9.23 (follow-up, separate phase): the opt-in employment-verification flow where the seeker shares the contact person + email and Sebenza emails them once for explicit verification. This phase stays POPIA-clean by not capturing any third-party PII.

---

## 🔒 LOCKED DECISIONS

### D0 — Sebenza grows employer coverage organically; doesn't conflate "named" with "recruiting"

The `organizations` table gains a two-state axis:
- **Sebenza-registered** (existing): the org actively uses the platform, completed Phase 9.10 KYC, can post vacancies + invite seekers.
- **Seeker-named** (new): the org was created from a seeker's "Other" submission, admin-verified, named on N seeker profiles. Cannot post vacancies. May or may not eventually sign up.

The two are visually distinguished everywhere they surface. Promoting a seeker-named org to Sebenza-registered status is NOT automatic; it requires the org's own admin to sign up + complete KYC, same as any other employer onboarding.

### D1 — Reuse Phase 9.15 `taxonomy_suggestions` with `kind='organisation'`

`ALTER TYPE taxonomy_suggestion_kind ADD VALUE 'organisation'`. The full Phase 9.15 lifecycle (submit → pending → promoted / merged / rejected) carries over: rate-limit, dedupe-by-lower-name, admin notification, audit trail. Zero new server actions; the existing five (`submit`, `listPending`, `promote`, `merge`, `reject`) extend with org-kind branches.

### D2 — Seeker form gains optional employment fields when status is `employed` or `self_employed`

Three fields, all optional:
- **Employer** (searchable combobox over Sebenza-registered + verified-seeker-named orgs). "Other" path creates a pending org.
- **Role started** (year + month picker; we don't need day-level precision and the seeker often won't remember).
- **City** (existing province → city dropdown; pre-fills from the seeker's residence city but is editable since some commute across provinces).

For `self_employed`, the same fields apply — the employer is the seeker's own business / sole prop. We don't try to validate "is this person actually the owner" — same posture as every other self-declared field.

### D3 — Picker UX shows verified orgs only; pending orgs are invisible until promoted

The dropdown filters to `verification_state IN ('verified')` UNION Sebenza-registered orgs. Pending submissions never surface — that's the safeguard against typo proliferation. If two seekers type "Capitec Bank Limited" and "Capitec Bank Ltd" while admin hasn't promoted yet, both are isolated pending entries; the admin merges them at the queue.

Each option in the picker carries a small badge:
- `Sebenza employer` — green tone (the org actively uses the platform)
- `Listed by N seekers` — neutral tone with the count (verified but seeker-named)

This makes the verification posture honest in-line, no separate trust-strip needed.

### D4 — Admin verification is REAL editorial work, not rubber-stamp dedupe

The admin queue Organisations tab carries the submitted text + city + a free-text notes panel for the admin to log what they did ("called Capitec switchboard, confirmed they exist; corrected spelling from 'Capictec'"). The Promote form is not a one-click confirm — it shows editable name + city + website fields so the admin can normalise the submission before it becomes canonical.

Internal admin notes live on the suggestion row, never on the seeker's profile. The seeker doesn't see "admin called your company"; the audit log carries the action.

### D5 — Same Promote / Merge / Reject lifecycle as 9.15

- **Promote**: flips the pending org's `verification_state='verified'`, sets `origin='seeker_named'` (already the default for this path), backfills profile references, fires `taxonomy.suggestion.received`-equivalent confirmation audit.
- **Merge**: re-points the pending org's profile references at an existing org, deletes the pending org, marks suggestion `state='merged'`. Same de-dupe path as Phase 9.15 used for institutions.
- **Reject**: marks suggestion `state='rejected'`. Per Phase 9.15 D2: **user data is never mutated on reject**. The seeker's free-text employer name stays on their profile; we just stop surfacing the suggestion in the admin queue.

### D6 — Visual labelling never lies

Per Verification-Honesty Rule. Two display states:
- Verified Sebenza-registered org → "Sebenza employer" badge.
- Verified seeker-named org → "Listed by N seekers" badge (count never includes profile.deleted_at rows).
- Pending seeker-named org (only visible to the submitting seeker on their own profile, and to admins) → "Awaiting verification" badge.

The seeker who submitted an Other entry sees the pending row on their own profile so they know it landed. They cannot promote it themselves.

### D7 — Promotion does not grant employer-platform privileges

A verified seeker-named org cannot post vacancies, log placements, or invite seekers. Those still require the org to sign up via the existing Phase 9.10 flow + complete KYC. The two paths converge at `/admin/employer-vetting` if an org signs up that we already have a seeker-named entry for — admin can merge the new KYC'd account into the existing record (preserves the "listed by N seekers" continuity).

### D8 — Three new optional columns on profiles for current employment

- `current_employer_org_id text REFERENCES organizations(id) ON DELETE SET NULL` — nullable; NULL = no current employer declared
- `current_role_started_at date` — nullable; YYYY-MM-DD with day defaulted to 01 by the form
- `current_role_city text` — nullable; could differ from `profiles.city` for cross-province commuters

When the seeker changes status away from `employed` / `self_employed`, the form softly prompts to clear these (but doesn't force it; the seeker may want to keep the historical entry while their status is `unemployed` between jobs). When the seeker explicitly clears the employer, a `profile.employment.cleared` audit row writes — this is honest about the change rather than silently dropping history.

Future Phase: roll these onto an `experiences` row when the seeker reports the job ended.

### D9 — Self-employed seekers can use the picker too

A self-employed contractor / freelancer / sole-prop may have a registered business name. They can pick it from the dropdown OR create an Other entry the same way. The "Listed by N seekers" badge will eventually surface their business once admin verifies. No "contact person" path for self-employed (Phase 9.23 D-something will gate on `status='employed'` only — you don't email yourself for verification).

### D10 — POPIA: this phase creates no third-party PII

Org name + city + website are public-domain data. The seeker's relationship to the org lives on their own profile (their data). Nothing about the contact person / manager / HR is captured at this phase — that's Phase 9.23 with its own consent design. The admin's verification notes are admin-internal, never seeker-visible.

### D11 — One migration, one commit

Migration `0036_phase9_22_organisation_suggestions.sql`:
- `ALTER TYPE taxonomy_suggestion_kind ADD VALUE 'organisation'`
- `organizations` table gains `origin` enum (`sebenza_registered` / `seeker_named`, default `sebenza_registered` for backward compatibility on existing rows) + `verification_state` enum (`pending` / `verified` / `rejected`, default `verified` for existing rows since they're all KYC'd already) + `listed_by_seeker_count int DEFAULT 0` (denormalised for fast picker reads)
- `profiles` gains `current_employer_org_id` + `current_role_started_at` + `current_role_city`
- `taxonomy_suggestions` gets `pending_organisation_slug text` mirror of its `pending_institution_slug` column

---

## 📦 TASK LIST

- **9.22.1 Migration** `0036_phase9_22_organisation_suggestions.sql` — enum extension + organisations columns + profiles columns + taxonomy_suggestions column.
- **9.22.2 Schema** — extend Drizzle: organisations table (origin + verification_state + listed_by_seeker_count), profiles table (three new cols), taxonomy_suggestions table, kind enum.
- **9.22.3 Suggestion actions** — extend `lib/taxonomy/suggestions.ts`:
  - `submitTaxonomySuggestion` learns the `kind='organisation'` branch (creates pending `organizations` row + suggestion row + city normalisation)
  - `listPendingSuggestions('organisation')` returns the new kind
  - `promoteTaxonomySuggestion` for `kind='organisation'` flips `verification_state='verified'` + accepts editable name + city + website + admin notes
  - `mergeTaxonomySuggestion` for organisations re-points profile references + deletes the pending row + decrements `listed_by_seeker_count` on the target
  - `rejectTaxonomySuggestion` — same posture, never touches profile data
- **9.22.4 Seeker form fields** — extend `SeekerSignUpForm` step 3 (the status step) with the three conditional fields when status is `employed` or `self_employed`. New `<EmployerPicker>` client island reuses `<ComboboxField allowOther>`.
- **9.22.5 Dashboard profile editor** — same fields on `/dashboard/profile/employment` (new sub-page) or inline on the existing profile editor. Server action `updateCurrentEmployment({ employerOrgId?, customEmployerName?, roleStartedAt?, roleCity? })`.
- **9.22.6 Public profile rendering** — when a profile has `current_employer_org_id` AND that org is verified, render the org name + badge on the public profile + search result row. Pending orgs never surface publicly (D3).
- **9.22.7 Admin queue UI** — `/admin/taxonomy/suggestions` Organisations tab. Per-suggestion card: submitted text + city + submitter count + Promote (with editable canonical form) / Merge / Reject. Internal-notes textarea on each suggestion row.
- **9.22.8 Listed-by-seeker-count maintenance** — `listed_by_seeker_count` denormalised on `organizations` rows. Updated by: profile employer-change actions + admin promote/merge/reject paths. A nightly cron `recompute-organisation-seeker-counts` runs as a backstop for drift (small org table; full recount is cheap).
- **9.22.9 Compliance assertions** — three new on `/api/admin/outcomes-compliance`:
  - `organisations-no-empty-pending` — every `kind='organisation'` pending suggestion has non-empty trimmed name
  - `organisations-rejection-preserves-data` — rejected org suggestions still have the submitting profile's free-text fallback intact
  - `organisations-promotion-backfill-complete` — every promoted org suggestion has all referencing profiles re-pointed
- **9.22.10 Seed fixtures** — 3 demo org suggestions: `Capitec Bank Limited` (pending), `Shoprite Holdings` (already verified seeker-named), `asdfasdf` (rejected for the audit-trail demo).
- **9.22.11 Typecheck + tests + build + commit**.

---

## 🚫 OUT OF SCOPE

- ❌ **Contact person name + email** — Phase 9.23. POPIA-heavy, deserves its own focused phase with proper consent scaffolding.
- ❌ **Auto-verification** — admin discretion always required (D4).
- ❌ **Auto-promotion of seeker-named orgs to Sebenza-registered status** — those orgs still need to sign up + KYC (D7).
- ❌ **Org logos / branding / industry tagging for seeker-named entries** — those come with KYC.
- ❌ **"Claim this org" flow** — future phase; when an org signs up and finds a seeker-named entry, admin can merge during onboarding.
- ❌ **Predictive employer suggestions** ("you probably work at one of these three") — speculative.
- ❌ **Org pages for seeker-named entries** — verified seeker-named orgs don't get a public profile page; they only appear as a label on seeker profiles.
- ❌ **Removing the seeker's free-text fallback** — if a seeker pre-populates an employer text and admin rejects the suggestion, the free-text stays on their profile. Verification-Honesty Rule.

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

1. **Phase 9.15 already paid the architecture cost.** The `taxonomy_suggestions` table, the "Other" combobox mode, the admin queue UX, the dedupe logic, the audit kinds, the notification cadence — all of it. Adding `kind='organisation'` is genuinely a small extension.

2. **The platform learns about employer coverage without forcing employers to register.** Today /insights can't say "Sebenza has employer data on 40% of formal-sector SA firms" because we only know about the orgs that signed up. After 9.22, every seeker who signs up adds (verified, admin-curated) signal about the actual employer landscape.

3. **POPIA stays clean.** No third-party PII enters the system at this phase. Org names + cities are public data; the seeker's relationship to their employer is their own data. Phase 9.23 will handle the harder "contact this person" flow with its own dedicated consent UI.

---

*Plan opened 2026-05-29. Target: complete within one focused day. Bounded scope (~10 edits + 1 migration), no new tables, no new audit kinds (reuses `taxonomy.suggestion.*`), no new notification kinds.*
