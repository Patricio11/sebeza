# PHASE 9.15 COMPLETE  "OTHER" FREE-TEXT + ADMIN TAXONOMY SUGGESTION QUEUE
*Shipped 2026-05-26. Plan: [`docs/completed/PHASE_9_15_PLAN.md`](./PHASE_9_15_PLAN.md). Closes the user-side gap surfaced post-9.14: real users with unusual professions or institutions can now onboard without being told "your work doesn't fit our list" + admins get a structured queue to canonicalise them.*

> **One-line summary**: User picks "Other" on the profession / institution combobox → enters free-text → it's stored on their profile + a row lands in a new `taxonomy_suggestions` queue → admins get a dedupe-aware notification → admin promotes / merges (with auto-backfill) / rejects (without ever erasing user data).

---

## 🎯 WHAT SHIPPED

### A  `<ComboboxField>` extended with `allowOther` mode
Two new props on the component shipped in 9.14.x:
- `allowOther: boolean`  adds an "Other (specify)" footer option to the dropdown
- `onOtherSubmit?: (text) => void`  optional callback for parents that want to fire the suggestion submission immediately on blur

UX: clicking the footer option transforms the field into a free-text input with a "Pick from list" revert link. Visual treatment uses the accent palette so the field is clearly in custom-text mode. Mobile-first like the rest of the component.

### B  `taxonomy_suggestions` table + new schema columns
Migration `0024_phase9_15_taxonomy_suggestions.sql` (additive):
- New table `taxonomy_suggestions` with `kind` enum (`profession` / `institution`) + `state` enum (`pending` / `promoted` / `merged` / `rejected`) + CHECK constraint enforcing 2-80 char trimmed custom_text
- Two new columns on `institutions`: `is_pending boolean` + `deleted_at timestamp`. Pending institution rows are created when a user types free-text; admin promote flips `is_pending=false`
- Two indexes: `(state, kind, submitted_at DESC)` for the admin queue + `(kind, lower(custom_text))` for dedupe lookups

