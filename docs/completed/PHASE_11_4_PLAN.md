# PHASE 11.4 PLAN  SA DISTRIBUTION (PROFILE-SHARE + WHATSAPP + SMS)
*Opens after Phase 11.3. Companion docs: `PHASE_11_PLAN.md` · `docs/popia/DPIA.md` · `docs/SECURITY.md` · `UX_UI_SPEC.md`.*

> **Thesis:** Sebenza's seeker product is a quiet web app. South Africans don't discover work on the open web; they discover it via WhatsApp groups, SMS, and word of mouth between friends. Phase 11.4 builds the **distribution surface** for that real-world behaviour: a shareable profile card (PNG) with a WhatsApp deep-link, a follow-employer save-list to capture warm intent, optional data-saver mode for low-bandwidth users, and  carefully  an SMS / WhatsApp notification channel for critical invites that can't wait for the next time the seeker opens the app.

> **Cost note:** This is the only Phase 11 sub-phase that introduces recurring external cost (Twilio / AWS SNS for SMS, WhatsApp Business API). The plan documents the cost model up-front so the operator can scope the rollout to a budget.

---

## 🎯 GOAL

After Phase 11.4 ships, a seeker can:

- **Share their profile via WhatsApp** in two taps. The recipient sees a rich preview card (PNG image) on WhatsApp's link-preview surface  not a bare URL.
- **Save employers they find on `/search` or `/p/{org-handle}`** to a private "Following" list. Re-visit, see when new vacancies open, build warm intent into a real pipeline.
- **Toggle data-saver mode** in account preferences. Disables avatars, lazy-loads more aggressively, swaps charts for tables. Respects the SA reality of expensive data.
- **Opt in to SMS / WhatsApp notifications** for critical events  invitation received, contact reveal request. Universal reach for seekers who don't keep email apps installed or who have spotty mobile data.

A fifth task surfaces the related "recommended employers" view to drive organic discovery without paid placement.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Public profile route**  `/p/{handle}`. Already serves redacted, consent-gated profile data to public viewers.
- **Notification infrastructure**  `lib/notifications/server.ts` + `lib/notifications/catalog.ts`. Pluggable channel abstraction; SMS / WhatsApp slot in as new channels.
- **Email transport**  `lib/email/send.ts`. SMTP-based, provider-agnostic. The same abstraction shape works for SMS.
- **Audit log**  every PII-touching outbound message writes a row.
- **Consent surface**  `/dashboard/privacy`. New channels become new consent purposes (or attach to existing service-communication consent  see decision D2).
- **Helper for signed Supabase URLs**  `lib/storage/signed.ts`. The share-card image renders from a Supabase-stored canonical PNG.

---

## 📋 TASKS

### Task 11.4.1: Profile shareable summary card (PNG)

**Scope.** A static PNG image rendered server-side from the seeker's public profile data. The image carries the seeker's display name, profession + city, top three skills (canonical labels), verification badges, and the platform's wordmark. Civic-Editorial typography (Fraunces title, Hanken Grotesk body). Dimensions 1200×630 (standard OpenGraph image dimension for WhatsApp + LinkedIn previews).

A new public route `/p/{handle}/card` returns the PNG (`Content-Type: image/png`). The route is auth-free; subject to the same redaction rules as `/p/{handle}`. Generation is cached for 7 days; cache busts on profile mutation.

Profile editor gains a "Share my profile" button → opens a small modal with three pre-composed messages: WhatsApp ("Check me out on Sebenza: {link}"), LinkedIn ("I'm now on Sebenza, South Africa's talent platform. {link}"), and "Copy link". The WhatsApp option deep-links via `https://wa.me/?text=...&url=...`.

**Why now.** This is the single feature most likely to drive organic growth from your friends' networks. The data is already public-safe (we use it on `/p/{handle}` today). The image just bundles it nicely.

