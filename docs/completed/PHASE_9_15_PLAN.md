# PHASE 9.15 PLAN — "OTHER" FREE-TEXT + ADMIN TAXONOMY SUGGESTION QUEUE
*Side-phase after 9.14. Opened 2026-05-26. Closes a UX gap surfaced during the 9.14 system review: a user whose profession or institution isn't in the canonical taxonomy has no way to onboard cleanly. Building a sloppy free-text field would compromise analytics integrity; building no escape hatch fails real users. This phase ships the middle path: free-text capture + structured admin review.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md`.*

> **One-mechanism design**: profession + institution share the same suggestion table + admin queue + notification kind + audit kinds. Splitting them into two phases would double the engineering for no design benefit. Locked in D0.

---

## 🎯 GOAL

When a user can't find their profession in the dropdown (sign-up / profile / vacancy form) or their institution (student section), they pick **"Other"** and enter free-text. The system:

1. **Stores the free-text** so the user can onboard immediately (no signup friction)
2. **Notifies admins** so a human reviewer sees the suggestion
3. **Lets admin promote / merge / reject** — promotes to canonical taxonomy (adds to the seed list), merges into an existing entry (fixes misspellings — "Damelan" → "Damelin College"), or rejects (spam / joke)
4. **Backfills on promotion** — every existing profile/academic row carrying the rejected free-text gets updated to the canonical value, so analytics aggregate correctly

The mechanism applies to **professions** and **institutions** simultaneously. Same code, two flows. Same admin queue, two tabs.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- `professions` + `institutions` tables (Phase 0 + 1.5) — canonical taxonomies, FK targets
- `/admin/taxonomy` Phase 7 admin CRUD for professions + skills + provinces + cities — institutions are **missing** from this surface today. 9.15 adds them.
- `<ComboboxField>` Phase 9.14.x — searchable select with built-in "no matches" footer text; 9.15 extends it with an optional `allowOther` prop
- `profiles.profession` + `academic_profiles.institution_slug` columns — current shape unchanged
- `lib/notifications/server.ts` + the notification catalog — new kind `taxonomy.suggestion.received` slots in
- `lib/audit/` — new audit kinds slot in
- `/admin/taxonomy` page structure (tabs for each kind) — new "Suggestions" tab adds to it; institution CRUD also lands here

---

## 🔒 LOCKED DECISIONS

### D0 — One combined phase, not two
Same DB table, same admin queue, same notification kind. Splitting professions + institutions into separate phases would double the engineering with zero design benefit. Single phase.

### D1 — Schema: Option A (no new column on profiles/academic_profiles)
The canonical column (`profiles.profession`, `academic_profiles.institution_slug`) stores the user-entered free-text directly when "Other" is selected. **NO new `profession_custom` column.** Reasons:
- Avoids a 2-column read pattern in every query that touches profession/institution
- The existing `/insights` heatmap (which JOINs to taxonomy via `lower(label) = lower(p.profession)`) already handles orphan strings — they fall through to the raw value + suppress out by k-floor naturally
- Cleaner backfill on promotion: a single UPDATE matching the old free-text to the canonical value

Trade-off: until admin promotes / merges, a free-text profession is a one-off cell. That's correct — it shouldn't surface in aggregates yet.

For institutions specifically, `academic_profiles.institution_slug` is a FK to `institutions.slug`. To accommodate free-text, we'll need to drop the FK constraint OR introduce a sentinel slug `other--<random>` for free-text. **Sub-decision**: drop the FK + add a CHECK constraint that the slug exists in `institutions` table OR matches the pattern `other--*`. This keeps referential integrity for the canonical case while permitting the free-text case.

### D2 — New `taxonomy_suggestions` table
One table for both kinds, discriminated by `kind` enum:

```sql
CREATE TYPE taxonomy_suggestion_kind AS ENUM ('profession', 'institution');
CREATE TYPE taxonomy_suggestion_state AS ENUM ('pending', 'promoted', 'merged', 'rejected');

CREATE TABLE taxonomy_suggestions (
  id                  text PRIMARY KEY,
  kind                taxonomy_suggestion_kind NOT NULL,
  custom_text         text NOT NULL,          -- what the user typed
  submitted_by_user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  submitted_at        timestamp NOT NULL DEFAULT now(),
  state               taxonomy_suggestion_state NOT NULL DEFAULT 'pending',
  resolved_by_user_id text REFERENCES app_user(id),
  resolved_at         timestamp,
  -- When promoted, the new canonical slug. When merged, the existing
  -- canonical slug it was merged INTO. When rejected, NULL.
  target_slug         text,
  -- Admin can leave a free-text note ("merged into existing  spelling fix")
  admin_note          text
);

CREATE INDEX taxonomy_suggestions_state_idx ON taxonomy_suggestions(state, kind);
CREATE INDEX taxonomy_suggestions_dedup_idx ON taxonomy_suggestions(kind, lower(custom_text));
```

