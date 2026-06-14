# Post-launch backlog

*Opened during Phase 10 (PHASE_10_LAUNCH_PLAN.md). The "things we deliberately did not build before public launch" collection.*

> **The fence**: Phase 10 is polish + audit + go-live. Feature requests that arrive during Phase 10 land here, not in main. Phase 11+ pulls from this list  in particular, items here that fit Phase 11's seeker-retention or skill-growth-conversion thesis may be promoted into one of the `PHASE_11_{1,2,3,4,5}_PLAN.md` sub-phases. **Phase 13** (student lane expansion + editorial-LLM curriculum pipeline) shipped 2026-05-31  2026-06-01 *ahead* of Phase 12 at founder direction; Phase 13 follow-ups are listed below in their own section.

---

## How to add an item

Pick the right section. Each item gets:

```
- **Title**  one-line description. _(Origin: who asked, where, when. Optional)_
  Details if needed (1-3 sentences). Link to plan / decision doc if applicable.
```

Keep entries terse  this is a triage list, not a spec.

---

## Quick wins (small, high-leverage)

> Sub-half-day items that could ship as a small point release between Phase 10 close and a Phase 11 sub-phase starting.

- _empty for now  add as they arrive_

---

## Dashboard shell UX hardening — _(Origin: founder, clicking through /admin, 2026-06-14)_

> Active plan: **`docs/ADMIN_SHELL_UX_PLAN.md`**.

- **Persistent dashboard sidebar**  hoist the sidebar into a route-group `layout.tsx` so only the
  content column reloads on navigation (it was remounting the whole screen + flashing a skeleton).
  **Part A admin = done** (shipped 2026-06-14); seeker / employer / gov rollout + `DashboardShell`
  retirement still tracked in the plan.
- **In-shell admin user-management** (`/admin/users/[id]`) — ✅ **done 2026-06-14** (Part D).
  Full management console inside the admin frame: identity header, Security & access, seeker
  profile + verification (roll-up/KYC/qualifications), employer organisation, POPIA consents,
  recent activity, and a redesigned account-actions panel (suspend/restore, reset-2FA, danger-zone
  erase — role-aware). Document-dependent reviews (KYC ID / qualifications / org vetting) surface
  state inline + deep-link to the verification queues that hold the doc viewer.
  - _Follow-up:_ inline the KYC / qualification / org **decision actions** (approve/reject/
    request-changes) on the user page with a signed-URL doc link beside them, if on-page review is
    wanted (currently deep-linked to the queues).
- **Public profile loading-hang** — ✅ **resolved (not a bug) 2026-06-14.** Probed: the page
  renders fully server-side (HTTP 200, 179 KB); the "stuck skeleton" was first-hit dev Turbopack
  compilation, not a stall, and prod has no per-request compile. Restart `npm run dev` if it
  recurs after a large change.

---

## Accessibility automation

> The Phase 10.5 audit (`A11Y_AUDIT.md`) ships with static scan + manual screen-reader passes; the automated runtime layer is deferred for capacity reasons.

- **Playwright + `@axe-core/playwright` a11y suite**  one spec per route group (`public`, `seeker`, `employer`, `admin`, `gov`); per-test pattern is `new AxeBuilder({ page }).analyze()`, asserting zero serious / critical violations. **Phase 12 (2026-06-12) removed most of the setup cost**: `@playwright/test` + chromium are installed, `playwright.config.ts` already serves the production build against the test DB, and `tests/e2e/` has the spec layout to extend — remaining work is `npm i -D @axe-core/playwright` + the per-route-group specs.
- **E2E follow-up arcs** _(Origin: Phase 12 close, 2026-06-12)_  four browser walks deferred from Task 12.3; the underlying behaviours are integration-covered, only the click-throughs remain: (1) full seeker sign-up with email-token capture (read the Better Auth `verification` row from the test DB inside the spec — the harness can query it directly); (2) the vacancy loop (create → match → invite → accept → mark-as-filled); (3) the 9.17 `/sign-up/invited/[token]` landing (mint a token with `signInviteToken` inside the spec); (4) the privacy export download click-through. The harness (`playwright.config.ts` + seeded accounts) makes each a focused half-day.
- **Modal focus-return hook** _(Origin: Phase 12 modal sweep, 2026-06-12)_  none of the 20 `role="dialog"` components restores focus to the trigger element on close (browser drops focus to `<body>`). Esc-close is now universal (Phase 12 patched the last 4: `BulkInviteIsland`, `DepartureIsland`, `ConfirmStatusIsland`, mobile `SearchFilters`). Right shape: one `useModalFocus(ref, open)` hook capturing `document.activeElement` on open + restoring on close, applied across all 20 — a mechanical but wide change best done as one focused pass with an E2E assertion per modal.

