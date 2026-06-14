# ADMIN SHELL UX PLAN — persistent sidebar + in-shell user detail

*Opened 2026-06-14. No phase number — this is a UX/architecture hardening pass on the
authenticated dashboard shell, surfaced while clicking through the admin side.*

Two related problems were found while navigating the admin workspace:

1. **Full-page skeleton on every navigation.** The sidebar disappeared and the whole screen
   showed a loading skeleton when moving between admin pages — the sidebar should stay put and
   only the main content should reload.
2. **No way back when viewing a user.** Clicking a user in the directory jumped *out* of the
   admin shell into the public profile `/p/[handle]` (no sidebar, no back button), and on the
   dev server that public page was seen hanging on its loading skeleton.

This plan tracks both, plus the rollout of the layout fix to the other role groups.

---

## 🎯 GOAL

- Navigating inside any authenticated workspace keeps the sidebar mounted; only the content
  column shows a skeleton.
- Admins inspect a user **inside the admin shell** (`/admin/users/[id]`), with a real back
  affordance — they never bounce to the public profile to do admin work.
- The public profile hang is understood and, if it's a real bug, fixed (it affects public +
  employer viewers regardless of the admin flow).

---

## PART A — Persistent dashboard sidebar (layout refactor)

**Root cause:** the sidebar was rendered *inside each page* via `<DashboardShell>`, so the
segment's `loading.tsx` Suspense boundary replaced the whole screen (sidebar included), and the
sidebar remounted on every navigation. The fix is the idiomatic App Router pattern: hoist the
sidebar into a route-group `layout.tsx` (rendered *outside* the Suspense boundary) so it persists
and only `{children}` shows the fallback.

### ✅ A1 — Admin (DONE 2026-06-14, commit pending)
- New `components/layout/dashboardChrome.tsx` — shared `DashboardRole` / `DashboardNavItem`
  types, `ROLE_ACCENT`, `NOTIFICATIONS_HREF`, `BellSlot` (single source of truth).
- New `components/layout/DashboardFrame.tsx` — the **persistent** sidebar + mobile nav strip,
  rendered once in the layout.
- New `components/layout/DashboardNavLink.tsx` — client island; active state derived from the
  **pathname** via `aria-current` (replaces the per-page `activeKey`).
- New `components/layout/DashboardMasthead.tsx` — per-page editorial header + `<main>`, slots
  into the frame's main column.
- New `app/[locale]/(admin)/admin/layout.tsx` — renders `<DashboardFrame>` around all admin
  pages; also a layout-level `verifyAdmin()` guard.
- `app/[locale]/(admin)/admin/loading.tsx` — slimmed to a content-column skeleton (echoes the
  masthead) since it now fills only `{children}`.
- 15 admin pages switched `<DashboardShell>` → `<DashboardMasthead>` (mechanical rename).
- `DashboardShell` kept for the other groups; it now sources chrome from `dashboardChrome`.
- **Verified:** typecheck ✅ · lint ✅ (0 errors) · build ✅ · E2E ✅ (`role-arcs.spec.ts`
  strengthened to click a sidebar link client-side and assert the sidebar survives + marks the
  new page active; 10/10 across desktop + mobile-360).

### ✅ A2 — Seeker (`/dashboard`) — DONE 2026-06-14
### ✅ A3 — Employer (`/employer`) — DONE 2026-06-14
### ✅ A4 — Gov (`/gov`) — DONE 2026-06-14

Each followed the admin template: a `(<group>)/<root>/layout.tsx` rendering `<DashboardFrame>`
(workspace label from the role's DAL: seeker `getMyProfile().displayName`, employer
`verifyEmployer().orgName`, gov `verifyGov().name`; its `*_NAV`), pages switched to
`<DashboardMasthead>`, and `loading.tsx` slimmed to a content skeleton.
- **Guards:** seeker `verifyRole("seeker")` (2FA not forced for seekers); employer
  `verifyEmployer()` — the WEAK guard so `/employer/onboarding` doesn't loop; gov `verifyGov()`.
- **Print-CSS pages (the wrinkle):** `/dashboard/cv` and `/gov/brief` are standalone full-page
  print documents that don't use the shell. A group layout wraps them too — so `<DashboardFrame>`
  chrome is now `print:hidden` and its grid is `print:block`, so those pages still **print** as
  clean, full-width, chrome-less documents. The only change: on **screen** they now show the
  workspace sidebar (consistent with the rest of the dashboard; both are max-width-constrained so
  they render fine in the content column). E2E confirms the CV builder still renders with no 360px
  overflow.
