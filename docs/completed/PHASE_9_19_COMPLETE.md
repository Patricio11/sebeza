# PHASE 9.19 COMPLETE  VACANCY MATCH ENRICHMENT + INVITE-FLOW POLISH
*Shipped 2026-05-29. Plan: [`docs/completed/PHASE_9_19_PLAN.md`](./PHASE_9_19_PLAN.md). Closes the gap where the vacancy form was the bottleneck: matcher couldn't ask for work availability, years of experience, or NQF level even though seekers carried them  and the invite flow stayed flat after the bulk-invite went out.*

> **One-line summary**: The vacancy form learns three new match axes (work availability, min years, min NQF), the match page gains filter chips + sort + per-(org, vacancy) shortlist, and the invite flow grows a personal note + duplicate-vacancy + opt-in follow-up nudge cron + per-vacancy accept-rate strip. Every axis is vacancy-optional (D0)  blank means the matcher ignores it.

Three independently shippable tiers, all in:

- **Tier 1** `fcd4c8d`  vacancy schema + form + matcher
- **Tier 2** `e8112ea`  match page filter chips, sort, shortlist
- **Tier 3** `6f5462d`  invite-flow polish (note, duplicate, nudges, accept-rate)

---

## 🎯 WHAT SHIPPED  TIER 1 (vacancy match enrichment)

### A  Three new vacancy columns
Migration `0031_phase9_19_vacancy_match_fields.sql`:
- `work_availability work_availability_kind[] NOT NULL DEFAULT '{}'`  empty array = no constraint
- `min_years_experience int` (nullable, 0–60 at the action layer)
- `min_nqf_level int` (nullable, 1–10 at the action layer)
- Partial index `vacancies_min_years_idx WHERE min_years_experience IS NOT NULL`

### B  `VacancyRow` + `rowToVacancy` exposes the new fields
`lib/employer/vacancies.ts` extended with the three columns + the Zod schema gates them at the action boundary. Both `createVacancy` insert + `updateVacancy` set() persist them.

### C  Matcher reads the new axes
`db/queries/profiles.ts:searchProfilesQuery` + `countMatchesByCitizenship` learned two new WHERE clauses:
- Years floor: `p.years_experience IS NOT NULL AND p.years_experience >= ${min}`  NULL on seeker doesn't pass (D2: "unknown is not a pass")
- NQF floor: `EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.profile_id = p.id AND ap.nqf_level >= ${min})`  no academic record = doesn't pass when the vacancy declares a floor

`SearchFilters` (`lib/mock/types.ts`) grew `minYearsExperience?: number | null` + `minNqfLevel?: number | null`. `vacancyToSearchFilters()` forwards the vacancy's values through to the matcher.

### D  Form UI
`VacancyForm.tsx` gained a new "Match requirements" section after "The role":
- Six work-availability chips (full_time / part_time / contract / casual / remote / hybrid)
- Min years number input (0–60, "leave blank if no requirement")
- Min NQF select (4–10, leverages the SAQA labels: Matric, Higher Cert, Diploma, Bachelor's, Honours, Master's, Doctorate)
- Persists via the existing `useSessionDraft` hook so locale-switching mid-edit keeps the draft

### E  Detail page "Match Requirements" strip
`/employer/vacancies/[id]` shows a small 3-column dl with work modes + years + NQF. Each field that's blank renders as "Any work mode / employment type" / "No minimum" / "Not required"  honest about what the matcher is and isn't checking.

---

## 🎯 WHAT SHIPPED  TIER 2 (match page polish + shortlist)

