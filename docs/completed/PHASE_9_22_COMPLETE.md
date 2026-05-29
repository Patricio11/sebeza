# PHASE 9.22 COMPLETE — SEEKER EMPLOYER PICKER + ORGANISATION SUGGESTION QUEUE
*Shipped 2026-05-29. Plan: [`docs/completed/PHASE_9_22_PLAN.md`](./PHASE_9_22_PLAN.md). Closes the gap where a seeker who declares `employed` at sign-up tells the platform they're employed but nothing about *where*.*

> **One-line summary**: Seekers picking `employed` / `self_employed` get an optional employer + start-date + role-city block, backed by a searchable picker over the existing `organizations` table. "Other" reuses Phase 9.15's `taxonomy_suggestions` pattern with the new `kind='organisation'`, so admin can review + edit + promote new orgs into the picker for future seekers. Honest badges throughout — "Sebenza employer" (KYC'd) vs "Verified employer" (admin-reviewed seeker-named). Zero third-party PII; contact-person verification with explicit consent is Phase 9.23.

One commit, one migration:

- **Phase 9.22** `f9da4fd` — schema + suggestion lifecycle + sign-up form + dashboard editor + admin queue + public renderer

---

## 🎯 WHAT SHIPPED

### A — Migration `0036_phase9_22_organisation_suggestions.sql`

- `ALTER TYPE taxonomy_suggestion_kind ADD VALUE 'organisation'` (third kind alongside `profession` + `institution`)
- New `organization_origin` enum: `sebenza_registered` | `seeker_named`. Existing rows back-fill cleanly as `sebenza_registered` (every pre-9.22 org came through the employer signup path).
- `organizations.origin` + `organizations.listed_by_seeker_count` (denormalised count, powers the "Listed by N seekers" badge without per-render JOIN)
- `taxonomy_suggestions.pending_organisation_id` FK (mirror of `pending_institution_slug`)
- `profiles.current_employer_org_id` + `current_role_started_at` + `current_role_city`
- Partial picker index `organizations_picker_idx` on `(origin, verification, name) WHERE verification != 'rejected'`
- Partial index `profiles_current_employer_idx` on `(current_employer_org_id) WHERE NOT NULL`

### B — Server actions in `lib/profile/employment.ts`

- `listEmployerOptions(query)` — picker filter `WHERE origin = 'sebenza_registered' OR verification = 'verified'`. Sorts Sebenza-registered first (CASE expression), then alphabetical. Server-fetched + passed into the sign-up form + dashboard editor so the picker has a complete starting set without a client-side round-trip on mount.
- `updateCurrentEmployment({ employerOrgId? | customEmployerName?, customEmployerCity?, roleStartedAt?, roleCity? })` — mutually-exclusive picked-vs-typed via Zod `refine`. When typed, delegates to `submitTaxonomySuggestion(kind: 'organisation')` to create the pending org + suggestion + admin notification atomically. Maintains `listed_by_seeker_count` on both ends of any swap via authoritative `COUNT(*)` recounts.

### C — Suggestion lifecycle extended with `kind='organisation'` in `lib/taxonomy/suggestions.ts`

- `submit` — dedupe against picker-visible orgs (sebenza_registered OR verified seeker_named). Pending rows isolated from the dedupe so multiple submissions of the same name don't collide; admin merges them at the queue.
- `promote` — flips the pending row's `verification='verified'`, records `verifiedAt + verifiedByUserId`, accepts admin-edited name AND city via `correctedLabel + correctedCity`. Then dedupes any other pending rows with the same name (re-points seeker profile FKs, deletes the dupes, marks their suggestions auto-merged). Final step: recount `listed_by_seeker_count` from authoritative source so the denormalised column stays honest.
- `merge` — re-points seeker profile FKs to the canonical target, recounts target's seeker count, deletes the pending row.
- `reject` — **never mutates user data** (D5 + Phase 9.15 D2 carry-over). Pending org row stays linked to the seeker's profile; the picker filter hides it; the seeker re-picks if/when they want a verified affiliation.

### D — Sign-up path (`lib/auth/actions.ts:signUpSeeker`)

Inline org resolution because the seeker doesn't have a session yet (can't call `submitTaxonomySuggestion`):