- Gov's one-off "Government · analyst access" eyebrow was standardised to "Government / policy
  workspace" (sidebar eyebrow only; cosmetic).

### 🧹 A5 — Cleanup — ✅ DONE 2026-06-14
- ✅ Repointed the 4 nav configs' `import type { DashboardNavItem }` to `./dashboardChrome`.
- ✅ **Deleted `components/layout/DashboardShell.tsx`** — every page is migrated; nothing imports it.
- ✅ **Stripped the compatibility-shim props** from all 60 migrated `<DashboardMasthead>` call-sites
  (`workspaceLabel` / `workspaceEyebrow` / `nav` / `activeKey`) + removed them from the
  `DashboardMasthead` interface, so it now accepts only real masthead props. Also removed the
  now-unused `*_NAV` / `MOCK_*` page imports and dropped the orphaned guard assignments
  (`const session = await verifyX()` → `await verifyX()`, keeping the guard). This also retired the
  last runtime `MOCK_EMPLOYER` page imports — the mock constants now feed only the seed (DB-first).
  Verified: build ✅ · typecheck ✅ · no new lint warnings (a few stray pre-existing `MOCK_*`
  imports cleaned as a side benefit) · E2E 24/24 (role + seeker arcs).

**Verified (whole A rollout):** build ✅ · typecheck ✅ · lint ✅ (0 err) · `vitest` 318/318 ✅ ·
**E2E 46/46** at desktop + mobile-360 (admin/seeker/employer/student/analytics/public/locality/
perf-budget arcs, incl. the CV print page inside the frame).

---

## PART B — In-shell admin user detail (`/admin/users/[id]`)

Replace the directory's bounce to the public `/p/[handle]` with a proper detail view **inside the
admin frame**, so the sidebar + a back button are always present and admins stay in context.

> **✅ DONE 2026-06-14 (commit pending).** Shipped `getAdminUserDetail()` +
> `app/[locale]/(admin)/admin/users/[id]/page.tsx` (in-shell via `<DashboardMasthead>`, identity +
> status/moderation cards reusing `UserRowActions`, "← Back to user directory", "View public
> profile ↗" as the secondary masthead action). Directory rows now link to `/admin/users/[id]`
> (handle-less users included). **Verified:** typecheck ✅ · lint ✅ · build ✅ (route registered)
> · `npm run test:all` → 318/318 vitest ✅ · E2E ✅ (new "admin user detail opens in-shell" test
> asserts no `/p/` bounce, sidebar present, back returns to directory, actions reachable —
> desktop + mobile-360). One deviation from the outline below (B2 logAccess).

### B1 — Single-user read ✅
- Add `getAdminUserDetail(userId)` to `lib/admin/users.ts` (reuse the `listUsersQuery` join/shape;
  return the `AdminUserRow` fields + anything detail-only: suspension reason/actor/date, last
  sign-in, 2FA state, org link, handle). Returns `null` → `notFound()`.

### B2 — Detail page ✅
- `app/[locale]/(admin)/admin/users/[id]/page.tsx`, rendered via `<DashboardMasthead>` (sits in the
  persistent admin frame from Part A). Identity header (name, @handle, email, role pill, status);
  status & moderation card reusing `UserRowActions` (suspend / restore / reset-2FA / erase);
  context (org, profession/city, email-verified, 2FA, joined); "← Back to user directory"; "View
  public profile ↗" as the masthead secondary action when the user has a handle.
- **Deviation from the outline (logAccess):** the plan said to wrap the read in `logAccess()`. On
  inspection the directory list (`listUsersQuery`) does **not** log reads, and the detail view
  surfaces the *same* account data the list already shows (plus a 2FA-enabled bool + suspension
  when/by — no new sensitive PII). Adding a one-off audit *kind* just for the detail view would be
  inconsistent (logged detail-views but not list-views of the same data) and there's no existing
  `admin.user.view` kind. **Decision:** no new audit kind for the view; the moderation *actions*
  keep logging via their own kinds. Comprehensive admin-read auditing (list + detail) is a separate
  cross-cutting follow-up if POPIA oversight wants it — noted, not built here.

### B3 — Re-point the directory ✅
- `admin/users/page.tsx`: desktop row + mobile card name links now go to `/admin/users/${id}`
  (handle-less users included). The public-profile link moved to the detail page (B2).

### B4 — Tests ✅
- E2E added to `role-arcs.spec.ts` ("admin user detail opens in-shell"): from `/admin/users`,
  clicking a user lands on `/admin/users/[id]` **inside the shell** (nav still visible, asserts it
  did **not** go to `/p/`), the back link returns to the directory, and the moderation actions are
  present — desktop + mobile-360.

---

## PART C — Public profile "hang" — ✅ RESOLVED (not a bug) 2026-06-14

Observed on the dev server: `/p/patricio-manuel-2` appeared stuck on the `(public)` loading
skeleton after an admin clicked through. **Probed and cleared:** `curl http://localhost:3000/p/patricio-manuel-2`
(public viewer path) returned **HTTP 200 with a full 179 KB render** — the real page, not the
skeleton — in ~6 s on a cold hit (baseline `/` was ~3.4 s the same way). That is first-hit
Turbopack **compilation** time, amplified by a broad recompile right after the 24-file Part-A
refactor and the dev server being mid-restart; it is **not** a server-side stall.

Confirmed not caused by the layout change: the page
(`app/[locale]/(public)/p/[handle]/page.tsx`) is independent of Part A (it uses `SiteHeader` +
`dataProvider` + `getSessionUser`/`getMyProfile`/`getSetting`), the production build compiles it,
and the profile E2E paths pass. **In production there is no per-request compile step, so it serves
immediately.** If it recurs in dev after a large change, restart `npm run dev` to clear stale
Turbopack/HMR state. No code change required.

Part B still proceeds — it removes the admin's bounce to the public profile entirely (a UX win
independent of this finding).

