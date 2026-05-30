# PHASE 11.1 PLAN — ENGAGEMENT VELOCITY (RETENTION SURFACING)
*Opens with Phase 11. Companion docs: `PHASE_11_PLAN.md` · `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/popia/`.*

> **Thesis:** Almost every retention gap on the seeker side is a *surfacing* problem, not a missing-feature problem. The data exists, the cron jobs run, the audit log records the events. Phase 11.1 makes the seeker's existing effort visible and felt. Near-zero risk; mostly compose-existing-data work; biggest single retention lift available.

---

## 🎯 GOAL

After Phase 11.1 ships, a seeker who hasn't opened the dashboard in 14 days returns with three signals: a **digest email** that summarises what changed while they were away, a **welcome-back delta card** on the dashboard surfacing the same data when they sign in, and a **"why no invites?" diagnostic** on the invitations inbox that turns the "platform is broken" silent-fail into an actionable checklist.

Two smaller pieces round it out: **achievement badges** that celebrate the milestones their existing audit data already implies (verified profile, 10 invites accepted, 5-view week, 3-month status fresh streak), and **invitation urgency** (a "1 day left" chip on invites that expire within 48h).

The shared invariant: **no new data category**. Everything Phase 11.1 surfaces is data we already collect for POPIA / audit / activity-feed reasons.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Activity / KPI infra** — `getSeekerActivity(me, n)` in `lib/profile/activity.ts` returns the viewers / contacts / reveals / downloads KPIs + a chronological feed. Used by `/dashboard/activity` + the dashboard overview.
- **Rank-in-pool query** — `rankInPoolQuery({ handle, profession, province, projectedSkillBoost })` in `db/queries/analytics.ts` returns current rank + projected rank for "+N skills".
- **Status freshness** — `freshnessSummary(statusConfirmedAt)` in `lib/status.ts` returns band + days.
- **Notification infra** — `lib/notifications/server.ts` + `lib/notifications/catalog.ts`. Nine kinds; in-app + email channels; dedupe windows. Already used for `qualification.verified`, `profile.viewed` etc.
- **Email transport** — `lib/email/send.ts` (Phase 9.18). SMTP-only; loud-fail in prod when misconfigured; `EmailTestPanel` for diagnostics.
- **Cron infrastructure** — `app/api/cron/*` routes gated by `CRON_SECRET`. Existing examples: `status-stale-warning`, `placement-retention-snapshot`, `lmi-snapshot`. Each one is a thin Server-Action wrapper.
- **Audit log** — every milestone we want to surface (first verified cert, 10th invite accepted, etc.) is already a row in `audit_log` with a structured `kind` and `meta`.
- **Last-login timestamp** — `appUser.lastSignInAt` (set on Better Auth callback). The delta card reads this.

---

## 📋 TASKS

### Task 11.1.1: Weekly seeker digest email

**Scope.** A weekly cron fires a single email per opted-in seeker on Mondays at 06:00 SAST summarising the last 7 days: viewers, contacts, rank delta, status freshness. Each section is a number + a one-line action. The footer carries an unsubscribe link.

**Why now.** This is the single highest-leverage surfacing change in the entire phase. Email is the only channel that reaches a seeker who hasn't opened the app — exactly the audience we lose.

**Data shape (no new tables).** Read-only composition over existing queries:

```ts
// lib/seeker/digest.ts (new file)
export async function composeWeeklyDigest(profileId: string): Promise<DigestPayload> {
  const me = await loadProfile(profileId);
  const activity = await getSeekerActivity(me, 0); // window: last 7d
  const rank = await rankInPoolQuery({
    handle: me.handle,
    profession: me.profession,
    province: me.province,
    projectedSkillBoost: 2,
  });
  const fresh = freshnessSummary(me.statusConfirmedAt);
  const invites = await countNewInvitesSinceDate(me.id, sevenDaysAgo());
  return { activity, rank, fresh, invites, profile: me };
}
```

**Template.** Plain-text + HTML alternates (RFC 2046 multipart). The HTML body uses inlined CSS, no remote assets except the logo (signed Supabase URL). Civic-Editorial typography is faked with web-safe fallbacks (`'Hanken Grotesk', system-ui, sans-serif`); we do not embed Google Fonts in email.

**Notification catalog kind.** `seeker.weekly_digest` — new kind in `lib/notifications/catalog.ts`. `defaultInApp: false` (the email is the artefact; the in-app version would clutter the bell), `defaultEmail: true` for new sign-ups (with the opt-out link in every send).