### F  `vacancy_shortlists` table
Migration `0032_phase9_19_shortlists_and_nudges.sql` (also carries Tier 3's nudges column):
- Per-(vacancy, profile) bookmark rows with cascade-on-delete from both parents
- Unique index on `(vacancy_id, profile_id)` so toggling is upsert/delete
- Scope is the vacancy, not the user (D5)  two team-mates share one shortlist per vacancy

### G  Shortlist server actions
`lib/employer/vacancy-shortlists.ts`:
- `addToVacancyShortlist({ vacancyId, profileId })`  idempotent ON CONFLICT DO NOTHING
- `removeFromVacancyShortlist({ vacancyId, profileId })`  idempotent on missing rows
- `getVacancyShortlistProfileIds(vacancyId)`  Set<string> for O(1) membership tests
- Not a consent surface  no `profile.shortlist.add` audit row (that path stays on the cross-vacancy talent pools surface)

### H  Match page chrome (BulkInviteIsland extended)
The existing `BulkInviteIsland` grew:
- "All matches (N)" / "Shortlist (M)" view tabs
- Chip strip: "All" clear-chip + 6 work-availability chips + 5+/8+ years quick-picks
- Sort dropdown: Best match (default) / Most recent status / Most complete profile / SA citizens first
- Per-row bookmark icon with optimistic update + rollback on failure
- All chip/sort logic is client-side (D4)  the already-fetched SEARCH_LIMIT-capped list is what the chrome refines

---

## 🎯 WHAT SHIPPED  TIER 3 (invite-flow polish)

### I  Per-invite personal note
`bulkInviteToVacancy` action gained an optional `personalNote` field (≤200 chars). When set:
- Appended to the `vacancy.invite` notification body so the seeker actually reads it (`"Note from {orgName}: …"`)
- Captured in audit meta as `{ note, notePii: true }`  reuses Phase 9.17's PII-flag pattern (D6), no new audit kind

The `BulkInviteIsland` modal shows a 200-char counter textarea labelled "Add a note (optional)" with an explainer about the org-private audit treatment.

### J  Duplicate-vacancy button
`/employer/vacancies` rows now render two CTAs (Open + Duplicate). The Duplicate link sends the recruiter to `/employer/vacancies/new?duplicateFrom={id}`; the create page reads that param server-side, pre-fills every form field via `getMyVacancy`, and suffixes the title with " (copy)". The new vacancy is its own draft  saving doesn't touch the source row (D7). No `templates` table.

### K  Follow-up nudges
- Migration 0032 adds `vacancies.follow_up_nudges_enabled boolean NOT NULL DEFAULT false` (D8  opt-in)
- New checkbox in the vacancy form Invite expiry section
- New cron route `/api/cron/vacancy-follow-up-nudges`  for every `invited`-state invitation older than 7 days on a flag-on vacancy, fires `vacancy.invite.followup` notification to the seeker
- Cap: one nudge per invite EVER, enforced by `NOT EXISTS` subquery on the notifications table (`meta->>'invitationId'`)
- New `vacancy.invite.followup` notification catalog entry + new `AuditKind`

### L  Accept-rate strip on vacancy detail
A new "Invitation outcomes" strip above the existing detail content shows five buckets:
- Sent / Accepted (accepted + accepted_with_notice) / Declined (declined + reconsidering) / Pending (invited) / Expired (expired + withdrawn)
- Acceptance percentage = accepted / (accepted + declined)  pending and expired don't sandbag the rate
- Vacancy-private only (D9)  no cross-vacancy comparison, no per-seeker breakdown
- When follow-up nudges are on AND there's pending volume, a one-line footer reminds the recruiter about the cadence

---

## ✅ LOCKED DECISIONS HONOURED

| # | Decision | Where it lives |
|---|---|---|
| **D0** | Vacancy is source of truth; every match axis is vacancy-optional | `vacancyToSearchFilters` forwards only what the vacancy declared; SearchFilters honour NULL as "skip axis" |
| **D1** | One enum, two-axis matching | Tier 1 reuses `work_availability_kind` 1:1 between seeker + vacancy + `&&` array-overlap |
| **D2** | Years experience is a hard floor, not a sort key | SQL clause excludes seekers without years; ranking still done by Phase 4 score |
| **D3** | NQF matches MAX(academic_profiles.nqf_level); NULL on vacancy = no NQF check at all | `EXISTS` subquery; many SA roles (trades, hospitality, casual labour, sales) don't require credentials and the form never forces a floor |
| **D4** | Match-page filter chips are client-side only | `BulkInviteIsland` filters the fetched list in JS; no new SQL round-trips |
| **D5** | Shortlist is per-(org, vacancy), not per-user | `vacancy_shortlists.vacancyId` is the unique key axis; talent pools stay on `/employer/shortlists` |
| **D6** | Per-invite note reuses Phase 9.17's PII flag | `meta.note + notePii: true` on the existing `vacancy.invite` audit row |
| **D7** | Duplicate = pre-fill, not a separate templates resource | `?duplicateFrom=` query param; no `templates` table |
| **D8** | Follow-up nudges are opt-in via a vacancy flag (default off) | `vacancies.follow_up_nudges_enabled boolean DEFAULT false` |
| **D9** | Accept-rate analytics are vacancy-private | The strip aggregates only this vacancy's invitations; never cross-vacancy |
| **D10** | One migration for Tier 1, separate for Tier 2 + Tier 3 | `0031` (Tier 1) + `0032` (Tier 2 shortlists + Tier 3 nudges column) |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0031_phase9_19_vacancy_match_fields.sql`
- `db/migrations/0032_phase9_19_shortlists_and_nudges.sql`
- `lib/employer/vacancy-shortlists.ts`
- `app/api/cron/vacancy-follow-up-nudges/route.ts`
- `docs/completed/PHASE_9_19_PLAN.md` (moved from `docs/`)
- `docs/completed/PHASE_9_19_COMPLETE.md` (this doc)

**Edited**
- `db/schema.ts`  vacancies table gets work_availability + min_years + min_nqf + follow_up_nudges_enabled; new `vacancyShortlists` table
- `db/migrations/meta/_journal.json`  appended idx 31 + 32
- `db/queries/profiles.ts`  searchProfilesQuery + countMatchesByCitizenship learned the two new filter axes
- `lib/mock/types.ts`  `SearchFilters` extended with `minYearsExperience` + `minNqfLevel`
- `lib/employer/vacancies.ts`  `VacancyRow` + `vacancyInputSchema` + create + update + `vacancyToSearchFilters` all extended; new `followUpNudgesEnabled` flag plumbed
- `lib/employer/invitations.ts`  `bulkInviteToVacancy` accepts optional `personalNote`; appends to body + meta
- `lib/notifications/catalog.ts`  `vacancy.invite.followup` entry
- `lib/audit/index.ts`  `vacancy.invite.followup` kind added
- `components/feature/employer/vacancies/VacancyForm.tsx`  Match requirements section + nudges checkbox
- `components/feature/employer/vacancies/BulkInviteIsland.tsx`  filter chips + sort dropdown + shortlist toggle + bookmark icon + personal-note textarea
- `app/[locale]/(employer)/employer/vacancies/page.tsx`  list cards restructure (Open + Duplicate); decline-reasons strip preserved
- `app/[locale]/(employer)/employer/vacancies/new/page.tsx`  `?duplicateFrom=` server-side prefill
- `app/[locale]/(employer)/employer/vacancies/[id]/page.tsx`  Match Requirements strip + Accept-rate strip
- `app/[locale]/(employer)/employer/vacancies/[id]/match/page.tsx`  passes shortlist + meta to the island, threads the two new server actions

**Verification**
- `tsc --noEmit` clean at every tier boundary
- `npx vitest run` 50/50 green
- `npm run build` succeeds; `/api/cron/vacancy-follow-up-nudges` registered in the manifest

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **No new `vacancy.invite.skip` reason for "shortlist filter active."** When the recruiter hits Send with the shortlist filter active, the bulk-invite action receives the same shape  only the candidate set differs. No new audit kind needed.

2. **No "you've been shortlisted" notification.** Shortlisting is a transient employer preference, not a consent surface. The seeker never knows.

3. **Years experience stays a pure filter, not a ranking signal.** Re-introducing years as a ranking weight is Phase 9.20+ territory once we see how the floor performs.

4. **Email default for `vacancy.invite.followup` is ON.** Same as the other transactional `vacancy.*` kinds. The dedupe cap (1/invite ever) is the harassment guard.

5. **NULL `min_years_experience` on a seeker doesn't pass a floor.** Conservative posture, matches every other "did the seeker tell us" filter. Single SQL change if we ever flip to optimistic.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/employer/vacancies/new`**  form gained Match requirements section + nudges checkbox
- **`/employer/vacancies/[id]`**  Match Requirements + Invitation Outcomes strips above the existing detail
- **`/employer/vacancies/[id]/match`**  filter chips + sort + shortlist tabs + bookmark icons; bulk-invite modal grew the optional note
- **`/employer/vacancies`**  list cards refactored to host two CTAs (Open + Duplicate)
- **Seeker `vacancy.invite` notification**  body now includes the personal note line when present
- **Seeker dashboard**  gains a one-time `vacancy.invite.followup` notification on flag-on vacancies after 7 days of silence
- **Audit log**  one new kind (`vacancy.invite.followup`)
- **Notification preferences**  one new kind, default in-app + email ON (transactional posture)

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved from the plan)

