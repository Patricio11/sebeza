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

### ⏳ A2 — Seeker (`/dashboard`) — TODO
### ⏳ A3 — Employer (`/employer`) — TODO
### ⏳ A4 — Gov (`/gov`) — TODO

Each follows the admin template: add `(<group>)/<root>/layout.tsx` rendering `<DashboardFrame>`
(workspace label from that role's session/DAL, its `*_NAV`), switch the group's pages to
`<DashboardMasthead>`, and slim its `loading.tsx` to a content skeleton. Watch for per-page
`banner`s (e.g. employer org-unverified) and any group-specific masthead actions — those stay on
the page via `DashboardMasthead`.

### 🧹 A5 — Cleanup after rollout — TODO
Once A2–A4 land and no page renders `<DashboardShell>`:
- Delete `components/layout/DashboardShell.tsx`.
- Remove the **transitional ignored props** from `DashboardMasthead` (`workspaceLabel`,
  `workspaceEyebrow`, `nav`, `activeKey`) and drop them from every page's `<DashboardMasthead>`
  call + the now-unused `*_NAV` / `activeKey` imports on pages.
- Point the nav config files' `import type { DashboardNavItem }` at `./dashboardChrome` directly.

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
