# Phase 7 — Admin, Moderation & 2FA Enforcement · 📋 PLAN (opened 2026-05-23)

> Active plans live at the top of `docs/`. When this phase ships, this file moves to `docs/completed/PHASE_7_PLAN.md` and `docs/completed/PHASE_7_COMPLETE.md` is written.

**Goal:** Make every admin control real, enforce 2FA for employer + admin sign-in, and ship the audit-driven polish carried over from the post-Phase-5 audit (2026-05-23). After Phase 7 there are no dead buttons in the product — every visible affordance does what it says.

---

## Re-checks (decide before kickoff)

### Re-check #1 — Build `lib/admin/*` as a peer of `lib/employer/*` ✅ LOCKED
Same shape: one Server Action file per surface, each action calls `verifyAdmin()`, each writes an `audit_log` row. No "global admin" magic — every privileged action is grep-able.

### Re-check #2 — 2FA via Better Auth's `twoFactor` plugin ✅ LOCKED
The same plugin SRS uses. Issuer = "Sebenza", 30s period, 6 digits + 10 backup codes shown once at enrolment. Mandatory for `employer` and `admin` roles; optional for `seeker`. After password verification Better Auth intercepts with `twoFactorRedirect: true`; the client calls `/two-factor/verify-totp` or `verify-backup-code` before the session commits.

### Re-check #3 — Forced 2FA setup for existing employer/admin users
Anyone with `role IN ('employer', 'admin')` AND `twoFactorActive = false` (or `app_user.two_factor_enabled = false` once we add that column) hits a one-time forced setup screen on next sign-in. Don't let them into the dashboard until enrolled. Seekers stay free to skip.

### Re-check #4 — Settings schema gets a `platform_settings` table
Today `/admin/settings` is entirely UI-only. Add a single-row table (or a `key/value` table) so freshness band thresholds + ranking weights + feature flags persist. Reading at runtime: cached in a module-scope variable, refreshed every 5 min.

### Re-check #5 — Admin actions on PII-touching surfaces (suspend / approve) write to BOTH audit_log AND a "moderation_actions" trail
For accountability + reversibility. The `audit_log` row is the canonical event; `moderation_actions` carries the human reason ("3 reports, spam template match") so a future admin can review the decision context.

### Re-check #6 — In-product CSV export = real, not download-by-email
`/admin/audit-log` CSV button streams aggregated CSV directly (≤10k rows). Bigger exports → "We'll email you the file" Phase 8 hook. Same for `/insights` export (Phase 6 already lands the in-product CSV).

### Re-check #7 — Doc convention (unchanged)

### Re-check #8 — In-app notifications are a separate table, not a view over `audit_log` ✅ LOCKED
Tempting to derive notifications from `audit_log` rows since the trigger points overlap perfectly. We don't. Reasons:

1. **Different lifetimes.** Audit log is system-of-record for POPIA — retained per policy, never user-deleted. Notifications are UX state — dismissable, prunable, per-user.
2. **Different cardinality.** One `placement.confirm` audit row → one notification for the *seeker* AND (Phase 7) one for the *admin* (queue stat). Audit rows can't carry recipient targeting cleanly.
3. **Different shape.** Notifications need `title` + `body` + `link` localised per recipient. Audit rows carry actor/subject ids; rendering them into copy is presentation logic.
4. **Read-state per user.** A user marking a notification as read shouldn't mutate the audit log.

Cleanest separation: when a Server Action writes an audit row, it ALSO calls `createNotification()` for the affected user(s). The two writes happen in the same transaction so we never drift.

### Re-check #9 — No polling, no WebSockets ✅ LOCKED (revised 2026-05-23)
Originally planned 30 s polling. Re-evaluated during implementation: every notification originates in a specific Server Action that already calls `revalidatePath` on relevant surfaces. The bell mounts inside `DashboardShell` and is server-fetched on every render, so any client-side navigation (the typical action a user takes after being notified — clicking a link, switching tabs) refreshes the badge naturally. `markRead` / `markAllRead` add `revalidatePath("/dashboard", "layout")` etc. so the local action also refreshes the bell.