- ❌ Cross-vacancy analytics dashboard (D9  vacancy-private only)
- ❌ Vacancy templates as a top-level resource (D7  duplicate-from-existing covers it)
- ❌ AI-suggested vacancy field completion
- ❌ Years experience as a ranking signal (D2)
- ❌ Boolean "must have" vs "nice to have" skill split
- ❌ Default-on follow-up nudges (D8)
- ❌ A `templates` table

---

## 🧪 HOW TO VERIFY

1. Run migrations: `npm run db:migrate` to land 0031 + 0032.
2. Create a vacancy: set work_availability + min years + min NQF; confirm the matcher narrows the candidate list accordingly on `/employer/vacancies/[id]/match`.
3. On the match page: toggle work-availability chips + the years quick-picks; flip between "All matches" and "Shortlist" tabs; bookmark a row and confirm it survives the tab swap.
4. Duplicate the vacancy via the list-card button; confirm the new page is pre-filled with " (copy)" in the title and saving creates a fresh draft.
5. Send a bulk-invite with a 200-char note; check the seeker's notification body includes the note line.
6. Set `follow_up_nudges_enabled = true` on a vacancy with an invited seeker > 7 days ago; hit the cron with `Bearer ${CRON_SECRET}`; confirm a single `vacancy.invite.followup` fires and a second invocation is silent.
7. Open `/employer/vacancies/[id]` with at least one invitation in each state; confirm the Invitation Outcomes strip math (Accepted / (Accepted + Declined)).

---

*Phase 9.19 turned the vacancy from a shallow specification into a sharper match axis vehicle, and the match page from "list of 50" into a triage surface. The invite flow now carries a human note alongside the data and the recruiter sees how their hiring is actually working out without leaving the workspace.*