### D3 — Notification dedupe by `(kind, lower(custom_text))`, not by user
If 10 users type "Damelin College" on the same day, admins should see ONE entry in the queue (with submitter_count=10), not 10 separate suggestions. A bell notification fires when a NEW unique (kind, lower(custom_text)) lands in `pending` state — repeat submissions of the same text increment a counter (or simply spawn additional suggestion rows that get merged in the admin view by `lower(custom_text)`). I prefer the latter — keeps the table simple, lets admin see all submitters if needed.

Notification kind:
```
taxonomy.suggestion.received
  audience: all_admins
  defaultInApp: true
  defaultEmail: false  (queue page is the canonical surface; no need to email)
  dedupeWindowSeconds: 24 * 60 * 60  (one bell ping per unique text per day)
```

### D4 — Admin action set
On `/admin/taxonomy/suggestions` (new tab on the existing `/admin/taxonomy` page):

| Action | Effect |
|---|---|
| **Promote** | Adds `(slug, label)` to the canonical taxonomy. Backfills: `UPDATE profiles SET profession = '<canonical label>' WHERE lower(profession) = lower(<custom_text>)`. Sets suggestion `state='promoted'`, `target_slug=<new slug>`, `resolved_*`. Audit `taxonomy.suggestion.promote`. |
| **Edit & promote** | Admin can fix spelling/casing first ("Damelin Collage" → "Damelin College") before promoting. Same backfill from the ORIGINAL custom_text to the corrected canonical label. |
| **Merge into existing** | Admin picks an existing canonical entry from a fuzzy-match dropdown. Backfill updates matching rows to the existing canonical value. Sets suggestion `state='merged'`, `target_slug=<existing>`. Audit `taxonomy.suggestion.merge`. |
| **Reject** | Admin rejects (spam/joke). Sets `state='rejected'`. **The user's profile is NOT modified** — their entered text stays on their profile (it's their data). Future renderings of that profile show their free-text + a quiet "Verification: unverified" badge. Audit `taxonomy.suggestion.reject`. |

### D5 — Backfill direction is always free-text → canonical
Never the other way. If admin promotes "Damelan" to canonical, only profiles that currently have "Damelan" stored get updated to the canonical label. Profiles that already have a different canonical entry are untouched.

### D6 — Institutions get admin CRUD on `/admin/taxonomy` as part of this phase
Currently the admin taxonomy surface covers professions, skills, provinces, cities — but **not institutions**. 9.15 adds the institutions tab so admins can also add/edit/remove institutions outside the suggestion flow (e.g. when a partner institution comes onboard ahead of any user requesting them). Same shape as the existing tabs.

### D7 — "Other" UI is conditional + inline
The `<ComboboxField>` gains an `allowOther` prop. When set, the dropdown shows an "Other (specify)" footer option. Selecting it transforms the field into a text input where the user types free-text. There's a visible "I picked from the list" link to revert. Mobile-first.

### D8 — Audit log shape
Four new audit kinds:
- `taxonomy.suggestion.submit` — actor: submitter; subject: suggestion.id; meta: `{ kind, customText }`
- `taxonomy.suggestion.promote` — actor: admin; subject: suggestion.id; meta: `{ kind, newSlug, newLabel, backfilledRows }`
- `taxonomy.suggestion.merge` — actor: admin; subject: suggestion.id; meta: `{ kind, targetSlug, backfilledRows }`
- `taxonomy.suggestion.reject` — actor: admin; subject: suggestion.id; meta: `{ kind, customText, reason? }`

`backfilledRows` lets admin verify the promotion landed cleanly + lets the oversight log reason about scope.

