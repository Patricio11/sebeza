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

### B1 — Single-user read
- Add `getAdminUserDetail(userId)` to `lib/admin/users.ts` (reuse the `listUsersQuery` join/shape;
  return the `AdminUserRow` fields + anything detail-only: suspension reason/actor/date, last
  sign-in, 2FA state, org link, handle). Returns `null` → `notFound()`.

### B2 — Detail page
- `app/[locale]/(admin)/admin/users/[id]/page.tsx`, rendered via `<DashboardMasthead>` (so it sits
  in the persistent admin frame from Part A). Sections:
  - Identity header (name, @handle, email, role pill, status).
  - Status & moderation: current status, suspension reason/when/by; **reuse `UserRowActions`**
    (suspend / restore / reset-2FA / erase — already wired to `lib/admin/moderation` +
    `lib/auth/two-factor`).
  - Context: organisation (for employers), join date, verification snapshot where relevant.
  - **Back affordance:** a "← Back to user directory" link to `/admin/users` (preserve the
    directory's active filters via the referring query when feasible).
  - Secondary action: "View public profile ↗" → `/p/[handle]` (opens the public view explicitly,
    not as the default destination).
- POPIA: this is an admin PII surface — wrap the read in `logAccess()` per the audit rule; no
  raw documents/contact beyond what admin moderation already exposes.

### B3 — Re-point the directory
- In `admin/users/page.tsx`, change the user name links (desktop row + mobile card) from
  `/p/${handle}` → `/admin/users/${id}`. Keep handle-less users (orgs) linking to the detail page
  by id too. The public-profile link moves to the detail page as the secondary action (B2).

### B4 — Tests
- E2E: from `/admin/users`, click a user → lands on `/admin/users/[id]` **inside the shell**
  (sidebar still visible), the back link returns to the directory, and the moderation actions are
  present. Add to `role-arcs.spec.ts` or a new `admin-users.spec.ts`.

---

## PART C — Public profile hang (open question, investigate)

Observed on the dev server: `/p/patricio-manuel-2` stuck on the `(public)` loading skeleton after
an admin clicked through. The page (`app/[locale]/(public)/p/[handle]/page.tsx`) is independent of
the Part A refactor (it uses `SiteHeader` + `dataProvider` + `getSessionUser`/`getMyProfile`/
`getSetting`), and the production build compiles it fine — so this is **not** caused by the layout
change. Hypotheses to rule out, in order:

1. Dev-server artifact — stale Turbopack/HMR state after the multi-file refactor (a `dev` restart
   clears it). Most likely; confirm first.
2. A hanging server `await` in the profile render path (one of `dataProvider.getProfile`,
   `getSessionUser`, `getMyProfile`, `getSetting`) against the dev Neon DB.
3. Data-specific: something about that particular handle/profile.

**Probe:** `curl -m 20 http://localhost:3000/p/patricio-manuel-2` (public viewer path) — returns
promptly ⇒ client/session/dev-HMR; hangs ⇒ a real server-side stall to trace. If real, it affects
public + employer profile views too and is **higher priority than B** because it's user-facing on
the public site. (Part B reduces the admin's *exposure* to it but doesn't fix the underlying page.)

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