- `currentEmployerOrgId` picked from the dropdown → silently null-out if not picker-visible (same posture as Phase 9.8.6 used for cross-org `vacancyId` smuggling — don't fail the sign-up).
- `customCurrentEmployerName` typed via "Other" → check dedup against picker-visible orgs first (attach to existing match if found), else create the pending row inline + queue the suggestion post-transaction as auxiliary (matches the Phase 9.15 institution path: failure doesn't tank the sign-up).
- Both paths increment `listed_by_seeker_count` post-transaction via recount.

### E — `SeekerSignUpForm` step 3 conditional block

Renders "Where do you work?" fieldset only when `state.status === 'employed' || state.status === 'self_employed'`. Uses `ComboboxField` with `allowOther` for the picker (server-fetched options carry the "Sebenza employer" / "Listed by N seekers" subLabel chips). When the seeker picks Other, an inline `Employer city` text field surfaces. Month + year selects for start date; role-city text field for cross-province commuters. All fields draft-persisted via the existing `useSessionDraft` so locale-switching mid-form doesn't wipe the block.

### F — Dashboard `CurrentEmploymentEditor` client island

New section between "Work availability" and "National ID" on `/dashboard/profile`. Mirrors the sign-up form layout but lives on the dashboard surface as an in-place editor with Save / Clear buttons. Crucial: when the seeker's current employer is still a pending seeker_named row (verification != 'verified'), the editor still surfaces the free-text name so the seeker can see their text landed — even though `listEmployerOptions` hides pending rows from everyone else (D3).

### G — `getMyProfile` extended with current-employment fields

`MyProfile` type gains `currentEmployerOrgId` + `currentEmployerName` + `currentEmployerIsPending` + `currentRoleStartedAt` + `currentRoleCity`. A single extra round-trip to `organizations` resolves the name and the verification posture; the `IsPending` flag drives the dashboard editor's pending-state UX without leaking it to the public payload.

### H — Admin queue `/admin/taxonomy/suggestions` gains Organisations tab

`TaxonomySuggestionsManager` extended with a third `<Section>` for `kind='organisation'`. Per-suggestion card shows the submitted name + the seeker-submitted city + submitter count + first-submitted date. The Promote form gains **two editable fields** (D4 — real editorial work): name (existing pattern) + city (new). Inline explainer in the Promote panel: *"Promoting marks this org as verified seeker-named. It does NOT grant vacancy-posting rights — the employer still needs to sign up + complete KYC for that."* (D7)

The queue page also fetches a 500-cap list of canonical picker-visible orgs for the Merge picker.

### I — Public profile `/p/[handle]` employer line

New "Currently at" `<DossierRow>` in the right sidebar, rendered only when `profile.currentEmployerName && profile.currentEmployerBadge` (the read path strips both when the org isn't picker-visible). Badge label honest:

- `Sebenza employer` (badge = sebenza_registered)
- `Verified employer` (badge = seeker_named_verified)

Start date renders as "since MMM YYYY" when present.

### J — Read-path plumbing in `db/queries/profiles.ts`

Both `findProfileByHandleQuery` + `searchProfilesQuery` now `LEFT JOIN organizations orgs ON orgs.id = p.current_employer_org_id` and use a shared `employerPayload()` helper to shape the new `PublicProfile` fields. The helper returns an empty object (effectively NULL all three new fields) when the org isn't picker-visible — pending seeker_named rows never reach any public payload, by construction.

### K — Audit

New `profile.employment.update` kind for the dashboard editor write path. Meta carries `{ employerOrgId, priorEmployerOrgId, roleStartedAt, roleCity, cleared }`. The free-text "Other" submission re-uses the existing `taxonomy.suggestion.submit` kind so the admin lifecycle audit trail stays unified across all three kinds.

---

## ✅ LOCKED DECISIONS HONOURED

| # | Decision | Where it lives |
|---|---|---|
| **D0** | Two-state axis on `organizations` (sebenza_registered vs seeker_named) | New enum + column; the two states never conflate downstream |
| **D1** | Reuse Phase 9.15 `taxonomy_suggestions` with `kind='organisation'` | Single ALTER TYPE; the existing 5 server actions branch on kind |
| **D2** | Optional fields when status is `employed` / `self_employed` | Form gates the conditional fieldset; `updateCurrentEmployment` accepts all three independently |
| **D3** | Picker shows verified orgs only; pending hidden from everyone except the submitting seeker on their own dashboard | `listEmployerOptions` filter + the `currentEmployerIsPending` flag on `MyProfile` |
| **D4** | Admin verification is real editorial work | The Promote panel for org-kind shows editable name + city + the "doesn't grant vacancy-posting rights" explainer |
| **D5** | Reject NEVER mutates user data | Inherited from Phase 9.15; the pending org row stays linked to the seeker's profile after a reject |
| **D6** | Honest badges throughout | "Sebenza employer" vs "Listed by N seekers" / "Verified employer" — the verification posture is the label |
| **D7** | Promotion does NOT grant vacancy-posting rights | Explicit explainer in the admin Promote UI; the verified seeker_named state has no employer-platform privileges |
| **D8** | Three new optional columns on `profiles` | Schema + read path through `MyProfile` + write path through `updateCurrentEmployment` |
| **D9** | Self-employed can use the picker too | Form gates on `status === 'employed' || status === 'self_employed'`; no contact-person path here (Phase 9.23 D2 will gate on `employed` only) |
| **D10** | No third-party PII in this phase | Org name + city + website are public-domain data; contact-person collection lives in Phase 9.23 with its own consent design |
| **D11** | One migration, one commit | Migration 0036 is the entire schema change; commit `f9da4fd` is the entire phase |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0036_phase9_22_organisation_suggestions.sql`
- `lib/profile/employment.ts` — `listEmployerOptions` + `updateCurrentEmployment`
- `components/feature/profile/CurrentEmploymentEditor.tsx`
- `docs/completed/PHASE_9_22_PLAN.md` (moved from `docs/`)
- `docs/completed/PHASE_9_22_COMPLETE.md` (this doc)

**Edited**
- `db/schema.ts` — `organization_origin` enum; `organizations.origin` + `listed_by_seeker_count`; `taxonomy_suggestions.pending_organisation_id`; `profiles` three new columns; `taxonomySuggestionKind` enum gains `organisation`
- `db/migrations/meta/_journal.json` — appended idx 36
- `db/queries/profiles.ts` — `findProfileByHandleQuery` + `searchProfilesQuery` LEFT JOIN organizations + `employerPayload()` shared helper
- `lib/mock/types.ts` — `PublicProfile` gains optional `currentEmployerName + currentEmployerBadge + currentRoleStartedAt`
- `lib/profile/me.ts` — `MyProfile` shape + read-path resolution including pending-state flag
- `lib/auth/actions.ts:signUpSeeker` — inline employer resolution + post-transaction suggestion submission for the org-kind path
- `lib/taxonomy/suggestions.ts` — `kind='organisation'` branches across submit / listPending / promote / merge / reject + `SuggestionKind` union widened + city editing on Promote
- `lib/audit/index.ts` — new `profile.employment.update` kind
- `components/feature/auth/SeekerSignUpForm.tsx` — new prop + form state + conditional UI block + draft persistence
- `components/feature/admin/TaxonomySuggestionsManager.tsx` — new optional org props + third `<Section>` + per-card city editor on Promote
- `app/[locale]/(auth)/sign-up/seeker/page.tsx` — fetches + passes `employerOptions`
- `app/[locale]/(admin)/admin/taxonomy/suggestions/page.tsx` — loads org suggestions + canonical orgs
- `app/[locale]/(seeker)/dashboard/profile/page.tsx` — new "Current employment" section between Work availability and National ID
- `app/[locale]/(public)/p/[handle]/page.tsx` — "Currently at" dossier row + `formatRoleStartedAt` helper

**Verification**
- `tsc --noEmit` clean at every step
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **Search-row (`TalentRosterItem`) employer line deferred.** The row is dense; adding a "Currently at" line risks visual clutter. Will follow up if employer recruiters tell us it's hard to spot. The data is already in the search payload, so it's a UI-only follow-up.

2. **`acceptSeekerInvitation` (Phase 9.17 path) doesn't take the new employer fields yet.** Invited seekers go through a parallel sign-up; the conditional block doesn't render in that flow at this commit. Symmetric extension is small but deferred to keep this phase one commit.

3. **No "claim this org" flow for employers.** A new employer signing up via Phase 9.10 KYC who finds an existing seeker-named entry for their company has to be merged manually by admin. We could automate the claim at signup but it's a future surface — for now admin discretion holds.

4. **No org page for verified seeker-named entries.** Verified seeker-named orgs only appear as a label on seeker profiles. They don't get a public landing page like Sebenza-registered employers will eventually have. By design — they haven't opted in.

5. **No nightly cron for `listed_by_seeker_count` drift.** The plan mentioned one as a backstop; the action-layer recounts are authoritative (single `COUNT(*)` per swap) so drift would only happen via direct-SQL mutations. If we see drift, the cron is trivial to add.

6. **No predictive employer suggestions** ("you probably work at one of these three"). Speculative; out of scope.

7. **The `currentEmployerCity` form field for "Other" submissions is intentionally separate from `roleCity`.** The first is *where the company is based* (lives on the org row). The second is *where the seeker performs the role* (lives on the seeker's profile). A senior partner at PwC in Joburg might do consulting work in Pretoria; the two cities are genuinely different.

8. **Picker uses server-fetched-once + client-side filter via `ComboboxField`**, not server-side search-as-you-type. For org tables under ~1k entries this is fine; the existing combobox does fuzzy match locally. We'll switch to server-side search if/when the table grows past that.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/sign-up/seeker` step 3** — new conditional employer block when status is employed / self_employed
- **`/dashboard/profile`** — new "Current employment" section between Work availability and National ID
- **`/p/[handle]`** — gains "Currently at" dossier row when employer is picker-visible
- **`/search` payloads** — `PublicProfile.currentEmployerName + currentEmployerBadge + currentRoleStartedAt` available on every row (search-row UI doesn't surface them yet — see deliberate non-decision #1)
- **`/admin/taxonomy/suggestions`** — gains Organisations tab; total-pending count includes org-kind
- **Audit log** — new `profile.employment.update` kind; existing `taxonomy.suggestion.*` kinds extend with `kind='organisation'` meta
- **Notification preferences** — no new kinds; the existing `taxonomy.suggestion.received` covers org-kind too via the kind meta field

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved from the plan)

- ❌ **Contact person name + email** — Phase 9.23 (POPIA-heavy, deserves its own focused phase)
- ❌ **Auto-verification** — admin discretion always required (D4)
- ❌ **Auto-promotion of seeker-named orgs to Sebenza-registered status** — those orgs still need to sign up + KYC (D7)
- ❌ **Org logos / branding / industry tagging for seeker-named entries** — those come with KYC
- ❌ **"Claim this org" flow** — future phase
- ❌ **Predictive employer suggestions** — speculative
- ❌ **Org pages for seeker-named entries** — verified seeker-named orgs don't get a public profile page
- ❌ **Removing the seeker's free-text fallback** — Verification-Honesty Rule

---

## 🧪 HOW TO VERIFY

1. Run migration: `npm run db:migrate` to land 0036.
2. Open `/sign-up/seeker`, complete steps 1 + 2, then on step 3 pick `Employed`. The "Where do you work?" fieldset should appear with the picker + month/year + city fields.
3. Pick an existing org from the dropdown; complete signup; open `/p/{handle}` — the "Currently at" row should render with the "Sebenza employer" or "Verified employer" badge.
4. Repeat with the "Other" path: type a new employer name, optionally enter an employer city, complete signup. Verify the row lands in `/admin/taxonomy/suggestions` under the Organisations section + the public profile does NOT show the pending org (D3).
5. Promote the pending org via the admin queue: edit the name + city, hit Confirm Promote. Re-open `/p/{handle}` — the "Currently at" row should now show with the "Verified employer" badge.
6. Verify the `listed_by_seeker_count` denormalised column: query `SELECT name, listed_by_seeker_count FROM organizations WHERE id = '<promoted-id>'`; should reflect the actual profile count.
7. Try the `/dashboard/profile` editor: change employers; confirm the prior org's count decrements and the new org's increments. Clear the employer entirely; confirm the column goes NULL + audit `profile.employment.update` row carries `cleared: true`.
8. Try Merge: in admin queue, pick "Merge into existing" for an org-kind suggestion; pick a canonical target; confirm seeker profile FKs re-point + the pending row is deleted + the target's seeker count recomputed.
9. Try Reject: pick a junk suggestion; confirm it leaves the seeker's free-text on their profile (the pending org row stays; the picker just hides it).

---

*Phase 9.22 lets the platform learn about employer coverage organically — every seeker who signs up adds (admin-curated) signal about the actual SA employer landscape. Without forcing any employer to register first. Without touching third-party PII. Phase 9.23 closes the loop with explicit consent-based verification via contact-person email.*