**Tech choice.** Render via `@vercel/og` (already available in the Next.js runtime; no extra dep). The image template lives at `app/p/[handle]/card/route.ts` returning an `ImageResponse`. Civic-Editorial typography handled via inlined web-safe font fallbacks (`Fraunces` is loaded server-side from `node_modules` if present; falls back to system serif).

**Cache strategy.**

```ts
export const revalidate = 60 * 60 * 24 * 7; // 7 days
```

Cache key includes the profile's `updated_at` timestamp; mutations bust automatically via Next's revalidation.

**POPIA touch.** Same data as `/p/{handle}`  no new data category. The card route is subject to the same `searchability` consent gate; revoked-searchability profiles return a generic "Profile not available" image.

**Anti-pattern guards.**
- No QR code on the card (visual noise; people share the link, not the image).
- No "Sebenza" call-to-action button visually overpowering the seeker's name (the seeker is the subject, not the platform).
- No tracking pixel on the image (we don't need to know who scanned it).

- [ ] New route `app/p/[handle]/card/route.ts` returning an `ImageResponse`.
- [ ] New `<ShareMyProfileModal>` component on `/dashboard/profile`.
- [ ] WhatsApp + LinkedIn + Copy-link deep-link templates.
- [ ] One help article: `content/help/seeker/profile/sharing-your-profile.md`.
- [ ] DPIA: no new data category, but the card is a new processing surface  add a row noting the cache TTL + the redaction inheritance.

---

### Task 11.4.2: Follow employer (save for later)

**Scope.** On `/search` results + `/p/{org-handle}` (when org-side public pages ship), a heart-icon button "Follow this employer" saves the org to the seeker's private follow list. No email goes to the employer. Future vacancies from followed employers surface in a new `/dashboard/following` view + trigger a `vacancy.opened.from_followed_employer` notification when the employer publishes a vacancy in the seeker's profession + province.

**Why now.** Warm-lead capture. Today a seeker reads an interesting employer profile, thinks *"maybe in 2 years"*, and never revisits. The follow list captures the intent + gives the platform a discovery surface to nudge gently when the timing is right.

**Data shape.**

```sql
CREATE TABLE seeker_followed_employers (
  id          text PRIMARY KEY,
  profile_id  text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  followed_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(profile_id, org_id)
);

CREATE INDEX idx_followed_employers_by_profile ON seeker_followed_employers(profile_id);
CREATE INDEX idx_followed_employers_by_org ON seeker_followed_employers(org_id);
```

The org-side index supports the "when this employer opens a vacancy, notify followers in matching profession + province" cron query.

**UI surfaces.**

- **`/search` results**: heart icon top-right of each card. Tap to follow / unfollow.
- **`/p/{org-handle}`**: a primary CTA below the org name + verification badge ("Follow this employer").
- **`/dashboard/following`** (new): a list of followed orgs. Each entry shows latest activity (new vacancies in last 30d, current verification tier). Empty state explains the pattern.

**Notification.** New kind `employer.opened_vacancy.in_your_pool` (in-app default on, email default off). Triggers from a nightly cron: for each new `vacancies` row, find all `seeker_followed_employers` matching the org_id, intersect with seekers whose `(profession, province) = (vacancy.profession, vacancy.province)`, send a notification per match.

**Privacy invariant.** The follow is **private to the seeker**. The employer is not notified, not shown a follower count, not given a follower list. Same posture as the block list (Phase 11.3).

**Audit posture.** Every follow / unfollow writes one row. Notification fires write the usual rows.

- [ ] Migration: new table.
- [ ] New `lib/seeker/follows.ts` with `followEmployer({ orgId })` / `unfollowEmployer({ orgId })`.
- [ ] Update `/search` cards to render the heart icon (server-rendered initial state; client island for the toggle).
- [ ] New `/dashboard/following` route + nav entry.
- [ ] Notification kind.
- [ ] New cron at `app/api/cron/followed-employer-vacancy-sweep/route.ts` (nightly).
- [ ] One help article: `content/help/seeker/profile/following-employers.md`.

---

### Task 11.4.3: Data-saver mode

**Scope.** A new account preference: `data_saver_mode` (boolean, default off). When on:

- Avatar images replaced with initials-in-circle (no image network requests).
- Recharts mount-gates more aggressively (chart sections render a "Tap to load chart" placeholder instead of auto-loading).
- City-demand table uses a more compact mobile layout.
- The dashboard's "Recent activity" feed limits to 5 items by default with a "Load more" control.
- Help articles render without the "Try it now →" CTA buttons (small saving but signals respect).

A `prefers-reduced-data` CSS media query is also honoured  if the browser signals it, the same treatment kicks in regardless of the account toggle. Browser signal is the floor; account toggle is the ceiling.

**Why now.** SA reality. Mobile data is expensive; many seekers care about every kilobyte. Respecting it as a first-class option signals trust.

**Data shape.** New column on `app_user`:

```sql
ALTER TABLE app_user ADD COLUMN data_saver_mode boolean NOT NULL DEFAULT false;
```

**UI.** New toggle in `/dashboard/account` under a "Data + bandwidth" section. Help-text: *"On low-data plans? Turn this on to skip images, charts, and some animated elements. We'll still load everything you need to use Sebenza  just lighter."*

**Server-side enforcement.** Conditional rendering throughout: every component that loads an image / chart / heavy island checks `me.dataSaverMode` and downgrades. The check is server-side first (no client-side script needed); the `prefers-reduced-data` browser hint is wired via the existing layout's `<html data-prefers-reduced-data>` attribute.

- [ ] Migration: new column.
- [ ] New `<DataSaverPreference>` component on `/dashboard/account`.
- [ ] Helper `lib/preferences/data-saver.ts` that exposes a server-side `shouldServeLight()` reading user pref + browser hint.
- [ ] Conditional rendering in: `<Avatar>`, `<ProvinceChart>`, `<MyLearningSection>` (chart sub-cards), `<ActivityFeed>`.
- [ ] One help article: `content/help/seeker/account/data-saver-mode.md`.

---

### Task 11.4.4: SMS + WhatsApp notification channel (gated rollout)

**Scope.** Two new notification channels: SMS (via Twilio or AWS SNS  operator choice) and WhatsApp Business (via Twilio or Meta WhatsApp Business API directly). Opt-in only; gated rollout (operator-configurable seeker allowlist before public availability). Limited to two critical notification kinds at launch: `vacancy.invite.received` and `contact.reveal.requested`.

**Why now.** SMS / WhatsApp reach seekers who don't reliably get email (no smartphone email setup, hostile mobile data plan, spam-filter eaten the email). For critical invites with response windows, that reach matters.

**Why gated.** SMS costs ~R0.30 per message in SA. WhatsApp Business is template-restricted + costs ~R0.10 per "conversation" (1-day window). At scale this becomes material. Phase 11.4 ships the channel infrastructure + a small allowlist; full public rollout is a Phase 12 decision once we have real usage data + budget signal.

**Data shape.**

```sql
ALTER TABLE app_user
  ADD COLUMN phone_e164 text,
  ADD COLUMN phone_verified_at timestamp,
  ADD COLUMN sms_channel_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN whatsapp_channel_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE seeker_sms_allowlist (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  enabled_at  timestamp NOT NULL DEFAULT now(),
  enabled_by  text REFERENCES app_user(id), -- admin who flipped the flag
  UNIQUE(user_id)
);
```

**Verification flow.** Seeker enters E.164 phone number on `/dashboard/account` → 6-digit code sent via SMS → seeker enters code → phone_verified_at sets. Same flow used for SMS + WhatsApp.

**Notification dispatch.** The existing `notify()` server action gains channel-routing logic:

```ts
async function notify({ kind, userId, ... }) {
  const prefs = await loadPrefs(userId, kind);
  if (prefs.inApp) await writeInAppRow(...);
  if (prefs.email) await sendEmail(...);
  if (prefs.sms && userInAllowlist(userId) && phoneVerified(userId)) {
    await sendSms(...);
  }
  if (prefs.whatsapp && userInAllowlist(userId) && phoneVerified(userId)) {
    await sendWhatsApp(...);
  }
}
```

**Provider abstraction.** New file `lib/messaging/sms.ts` with a single `sendSms({ to, body })` interface. Backed by Twilio in the initial implementation; AWS SNS adapter pluggable. Same shape as `lib/email/send.ts`.

**Audit posture.** Every SMS / WhatsApp send writes one `notification.sms.sent` / `notification.whatsapp.sent` row. Failures write `.failed` rows with the provider error code.

**POPIA touch.** Phone numbers are new PII. Encrypted at rest via the existing `lib/crypto/` AES-256-GCM helper. Phone_verified_at is the gate before any send. New consent purpose `messaging_channel_sms` + `messaging_channel_whatsapp`  optional, default off, the seeker explicitly grants on `/dashboard/account`.

**Anti-pattern guards.**
- **Never SMS without verified phone.** The verified_at check is in the dispatch layer; bypassing it requires a code change + a DPIA-flagged audit row.
- **Never SMS for non-critical events.** Only the two critical kinds at launch. Adding kinds to the SMS-allowed list is a code change, not a config change.
- **Stop-on-STOP.** Twilio + AWS SNS both honour STOP messages globally. Sebenza records the opt-out in `app_user.sms_channel_enabled = false` automatically via the provider webhook.
- **Quiet hours.** No SMS between 21:00 SAST and 07:00 SAST. Configurable via `feature_flag_sms_quiet_hours_start` + `_end`.

**Cost-control surfaces.** Admin dashboard gains a "Messaging spend this month" panel reading from the provider's billing API. Soft budget threshold ⇒ alert; hard threshold ⇒ disable the channel until manual reset.

- [ ] Migrations: columns on `app_user`, new `seeker_sms_allowlist` table.
- [ ] New `lib/messaging/sms.ts` + `lib/messaging/whatsapp.ts` (provider adapters).
- [ ] New phone-verification flow on `/dashboard/account`.
- [ ] Update `notify()` to route per-channel.
- [ ] Two new notification kinds enabled for SMS + WhatsApp at launch: `vacancy.invite.received`, `contact.reveal.requested`.
- [ ] Webhook endpoint for provider STOP messages.
- [ ] Admin "Messaging spend" panel on `/admin/settings`.
- [ ] Two help articles: SMS opt-in, WhatsApp opt-in.
- [ ] DPIA rows + Retention Policy lines.

---

### Task 11.4.5: Recommended employers by profession

**Scope.** A new card on `/dashboard/grow` (or a sibling page) surfacing the top employers hiring in the seeker's profession + province. Ranked by **confirmed-placement count** (not by paid placement). Tap an employer → land on `/p/{org-handle}` with a follow-this-employer CTA front-and-centre.

**Why now.** Discovery surface that doesn't compromise the matcher's privacy posture (no employer-paid ranking) but gives the seeker proactive options instead of waiting for invites.

**Query.**

```ts
// db/queries/employer-leaderboard.ts (new)
export async function topEmployersByProfessionProvince({
  profession,
  province,
  limit = 10,
}): Promise<EmployerLeaderboardRow[]> {
  // Aggregate confirmed `placement.confirmed` audit rows by org_id
  // WHERE profession + province match + placement is current
  // ORDER BY count DESC
  // Suppress orgs below k=10 confirmed placements (consistency with gov suppression posture)
}
```

The k=10 floor mirrors the gov suppression policy  no employer appears on the list until they have ≥ 10 confirmed placements in the profession + province. This prevents the leaderboard from being a marketing surface for low-volume orgs.

**Privacy invariant.** No seeker data leaks into this list. The aggregate is org-level.

- [ ] New query.
- [ ] New `<RecommendedEmployersCard>` component on `/dashboard/grow`.
- [ ] One help article: `content/help/seeker/growth/discovering-employers.md`.

---

## 🚫 OUT OF SCOPE FOR PHASE 11.4 (explicit guardrails)

- ❌ **WhatsApp inbox integration.** Receiving WhatsApp messages from employers via Sebenza is out-of-scope. The WhatsApp channel is outbound-notification-only.
- ❌ **Public follower counts on org pages.** The follow is private; employers see no count, no list.
- ❌ **Paid sponsored placement on `/search` or the recommended-employers card.** Sebenza has no advertising tier. The recommended-employer ranking is data-driven (confirmed placements) only.
- ❌ **Auto-share-on-completion.** Completing a learning item does not auto-post to social. The share is always manual.
- ❌ **SMS for non-critical events.** Only the two kinds documented. Adding kinds is a deliberate phase activity, not a config tweak.
- ❌ **Public OpenGraph image on `/p/{handle}` itself.** `/p/{handle}/card` is a separate route the seeker explicitly shares. The main public profile page does not bake the image into its `<meta og:image>` (privacy invariant  the seeker chooses when to share).

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Share-card image is generated server-side, cached 7 days. | Bundle weight stays zero on the seeker's dashboard. Cache is long enough to absorb a viral spike without re-rendering. |
| D2 | SMS / WhatsApp are new consent purposes. | The data flows (phone number, message content sent to a third party) are material enough to warrant a discrete opt-in. The existing `service_communications` consent is not granular enough. |
| D3 | Follow list is private. | Matches block-list privacy invariant from Phase 11.3. Consistency in the seeker control posture. |
| D4 | Recommended employers k=10 floor. | Matches gov suppression posture. Prevents marketing-via-leaderboard for small orgs. |
| D5 | Phase 11.4 ships SMS + WhatsApp with an allowlist gate, not full availability. | Cost-control + observability. Public rollout follows a Phase 12 decision once the budget signal is real. |
| D6 | Quiet hours hard-coded SAST timezone (not localised). | SA-first product. Adding configurable timezones is a Phase 12+ decision when international scope clarifies. |
| D7 | Phone numbers are encrypted at rest with the existing AES-256-GCM key. | No new crypto surface. Reuses the Phase 0 key infrastructure. |

---

## 🧪 HOW TO VERIFY

1. As a seeker, open `/dashboard/profile` → "Share my profile". Confirm modal renders with three options. Tap WhatsApp → confirm URL opens `wa.me/?text=...` with the share-card link.
2. Open `/p/{handle}/card` directly in a browser; confirm a PNG renders with the seeker's name, profession, top three skills, verification badges.
3. On `/search`, follow an employer. Confirm row in `seeker_followed_employers`. Open `/dashboard/following`; confirm the org appears.
4. As an admin, publish a new vacancy from the followed employer matching the seeker's profession + province. Run the followed-employer cron. Confirm the seeker gets a `employer.opened_vacancy.in_your_pool` notification.
5. Toggle data-saver mode on `/dashboard/account`. Open `/dashboard`; confirm avatars are replaced with initials + chart sections show the "Tap to load" placeholder.
6. As a seeker, opt in to SMS, verify phone via 6-digit code. As an employer, send an invitation. Confirm an SMS send fires (mock-back via Twilio sandbox in dev). Confirm audit row `notification.sms.sent` writes.
7. Send a STOP via the SMS provider sandbox. Confirm `sms_channel_enabled` flips to false; subsequent invites do not SMS.
8. Open `/dashboard/grow`. Confirm the recommended employers card lists the top orgs by confirmed-placement count. Click one → land on `/p/{org-handle}`.

---

*Plan opened with Phase 11. Target: ship the share-card + follow-employer (11.4.1 + 11.4.2) within 5 working days; SMS / WhatsApp (11.4.4) gated rollout follows within 10 working days; data-saver + recommended-employers in parallel.*