**Suppression rules.**
- Skip if `statusConfirmedAt > 90 days ago` AND no invites + no activity for 7d (don't email someone who's clearly inactive — they'll feel spammed).
- Skip if the seeker has no consent for `searchability` (they paused the platform; respect it).
- Skip if last digest sent in past 6 days (cron-restart safety; idempotent send window).

**Audit posture.** Each send writes `seeker.digest.sent` with the timestamp, the digest hash, and the open-tracking pixel URL. Resend / Sendgrid log opens via webhook → another audit row `seeker.digest.opened`.

**POPIA touch.** Add `seeker.weekly_digest` to `docs/popia/DPIA.md` table. The processing purpose is "service communications" which falls under POPIA s.11(1)(b) "performance of a contract" + the seeker's account-creation consent — no new consent needed.

- [ ] New `lib/seeker/digest.ts` with `composeWeeklyDigest` + `renderDigestText` + `renderDigestHtml`.
- [ ] New cron endpoint `app/api/cron/seeker-weekly-digest/route.ts`. Cursor over opted-in profiles in batches of 100; `await sendEmail({ to, subject, text, html })` per row.
- [ ] New notification kind `seeker.weekly_digest` in the catalog.
- [ ] Vercel cron `0 4 * * 1` (Monday 04:00 UTC = 06:00 SAST).
- [ ] One help article at `content/help/seeker/account/managing-notification-preferences.md` updated to mention the digest + opt-out.
- [ ] DPIA row added.

---

### Task 11.1.2: "Why no invites?" diagnostic card

**Scope.** When a seeker opens `/dashboard/invitations` and the invite count is 0, render a diagnostic card *above* the empty state. The card lists the four preconditions for getting invites, each with a green check or a red cross + actionable link:

- ✓ Status confirmed within the last 90 days *(or ✗ stale since YYYY-MM-DD — confirm now)*
- ✓ Profile is at least 50% complete *(or ✗ 30% — add 2 skills + 1 cert)*
- ✓ Vacancy-matching consent is on *(or ✗ off — toggle in Privacy)*
- ✓ Employers in your skill × location combo exist *(or ✗ rare combo — see Career Compass for adjacent skills)*

**Why now.** This is the silent killer. A seeker with stale status + 2 skills + vacancy-matching consent off sees no invites and assumes Sebenza is broken or that they're not good enough. The diagnostic turns the platform's existing knowledge ("we know exactly why you have no invites") into a five-line, actionable card.

**Composition.** All four preconditions are derived from data we already load on the page:

```ts
// inside app/[locale]/(seeker)/dashboard/invitations/page.tsx
const fresh = freshnessSummary(me.statusConfirmedAt);
const completeness = me.completeness;
const matchingConsent = await readConsent(me.id, "vacancy_matching");
const poolSize = await rankInPoolQuery({ ... }).total;
```

No new queries; no new DB columns.

**UI.** Civic-Editorial card pattern — ink border, paper background, ordinal numerals (`01`, `02`, `03`, `04`) for the four checks, green check / red cross icon (`lucide-react`) inline. The action link is a `<HelpLink>` chip pointing at the relevant help article + a direct link to the action surface (`/dashboard/privacy`, `/dashboard/grow` etc.).

**Edge cases.**
- All four ✓ + no invites: the card renders "All clear. The matcher hasn't surfaced you for a fresh vacancy yet. Most seekers see their first invite within 21 days of a complete profile."
- 3+ red crosses: visual emphasis on the most-impactful one (status freshness > completeness > consent > pool size).

- [ ] New `<NoInvitesDiagnosticCard>` client component in `components/feature/seeker/NoInvitesDiagnosticCard.tsx`.
- [ ] Conditional render in `app/[locale]/(seeker)/dashboard/invitations/page.tsx` when `invitations.length === 0`.
- [ ] Help article at `content/help/seeker/invitations/why-no-invites.md`.
- [ ] No DPIA touch — composition over existing data.

---

### Task 11.1.3: Welcome-back delta card on `/dashboard`

**Scope.** When a seeker signs in after an absence ≥ 7 days, render a one-time delta card at the top of `/dashboard` summarising what happened while they were gone: profile views, contact reveals, new invites, rank movement, freshness state. Dismissable; auto-dismisses on the next page navigation regardless.

**Why now.** The welcome-back moment is the single most engagement-elastic touchpoint we have. A seeker returning after 14 days who sees "3 employers viewed you while you were gone, your rank is +2, your status is still fresh" is materially more likely to stay engaged than one who sees an unchanged dashboard.

**State management.** No new DB column. Read `appUser.lastSignInAt`; compare against `now()`. If delta < 7 days, render nothing. If ≥ 7 days, compute the delta server-side over `getSeekerActivity` + `rankInPoolQuery` for the absence window. Mark the card as "seen" by writing a cookie (`sebenza:welcome_back:dismissed=<lastSignInAt>`) so a refresh in the same session doesn't re-render it.

**Composition example.**

```ts
const absentSinceDays = differenceInDays(now(), lastSignInAt);
if (absentSinceDays < 7) return null;
const delta = await composeAbsenceDelta(me, lastSignInAt);
// delta carries: viewersInWindow, contactsInWindow, newInvitesInWindow,
// rankAtSignIn, rankNow, statusBandAtSignIn, statusBandNow.
```

**UI.** Brand-tint background (`var(--color-brand-tint)`), brand-strong border on the left edge (matching the existing PendingInvitesCallout pattern). Four numbers in a horizontal row at the top; the bottom carries one inline "Open inbox →" CTA when `newInvitesInWindow > 0`.

**Suppression.** Skip when the delta is entirely zeros (no views, no new invites, no rank movement). The card celebrates change; nothing-changed is its own honest signal but doesn't need a card.

- [ ] New `composeAbsenceDelta(profile, sinceDate)` in `lib/seeker/welcome-back.ts`.
- [ ] New `<WelcomeBackCard>` server component in `components/feature/seeker/WelcomeBackCard.tsx`.
- [ ] Conditional render in `app/[locale]/(seeker)/dashboard/page.tsx`.
- [ ] Cookie helper `lib/cookies/welcome-back.ts` (idempotent read-and-clear pattern).

---

### Task 11.1.4: Achievement badges (milestone surfacing)

**Scope.** Six honest milestones surfaced as badges on `/dashboard`. Each is derived from audit-log data we already have:

| Slug | Trigger | Audit-log derivation |
|---|---|---|
| `profile_verified` | Any qualification or KYC verified | `audit_log` rows of kind `qualification.verified` OR `kyc.verified` |
| `first_invite_accepted` | First `invitation.accepted` row | Earliest `invitation.accepted` with this profile_id |
| `ten_invites_accepted` | Tenth `invitation.accepted` row | Count `invitation.accepted` rows |
| `five_view_week` | ≥5 distinct viewer-orgs in any 7-day window | `profile.view` rows grouped by org_id in window |
| `status_streak_90` | 3 consecutive monthly status confirmations | `profile.status.confirm` rows over the last 90 days |
| `first_placement` | First confirmed placement (Mark-as-Hired) | Earliest `placement.confirmed` with this profile_id |

**Why now.** Achievement visibility is the missing reward loop. Seekers do all the work; the platform celebrates none of it. Six milestones is enough variety without becoming spammy; each is honest (no participation trophies).

**Storage.** New table `seeker_badges`:

```ts
seeker_badges (
  id              text primary key,
  profile_id      text references profiles(id) on delete cascade,
  slug            text not null,           -- one of the six slugs above
  awarded_at      timestamp not null default now(),
  unique(profile_id, slug)
)
```

A cron job runs nightly and inserts new rows for seekers who've crossed a threshold since the last run. Insertion is idempotent (unique constraint catches re-runs).

**UI.** A "Recent achievements" strip on `/dashboard` showing the most recent 3 badges. Each badge is a small medallion (SVG glyph) + label + the awarded date. Hover / tap reveals the full citation: "Awarded 2026-05-30 — first verified qualification on your profile."

**Notification + audit.** Each badge insert fires an `achievement.awarded` notification (in-app default on, email default off) + writes one `achievement.awarded` audit row. Resend webhook on open lands in `notification.opened`.

**Civic-Editorial constraints.** No confetti. No bouncing icons. The badge medallion is a static SVG; the appearance on the dashboard is a quiet card (not a modal).

- [ ] New migration: `seeker_badges` table.
- [ ] New `lib/seeker/badges.ts` with `awardEligibleBadges(profileId)` (idempotent).
- [ ] New cron at `app/api/cron/seeker-badge-sweep/route.ts` (nightly).
- [ ] New notification kind `achievement.awarded`.
- [ ] New `<RecentAchievementsStrip>` component on `/dashboard`.
- [ ] Six static SVG medallions in `public/badges/`.
- [ ] One help article: `content/help/seeker/profile/achievements.md`.

---

### Task 11.1.5: Invitation urgency chip

**Scope.** When an invitation card is rendered on `/dashboard/invitations` and the responds-by date is within 48h, add a red chip "1 day left" or "Responds today". When the responds-by date is in the past but state is still `invited`, add an orange chip "Expires soon — auto-decline pending".

**Why now.** The card already shows the responds-by date in small grey type. Seekers gloss over it. The visual urgency cuts response time and reduces auto-expirations (which are a worse outcome than declines because they're silent).

**Logic.**

```ts
const hoursUntilExpiry = differenceInHours(invitation.expiresAt, now());
const chip = hoursUntilExpiry < 0
  ? { label: "Expires soon", tone: "warning" }
  : hoursUntilExpiry < 24
    ? { label: "Responds today", tone: "danger" }
    : hoursUntilExpiry < 48
      ? { label: "1 day left", tone: "danger" }
      : null;
```

- [ ] Modify `<InvitationCard>` component (or wherever the cards render in `app/[locale]/(seeker)/dashboard/invitations/page.tsx`) to add the urgency chip.
- [ ] No data shape change.

---

### Task 11.1.6: Audit-log link prominence

**Scope.** Today the link to `/dashboard/activity` is buried in the sidebar nav. On the dashboard, when `viewers_this_week > 0`, render an inline link near the rank card: "{N} employers looked at you this week. See who →".

**Why now.** This is one of Sebenza's strongest differentiators — most platforms hide viewer data behind a paywall. We give it away by default but don't surface it. Making it prominent builds trust at the surface where seekers first encounter the platform.

- [ ] Modify `app/[locale]/(seeker)/dashboard/page.tsx` to add an inline "See who →" link to the existing activity section.
- [ ] One help article cross-link from `/dashboard/activity` help center.

---

## 🚫 OUT OF SCOPE FOR PHASE 11.1 (explicit guardrails)

- ❌ **Daily digest emails.** Weekly is the upper bound for opt-in transactional emails before the spam-filter risk grows materially. Daily can land in Phase 11.5+ if real usage suggests it.
- ❌ **In-app push notifications.** Requires service-worker setup which is out-of-scope for Phase 11; deferred to **Phase 12 PWA work**.
- ❌ **New consent purposes.** The digest email reads from existing consents (account-creation + service-communication) — no new toggle on `/dashboard/privacy`.
- ❌ **AI-summarised digest copy.** The digest is composed from structured numbers + canned copy. Template-driven; no LLM in the loop.
- ❌ **Public-facing achievement leaderboards.** Badges are private to the seeker. Don't expose them on `/p/[handle]`; that's a different conversation.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Weekly cadence on the digest, never higher. | Higher cadence inflates the spam-filter risk + fatigues seekers. Weekly is the cadence that survives. |
| D2 | Digest opens via email-pixel tracking. | Standard ESP feature; non-controversial. The pixel URL writes one `seeker.digest.opened` audit row so we have honest open-rate data. |
| D3 | "Why no invites?" card only renders when invites count is 0. | Once a seeker has had one invite, the silent-fail concern is resolved. Card disappears. |
| D4 | Welcome-back card is cookie-dismissed, not DB-tracked. | Lightweight + survives clean-browser users. The cost of re-rendering in the rare double-render case is near-zero. |
| D5 | Badges are append-only; we never revoke. | Honest milestones; revoking a badge because circumstances changed is a worse signal than letting it stand. The exception is admin moderation actions (a suspended account loses all badges — handled in the existing suspension flow). |
| D6 | Six badges, not twenty. | Variety without spam; each badge has to be honest enough to feel earned. Adding more later is easy; adding too many at once cheapens them all. |
| D7 | "Responds today" chip uses the danger tone (red), not just an icon. | The tradeoff is a small amount of visual noise vs the much-larger cost of an auto-expired invite (silent failure, both parties lose). Red wins. |

---

## 🧪 HOW TO VERIFY

After the sub-phase ships:

1. Sign in as a seeded seeker; confirm the dashboard shows no welcome-back card on first session.
2. Wait 7 days (or fake `lastSignInAt`); sign in again. Welcome-back card renders.
3. Visit `/dashboard/invitations` with a fresh profile (no invites). Confirm the diagnostic card renders with the appropriate ✓/✗ pattern.
4. Manually trigger the digest cron via the seeded CRON_SECRET; check Resend inbox for the email + the pixel URL fires.
5. Confirm the seeded "10 invites accepted" seeker has the `ten_invites_accepted` badge on their dashboard.
6. Open `/dashboard/account`, toggle the email channel off, re-trigger the cron; confirm no digest is sent.

---

*Plan opened with Phase 11. Target: ship within 5 working days of opening.*
