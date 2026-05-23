# Phase 5 — The Employer Portal · ✅ COMPLETE

**Shipped:** 2026-05-23

> Phase 5 turns Sebenza from a directory into a national talent-intelligence platform. Employers can now reveal candidate contacts (consent-gated, audit-logged), download verified documents (separate audit), and log confirmed placements that feed the live national hire count. Without confirmed placements, Phase 6 analytics would be guesses; Phase 5 is the data-quality lever.

---

## 1 · What shipped

### Schema (migration `0002_phase5_employer.sql`)
- `placements.actor_user_id` — who clicked "Mark as hired" (accountability)
- `placements.salary_band` — optional, kept private; never in public reads
- `saved_searches` — per-org saved filter sets; `filters` as JSONB so the schema doesn't migrate for every new filter
- `shortlist_pools` + `shortlist_members` — per-org talent pools with composite PK
- Indices: `placements_org_idx`, `placements_profile_idx`, `placements_hired_at_idx`, `saved_searches_org_idx`, `shortlist_pools_org_idx`, `shortlist_members_profile_idx`

### Server actions (`lib/employer/*`)

#### [`reveal.ts`](../../lib/employer/reveal.ts)
- **`revealContact({ handle })`** — three-lock gate:
  1. `verifyOrgVerified()` (redirects to `/employer/organisation` if not)
  2. Seeker has `contact_reveal` consent in `granted` state
  3. Audit-logs `profile.contact.reveal` with `meta = { orgId, handle, consentVersion }`
  
  Returns `{ email, city, consentVersion, revealedAt }`. No silent failures — every block surfaces a clear message.
- **`downloadQualification({ qualificationId })`** — same three locks but for `document_sharing` consent. Mints a 60s signed Supabase URL; audit-logs `profile.document.download` with the qualification id + title.

#### [`placements.ts`](../../lib/employer/placements.ts)
- **`markAsHired({ handle, role, city, hiredAt, salaryBand? })`** — Placement-Truth Rule with the **30-day reveal gate**: the audit log must contain a `profile.contact.reveal` row for THIS org targeting this profile in the last 30 days. Without one, you cannot log a hire for someone whose contact you never saw. Audit-logs `placement.confirm` and triggers ISR refresh on `/insights`.
- **`deletePlacement({ placementId })`** — scoped to org; audit-logs `placement.delete`.

#### [`saved-searches.ts`](../../lib/employer/saved-searches.ts)
- **`saveSearch({ name, filters })`** — runs the search once to populate `newMatchesCount`, writes audit row.
- **`runSavedSearch({ id })`** — re-executes against live profiles, updates `newMatchesCount + lastRunAt`. We never snapshot the result set.
- **`deleteSavedSearch({ id })`** — scoped to org.
- **`loadSavedSearches()`** — server-side loader for the page.

#### [`shortlists.ts`](../../lib/employer/shortlists.ts)
- **`createPool({ name, description })`** / **`deletePool({ poolId })`**
- **`addToPool({ poolId, handle })`** / **`removeFromPool({ poolId, handle })`** — both audit-logged. `ON CONFLICT DO NOTHING` makes double-adds idempotent.
- **`loadPools()`** — pools + their members in two round-trips (pools query, then members in one `IN` query).

### New page: [`/employer/dossier/[handle]`](../../app/[locale]/(employer)/employer/dossier/[handle]/page.tsx)
The centrepiece of Phase 5. Renders:
- Full candidate header (avatar + photo + verification badge + StatusChip + location)
- Bio, skills, experience, qualifications (verified ones with download buttons)
- **Right-rail action stack**:
  - `ContactRevealCard` — three states: already-revealed (shows cached contact with audit indicator), reveal-available (button), reveal-blocked (consent not granted, disabled with explanation)
  - `MarkAsHiredCard` — gated on the 30-day prior reveal; shows existing placement receipt if logged; inline form for the new placement
  - `DataSpine` with member-since, completeness, optional studies snippet, link to public profile
- Banner if the employer's org isn't verified (redirect happens upstream via `verifyOrgVerified`, but this is the belt-and-braces UI)

### Client islands
- `ContactRevealCard.tsx` — handles all three reveal states; surfaces consent state honestly
- `QualificationDownloadButton.tsx` — per-row; sniffs document_sharing consent; opens signed URL in new tab
- `MarkAsHiredCard.tsx` — inline form with role/city/date/optional salary; client-side guard mirrors server gate
- `PlacementDeleteButton.tsx` — confirmation prompt before deleting (it bumps the national hire count back down)
- `SavedSearchesManager.tsx` — list + add + run + delete CRUD
- `ShortlistsManager.tsx` — pool create/delete + member remove