---

## Trust + safety follow-ups

> POPIA, moderation, audit  things that ladder up to the trust posture.

- **Skill suggestion auto-notify**  when admin promotes a skill, fire a `taxonomy.promoted` notification to the user who originally submitted it so they can re-add it to their profile / vacancy. _(Phase 10 ship: skill suggestions land but submitters aren't notified on promotion; they discover it via the picker next time they edit.)_
- **Pending-skill backfill**  decide whether non-canonical "Other" skill submissions should persist to `profile_skills` / `vacancy.skill_slugs` with an `is_pending` flag (vs the current filter-at-save model). Tradeoff: simpler data model now (current) vs auto-recovery after admin promotion.

---

## Performance + scale

> Things to revisit if traffic patterns surprise us at launch.

- ~~**Server-side full-text search**~~ **RESOLVED — entry was stale (Phase 12 verification, 2026-06-12).** `searchProfilesQuery` contains zero ILIKE: free-text search has run `websearch_to_tsquery` + `ts_rank_cd` over the GIN-indexed `search_vector` since Phase 4. The Phase 12 ranking fixtures (`tests/integration/ranking-freshness.test.ts`) pin the path.
- **No-Flash bundle pass** _(Origin: Phase 12 perf gate, 2026-06-12)_  the automated script-budget gate (`tests/e2e/perf-budget.spec.ts`, deterministic encoded wire bytes on the production build) found the **shared App Router baseline puts every key route over the 160 KB target**: `/` 194.2 · `/search` 210.2 · `/p/[handle]` 195.5 · `/sign-in` 196.8 · `/insights` 291.7 KB (Recharts adds ~95 KB — it ships in the route bundle; mount-gating defers execution, not transfer). All five pinned with tight ratchet ceilings (measured +3 KB) so they can only improve. The pass: `ANALYZE=true npm run build`, read the shared-chunk treemap for the ~40 KB of baseline trim (likely suspects: next-intl message payloads, Better Auth client on non-auth routes, icon imports), and dynamic-import the `/insights` chart islands (`next/dynamic`, ssr:false). Lower the spec ceilings as each lands; target state is 160 everywhere.
- **CDN edge config**  static assets cache fine via Next defaults; revisit if image-heavy public profiles see traffic spikes.

---

## Localisation expansion

> Phase 10.7 scaffolded Tier-2 / Tier-3 catalogs (`messages/{nso,tn,st,ts,ve,ss,nr,pt,fr,sw}.json`) with `__notice` markers. As professional human translations arrive, each crossing the readiness threshold (per `lib/i18n/config.ts:PENDING_LOCALES`) gets enabled in `i18n/routing.ts`.

- **Tier 2 rollout**  Sepedi, Setswana, Sesotho, Xitsonga, Tshivenda, siSwati, isiNdebele.
- **Tier 3 rollout**  Portuguese, French, Swahili.
- **RTL readiness**  not currently needed (none of the planned locales are RTL), but if Arabic / Persian ever join the roadmap, the `<html dir>` attribute logic in `app/[locale]/layout.tsx` becomes load-bearing.

---

## Help center expansion

> Phase 10.1-10.4 shipped four role-specific help centers (employer, seeker, admin, gov). The launch tasks live in Phase 10.5-10.11 (`PHASE_10_LAUNCH_PLAN.md`). Follow-ups:

- **Translation**  help articles are English-only at v1. Once Tier-2 / Tier-3 catalogs cross readiness, key articles (orientation, consent, POPIA rights) translate first.
- **Help-search analytics**  D8 in PHASE_10_1_COMPLETE.md deferred this. If support load patterns suggest the search isn't surfacing the right articles, add minimal anonymised search-query logging (with a privacy story).
- **"What's new"**  D7 in PHASE_10_1_COMPLETE.md deferred a changelog feed. Revisit if users start asking "what changed?".

---

## Operator / admin tooling

> Things that would make Sebenza staff's daily work smoother but don't ship at launch.

- **Skill suggestion bulk-promote**  if the skill-suggestion queue grows past 50 pending, a bulk-promote (or bulk-reject) action saves operator time vs the current per-row UI.
- **Audit log saved views**  saved filter combinations (e.g. "gov-employer-lookups this week") for repeat investigations.

---

## Data + analytics surface

> Gov + employer analytics surfaces ship at launch. Follow-ups:

- **Municipal-level analytics**  `/gov/municipalities` ships dormant in Phase 10; flips on once cell-counts cross the k-anonymity floor across most municipalities. See `content/help/gov/provincial-briefs/cities-coming-soon.tsx`.
- **Quarterly retention report**  the cron job that snapshots placement retention runs but the gov-facing artefact is not yet generated. Pending operator-side review of which timeframes to publish.

---

## Phase 13 editorial + operational follow-ups

> Shipped 2026-06-01 (see `docs/completed/PHASE_13_COMPLETE.md`). Code is complete; these are operational gaps that don't block the existing surface but should land before the catalogue surface is publicly promoted.

- **Tier-1 catalogue expansion** (49  ~750 rows)  the demo seed in `db/seed.ts → seedPhase13_2ModuleSkills` covers BSc CS, BCom Accounting, BCom Management Studies, BEd, BA, BSc Eng Electrical at skeleton density. Editorial work to reach the Tier-1 launch target (5 programmes × ~30 modules × ~5 skills) runs through `/admin/curriculum`. Process documented in `docs/PHASE_13_CATALOGUE_GUIDE.md` (Tier-1 operational checklist).
- **Information Officer designation**  DPIA §4 is unsigned; the engineering team owns open risks until a named IO takes the role. Land this with the launch checklist.
- **18-month catalogue-review automation**  the review query exists in `PHASE_13_CATALOGUE_GUIDE.md` (Monthly review §). Currently surfaces via a calendar reminder; an admin-dashboard panel showing the flagged rows would close the manual gap.
- **SKILLS taxonomy expansion for BSc Eng + BA core**  the SKILLS taxonomy is presently job-skills-shaped; engineering foundations (thermodynamics, fluid mechanics, structural analysis, CAD) + humanities core (literary criticism, historical methods, philosophical reasoning) need slugs before `module_skills` rows make sense for those programmes. Goes through the existing Phase 9.15 admin suggestion queue.
- **Per-row catalogue version strings**  deliberately deferred per Task 13.7 in favour of the monthly-review process. Revisit only if the gov-facing surface starts citing "catalogue v2026.10" attributions in policy briefs and needs the version string at row granularity.
- **Cross-encryption-rotation script**  per `ENCRYPTION_INVENTORY.md → Open items`: extend the planned rotation script to walk `app_user.phone_e164_enc` (Phase 11.4.4) AND `llm_providers.credentials_enc` (Phase 13.3) alongside `profiles.national_id_enc`. All three share `SEBENZA_ENCRYPTION_KEY` so they must rotate together.

---

## Phase 13.8–13.10 side-phase follow-ups

> Three quick side-phases shipped 2026-06-04 → 2026-06-06 (see `docs/completed/PHASE_13_{8,9,10}_COMPLETE.md`). Deliberately-deferred polish from their out-of-scope sections:

- **Suggest secondaries from declared experiences** _(13.10 out-of-scope)_  the platform can see a seeker worked 2 yrs as a barista in `experiences`; a quiet "add Barista as a secondary profession?" nudge on the profile editor would lift adoption. Deferred so the field stays seeker-controlled at v1; revisit once usage data shows under-adoption.
- **Multi-profession vacancies** _(13.10 out-of-scope)_  "hiring a barista OR a kitchen porter" needs `professionSlugs: text[]` on vacancies. Skill-overlap matching covers most of this today; build only if employers ask.
- **Profession slug migration** _(13.10 out-of-scope)_  `profiles.profession` + `secondary_professions` store labels, not slugs. A slug-everywhere migration touches every consumer; do it as its own hygiene phase if label-drift bugs appear.
- **Cross-border remote vacancies** _(13.9 out-of-scope)_  "Any" means any SA province. Opening the pool to non-SA-residents is a different problem with different POPIA implications; needs its own governance-reviewed phase if ever.
- **Migration journal discipline** _(2026-06-09 incident)_  journal drift recovered via `db:push`; convention now in `TO_START_EVERY_SESSION.md`. If the team grows, consider a CI check that fails when a `db/migrations/*.sql` file lands without a matching `_journal.json` entry.

---

## Feature requests from users

> Filled in as launch traffic + user feedback arrive.

- _empty for now  add as they arrive_

---

*Maintainer note: keep this file short. Each section is one screen of triage; if a section grows past that, it's a sign the item deserves a real plan doc, not a backlog row.*