### D9 — Validation + abuse defence
- Custom text: trim + collapse whitespace + reject if length < 2 or > 80 chars
- Reject if matches an existing canonical entry case-insensitively (the user should just pick that one; ComboboxField search would have surfaced it)
- Rate-limit: max 5 suggestions per user per day (anti-spam). Use Phase 9 in-memory rate limiter.
- Admin can BLOCK a custom_text pattern via the reject reason — future submissions of the same text auto-reject (post-launch polish, not in this phase).

### D10 — POPIA + retention
Custom text is PII-ish (can hint at workplace / education attributes). Suggestion rows respect retention:
- When the submitter's account is hard-deleted (Phase 8 cron), CASCADE deletes the suggestion row too
- Resolved suggestions (promoted / merged / rejected) older than 365 days get archived (admin reference only)
- Audit log retention follows the existing 7-year rule

---

## 📋 TASKS

### Task 9.15.1: Schema + migration
- [ ] Migration `0024_phase9_15_taxonomy_suggestions.sql`:
      - New enums: `taxonomy_suggestion_kind`, `taxonomy_suggestion_state`, audit kinds (4 new)
      - New `taxonomy_suggestions` table per D2
      - Drop FK constraint on `academic_profiles.institution_slug` + add CHECK that the slug exists in `institutions(slug)` OR matches `other--*` pattern (D1 sub-decision)
- [ ] Drizzle schema mirrors the migration
- [ ] Journal entry

### Task 9.15.2: ComboboxField extension
- [ ] New prop `allowOther: boolean`
- [ ] When set, list footer shows "Other (specify)" option
- [ ] On selection, field transforms to a text input with a "Pick from list" revert link
- [ ] State stays the same shape (`value: string`); free-text is just a string value not in the options array
- [ ] Mobile + desktop variants handled

### Task 9.15.3: Suggestion-write Server Action
- [ ] New `lib/taxonomy/suggestions.ts` with `submitTaxonomySuggestion({ kind, customText })`:
      - Validate (length, whitespace, not-already-canonical) per D9
      - Insert into `taxonomy_suggestions` table
      - Fire `taxonomy.suggestion.received` notification to all admins (dedupe per D3)
      - Audit-log `taxonomy.suggestion.submit`
- [ ] Called from sign-up flow + profile editor + vacancy form (for profession) + student section (for institution)
- [ ] Rate-limit per D9 (5 per user per day)

### Task 9.15.4: Notification catalog entry
- [ ] New `taxonomy.suggestion.received` per D3
- [ ] Email template optional (default off so no template needed at ship time)

### Task 9.15.5: Admin queue page + actions
- [ ] New tab on `/admin/taxonomy` → "Suggestions" tab with two sub-tabs (profession / institution)
- [ ] Lists pending suggestions grouped by `lower(custom_text)` so dupes cluster, sorted by submitter-count DESC then submitted_at DESC
- [ ] Each row: custom_text + submitter count (e.g. "5 users") + first-submitted date + 4 action buttons
- [ ] **Promote** Server Action: insert into canonical table + backfill profiles/academic_profiles + set state='promoted' + audit
- [ ] **Edit & promote**: admin types corrected label first, then same as Promote with the corrected value
- [ ] **Merge into existing**: fuzzy-match dropdown of existing canonical entries (case-insensitive substring); admin picks one, backfill runs, state='merged' + audit
- [ ] **Reject**: admin enters optional reason; state='rejected'; profile data UNTOUCHED per D4 + audit

