# PHASE 11.1 COMPLETE — ENGAGEMENT VELOCITY (RETENTION SURFACING)
*Shipped 2026-05-30. First sub-phase of Phase 11 (Seeker Retention + Skill-Growth Conversion). Six tasks; all six landed with no new data category and no machine translation.*

> **One-line summary**: Six near-zero-risk surfacing changes on the seeker side — weekly digest email, "why no invites?" diagnostic, welcome-back delta card, achievement badges + nightly sweep, invitation urgency chips, audit-log link prominence. Every signal is composed from existing data the platform already collects for POPIA / audit / activity-feed reasons; no new tables for any of the user-facing copy beyond `seeker_badges`, no new consent purposes, no new audit kinds beyond the two the badges + digest require.

Commits:

- (this commit) — Phase 11.1 ship: 6 tasks, 1 new table, 2 new audit kinds, 1 new notification kind

---

## 🎯 WHAT SHIPPED

### Task 11.1.1 — Weekly seeker digest email
- New `lib/seeker/digest.ts` composes `DigestPayload` from existing `audit_log` + `vacancy_invitations` + `rankInPoolQuery` + `freshnessSummary` queries. No new data category.
- New cron at `app/api/cron/seeker-weekly-digest/route.ts` runs Monday `0 4 * * 1` UTC (06:00 SAST). Cursors over non-deleted profiles; per-profile failures isolated. Schedule declared in `vercel.json`.
- New notification kind `seeker.weekly_digest` in `lib/notifications/catalog.ts` with `defaultInApp: false` + `defaultEmail: true` + 6-day dedupe window.
- Bespoke email template in `lib/email/templates/notifications.ts` (the four-row metric layout doesn't fit the genericTemplate shell — viewers, contacts, new invites, rank line).
- Suppression: silent weeks (zero deltas + fresh status), email killswitch off, in-window dedupe.

### Task 11.1.2 — "Why no invites?" diagnostic card
- New `<NoInvitesDiagnosticCard>` at `components/feature/seeker/NoInvitesDiagnosticCard.tsx`. Four ordinal checks (status freshness · profile completeness · vacancy-matching consent · pool has employers) each with a green check or red cross + action link.
- Conditional render in `app/[locale]/(seeker)/dashboard/invitations/page.tsx` when `all.length === 0`. Server-composes from existing reads — no new queries.

### Task 11.1.3 — Welcome-back delta card
- New cookie helper `lib/cookies/welcome-back.ts`. `readAndSetLastSeen()` reads `sebenza_dash_last_seen`, returns absence days when ≥ 7, always rewrites.
- New `<WelcomeBackCard>` at `components/feature/seeker/WelcomeBackCard.tsx`. Renders viewers + contacts + new invites with the absence window in the eyebrow. Suppresses when every delta is zero.
- Wired into `app/[locale]/(seeker)/dashboard/page.tsx` above the StatusNudgeBanner.

### Task 11.1.4 — Achievement badges + nightly cron + SVG medallions + UI strip
- New migration `db/migrations/0038_phase11_1_seeker_badges.sql` + matching `seekerBadges` table in `db/schema.ts`. UNIQUE(profile_id, slug) makes the sweep idempotent.
- New `lib/seeker/badge-catalog.ts` with six badges: `profile_verified`, `first_invite_accepted`, `ten_invites_accepted`, `five_view_week`, `status_streak_90`, `first_placement`.
- New `lib/seeker/badges.ts` with `awardEligibleBadges` (idempotent inserts + audit row per award) + `listMyBadges` (newest first, default cap 3).
- New cron at `app/api/cron/seeker-badge-sweep/route.ts`. Nightly (`30 5 * * *` UTC = 07:30 SAST). Per-profile failure-isolated. Schedule declared in `vercel.json`.
- Six static SVG medallions in `public/badges/` (64×64 viewBox, Civic-Editorial paper/ink/ochre palette).
- New `<RecentAchievementsStrip>` at `components/feature/seeker/RecentAchievementsStrip.tsx`. Renders the most-recent three badges across the dashboard overview grid. Silent when the seeker has none.
- New audit kind `achievement.awarded` in `lib/audit/index.ts`.

### Task 11.1.5 — Invitation urgency chip
- `<InvitationCard>` in `app/[locale]/(seeker)/dashboard/invitations/page.tsx` gains a `urgencyChip()` helper. Returns a danger-tone chip for invites within 48 h ("Responds today" / "1 day left") and a warning chip for expired-but-still-`invited` rows.

### Task 11.1.6 — Audit-log link prominence
- Top-of-page audit-log callout on `app/[locale]/(seeker)/dashboard/page.tsx`. Renders only when `activity.kpis.viewersDelta > 0` — avoids an empty boast. Links straight to the activity ledger.

---

## 📦 FILES TOUCHED

**New (12 files)**
- `app/api/cron/seeker-weekly-digest/route.ts`
- `app/api/cron/seeker-badge-sweep/route.ts`
- `lib/seeker/digest.ts`
- `lib/seeker/badge-catalog.ts`
- `lib/seeker/badges.ts`
- `lib/cookies/welcome-back.ts`
- `components/feature/seeker/NoInvitesDiagnosticCard.tsx`
- `components/feature/seeker/WelcomeBackCard.tsx`
- `components/feature/seeker/RecentAchievementsStrip.tsx`
- `db/migrations/0038_phase11_1_seeker_badges.sql`
- `public/badges/{profile-verified,first-invite-accepted,ten-invites-accepted,five-view-week,status-streak-90,first-placement}.svg`
- `docs/completed/PHASE_11_1_COMPLETE.md` (this doc)

**Edited (9 files)**
- `lib/audit/index.ts` — added `achievement.awarded` AuditKind.
- `lib/notifications/catalog.ts` — added `seeker.weekly_digest` NotificationKind.
- `lib/email/templates/notifications.ts` — added bespoke weekly-digest template + mapped the kind.
- `db/schema.ts` — added `seekerBadges` pgTable.
- `app/[locale]/(seeker)/dashboard/page.tsx` — welcome-back, audit-log callout, recent-achievements strip.
- `app/[locale]/(seeker)/dashboard/invitations/page.tsx` — urgency chip + diagnostic-card render path.
- `vercel.json` — canonical 16-job cron schedule (replaces a stub from earlier); two new entries for `seeker-weekly-digest` (Monday `0 4 * * 1`) and `seeker-badge-sweep` (nightly `30 5 * * *`), all jobs staggered 02:00–05:30 UTC.
- `README.md` — refreshed Vercel-Cron row + the cron-routes list to 16 jobs.
- `docs/ROADMAP.md`, `docs/TO_START_EVERY_SESSION.md` — updated current-state.

**Verification**
- `tsc --noEmit` clean
- `vitest run` (carried forward from 10.4) — no regressions

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **Welcome-back state in a cookie, not the DB.** Lightweight, survives clean-browser users; the cost of a re-render in the rare double-render case is near-zero (cf. plan D4).
2. **Badges are append-only — we never revoke** (cf. plan D5). Suspension still wipes them via the existing suspension flow.
3. **Six badges, not twenty** (cf. plan D6). Variety without spam.
4. **Weekly digest cadence, never higher** (cf. plan D1). Higher cadence inflates spam-filter risk + fatigues seekers.
5. **No in-app `seeker.weekly_digest`.** The email IS the artefact; an in-app duplicate would crowd the bell.
6. **No new consent purpose.** Weekly digest reads from existing account-creation + service-communication consents.
7. **Status-confirm streak counts both `profile.status.update` and `profile.status.reconfirm`** — both signal freshness; gating to one of them would punish a seeker who happens to have updated mid-cycle.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Seeker dashboard** — gains welcome-back card (gated by cookie age), audit-log callout (gated by viewersDelta), recent-achievements strip (gated by badge count).
- **Seeker invitations page** — diagnostic card replaces the bare empty state when invites are zero; cards in the list get the urgency chip when within 48 h.
- **Cron surface count** — two new entries (`seeker-badge-sweep` nightly, `seeker-weekly-digest` Monday).
- **Notification prefs panel** — picks up `seeker.weekly_digest` automatically via the catalog iteration.
- **Audit log** — picks up `achievement.awarded` rows from the nightly badge sweep.

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ Daily digest emails (Phase 11.5+ if real usage suggests it)
- ❌ In-app push notifications (Phase 12 PWA work)
- ❌ New consent purposes
- ❌ AI-summarised digest copy
- ❌ Public-facing achievement leaderboards
- ❌ Resend webhook for `seeker.digest.opened` pixel (Phase 11.5+; the cron already audit-rows the send)

---

## 🧪 HOW TO VERIFY

1. Sign in as a seeded seeker → confirm the dashboard shows no welcome-back card on the first session.
2. Clear the `sebenza_dash_last_seen` cookie, set it to a timestamp >7 days ago, sign in again → welcome-back card renders with the absence window in the eyebrow.
3. Visit `/dashboard/invitations` with a profile that has no invites → diagnostic card renders with the four ✓/✗ checks.
4. Manually trigger the digest cron with the local CRON_SECRET → for opted-in seekers with non-silent weeks, an email is dispatched (console transport in dev prints it).
5. Manually trigger the badge sweep cron → confirm seeded seekers who match a badge predicate get rows in `seeker_badges` + the dashboard strip renders the three most-recent.
6. Open `/dashboard/notifications/preferences` → confirm `seeker.weekly_digest` is listed with the expected default toggles.
7. Toggle the email kind off, re-trigger the digest cron → no email is dispatched.
8. On `/dashboard/invitations`, set a test invite's `expiresAt` to within 48 h → urgency chip renders on the card.
9. On the dashboard, ensure the "N employers viewed your profile this week" callout renders only when `viewersDelta > 0`.

---

*Phase 11.1 closes the engagement-velocity arc. Next: Phase 11.2 (Career Compass amplification → growth conversion).*