---

## PART D — Full admin user-management surface  _(Origin: founder, 2026-06-14)_

> "The user profile must be a full one with **all the actions** an admin can do, **all user
> info**, and improved UX/UI." The Part-B page was info-only + minimal actions.

Turn `/admin/users/[id]` into a real management console: everything an admin can see about a user,
and every action they can take, surfaced in one well-designed surface (sidebar stays from Part A).

### Inventory (what exists to surface — confirmed by codebase sweep)
- **Account actions** (account-level, document-free): `suspendUser` / `restoreUser` /
  `eraseUser` (`lib/admin/moderation.ts`), `reset2faForUser` (`lib/auth/two-factor.ts`).
  Guards: can't suspend/erase self or other admins; can't reset own 2FA. `reset2faForUser` DOES
  work on another admin.
- **Seeker verification** (document-dependent): `approveSeekerId` / `rejectSeekerId` /
  `requestChangesOnSeekerId` (`lib/admin/kyc-review.ts`); `approveQualification` /
  `rejectQualification` (`lib/admin/verifications.ts`).
- **Employer vetting** (document-dependent): `approveOrg` / `rejectOrg` / `requestChangesOnOrg` /
  `resendOrgVerificationEmail` / `markOrgEmailVerified` (`lib/admin/org-vetting.ts`).
- **Data:** `app_user` (incl. image, kyc, phone-verified, channels, 2FA, suspension), `session`
  (last sign-in + active devices), seeker profile via `loadProfileForUser` (profession, status,
  completeness, verification roll-up, skills, qualifications-with-state, experience, academic),
  org membership + verification, `consents` (POPIA), `audit_log` via `recentAuditEventsFromDb`.

### D1 — Rich loader
- Extend `getAdminUserDetail` with the missing account fields (image, `kycVerifiedAt`,
  `phoneVerifiedAt`, sms/whatsapp channels) + `lastSignInAt` + `activeSessions` (from `session`).
- Add small reads: `listConsentsForUser(userId)`, `getEmployerContextForUser(userId)`
  (org id/name/role/verification via `organization_members` → `organizations`).
- Page composes those + `loadProfileForUser(userId)` (seekers) +
  `recentAuditEventsFromDb({ actor: userId })`.

### D2 — Redesigned page (UX/UI)
- **Header:** avatar (`Avatar`), name, @handle, email, role pill, status badge, key facts
  (joined, last active), copy-able account id.