### Task 9.15.6: Institution admin CRUD (D6)
- [ ] Extend `/admin/taxonomy` with institutions tab (add / edit slug+label / soft-delete)
- [ ] Add migration column `institutions.deleted_at` for soft-delete (orphan academic_profiles handled — soft-delete just hides from picker; doesn't break FK)

### Task 9.15.7: Compliance assertions
Three new assertions on `/api/admin/outcomes-compliance`:
- [ ] `taxonomy-suggestions-validate`  no suggestion row has empty or whitespace-only custom_text
- [ ] `taxonomy-suggestions-rejected-preserve-data`  for every rejected suggestion, the submitter's profile/academic row still contains the rejected custom_text (D4 contract  rejection never erases user data)
- [ ] `promotion-backfill-complete`  after a `promoted` or `merged` suggestion, no profile/academic row remains with the OLD custom_text

### Task 9.15.8: Seed fixtures
- [ ] 3 demo suggestions in the seed: one pending profession ("Game Ranger", submitted by a seeker), one merged institution ("Damelin" → "Damelin College" assuming Damelin College gets canonicalised), one rejected ("asdfasdf" submission demonstrating spam path)
- [ ] So `/admin/taxonomy/suggestions` renders real rows on first sign-in

### Task 9.15.9: POPIA, wiring, verification, doc convention
- [ ] CASCADE delete tested: deleting a user via Phase 8 hard-delete cron removes their suggestions too
- [ ] Audit kinds documented in `lib/audit/index.ts`
- [ ] Compliance assertions wired into `/api/admin/outcomes-compliance` (now **22 assertions**)
- [ ] `npm test` green; `npm run typecheck` clean; `npm run build` clean
- [ ] On ship: `docs/completed/PHASE_9_15_COMPLETE.md`; tick 9.15 in `ROADMAP.md` ✅; refresh `TO_START_EVERY_SESSION.md`; commit `Phase 9.15 complete  taxonomy suggestion queue`

---

## 🚫 OUT OF SCOPE FOR 9.15 (explicit guardrails)

- ❌ **Skills "Other" + suggestion path** — skills are controlled enough today; if a need emerges post-launch, the same mechanism extends to a `kind='skill'` enum entry with zero rework
- ❌ **Provinces / cities "Other"** — SA geography is fixed; no need
- ❌ **Auto-promotion rules** (e.g. "if 50 users suggest the same thing, auto-promote") — admin discretion only; auto-promotion risks polluting the taxonomy
- ❌ **External taxonomy sources** (SAQA / DHET API integration to auto-validate institutions) — that's the dormant Phase 8 SAQA adapter territory
- ❌ **Suggestion-level rejection-reason templates** — admin types free-text for now; canned reasons can land in a future polish
- ❌ **Submitter notification** ("your suggestion was promoted") — nice-to-have; defer unless user feedback asks
- ❌ **Bulk admin actions** (promote 10 dupes at once) — the queue dedupes via grouping, so individual approvals work fine at pilot scale; bulk lands when volume justifies

---

## ⚠️ RISK AREAS

1. **Backfill scope** — promoting a popular suggestion ("Cape Town University" → "University of Cape Town") might backfill thousands of rows. The backfill must be inside the same transaction as the promotion so a failure rolls back cleanly. For larger backfills (>5K rows), consider chunking with `LIMIT/OFFSET` — but at pilot scale, single-transaction is fine.

2. **FK drop on `academic_profiles.institution_slug`** is the most structurally invasive bit. The CHECK constraint replacement needs to verify that admin-deleted institutions don't strand profiles either — soft-delete on institutions (D6) covers this.

3. **Custom text collisions** — two different users might type slightly different versions of the same intent ("Damelin", "Damelin College", "Damelin Education"). The admin queue groups by `lower(custom_text)` which catches exact matches but not these near-dupes. The admin needs to use the "Merge into existing" action sequentially on each. Acceptable at pilot scale; clustering UX is post-launch polish.

4. **Notification storm** if many users submit different texts in a short window — the dedupe is per (kind, custom_text), so 100 different "Other" texts in one day = 100 bell notifications. Mitigation: per-admin `notification_prefs` already lets each admin opt out of `taxonomy.suggestion.received`. Plus the dedupeWindowSeconds: 24h cap.

5. **POPIA — the submitter's identity is in the audit trail**, linked to their custom text. If a custom text is reputationally sensitive ("my role at Acme Corp"), the audit log carries that linkage. Worth flagging in the DPIA addendum that the suggestion table is treated as PII-grade storage.

---

## 🧭 WHY THIS DESERVES ITS OWN PHASE

Two reasons:
- **It's a meaningful new system surface** — new table, new admin queue, new notification, four new audit kinds, three new compliance assertions
- **It changes the canonical taxonomy contract** in a way that ripples to analytics — every gov-facing aggregate (Justification Index, decline reasons, curriculum, stall reasons) now needs to assume orphan free-text exists. The compliance assertions catch the structural cases; the design documentation is the reasoning record.

Phase 9.14 fixed the verification badge so it reflects reality; 9.15 extends the same Verification-Honesty + Civic-Editorial philosophy to taxonomy — the catalogue stays clean, but real people with unusual jobs/educations can onboard without being told "your work doesn't fit our list."

---

*Plan opened 2026-05-26. Target: complete before Phase 10 (public launch) opens. Bounded scope (~1 focused session) given the existing infrastructure (`/admin/taxonomy`, `<ComboboxField>`, notification + audit + compliance machinery all in place).*