The trade-off: a recipient sitting completely idle on one page won't see new notifications until they navigate. Acceptable given (a) bell badges aren't life-critical, (b) no metered-data tax for users on 3G, and (c) the audit log remains authoritative regardless. Phase 9 may add Supabase Realtime if usage analytics show idle-pad-stare is common — until then, action-triggered revalidation is right.

---

## Implementation plan

### A. Audit-driven polish carryover (Tier 1 + Tier 2 from 2026-05-23 audit)

#### A.1 Admin moderation queue (lib/admin/moderation.ts)
- New table `reports`: `id`, `subjectProfileId`, `reporterUserId`, `reason enum`, `note`, `createdAt`, `status enum (open|closed|actioned)`, `closedAt`, `closedByUserId`, `closedReason`
- Server Actions: `suspendUser({ userId, reason })`, `restoreUser({ userId })`, `closeReport({ reportId, reason })`, `flagProfile({ handle, reason, note })` (called from public `/p/[handle]` Report button)
- Add `app_user.suspendedAt`/`suspendedReason` columns (or use existing `deletedAt` if soft-delete is enough — DECIDE before migration)
- Wire `/admin/moderation` to read live reports + the 3 action buttons per row
- `/admin/overview` "open reports" KPI counts unclosed reports

#### A.2 Verifications queue (lib/admin/verifications.ts)
- Server Actions: `approveQualification({ qualificationId, note })`, `rejectQualification({ qualificationId, reason })`, `approveOrganisation({ orgId, note })`, `rejectOrganisation({ orgId, reason })`
- Each flips the `verification` column on the target row, writes audit `verification.approve` / `verification.reject` with `meta.reason`
- Wire `/admin/verifications` to read pending qualifications (`qualifications.verification = 'pending'`) + pending orgs (`organizations.verification = 'unverified'` with a pending flag — or add `verification = 'pending'` state)
- `/admin/overview` "pending verifications" KPI counts both pending queues

#### A.3 Users management (lib/admin/users.ts)
- Replace the hardcoded `EXTRA_USERS` array with a real DB query: `SELECT * FROM app_user JOIN organization_members (where role=employer) JOIN profiles (where role=seeker) ORDER BY created_at DESC`
- Add search + role filter handlers (Server Action that returns filtered rows + paginates)
- Server Actions: `suspendUser`, `restoreUser`, `eraseUser` (soft-delete + 30-day grace, hard-delete via Phase 8 cron)
- `/admin/overview` "new users 7d" KPI counts `app_user.created_at >= now() - 7d`

