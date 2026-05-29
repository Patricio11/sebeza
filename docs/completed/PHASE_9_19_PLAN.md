# PHASE 9.19 PLAN — Vacancy match enrichment + invite flow polish

*Plan opened 2026-05-29. Companion: `docs/ROADMAP.md`. Targets sign-off before code lands.*

---

## 🎯 WHAT THIS PHASE IS

Phase 9.8 shipped the vacancy → match → bulk-invite loop. Phase 9.17 shipped employer-initiated seeker invites. Phase 9.18 captured Remote / Hybrid plus the four employment types on the seeker side. **Today the vacancy form is the bottleneck**: it asks for profession + skills + province + city + seniority and stops, while seekers carry years of experience, NQF level, and work availability that the matcher never gets to consult.

Phase 9.19 closes that gap in three tiers, all shipped under one phase header because they share the vacancy-match seam and would otherwise need three round-trips through the schema, the form, the matcher, and the docs.

- **Tier 1 — Vacancy form enrichment for sharper matching.** Adds work availability + min years of experience + min NQF level to the vacancy schema + form + matcher. Sharpens every existing vacancy → match → invite flow immediately.
- **Tier 2 — Match page filter / sort / shortlist.** Lets the employer refine the matched set *before* inviting (work-mode chip filter, sort options, "save as shortlist" so they can build a list across multiple visits).
- **Tier 3 — Invite-flow polish + new functionality.** Per-invite personal note, "duplicate vacancy" template, gentle follow-up nudge cron, accept-rate analytics on the vacancy detail.

Each tier is **independently shippable**. Stopping after any tier leaves the others as separate commits.

---

## 🔒 LOCKED DECISIONS

### D0 — The vacancy is the source of truth; every match axis is optional

**Cross-cutting principle, applies to D1 / D2 / D3 + every future matcher field.** Every match dimension is **vacancy-optional**. If the vacancy leaves the field blank, the matcher does not constrain on that axis. Specifically:

- **Work availability** — empty `work_availability` array → matcher ignores work-mode + employment-type; every seeker passes this axis.
- **Min years of experience** — NULL `min_years_experience` → matcher ignores years; every seeker passes.
- **Min NQF level** — NULL `min_nqf_level` → matcher ignores qualifications; every seeker passes, **including seekers with no academic record at all**. (Many SA roles  trades, hospitality, casual labour, sales  do not require any formal qualification and an employer recruiting for one of these should not be forced to declare otherwise just to use the platform.)

This is the contract: **the employer declares what the role needs; the matcher honours that declaration and ignores the axes the employer left blank.** Future tiers that add new match fields must follow the same rule  no axis is ever "always on."

The form UI must reinforce this. Every match-related field carries an inline hint: *"Leave blank if this isn't a requirement."* The vacancy detail page renders the unset axes as "No minimum" / "Any work mode / employment type" rather than hiding them silently  honesty about what the matcher is and isn't filtering on.

### D1 — One enum, two-axis matching (Tier 1)

Vacancy's `work_availability` mirrors the seeker column 1:1 — same `work_availability_kind` enum (casual / part_time / contract / full_time / remote / hybrid). This conflates work-mode and employment-type just like Phase 9.18 did on the seeker side. **It is the right call** because the two columns must match on the same enum for the array-overlap (`&&`) filter to work without a translation layer.

**Match semantics:** if the vacancy declares `work_availability = ['full_time', 'remote']` and a seeker is open to `['full_time']` (but not remote), they STILL match on the `full_time` axis — array-overlap requires only one shared value. This is deliberate: the employer can decide whether the lack of "remote" matters per candidate; the matcher's job is to surface *plausible* matches, not perfect ones. Empty vacancy array = "no constraint on this axis" (current behaviour).

### D2 — Years experience is a hard floor, not a sort key (Tier 1)

`min_years_experience` filters out seekers below the threshold; it does **not** re-rank above the threshold. A vacancy that requires 5+ years gets seekers with 5, 7, and 12 years in the existing Phase 4 ranking order (skill / freshness / completeness / citizen-boost). Re-introducing years as a ranking signal is Phase 9.20+ territory once we see how the floor performs in practice.

NULL years on a seeker (Phase 9.9 "rather not say") is treated as **does not pass the floor** — same conservative posture as every other "did the seeker tell us" filter. If we ever want to flip that to "include unknowns optimistically," it's a single SQL change.

### D3 — NQF level matches against the seeker's *highest* academic record (Tier 1)

`min_nqf_level` checks `MAX(academic_profiles.nqf_level)` per profile. A seeker with two records (NQF 6 diploma + NQF 8 honours) passes a `min_nqf_level = 7` filter.

**Only applies when the vacancy declares a floor.** NULL `min_nqf_level` = no NQF check at all; every seeker passes regardless of whether they have any academic record. Per D0, many SA roles (trades, hospitality, casual labour, sales) do not require any formal qualification  the platform must support recruiting for those without forcing the employer to set a fictitious floor. **The default is "NQF doesn't matter for this role"**; the field only constrains when the employer explicitly says it does.

