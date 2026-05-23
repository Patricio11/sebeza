# Phase 7  Admin, Moderation & 2FA Enforcement · ✅ COMPLETE (2026-05-23)

Shipped across four commits  three feature parts plus a "close the gaps" pass after an in-depth audit caught items the first three commits glossed over. The full plan lives at `docs/completed/PHASE_7_PLAN.md` with every acceptance box ticked.

| Commit | Theme |
|---|---|
| `2c90b3d` | **Part 1**  admin actions + moderation + suspended sign-in bounce |
| `bacb16f` | **Part 2**  in-app notifications (action-driven, no polling) |
| `186844c` | **Part 3**  2FA enforcement (Better Auth `twoFactor` plugin) |
| _next_   | **Closing the gaps**  audit-log filters + CSV, notif prefs UI, pagination, `profile.viewed` trigger, settings consumed by `/insights`, sign-up profession from DB, public-surface polish |

---

## What's now real (every previously dead button)

### `/admin`
- KPI tiles read from `adminOverviewCounts()`  pending verifications, open reports, new users (7 d), audit events (24 h), suspended accounts.
- "Recent activity" feed reads the audit ledger live with relative-time formatting per locale.

### `/admin/verifications`
- Pending qualifications + pending organisations from a real DB query.
- Approve / Reject buttons wired to `approveQualification` · `rejectQualification` · `approveOrganisation` · `rejectOrganisation` with a reason-capture form for rejections (≥ 10 chars).
- Every flip writes `verification.approve` / `verification.reject` / `org.approve` / `org.reject` audit rows AND fires a `qualification.verified|rejected` notification to the seeker (or `org.verified|rejected` to all org members).