#### A.4 Taxonomy CRUD (lib/admin/taxonomy.ts)
- Server Actions: `addProfession({ slug, label })`, `addSkill`, `removeProfession`, `removeSkill`, `addCity`, `removeCity`
- Validation: slug must be kebab-case + unique; can't remove a profession/skill that's still referenced by `profiles` or `profile_skills`
- Wire `/admin/taxonomy` edit pencils + Add button
- Loading state on add (don't let the user spam-click)

#### A.5 Audit-log filters + CSV export
- Wire the filter form: `kind` + `actor` → reload page with `?kind=&actor=` search params; query layer filters
- "Export CSV" action: builds aggregated CSV (max 10k rows, paginated) + writes `analytics.export` audit row + streams via `Response`

#### A.6 Platform settings persistence
- Migration: `platform_settings` table with `key text PRIMARY KEY`, `value jsonb`, `updatedAt`, `updatedByUserId`
- Seed default values for the existing UI fields (freshness band days, ranking weights, feature flags)
- `lib/admin/settings.ts`: `updateSetting({ key, value })` Server Action (admin-only)
- Read helper `getSetting(key)` cached in a module-scope `Map` with 5-min TTL
- Wire `/admin/settings` Save button

#### A.7 Public surface polish (Tier 2 audit)
- Landing: replace hardcoded `"May"` with `Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date())`
- `/search`: remove the "Load more" disabled button until pagination ships (Phase 6 follow-up) — replace with "Showing X of Y · refine filters to narrow"
- `/p/[handle]`: "Report" button → calls `flagProfile` action (A.1); "Request contact" + "Save to pool" → link to `/sign-in?next=/employer/dossier/<handle>` for unauth, else to the actual action
- `/insights`: "Export CSV" → real CSV export (might also land in Phase 6 if the analytics rebuild gets there first)
- `/dashboard/profile`: surface email field (read-only from session) for clarity
- Add a "Request data export" + "Erase me" Server Action stub so the buttons disable honestly (Phase 8 finishes them but the click-handler-to-nowhere goes away)

#### A.8 Seed data quality
- Add 2 saved searches for Discovery Bank (Senior developer · Gauteng + Pastry chef · Western Cape)
- Add 2 shortlist pools for Discovery Bank (Q3 engineering, Pastry pop-up) with the existing seeded members
- Seed 1 prior `profile.contact.reveal` audit row for Naledi → Andile (lets the dossier render the cached state on first visit)
- Backfill `actorUserId` + `salaryBand` on the 2 seeded placements
- Seed 1-2 open `reports` for the moderation queue demo

### B. 2FA enforcement (the original ROADMAP Phase 7 work)

#### B.1 Schema + plugin wire-up
- Add `app_user.two_factor_enabled boolean default false` (Better Auth's twoFactor plugin manages its own `twoFactor` table; we still want a top-level flag for the forced-setup gate)
- Add Better Auth `twoFactor` plugin to `lib/auth/server.ts` (must stay before `nextCookies` per docs)
- `npx @better-auth/cli generate` → review the schema delta → fold into a new migration

#### B.2 Setup + verify pages
- `/setup-2fa`: QR + manual key + verify-code field; on success display 10 backup codes (one-time only — must be downloaded/printed)
- `/verify-2fa`: TOTP field + "Use backup code instead" link → `verify-backup-code` flow; rate-limited (Better Auth handles)
- Both pages use `AuthShell` chrome

#### B.3 Forced setup gate
- Server-side guard middleware: if `user.role IN ('employer','admin')` AND `user.twoFactorEnabled = false` AND current path is NOT `/setup-2fa` → redirect to `/setup-2fa`
- After successful setup, `user.twoFactorEnabled = true`; gate stops triggering
- Account page (`/employer/account`, `/dashboard/account`) gets a "Configure 2FA" panel that actually works (was disabled Phase 7-stub since the audit)

#### B.4 Sign-in flow change
- Phase 2's `signIn` action gets a 2FA branch:
  - Better Auth returns `{ twoFactorRedirect: true }` after a correct password if 2FA is on
  - Form's `onSubmit` checks for the flag and pushes to `/verify-2fa`
  - `/verify-2fa` form action commits the session after TOTP/backup code verification
- Update `docs/SECURITY.md` Layer 2 section to mention 2FA validation

#### B.5 Backup codes + recovery
- Backup codes are single-use, hashed at rest, regeneratable from `/setup-2fa` (invalidates the old set)
- Recovery flow if user loses both device + backup codes: admin-side action `reset2faForUser({ userId, reason })` — also audit-logged

---

## C. In-app notifications (Task 7.6)

The Phase 5 reveal / placement / download events already write audit rows but nobody knows about them unless they visit `/dashboard/activity`. Task 7.6 surfaces the same events as **in-app notifications** — bell icon with unread badge, dropdown panel, full-page list. Phase 7 admin actions (suspend / approve / reject / new queue items) naturally fold into the same channel. Phase 8 wires email as a parallel delivery channel using the same trigger points.

### C.1 Schema + migration
New table `notifications`:

```ts
notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind text NOT NULL,              -- e.g. 'contact.revealed'
  title text NOT NULL,             -- "Discovery Bank revealed your contact"
  body text,                       -- "Email shared. They have your consent on file (v2.1)."
  link text,                       -- "/dashboard/activity" — where the bell click goes
  meta jsonb,                      -- { orgId, orgName, profileId } for re-renders / l10n
  read_at timestamp,               -- null = unread
  created_at timestamp DEFAULT now()
)
```

Indices:
- `notifications_user_unread` ON `(user_id, created_at DESC) WHERE read_at IS NULL` — drives the unread-badge query
- `notifications_user_at` ON `(user_id, created_at DESC)` — drives the dropdown + full page

Per-user notification preferences (a small `notification_prefs` table OR a JSONB column on `app_user` — DECIDE). Plan: JSONB column `app_user.notification_prefs` keyed by `kind`, value `{ inApp: boolean, email: boolean }`. Defaults all `inApp: true, email: false` until Phase 8 ships the email channel.

### C.2 Library — `lib/notifications/server.ts`

```ts
createNotification({ userId, kind, title, body?, link?, meta? }): Promise<void>
markRead({ id }): ActionResult
markAllRead(): ActionResult
listForUser({ limit?, before? }): NotificationItem[]
unreadCount(): number  // cached() per render
```

- `createNotification` is **idempotency-aware** for high-cardinality kinds: if `kind = 'profile.viewed'` and the same `(userId, kind, meta.orgId)` already exists in the last 24h, dedupe (don't ping Andile 12 times because Naledi refreshed the dossier). For lower-cardinality kinds (placement.confirmed, contact.revealed) no dedupe — every reveal is its own event.
- All actions call `verifySession()` — notifications belong to one user only; cross-user reads forbidden.
- `listForUser` accepts a `since`/`before` cursor for pagination. Default page size: 20.

### C.3 Bell component (header)
- New `<NotificationBell />` client island. Polls `unreadCount` every 30 s via a Server Action; renders an unread badge if `>0` (cap label at "9+").
- Click opens a portaled dropdown panel: recent 10 notifications, click-to-mark-read, "Mark all read" link, "View all →" → `/dashboard/notifications` (role-scoped path).
- Mounts in `DashboardShell` header for all three roles (seeker, employer, admin). The header on `SiteHeader` (public pages) does NOT mount it — unauth users have nothing to be notified about.

### C.4 Full notifications page
- One implementation, three route-group entry points so the URL matches the role:
  - `/dashboard/notifications` (seeker)
  - `/employer/notifications` (employer)
  - `/admin/notifications` (admin)
- All three render the same `<NotificationsList />` component. Pagination via "Load older" cursor.
- Empty state per role with role-appropriate copy and a link back to the relevant surface (`/search` for seekers' "no activity yet — share your profile" etc.).
- Update SEEKER_NAV / EMPLOYER_NAV / ADMIN_NAV to include a "Notifications" entry with the unread count as a chip.

### C.5 Wire trigger points

#### Already-shipped Phase 5 actions (one `createNotification` line each)

| Trigger | Action file | Notification | Audience |
|---|---|---|---|
| Naledi opens Andile's dossier | `app/[locale]/(employer)/employer/dossier/[handle]/page.tsx` server side | `profile.viewed` (deduped 24h per orgId) | Seeker |
| `revealContact` | `lib/employer/reveal.ts` | `contact.revealed` | Seeker |
| `downloadQualification` | `lib/employer/reveal.ts` | `document.downloaded` | Seeker |
| `markAsHired` | `lib/employer/placements.ts` | `placement.confirmed` | Seeker (plus admin info notification) |

Each `createNotification` writes inside the same `db.transaction` as the existing audit-log + main mutation — drift-free.

#### Phase 7 admin actions (added inline as A.1–A.4 land)

| Trigger | Action | Notification |
|---|---|---|
| Admin approves qualification | `approveQualification` (A.2) | `qualification.verified` → seeker |
| Admin rejects qualification | `rejectQualification` (A.2) | `qualification.rejected` → seeker (with `meta.reason`) |
| Admin approves org | `approveOrganisation` (A.2) | `org.verified` → all org members |
| Admin rejects org | `rejectOrganisation` (A.2) | `org.rejected` → all org members |
| Admin suspends user | `suspendUser` (A.1) | `account.suspended` → user (with `meta.reason`); user is signed out + can't re-sign-in |
| Admin restores user | `restoreUser` (A.1) | `account.restored` → user |
| New report filed | `flagProfile` (A.1 from `/p/[handle]`) | `moderation.reported` → ALL admins (multi-recipient) |
| New verification queued | seeker uploads cert (existing) | `verification.queued` → ALL admins |

For multi-recipient (broadcast-to-admins) we insert one row per admin user. Cheap at our scale; the indexes cover it.

#### Deferred (Phase 8 cron + email)
- `status.stale.warning` → seeker (nightly cron flips when band crosses)
- `saved_search.new_matches` → all org members of the saved-search owner org

### C.6 Notification preferences UI
- `/dashboard/account` (and `/employer/account`, `/admin/account`) gets a "Notifications" panel listing every kind with two toggles (In-app · Email) — email column is disabled with a Phase-8 pill until Resend lands.
- Server Action `updateNotificationPref({ kind, channel, enabled })` flips the JSONB.
- `createNotification` honours `inApp = false` and silently skips (still writes the audit row — audit is separate, by design).
- Each kind ships with a sensible default (e.g. `contact.revealed` defaults to `inApp: true` — POPIA visibility); `profile.viewed` defaults to `inApp: false` because employers viewing a profile dozens of times is noisy.

### C.7 Notification kinds catalog (canonical list)

| Kind | Default in-app | Default email | Audience | Trigger |
|---|---|---|---|---|
| `profile.viewed` | off (noisy) | off | Seeker | Dossier render (deduped per org per day) |
| `contact.revealed` | **on** | off (Phase 8: on) | Seeker | `revealContact` |
| `document.downloaded` | **on** | off (Phase 8: on) | Seeker | `downloadQualification` |
| `placement.confirmed` | **on** | off (Phase 8: on) | Seeker | `markAsHired` |
| `qualification.verified` | **on** | off (Phase 8: on) | Seeker | `approveQualification` |
| `qualification.rejected` | **on** | off (Phase 8: on) | Seeker | `rejectQualification` |
| `account.suspended` | **on** | off (Phase 8: on) | Affected user | `suspendUser` |
| `account.restored` | **on** | off | Affected user | `restoreUser` |
| `org.verified` | **on** | off (Phase 8: on) | All org members | `approveOrganisation` |
| `org.rejected` | **on** | off | All org members | `rejectOrganisation` |
| `moderation.reported` | **on** | off | All admins | Public Report button |
| `verification.queued` | off (high-volume) | off | All admins | Seeker uploads cert / org submits |
| `status.stale.warning` | **on** | off (Phase 8: on) | Seeker | Phase 8 cron |
| `saved_search.new_matches` | **on** | off (Phase 8: on) | All org members | Phase 8 cron |

### C.8 POPIA design notes
- **Seekers see only events about themselves.** Surveillance kinds (`profile.shortlist.add`) are NOT in the catalog — Discovery Bank does not need a seeker to know they were shortlisted.
- **The `meta` JSONB never carries raw PII** beyond what the user has already consented to share (org name, role title). Email addresses, ID numbers, document keys never appear in notification rows.
- **Recipient targeting respects `app_user.suspendedAt`**: suspended users don't get notifications; the rows queue up so when restored they see them.
- **Audit log is the system-of-record**, notifications are UX state. Deleting a notification row (cleanup) never erases the underlying audit event. Document this in the Privacy page copy.

---

## Acceptance criteria (Phase 7 is DONE when every box ticks)

### Admin actions
- [ ] Suspend a reported user → row flips in DB; user can't sign in (gets "Account suspended" message); audit row written
- [ ] Approve a pending qualification → `verification = 'verified'`; seeker sees the badge change on their dashboard
- [ ] Add a new profession via /admin/taxonomy → appears in /sign-up/seeker dropdown immediately
- [ ] Adjust freshness-band thresholds in /admin/settings → `/insights` recomputes on next render
- [ ] /admin/audit-log filters narrow the list; CSV export streams a real file with the filtered rows

### 2FA
- [ ] Admin signs in → forced to /setup-2fa → scans QR → enters TOTP → backup codes shown once → lands on /admin
- [ ] Admin signs in again on a different device → /verify-2fa challenge → enters TOTP → /admin
- [ ] Admin loses TOTP device → uses a backup code → lands on /admin → code is now invalid for reuse
- [ ] Seeker signs in → no 2FA gate (optional)
- [ ] Employer with verified org → forced setup applies

### Audit-driven polish
- [ ] Landing "Confirmed hires · MONTH" reflects the actual current month
- [ ] /search no longer shows a disabled "Load more"
- [ ] /p/[handle] Report button writes a moderation report (visible in /admin/moderation)
- [ ] /p/[handle] "Request contact" routes to sign-in for unauth, to dossier for verified employer
- [ ] Every admin button does what its label says — zero dead controls

### In-app notifications (Task 7.6)
- [ ] Naledi reveals Andile's contact → Andile sees a bell badge within 30 s on any page he's on; clicking lands on `/dashboard/activity` with the highlighted event
- [ ] Naledi marks Andile as hired → Andile gets a `placement.confirmed` notification AND a prompt to update his employment status
- [ ] Admin approves a qualification → seeker gets `qualification.verified` notification; reject path includes `meta.reason` in the body
- [ ] Admin suspends a user → that user gets `account.suspended` (will see it on next sign-in attempt's bounce page) AND every admin gets `moderation.reported` on the originating report
- [ ] `profile.viewed` is deduped: Naledi refreshing Andile's dossier 5 times in an hour produces ONE notification, not 5
- [ ] Bell unread badge caps at "9+"
- [ ] Notifications page paginates ("Load older" cursor)
- [ ] Mark-all-read works; individual mark-read on click works
- [ ] `/dashboard/account` notification-prefs panel actually persists toggles (email column disabled with Phase-8 pill)
- [ ] Suspended user's notifications queue up; they see them on restore
- [ ] No `meta` field contains raw email / ID / document key on any seeded notification (grep audit)

---

## Out of scope for Phase 7

- **Pagination on /search** — Phase 6 (alongside the FTS query rebuild for skills-gap)
- **Email channel for notifications** — Phase 8 wires Resend; the schema already has the `email` toggle on the preferences panel, just disabled
- **Push notifications (web push / native)** — out of scope entirely until product validates the demand
- **Real-time delivery (WebSocket / SSE)** — Phase 9 if traffic justifies; polling holds for now
- **Cron-driven hard-delete of soft-erased users** (30-day window) → Phase 8
- **`status.stale.warning` + `saved_search.new_matches` notifications** — these need scheduled jobs → Phase 8
- **Rate limiting via Upstash** → Phase 9 (Better Auth's in-memory limit + 2FA brute-force protection holds for Phase 7)
- **SAQA / Home Affairs verification adapters** → Phase 8

---

## Risks to flag at kickoff

- **Backup codes shown once + hashed at rest** — if the user closes the modal without copying, they have to regenerate. Document this prominently in the setup flow. Make the "Download .txt" button huge.
- **Forced-setup gate must not loop** — verify the redirect logic excludes `/setup-2fa`, `/verify-2fa`, and `/api/auth/**` so the user can actually reach the setup page. Test with a sandbox account.
- **`admin/users` suspend action must use soft-delete** — never hard-delete from this surface. Hard-delete only via the Phase 8 erasure cron after the 30-day grace.
- **2FA reset by admin is a privileged escalation path** — only Sebenza-issued admins can do it; double-log the audit row with both the admin actor and the affected user as subject.
- **Settings persistence cache** — if cache TTL is too long, freshness-band changes don't surface for hours. Default 5 min; consider Redis pub/sub when we move to multi-instance (Phase 9).
- **Better Auth's `twoFactor` plugin must come BEFORE `nextCookies`** in the plugins array — order matters per their docs. Verify on a fresh build.

### Risks specific to notifications (Task 7.6)
- **`profile.viewed` notification spam.** Employers reload dossiers; without dedupe, every page render pings the seeker. Mitigation: 24-hour dedupe key `(userId, kind, meta.orgId)` enforced inside `createNotification`. Verify with a brute-force test before sign-off.
- **Polling cost.** 30s polling for every active dashboard tab → at scale this is the most-called Server Action. Mitigate with React `cache()` on `unreadCount`, and consider raising to 60s if Neon compute time becomes noisy.
- **Suspended-user notification fan-out.** A bulk admin action that suspends many users at once shouldn't crash trying to write thousands of notification rows. Wrap multi-recipient inserts in batched `INSERT ... VALUES (...)` (max 200 rows per insert) inside a single transaction.
- **POPIA: notification rows store actor org names + handles.** Confirm with privacy review that "Discovery Bank revealed your contact" doesn't itself constitute a new disclosure beyond the audit log (it's a delivery channel of the same fact). Document this in the Privacy page copy.
- **Notification cleanup policy.** Without retention, the table grows forever. Plan: notifications older than 90 days are pruned by the Phase 8 nightly cron. Document the policy on the Privacy page (alongside audit-log retention).

---

## Audit-2026-05-23 — full findings recap

Captured during the post-Phase-5 audit before this plan was opened. Every item is mapped to a section above; reference list for traceability:

| Surface | Issue | Mapped to |
|---|---|---|
| `/admin` overview KPIs | All 4 numbers hardcoded | A.1 + A.2 + A.3 (live KPI queries) |
| `/admin/audit-log` filters | No submit handler | A.5 |
| `/admin/audit-log` CSV | Dead button | A.5 |
| `/admin/moderation` queue + buttons | All fake / dead | A.1 |
| `/admin/settings` save | Entire page UI-only | A.6 |
| `/admin/taxonomy` add/edit | All buttons inert | A.4 |
| `/admin/users` search + fake employer rows | Mixed real/mock; search dead | A.3 |
| `/admin/verifications` approve/reject | All buttons inert | A.2 |
| Landing "Confirmed hires · May" | Month hardcoded | A.7 |
| `/search` load-more | Disabled button implies pagination | A.7 |
| `/p/[handle]` Report button | No handler | A.7 + A.1 |
| `/p/[handle]` contact/save buttons | Disabled with no sign-in route | A.7 |
| `/insights` CSV export | Dead button (overlaps Phase 6) | A.7 / Phase 6 |
| Seed: `salary_band`, `actor_user_id` missing on placements | Phase 5 columns not backfilled | A.8 |
| Seed: 0 saved searches, 0 shortlists, 0 prior reveals | Empty states forever in employer demo | A.8 |
| Production hardening | Rate-limit, CSP, Sentry, loading.tsx, robots, sitemap | **Phase 9** (explicit) |
| Trigger points minted by Phase 5 but no user-facing notification | reveal / placement / download / view → silent unless on `/dashboard/activity` | **C.5 (Task 7.6)** |
| Admin queue events have no admin-visible alert | Phase 7's own A.1/A.2 actions need a delivery channel | **C.5 (Task 7.6)** |
| Account suspension is silent to the affected user | A.1's `suspendUser` must reach the user | **C.5 (Task 7.6)** |

---

*When this ships: write `docs/completed/PHASE_7_COMPLETE.md` and open `docs/PHASE_8_PLAN.md` (Resend email + cron jobs + KYC adapter + SAQA verification).*