When the vacancy does declare a floor, a seeker with no academic record at all does not pass it  honest posture: the floor exists because the role needs a credential; if we don't know whether the seeker has one, the matcher should not pretend.

### D4 — Match-page filter chips are client-side only (Tier 2)

The filter chips on `/employer/vacancies/[id]/match` refine the **already-fetched** SEARCH_LIMIT-capped list in the client. They do NOT re-run the matcher with tighter filters. This matters because the chips are "let me see only the remote-open subset of these 50" — quick visual triage — not "give me 50 more matches that fit my new criteria." If an employer wants the latter, they edit the vacancy itself (where the persistent fields live).

### D5 — Shortlist is per-(org, vacancy), not per-user (Tier 2)

The "save as shortlist" affordance writes to a new `vacancy_shortlists` table scoped to the *vacancy*, not the user. Two team members editing the same vacancy work off the same shortlist. Per-user shortlists across vacancies live on `/employer/shortlists` (the existing Talent Pools surface) — not duplicated here.

Removing from the shortlist is symmetric to adding; no audit kind needed (shortlists are not a consent surface).

### D6 — Per-invite personal note reuses Phase 9.17's PII flag (Tier 3)

The 200-char note on a vacancy invitation gets the same audit-log treatment as the Phase 9.17 seeker invite: `meta.note` flagged as PII for any future data-export sweep. Same rate limit (50/day per org), same cooldown semantics, same `kyc.review`-style admin oversight path if reported.

We do **not** introduce a new audit kind — the existing `vacancy.invite` audit row gains an optional `meta.note` field.

### D7 — Vacancy template = "duplicate from existing," not a separate Templates resource (Tier 3)

A button on the vacancy list page: "Duplicate" → opens the create-vacancy form pre-filled with the source vacancy's values, with the title suffixed " (copy)" so the employer can rename. No `templates` table, no "save as template" affordance, no template library. This covers 95% of the real use case (two similar roles in a row) without committing to a templates abstraction we may regret.

### D8 — Follow-up nudges are opt-in via a vacancy setting, not a default (Tier 3)

A new boolean `vacancies.follow_up_nudges_enabled` (default false). When true, a nightly cron looks for invited seekers who haven't responded in 7 days and fires a single notification per invite per cron run (deduped via existing `notifications.dedupeKey` pattern). Cap at 1 nudge per invite ever — re-nudging is harassment.

Opt-in default because: today no seeker expects a follow-up; turning it on by default would feel like spam to early adopters. Once we see how often employers flip it on, we can revisit.

### D9 — Accept-rate analytics are vacancy-private (Tier 3)

`/employer/vacancies/[id]` gets a small stats strip: "Sent N · Accepted M · Declined K · Pending L · Expired P". Per-vacancy only, never cross-vacancy comparison, never per-seeker breakdown. POPIA-clean: the underlying data is the org's own invitation rows; we just aggregate.

