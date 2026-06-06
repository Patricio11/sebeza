# PHASE 13.8 COMPLETE  PER-ROW "INVITE TO VACANCY" CTA ON `/search`

*Shipped 2026-06-04. Closes the inverse direction of the existing vacancy-match flow: previously employers had to start from a vacancy and reverse-search candidates; now they can start from a search and invite directly.*

> **One-line summary**: When a logged-in employer with a verified org views `/search`, each result row gets an "Invite" button (hover-only on desktop, always-on on mobile). The button opens a modal listing the org's open vacancies; the employer picks one (or creates one if they have none) and the existing Phase 9.8.4 `bulkInviteToVacancy` action handles the rest. No new schema, no new audit kinds, no new platform flags.

Commits:

- `c7d5dff`  Phase 13.8: per-row Invite-to-vacancy CTA for verified employers on /search

---

## 🎯 WHAT SHIPPED

### Gate posture (hide-not-disable)

- Logged-out viewer → no slot rendered
- Seeker viewer → no slot rendered
- Employer with unverified org → no slot rendered (matches the existing Phase 9.10 PII-touching action gate; never advertise an action the viewer can't take)
- Employer with verified org → per-row Invite button + modal

### UX

- **Desktop**: button only shows on row hover via parent `<article>` `group-hover` selector  keeps the result list clean for casual browsing.
- **Mobile**: button always visible, stacked under "View profile" (no hover affordance on touch).
- **Modal**: bottom-sheet on phones / centred on `md+`; mirrors the Phase 9.8.4 `BulkInviteModal` idiom.
- **Vacancy picker**: radio list of org's open vacancies; rows the profile is already invited to render disabled with "Already invited" hint (DB unique constraint is the safety net).
- **Zero open vacancies**: modal degrades to a "Create a vacancy" CTA linking to `/employer/vacancies/new`.
- **Personal note**: reuses the existing `bulkInviteToVacancy` 200-char `personalNote` contract (PII-flagged in audit).

### Query helpers (lib/employer/vacancies.ts)

- `listMyOrgOpenVacancies()` → returns the picker payload (id + title + profession + province), filtered to `status='open'`.
- `activeInvitationsByProfileForMyOrg(profileIds)` → returns `Map<profileId, Set<vacancyId>>` across the org's open vacancies, scoped to active states (`invited` / `reconsidering` / `accepted_with_notice`). Accepted / declined / withdrawn / expired invites are NOT pre-blocked at the UX layer  those are deliberate re-invite scenarios.

### TalentRosterItem extension

- New optional `trailingAction?: ReactNode` prop renders next to "View profile" in the row footer.
- Mobile-first stacking via `flex-col → sm:flex-row`.
- Component stays role-agnostic: the slot accepts any node, the `/search` page decides who gets one.

### `/search` page wire-up

- Session detection via `getSessionUser()` (no redirect on miss  `/search` is public).
- Manual org-membership + verification lookup (`verifyEmployer()` would redirect non-employers).
- Handle → profile.id resolution in one extra query (handle is UNIQUE) for the visible page window, so the button can call `bulkInviteToVacancy` with the right `profileId` without leaking the internal id on the public payload type.
- `/search` route flagged dynamic (server-renders per request).

---

## 🛡️ NEW DATA / FLAGS / KINDS

- 0 new tables, 0 new columns.
- 0 new audit kinds (reuses the existing `vacancy.invite` trail from Phase 9.8.4).
- 0 new platform flags.
- 0 new notification kinds.

---

## 🧪 VERIFICATION

1. Unauthenticated visitor on `/search` → no Invite button.
2. Seeker on `/search` → no Invite button.
3. Unverified-org employer on `/search` → no Invite button.
4. Verified-org employer on `/search` (desktop, hover over a row) → Invite button appears. Click → modal opens with the org's open vacancies.
5. Mobile (touch device) → Invite button always visible, stacked under "View profile".
6. Pick a vacancy + click Send → success state. The seeker's row now appears as "Already invited" if you re-open the modal.
7. Org with zero open vacancies → modal shows the "Create a vacancy" CTA.

---

## 📦 FOOTPRINT

| Metric | Value |
|---|---|
| Files changed | 4 |
| New components | 1 (`<InviteFromSearchButton>`) |
| New query helpers | 2 (`listMyOrgOpenVacancies`, `activeInvitationsByProfileForMyOrg`) |
| Migrations | 0 |
| Audit kinds | 0 new (reuses `vacancy.invite`) |
| Platform flags | 0 |
| Lines added / removed | +660 / -7 |

*Phase 13.8 closes the obvious UX inverse. Honest disclosure: the matcher still ranks via skill + work-availability overlap, the same engine the vacancy-side `matchVacancyCandidates` already uses.*