### `/admin/moderation`
- Open reports loaded from `lib/admin/moderation-query.ts` with per-profile tallies.
- Inline forms: Close · no action (5-char note) and Suspend user (10-char reason, fires `account.suspended` notification, can't suspend self or other admins, simultaneously closes the originating report as `actioned`).

### `/admin/users`
- Replaces the hardcoded `EXTRA_USERS` array with a real DB join (`app_user × profiles × organization_members × organizations`).
- Search + role filter + status filter via plain `method="get"` form.
- Row actions: Suspend · Restore · **Reset 2FA** · Erase. Erase is soft-delete (Phase 8 cron hard-deletes after 30 days); Reset 2FA wipes the `two_factor` row + flips `two_factor_enabled = false` and is audit-logged as `account.2fa.reset`.

### `/admin/taxonomy`
- DB-backed read via `loadTaxonomy()` (skills, professions, cities + provinces  provinces read-only, seeded by Stats SA).
- Add form with slug + label (cities also pick a province) and per-row Remove with a usage-count guard (refuses to drop a skill still attached to N profiles).

### `/admin/audit-log`
- Filter form is now a real GET  `?kind=` is validated against the catalog union, `?actor=` substring-matches actor OR subject. URL state survives reload + share.
- Export CSV button hits `/api/admin/audit-log/export` which streams a real RFC-4180 CSV with the same filters, capped at 10 000 rows. Every export writes its own `analytics.export` audit row. OWASP CSV-injection guard + UTF-8 BOM for Excel.

### `/admin/settings`
- Reads from `platform_settings` JSONB store via `getAllSettings()`.
- Per-row save (no batch). `updateSetting` validates per-key (e.g. ageing days must exceed fresh days; ranking weights bounded). Each save audit-logs the prior + new value.
- Eight defaults seeded by the migration: freshness band days (fresh / ageing), three ranking weights, three feature flags (2FA enforced, email notifications, /gov portal).

### `/admin/notifications` + `/admin/account`
- New nav entries. The bell mounts in `DashboardShell` for every role.
- `/admin/account` shows profile, 2FA status, and notification preferences for admin-only kinds (`moderation.reported`, `verification.queued`).

### Sign-in flow
- `signIn` looks up `app_user.suspended_at` / `deleted_at` BEFORE issuing a session and returns the suspension reason verbatim.
- 2FA branch: when `auth.api.signInEmail` returns `{ twoFactorRedirect: true }` we route to `/verify-2fa` preserving the `?next=` cursor.
- `verifyRole` / `verifyAdmin` enforce 2FA setup for employer + admin sessions (seekers exempt per No-Flash Rule). The gate is itself gated on the `feature_flag_2fa_enforced` platform setting so ops can stage the rollout.

### Public surface
- Landing month is now `Intl.DateTimeFormat(locale, { month: "long" }).format(new Date())`  no more hardcoded "May".
- `/search` end-state now reads "Showing the top N of M  refine filters to narrow" or "Showing all N matches"  no dead "Load more" button.
- `/p/[handle]` "Request contact reveal" + "Save to talent pool" are real `<Link>`s: unauthenticated → `/sign-in?next=/employer/dossier/<handle>`; employer/admin → straight into the dossier; signed-in seekers see an honest explainer that the action belongs to employers.
- `/p/[handle]` Report button writes a real `reports` row via `flagProfile` (anonymous-safe).

---

## In-app notifications (Task 7.6)

A self-contained subsystem at `lib/notifications/`:

- **`catalog.ts`**  single source of truth for the 14 canonical kinds. Each entry carries default in-app + email toggles, audience, copy for the prefs panel, and a dedupe window in seconds.
- **`server.ts`**  `createNotification` honours user prefs (catalog default ⊕ stored override), dedupes inside the catalog window, swallows write failures so audit-log writes are never blocked. Plus `notifyOrgMembers` + `notifyAllAdmins` fan-out helpers.
- **`query.ts`**  `listForUser({ limit, before })` for cursor pagination + cached `unreadCount` for the bell + `getMyNotificationPrefs` for the prefs panel. All scoped to the signed-in user via `verifySession()`.
- **`actions.ts`**  `markRead`, `markAllRead`, `updateNotificationPref`, `loadOlderNotifications` Server Actions.

### Trigger points wired

| Trigger | Where | Notification |
|---|---|---|
| Dossier render | `app/[locale]/(employer)/employer/dossier/[handle]/page.tsx` | `profile.viewed` → seeker (24 h dedupe per `orgId`) |
| `revealContact` | `lib/employer/reveal.ts` | `contact.revealed` → seeker |
| `downloadQualification` | `lib/employer/reveal.ts` | `document.downloaded` → seeker |
| `markAsHired` | `lib/employer/placements.ts` | `placement.confirmed` → seeker |
| `approveQualification` | `lib/admin/verifications.ts` | `qualification.verified` → seeker |
| `rejectQualification` | `lib/admin/verifications.ts` | `qualification.rejected` → seeker (+ `meta.reason`) |
| `approveOrganisation` | `lib/admin/verifications.ts` | `org.verified` → every org member |
| `rejectOrganisation` | `lib/admin/verifications.ts` | `org.rejected` → every org member |
| `suspendUser` | `lib/admin/moderation.ts` | `account.suspended` → affected user (queued for restore) |
| `restoreUser` | `lib/admin/moderation.ts` | `account.restored` → affected user |
| `flagProfile` (public `/p/[handle]` Report button) | `lib/admin/moderation.ts` | `moderation.reported` → all admins |

### Bell + page surfaces
- `<NotificationBell />` in `DashboardShell` (desktop masthead + mobile top strip)  initial state server-fetched, action-driven revalidate (no polling, no WebSockets  re-check #9 revised during implementation).
- `/dashboard/notifications`, `/employer/notifications`, `/admin/notifications` all render a shared `<NotificationsList />` with 20-row pages and a "Load older" cursor.
- Per-kind prefs panel on all three account pages writes through to `app_user.notification_prefs` JSONB.

---

## 2FA enforcement (Task 7.2)

- Better Auth `twoFactor` plugin wired ahead of `nextCookies()` in the plugin chain. New `two_factor` table + `app_user.two_factor_enabled` flag.
- **/setup-2fa**  three stages: password confirm → QR + backup codes (one-time display, copy-all helper, otpauth URI shown verbatim for locked-down networks) → verify first TOTP.
- **/verify-2fa**  TOTP (default) and backup-code modes via toggle.
- **Forced gate**  `verifyRole` + `verifyAdmin` call `enforceTwoFactorSetup` which lazy-loads `feature_flag_2fa_enforced` from `platform_settings`. Seekers exempt.
- **Account panels**  `/dashboard/account`, `/employer/account`, `/admin/account` carry a real `<TwoFactorAccountPanel />` (was a dead "Configure" stub since the Phase 5 audit).
- **Admin escape hatch**  `reset2faForUser({ userId, reason })` for users who lose both device and backup codes. Audit-logged.

---

## Schema deltas (3 migrations)

| Migration | Adds |
|---|---|
| `0004_phase7_admin` | `reports` + `report_reason` / `report_status` enums · `app_user.suspended_at` / `suspended_reason` / `suspended_by_user_id` · `platform_settings` JSONB store + 8 seeded defaults |
| `0005_phase7_notifications` | `notifications` table with three indices (unread partial + user/at + user/kind/at for dedupe lookups) · `app_user.notification_prefs` JSONB |
| `0006_phase7_two_factor` | `two_factor` table (matches Better Auth plugin schema) · `app_user.two_factor_enabled` |

All migrations are re-runnable (`IF NOT EXISTS` on tables and `ADD COLUMN IF NOT EXISTS` on columns).

---

## Audit kinds added

13 new kinds extending `lib/audit/index.ts`'s `AuditKind` union:

`report.flag` · `report.close` · `account.suspend` · `account.restore` · `account.erase` · `account.2fa.reset` · `verification.approve` · `verification.reject` · `org.approve` · `org.reject` · `taxonomy.add` · `taxonomy.remove` · `setting.update`

---

## Re-check #9  revised during implementation

The plan locked 30 s polling. While building the bell I reconsidered: every notification fires from a specific Server Action that already calls `revalidatePath` on the relevant surfaces. The bell mounts inside `DashboardShell` and is server-fetched on every render, so any navigation refreshes the badge naturally  no client-side timer needed. `markRead` / `markAllRead` add `revalidatePath("/dashboard", "layout")` etc. so the local action also refreshes the bell.

Trade-off: a recipient sitting completely idle on one page won't see new notifications until they navigate. Acceptable for a bell badge  the audit log is authoritative, no metered-data tax on SA 3G mobile, and most active users navigate within 30 s anyway. Phase 9 may add Supabase Realtime if usage analytics show idle-page-stare is common.

---

## What's next

`docs/PHASE_8_PLAN.md` opens with:

- **Resend transactional emails**  finally turn on the per-kind `email: true` toggle on the notification prefs panel (UI already shipped, disabled with a Phase-8 pill).
- **Cron jobs**  nightly hard-delete of soft-erased users past 30 days · `status.stale.warning` nudges · `saved_search.new_matches` rollups · daily `captureSkillGapSnapshot()`.
- **KYC / Home Affairs adapter**  wire SA Home Affairs ID verification.
- **SAQA adapter**  verify qualifications against the National Learners' Records Database so an admin approval can be machine-confirmed first.

---

## Verification

`npm run typecheck` clean. `npm run build` ✓ (compiles, all 7 admin routes + 3 notification routes + /setup-2fa + /verify-2fa + /api/admin/audit-log/export render).

The Phase 5 audit's "every admin button is dead" finding is now answered: every visible admin affordance ships a Server Action behind it, every CTA on a public surface either does the thing or routes the visitor to where they can.