No new audit kinds. No new compliance assertions (the data already exists, we're just reading it).

### D10 — All three tiers share one migration if possible (Tier 1 + 2 + 3)

Migration `0031_phase9_19_vacancy_match_fields.sql` covers Tier 1 (work_availability + min_years + min_nqf). If Tier 2's `vacancy_shortlists` table and Tier 3's `vacancies.follow_up_nudges_enabled` column ship in the same week, they fold into a follow-up migration `0032_phase9_19_shortlists_and_nudges.sql` rather than one fat migration. Smaller, reversible, easier to roll back.

---

## 📦 TASK LIST

### Tier 1 — Vacancy form enrichment (sharpest matching impact)

- **9.19.1.1 Migration** `0031_phase9_19_vacancy_match_fields.sql` — adds `work_availability` (work_availability_kind[], default '{}'), `min_years_experience` (int, nullable), `min_nqf_level` (int, nullable) + partial index on min_years_experience. ✅ drafted.
- **9.19.1.2 Schema** — extend the `vacancies` Drizzle table in `db/schema.ts` with the three columns.
- **9.19.1.3 Form** — extend `<VacancyForm>` (and its `VacancyFormValue` + `VacancyDraft` types) with:
  - A work-availability multi-select chip block (mirrors the seeker sign-up UI; six checkable chips). Empty = "no constraint."
  - A minimum years of experience number input (0–60, NULL = "no constraint").
  - A minimum NQF level select (NQF 1 through NQF 10, with the existing `NQF_LEVELS` taxonomy labels).
  - Persist all three via the existing `useSessionDraft` hook so the locale-switcher fix from Phase 9.18 keeps working.
- **9.19.1.4 Server actions** — extend `createVacancy` + `updateVacancy` schemas + insert/update calls to persist the three new fields. Zod max(6) on the work_availability array.
- **9.19.1.5 Match query** — extend `SearchFilters` (`lib/mock/types.ts`) with `minYearsExperience?: number | null` and `minNqfLevel?: number | null`. Extend `searchProfilesQuery` to apply both at SQL with a `LEFT JOIN academic_profiles` for the NQF filter.
- **9.19.1.6 Vacancy → filters mapping** — `vacancyToSearchFilters()` now passes `availableFor: vacancy.workAvailability` (when non-empty), `minYearsExperience`, `minNqfLevel`.
- **9.19.1.7 Detail page** — render the three new fields on `/employer/vacancies/[id]`. Empty work_availability shows "Any work mode / employment type"; NULL years shows "No minimum"; NULL NQF shows "No minimum."

### Tier 2 — Match page filter / sort / shortlist

- **9.19.2.1 Filter chips** — on `/employer/vacancies/[id]/match`, render a chip strip above the candidate list: "All" + six work-availability chips + "5+ years" / "8+ years" quick-pick chips for the experience axis. Client-side filter only (D4).
- **9.19.2.2 Sort dropdown** — a small dropdown next to the filter chips: "Best match" (default, current behaviour), "Most recent status," "Most complete profile," "Citizens first." Re-orders the client-side list only.
- **9.19.2.3 Shortlist table** — migration `0032_phase9_19_shortlists_and_nudges.sql` adds `vacancy_shortlists` (id, vacancy_id, profile_id, added_by_user_id, added_at) + unique (vacancy_id, profile_id). Per-(org, vacancy) scope (D5).
- **9.19.2.4 Shortlist actions** — add `addToVacancyShortlist` / `removeFromVacancyShortlist` server actions. UI: a small bookmark icon per row + a "Shortlist (N)" tab toggle above the list to flip between "All matches" and "Shortlist only" views.
- **9.19.2.5 Shortlist → invite** — when the employer hits "Send invites" with the shortlist filter active, only shortlisted candidates land in the modal.

### Tier 3 — Invite-flow polish + new functionality

- **9.19.3.1 Per-invite note** — extend `bulkInviteToVacancy` action with an optional `personalNote?: string` (≤200 chars). Surface in the confirmation modal as an optional textarea labelled "Add a note (optional)" with a 200-char counter and PII-flag explainer. Audit `vacancy.invite` rows gain `meta.note`.
- **9.19.3.2 Vacancy duplicate** — "Duplicate" button on `/employer/vacancies` rows; on click, navigate to `/employer/vacancies/new?duplicateFrom=<vacancyId>`. The new page reads the source vacancy server-side, pre-fills the form, and suffixes the title with " (copy)" (D7).
- **9.19.3.3 Follow-up nudges schema** — migration `0032` (paired with shortlists) adds `vacancies.follow_up_nudges_enabled` boolean default false.
- **9.19.3.4 Follow-up nudges UI** — a checkbox in the vacancy form: "Send a gentle nudge to seekers who haven't responded after 7 days." (D8)
- **9.19.3.5 Follow-up nudges cron** — `/api/cron/vacancy-follow-up-nudges` route, CRON_SECRET-guarded, runs nightly. For every vacancy with the flag on, find `vacancy_invitations` in `invited` state ≥ 7 days, fire `vacancy.invite.followup` notification once per invite (`dedupeKey = invitationId`). New notification kind in the catalog.
- **9.19.3.6 Accept-rate strip** — on `/employer/vacancies/[id]`, render a stats strip above the existing detail content: "Sent N · Accepted M · Declined K · Pending L · Expired P." (D9). Aggregates from `vacancy_invitations` for this vacancy id.

---

## 🚫 OUT OF SCOPE

- ❌ **Cross-vacancy analytics dashboard** — Phase 10+. Per-vacancy stats only (D9).
- ❌ **Vacancy templates as a top-level resource** — duplicate-from-existing covers it (D7).
- ❌ **AI-suggested vacancy field completion** — too speculative for now. The richer schema is the win; suggestion is a future layer.
- ❌ **Years experience as a ranking signal** — pure filter for now (D2). Ranking comes later.
- ❌ **Boolean "must have" vs "nice to have" skill split** — the existing skill_slugs array is "things this role uses"; a hard requirement layer is a separate, larger conversation.
- ❌ **Default-on follow-up nudges** — opt-in only (D8).
- ❌ **A `templates` table** — explicitly rejected (D7).

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

Three reasons it's one phase, not three:

1. **The DPIA / Privacy / PAIA work is one pass.** Tier 3's per-invite note reuses the Phase 9.17 PII flag pattern; no new DPIA addendum needed. The shortlist is org-private and doesn't touch consent; no new compliance assertion. Splitting the tiers across three phases would mean three rounds of "is this POPIA-clean?" review for the same answer.

2. **The vacancy-match seam is shared.** Tier 1 widens the schema, Tier 2 reads the schema, Tier 3 writes audit rows referencing the same vacancy. Shipping them together lets each tier exercise the others' changes in development; shipping them apart means three rounds of integration risk.

3. **The user-side payoff is per-tier, but the trust-posture payoff is cumulative.** A richer vacancy form alone is good; a richer form *with* a smarter match page *with* a more honest invite is the experience employers will pay for. The tiers compose; splitting them flattens the perceived value of each.

---

*Plan opened 2026-05-29. Target: complete before Phase 10 (public launch) opens. Bounded scope (~1 focused day across the three tiers, given the existing infrastructure: migration discipline, `useSessionDraft` hook, the Phase 9.8 invite lifecycle, the Phase 9.17 audit + notification catalog patterns).*