### C  Server Actions in `lib/taxonomy/suggestions.ts`
Five actions covering the full lifecycle:
- `submitTaxonomySuggestion({ kind, customText })`  user-side. Validates length + whitespace + not-already-canonical, rate-limits to 5/user/day, creates the suggestion row, fires `taxonomy.suggestion.received` notification to all admins (dedupe per `(kind, lower(customText))` with 24h window via catalog), audit-logs as `taxonomy.suggestion.submit`. For institution kind: also creates the pending `institutions` row + stores its slug in `pending_institution_slug`.
- `listPendingSuggestions(kind)`  admin-side. Dedupes by `lower(custom_text)` with submitter-count aggregation so popular requests cluster.
- `promoteTaxonomySuggestion({ suggestionId, correctedLabel?, note? })`  adds to canonical (or flips `is_pending=false` for institutions) + **backfills** every profile carrying the original text to the canonical label. For institutions: also de-duplicates other pending rows with the same label by re-pointing their academic_profiles to this one + deleting the dupes.
- `mergeTaxonomySuggestion({ suggestionId, targetSlug, note? })`  links to an existing canonical entry. Backfills + (for institutions) deletes the pending row.
- `rejectTaxonomySuggestion({ suggestionId, reason })`  sets `state='rejected'`. **CRITICAL**: user data is NEVER mutated on reject (Verification-Honesty Rule + Placement-Truth  the user's entered text stays on their profile; the suggestion just stops surfacing in the admin queue).

### D  Sign-up flow honours "Other" end-to-end
`SeekerSignUpForm` step 3 now passes `allowOther` to both the profession + institution comboboxes. `signUpSeeker` server action handles the resolution:
- Before the transaction: checks if profession exists in canonical → flags `professionWasCustom` for post-tx suggestion submission
- Before the transaction: checks if institutionSlug references a real row → if not, creates the pending institutions row + uses its slug for the academic_profiles insert
- After the transaction: fires `taxonomy.suggestion.submit` audit + notification for each custom value. Auxiliary work  never blocks the user's signup if it fails

### E  Admin queue page at `/admin/taxonomy/suggestions`
New deep-linkable page (also linked from `/admin/taxonomy` via a banner that shows the pending count). Renders profession + institution sections; each card shows the customText + submitter count + first-submitted date + three action buttons. Promote / Merge / Reject all open inline forms (no modal) so admins can review quickly. The merge action uses a `<ComboboxField>` over the canonical list for searchable fuzzy-match.

### F  Notification + audit kinds
- New `taxonomy.suggestion.received` (audience: `all_admins`, in-app default-on, email default-off  queue page is the canonical surface, no email noise). 24h dedupe per `(kind, custom_text)` so repeat submissions don't spam the bell.
- Four new audit kinds: `taxonomy.suggestion.submit` / `.promote` / `.merge` / `.reject` with rich meta including `backfilledRows` count for forensic review.

### G  Three new compliance assertions
Wired into `/api/admin/outcomes-compliance` (now **22 assertions** total):
- `taxonomy-suggestions-valid`  DB CHECK constraint backup; no suggestion row has empty/whitespace-only custom_text or exceeds 80 chars after trim
- `taxonomy-suggestions-rejected-preserve-data`  every rejected institution suggestion still has its pending institutions row (the user-data-preservation contract from D4)
- `taxonomy-promotion-backfill-complete`  every promoted/merged profession suggestion has no profiles row still carrying the original custom_text (backfill completeness check)

### H  Seed fixtures
Three demo suggestions land at seed time so `/admin/taxonomy/suggestions` renders real content on first sign-in:
- Pending profession `"Game Ranger"` submitted by `wits-bsc-cs-2026-09`
- Pending institution `"Damelin College"` with the matching pending institutions row + slug `other--damelin-college-seed01`
- Already-rejected profession `"asdfasdf"` demonstrating the spam path with full audit trail

---

## ✅ COMPLIANCE ASSERTIONS

| # | Assertion | Where |
|---|---|---|
| **a** | DB CHECK constraint enforces 2-80 trimmed chars; the assertion catches drift if a future migration drops the constraint. | `assertTaxonomySuggestionsValid` |
| **b** | Rejection NEVER mutates user data. Institutional suggestions keep their pending row; the user's academic_profile keeps the same FK. | `assertRejectedSuggestionsPreserveData` |
| **c** | Promotion + merge backfills are complete. No profile rows survive a resolved suggestion carrying the OLD text. | `assertTaxonomyBackfillsComplete` |
| **d** | Audit trail captures the full lifecycle. Four `taxonomy.suggestion.*` kinds, each with `kind` + `customText` + (for resolve) `targetSlug` + `backfilledRows`. | `lib/audit/index.ts` |
| **e** | Notification dedupe is per `(kind, lower(custom_text))` not per-user, so 10 users typing "Damelin" produces ONE bell ping. | `lib/notifications/catalog.ts`  `taxonomy.suggestion.received` 24h dedupeWindowSeconds |
| **f** | Rate-limit on submission (5/user/day) blocks spam. | `submitTaxonomySuggestion` |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0024_phase9_15_taxonomy_suggestions.sql`  schema + journal entry
- `lib/taxonomy/suggestions.ts`  5 Server Actions (submit + listPending + promote + merge + reject)
- `components/feature/admin/TaxonomySuggestionsManager.tsx`  admin queue client island
- `app/[locale]/(admin)/admin/taxonomy/suggestions/page.tsx`  queue page
- `docs/completed/PHASE_9_15_COMPLETE.md` (this doc)

**Edited**
- `db/schema.ts`  institutions table extended; new `taxonomySuggestions` table + 2 enums
- `db/migrations/meta/_journal.json`  appended idx 24
- `db/seed.ts`  `seedPhase9_15TaxonomySuggestions()` + truncate list extended
- `components/ui/ComboboxField.tsx`  `allowOther` + `onOtherSubmit` + `otherLabel` props; inline free-text mode
- `components/feature/auth/SeekerSignUpForm.tsx`  `allowOther` on profession + institution comboboxes
- `lib/auth/actions.ts`  `signUpSeeker` resolves institution_slug + fires post-transaction suggestion submissions
- `lib/audit/index.ts`  4 new audit kinds
- `lib/notifications/catalog.ts`  `taxonomy.suggestion.received` entry
- `lib/analytics/outcomes-compliance.ts`  3 new assertions
- `app/api/admin/outcomes-compliance/route.ts`  wired the 3 new assertions
- `app/[locale]/(admin)/admin/taxonomy/page.tsx`  queue link banner with pending count

**Verification**
- `tsc --noEmit` clean
- `npm test` 22/22 green
- 22 compliance assertions on the admin endpoint

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **`allowOther` NOT wired on profile editor + vacancy form.** Two reasons:
   - **Profile editor (`ProfileBasicsForm`)** uses slug-based state (not label-based like sign-up), and would need a parallel resolution path before being safe. Deferred to a focused follow-up commit.
   - **Vacancy form**: free-text profession on a vacancy posting defeats the canonical-matching that drives reverse-match. Employers should pick from the canonical list. If they need a new profession, they can request it via the admin or wait for the next promotion. By design.

2. **Full institution admin CRUD UI deferred.** The schema is in place (`is_pending` + `deleted_at`) and the queue covers the immediate "Other" path. A dedicated add/edit/soft-delete form for institutions on the existing `/admin/taxonomy` tabs is a follow-up commit when admin volume justifies it.

3. **No "your suggestion was promoted" notification to the submitter.** Nice-to-have; defer unless feedback asks. The user already sees their value land on their profile + (after admin action) sees it become canonical.

4. **Auto-promotion rules not built.** Even if 50 users suggest the same thing, admin discretion still required. Auto-promotion risks polluting the taxonomy with viral typos.

5. **Free-text on skills picker not built.** Skills are controlled enough today; if a need emerges, the same `taxonomy_suggestions` table extends to `kind='skill'` with zero rework.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/sign-up/seeker` step 3**  Profession + institution comboboxes now show "Other" as a footer option. Picking it transforms the field. Submission either matches a canonical OR creates a suggestion + pending institutions row.
- **`/admin/taxonomy`**  Banner shows pending suggestion count + deep-links to the queue.
- **`/admin/taxonomy/suggestions`**  New page. Three-card lifecycle UX per suggestion.
- **`/admin/audit-log`**  Four new audit kinds filterable.
- **`/api/admin/outcomes-compliance`**  22 assertions now.
- **Search + insights heatmap**  Free-text professions on profiles fall through to the raw value and suppress out by k-floor until admin promotes (the 9.11 heatmap query already JOINs to canonical via `lower(label) = lower(p.profession)`, so orphans naturally appear once + don't drift aggregates).

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved guardrails)

- ❌ "Other" on profile editor / vacancy form (D1 above  deferred)
- ❌ Full institution add/edit/soft-delete UI (D2 above  deferred)
- ❌ Auto-promotion rules
- ❌ Free-text on skills / provinces / cities
- ❌ External SAQA / DHET validation (dormant Phase 8 adapter territory)
- ❌ Submitter-side "your suggestion was resolved" notification

---

## 🧪 HOW TO VERIFY

1. Re-seed: `npm run db:seed` to populate the 3 demo suggestions + apply the migration.
2. Sign in as admin (`admin@sebenza.co.za`) → notice the bell badge for the new "Game Ranger" + "Damelin College" suggestions.
3. Open `/admin/taxonomy` → the banner shows the pending count + deep-links to the queue.
4. On `/admin/taxonomy/suggestions`:
   - Try **Promote** on "Game Ranger" (optionally correct casing) → confirm it appears under `/admin/taxonomy` → professions tab
   - Try **Merge** on "Damelin College" → pick an existing institution from the merge picker → confirm any academic_profiles previously linked re-point
   - Try **Reject** with a reason → confirm the suggestion disappears + the user's profile data is untouched
5. Submit a fresh "Other" via sign-up:
   - Walk a new sign-up, pick "Other" on profession → enter a custom value
   - Confirm new suggestion appears in the admin queue
6. Hit `/api/admin/outcomes-compliance` → confirm all 22 assertions return `ok: true`.

---

*Phase 9.15 closed the last UX gap surfaced during the pre-launch system review. Real users with unusual jobs or non-canonical institutions can now onboard cleanly; admins canonicalise on their schedule without breaking analytics integrity. Mechanism scales to skills / cities / any future taxonomy via the `kind` enum.*