### Wired pages
- `/employer` — real KPIs (saved searches, shortlist pools, this-month reveals, this-month placements); recent matches preview from live search; "Open dossier" link on each result
- `/employer/placements` — real placements list, delete with confirmation, empty state when no rows
- `/employer/saved-searches` — real saved-searches CRUD
- `/employer/shortlists` — real pools CRUD with member chips

### Audit log
Added 10 new event kinds: `profile.contact.request`, `placement.confirm`, `placement.delete`, `profile.shortlist.add`, `profile.shortlist.remove`, `search.saved`, `search.saved.run`, `search.saved.delete`, `pool.create`, `pool.delete`. Phase 5 seeker activity feed (`getSeekerActivity` from Phase 3 audit) automatically surfaces `profile.contact.reveal` and `profile.document.download` events with real `actor = userId` and `meta.orgId` now that the reveal flow is live.

---

## 2 · Re-checks honoured (from `docs/completed/PHASE_5_PLAN.md`)

| # | Decision | Outcome |
|---|---|---|
| 1 | Three locks on every reveal (verified org + consent + audit) | ✅ Enforced in `revealContact` + `downloadQualification`; never silent |
| 2 | "Contact" = email + city (phone deferred) | ✅ Phone moves to Phase 8 with SMS verification |
| 3 | Document download is a separate audit kind | ✅ `profile.document.download` writes own row |
| 4 | "Mark as hired" gated on 30-day prior reveal | ✅ Direct `audit_log` query checks for prior `profile.contact.reveal` row from this org |
| 5 | Saved searches + shortlists are per-org | ✅ Every CRUD scoped to `session.orgId` |
| 6 | Search-side filter for "open to internships / graduate programmes" | ⚠️ Deferred — schema flag exists; filter UI wires when the search filter set gets its Phase 6 polish |
| 7 | Doc convention | ✅ This file + smoke test + Phase 6 plan + ROADMAP tick + commit |

---

## 3 · Verification

- **Typecheck:** ✅ clean (`npx tsc --noEmit`)
- **Build:** ✅ clean — all 8 employer routes dynamic (ƒ), including the new `/employer/dossier/[handle]`
- **Live DB smoke:** see `docs/completed/PHASE_5_SMOKE_TEST.md`

---

## 4 · What Phase 5 deliberately deferred

- **`open_to_internships` / `open_to_graduate_programmes` filter** in /search — schema flag exists; UI wires alongside the Phase 6 search polish
- **"Add to pool" from a dossier or search result** — the `addToPool` action exists; the in-context UI lands in a small Phase 5 follow-up when we add the search-results action menu
- **Seeker email notification** on `placement.confirm` ("Discovery Bank logged you as hired — is your status now 'employed'?") — Phase 8 with Resend
- **Saved-search alerts** ("3 new matches this week") — Phase 8 (cron + email)
- **Skills-gap engine + the demand-vs-supply analytics that surface why a candidate is the right fit** — Phase 6
- **Org KYC** (instead of admin-flips-the-flag) — Phase 8
- **2FA enforcement for employer + admin** — Phase 7
- **Materialised view for `analyticsSnapshotQuery`** — Phase 6 (rollups)

---

## 5 · Files added / changed

```
NEW  db/migrations/0002_phase5_employer.sql
NEW  lib/employer/reveal.ts
NEW  lib/employer/placements.ts
NEW  lib/employer/saved-searches.ts
NEW  lib/employer/shortlists.ts
NEW  components/feature/employer/ContactRevealCard.tsx
NEW  components/feature/employer/QualificationDownloadButton.tsx
NEW  components/feature/employer/MarkAsHiredCard.tsx
NEW  components/feature/employer/PlacementDeleteButton.tsx
NEW  components/feature/employer/SavedSearchesManager.tsx
NEW  components/feature/employer/ShortlistsManager.tsx
NEW  app/[locale]/(employer)/employer/dossier/[handle]/page.tsx

MOD  db/schema.ts                                          (3 new tables + 2 placement cols)
MOD  db/migrations/meta/_journal.json                      (register 0002)
MOD  lib/audit/index.ts                                    (10 new AuditKinds)
MOD  app/[locale]/(employer)/employer/page.tsx             (real KPIs + recent placements)
MOD  app/[locale]/(employer)/employer/placements/page.tsx  (real list + delete)
MOD  app/[locale]/(employer)/employer/saved-searches/page.tsx (real CRUD)
MOD  app/[locale]/(employer)/employer/shortlists/page.tsx  (real CRUD)
```
