# PHASE 29 — VACANCY SEATS + THE SEAMLESS SEARCH-INVITE FUNNEL

*Opened 2026-07-08. Founder request: (a) the approved "positions / headcount" recommendation
(truthful seat count instead of blind auto-invite), and (b) a seamless public-search invite
funnel: anyone can select candidates on `/search`; the moment they act they're routed through
sign-in, their selection survives, and they finish with a vacancy picker — including a
create-a-vacancy detour that returns them to complete the invites.*

> **Discipline (unchanged):** `test:all` + E2E at desktop + 360px green + clean migrations
> before commit. POPIA-First: every send still flows through `bulkInviteToVacancy`'s consent
> gate + 50-cap; selection stores only PUBLIC identifiers (handle + display name).

## 29.1 Vacancy seats (`positions`)
- Migration `0061`: `vacancies.positions integer` (NULL = unspecified — many SA vacancies
  genuinely have no fixed headcount; the field never fabricates one).
- `vacancyInputSchema` + `VacancyForm` ("Open positions (optional)", 1–999) + seats context
  on the match page ("N positions · X invited").

## 29.2 Select top N (match page)
- With `positions` set, `BulkInviteIsland` gains a "Select top N" button that ticks the first
  N eligible (not-yet-invited, consent-visible) rows. Human stays in the loop — it fills the
  selection; the existing explicit send button still does the sending.

## 29.3 `bulkInviteByHandles` (server)
- The public row exposes `handle` only. New action resolves handles → profile ids **inside**
  the verified-employer boundary and delegates to `bulkInviteToVacancy` (single home for
  consent gates, dedup, caps, audit).

## 29.4 Public-search selection island
- Checkbox per result row (leading slot on `TalentRosterItem`) + floating "N selected"
  action bar. Selection persisted in `localStorage` (cap 50) so it survives the sign-in
  round-trip; `?invite=1` reopens the dialog after auth.
- Viewer modes (server-decided, hide-not-disable where the viewer can never act):
  - logged-out → checkboxes render; "Invite" opens a sign-in prompt →
    `/sign-in?next=<current search URL + invite=1>`; copy says the selection is saved.
  - employer (verified) → vacancy picker (multi-profile) → send → honest sent/skipped counts.
  - employer (unverified) → honest gate: "verification first" + onboarding CTA (selection kept).
  - seeker / gov / admin → no selection UI at all.

## 29.5 Create-vacancy detour
- Picker's "create a new vacancy" carries `?returnTo=<validated internal path>` into
  `/employer/vacancies/new`; after create, the form redirects back to the search URL with
  `invite=1` — dialog reopens, selection intact, new vacancy in the list.

## 📌 STATUS
- [x] 29.1 `positions` (migration `0061`, zod 1–999 nullable, form field, VacancyRow read shape,
  seat context "N positions to fill" on the match page's eligibility strip)
- [x] 29.2 "Select top N" (fills the selection with the top N eligible rows in the CURRENT view
  order  ranking/sort/filter honoured; send stays behind the explicit confirm modal)
- [x] 29.3 `bulkInviteByHandles` (handles resolved → ids inside the verified boundary; delegates
  to `bulkInviteToVacancy`; unresolved handles reported inside `skipped`)
- [x] 29.4 selection island (`components/feature/search/SearchInviteSelection.tsx`): checkbox per
  row (new `leadingSelect` slot on TalentRosterItem), floating bar, localStorage persistence
  (cap 50, survives auth round-trip), `?invite=1` re-open, three dialog legs (sign-in gate /
  verification gate / vacancy picker with per-batch personal note + honest sent/skipped counts).
  Picker now lists DRAFTS too (labelled)  the invite action always accepted them, and the
  detour's just-created draft must appear immediately.
- [x] 29.5 create-vacancy detour (`?returnTo=` on /employer/vacancies/new, open-redirect guarded
  by `lib/nav/safe-internal-path` + unit tests; VacancyForm redirects back through the i18n
  router, locale-stripped paths throughout)
- [x] 29.6 search page wiring (viewer modes: logged_out / employer_verified / employer_unverified;
  seeker/gov/admin get NO selection UI  hide-not-disable)
- [x] 29.7 tests  vitest (safe-internal-path) + `tests/e2e/search-invite.spec.ts` (the full
  funnel: logged-out select → sign-in → detour with positions=2 → send 2 → seat context on the
  match page; seeker-negative test), desktop + 360px, screenshots
- [x] 29.8 docs + commit