- **Sections:** Security & access (email-verified, 2FA, phone, channels, sessions) · **Account
  actions** (prominent, see D3) · Seeker profile + verification (state + deep-links) · Employer
  organisation (state + deep-link) · Consents · Recent activity (audit). Role-aware: seeker vs
  employer vs admin sections render conditionally.

### D3 — Account actions, inline + redesigned
- New `AccountAdminActions` client component (replaces the tiny list-row `UserRowActions` on this
  page; the directory list keeps `UserRowActions`). Reuses the existing server actions. Prominent
  buttons + confirm-with-reason flows + a clearly separated **danger zone** (suspend/erase).
  **Role-aware:** for an admin target, show 2FA-reset (allowed) and explain that suspend/erase are
  guarded ("ops procedure required") rather than showing buttons that the server will refuse.

### D4 — Document-dependent reviews (scope decision)
- KYC ID review, qualification verification, and org vetting need the **document viewer** that
  already lives in the dedicated queues (`/admin/verifications`, KYC review). Also `QualificationItem`
  carries no id in the profile projection. **Decision for D:** surface the full *state* of each
  inline (verified/pending/rejected, reasons, dates) + a prominent **"Review in queue →"** deep
  link, rather than duplicate the doc-viewer here. The admin sees everything and is one click from
  acting. _(Follow-up option: inline the decision actions — approve/reject/request-changes — with a
  signed-URL doc link beside them, if on-page review is wanted. Tracked here.)_

### D5 — Tests + verify ✅
- Extend the E2E to assert the management sections render + the account-action controls are present
  for a non-admin target. `npm run test:all` + build + E2E green, desktop + mobile-360.

**Status:** ✅ DONE 2026-06-14 (commit pending). What shipped:
- **Loader (D1):** `getAdminUserDetail` extended (image, `kycVerifiedAt`, `phoneVerifiedAt`, sms/
  whatsapp channels, `lastSignInAt` + `activeSessions` from `session`); added `listConsentsForUser`
  + `getEmployerContextForUser`. Page composes those + `loadProfileForUser` (seekers) +
  `recentAuditEventsFromDb`.
- **Page (D2):** full redesign — identity header (avatar + role/status/key facts), and cards for
  Security & access, Seeker profile, Verification (roll-up + KYC + qualifications), Employer
  organisation, Consents (POPIA), Recent activity; right rail with Account actions + "Manage
  elsewhere" deep-links. Role-aware, 360px-first.
- **Actions (D3):** new `AccountAdminActions` — prominent suspend/restore, reset-2FA, and a
  separated danger-zone erase, with confirm-with-reason flows; role-aware guards (self / admin
  targets explained, not shown as failing buttons); `router.refresh()` on success.
- **Doc-review (D4):** ✅ **now inlined (2026-06-14).** The verification + organisation sections
  render the real **decision actions on the page**, reusing the existing components/server actions:
  `KycReviewActions` (approve / request-changes / reject the ID doc), `VerificationActions`
  (per-qualification approve/reject + SAQA-aware, and org approve/reject), each beside a
  **signed-URL "View" link** to the actual document in Supabase Storage. New DB loaders
  `getSeekerReviewBundle(profileId)` (ID doc + qualifications **with ids** + signed URLs) and
  `getOrgDocuments(orgId)` back them. The less-common org actions (request-changes / resend email /
  mark-verified) stay one click away in the vetting queue (linked). All DB/storage — no mock.
- **Verified:** typecheck ✅ · lint ✅ (0 err) · build ✅ · `npm run test:all` 318/318 ✅ ·
  E2E ✅ (detail test now asserts the management sections + live Suspend / Reset-2FA controls on an
  active seeker, no `/p/` bounce, back returns to directory — desktop + mobile-360).

---

## 🧪 VERIFICATION (whole plan)

- `npm run test:all` (typecheck + lint + vitest) green.
- `npm run build` green.
- `npm run test:e2e` green, incl. the persistent-sidebar assertion and the new in-shell
  user-detail flow, at desktop + mobile-360.
- Manual: navigate every group's workspace — sidebar never disappears; only content reloads.

## 🚫 OUT OF SCOPE

- Restyling the dashboard chrome — this is a structural move, pixels unchanged.
- New admin moderation capabilities — B reuses the existing actions only.
- Impersonation / "view as user".

*When complete, move to `docs/completed/` and update the migration/UX notes as needed.*
