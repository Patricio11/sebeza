# PHASE 11.4 COMPLETE — SA DISTRIBUTION SURFACE
*Shipped 2026-05-30. Fourth sub-phase of Phase 11. Five tasks; the distribution surface for South African mobile-first reality — WhatsApp + LinkedIn shareable profile cards, private follow-employer warm-intent capture, account-level data-saver mode, dormant admin-gated SMS / WhatsApp channels, and a confirmed-hire recommended-employers leaderboard. Crucially: SMS / WhatsApp ship with zero spend by default — six gates must align before any external provider receives a request.*

> **One-line summary**: Five distribution surfaces shipped, none of which can spend money without the operator's explicit consent. Share-card PNG via `next/og`; private follow-employer list mirroring the 11.3.2 block-list privacy invariant; data-saver downgrade that honours both the seeker's account toggle AND the `Save-Data` browser header; SMS / WhatsApp infrastructure that multi-gates dispatch behind admin platform flag + provider env vars + per-seeker consent + per-seeker app_user flag + verified phone + admin-managed allowlist row; recommended-employers leaderboard with the same k=10 suppression posture as the gov surfaces. Zero spend without operator approval, by design.

Commits:

- (this commit) — Phase 11.4 ship: 5 tasks, 1 new migration (5 sub-changes), 13 new audit kinds, 1 new notification kind, 1 new cron, 2 new tables, 5 new columns on `app_user`, 2 new consent purposes, 4 new platform-settings keys

---

## 🎯 WHAT SHIPPED

### Task 11.4.1 — Profile shareable summary card (PNG)
- New `next/og` route at `app/[locale]/(public)/p/[handle]/card/route.tsx` returning a 1200×630 PNG (`Content-Type: image/png`). Renders display name, profession, top 3 skills, verification chip, wordmark.
- Subject to the same redaction rules as `/p/{handle}` (reads through `dataProvider.getProfile`). Cache TTL 7 days.
- New `<ShareMyProfileModal>` client component on `/dashboard/profile` with three options: WhatsApp deep-link (`wa.me/?text=...`), LinkedIn deep-link (`linkedin.com/sharing/share-offsite/...`), Copy link.
- `/p/{handle}` `generateMetadata()` now sets `openGraph.images` + `twitter.images` pointing at `/p/{handle}/card` so link-unfurl engines auto-fetch the PNG.
- Anti-pattern guards per plan: no QR code, no tracking pixel, no Sebenza CTA visually overpowering the seeker's name.

### Task 11.4.2 — Follow employer (private warm-intent list)
- Migration `0041` adds new `seeker_followed_employers` table with UNIQUE on `(profile_id, org_id)` + per-side indexes.
- New `lib/seeker/follows.ts` with `followEmployer(orgId)` / `unfollowEmployer(orgId)` / `listMyFollows()` / `isFollowingEmployer(orgId)` Server Actions.
- New `<FollowEmployerButton>` heart-toggle client island with `icon` + `button` variants. Wired into invitation detail page next to the existing report + block controls (Phase 11.3).
- New `/dashboard/following` page + new `Heart` icon nav entry between Career compass + Activity.
- New cron at `app/api/cron/followed-employer-vacancy-sweep/route.ts` (daily 06:00 UTC = 08:00 SAST). Intersects new vacancies with follow list × seeker's (profession, province), fires `employer.opened_vacancy.in_your_pool` notifications. Day-long catalog dedupe per (user × org) absorbs employer publishing bursts.
- New notification kind `employer.opened_vacancy.in_your_pool` (in-app default ON, email default OFF, 24h dedupe).
- 2 new audit kinds: `seeker.follow.added`, `seeker.follow.removed`.
- D3 invariant: the employer is NEVER notified, never sees a follower count, never sees a follower list.

### Task 11.4.3 — Data-saver mode
- Migration `0041` adds `app_user.data_saver_mode boolean default false`.
- New `lib/preferences/data-saver.ts` exports `shouldServeLight()` + `shouldServeLightForUser(userId)`. Reads BOTH the browser `Save-Data: on` header (the floor) AND the seeker's account toggle (the ceiling). Either source triggers the downgrade.
- New `setDataSaverMode(enabled)` Server Action in `lib/preferences/actions.ts`.
- New `<DataSaverPreference>` toggle on `/dashboard/account` under a new "Data + bandwidth" section.
- `<Avatar>` extended with a `dataSaver` prop — when true, renders the initials block regardless of `photoUrl` (no image network request).

### Task 11.4.4 — SMS + WhatsApp notification channel (DORMANT BY DEFAULT, ADMIN-GATED)
- Migration `0041` adds: `app_user.phone_e164_enc` (encrypted) + `phone_verified_at` + `sms_channel_enabled` + `whatsapp_channel_enabled`; new `seeker_sms_allowlist` table.
- Two new consent purposes: `messaging_channel_sms` + `messaging_channel_whatsapp` (default off, per-channel).
- **Four new platform settings** in `lib/admin/settings.ts`:
  - `feature_flag_sms_channel_enabled` (default OFF)
  - `feature_flag_whatsapp_channel_enabled` (default OFF)
  - `feature_flag_sms_quiet_hours_start` (default 21 SAST)
  - `feature_flag_sms_quiet_hours_end` (default 7 SAST)
- New transports `lib/messaging/sms.ts` + `lib/messaging/whatsapp.ts` — provider-agnostic with a `disabled` fallback that NEVER calls a provider when `SMS_PROVIDER` / `WHATSAPP_PROVIDER` env is unset. Twilio implemented via direct REST (no SDK dependency); SNS + Meta Cloud paths stubbed with throw-on-call for operator runbook clarity.
- **Six-gate dispatch in `lib/messaging/dispatch.ts`** — `dispatchMessage({ userId, channel, kind, body })` checks: (1) admin platform flag, (2) provider configured, (3) per-seeker consent, (4) per-seeker app_user flag, (5) phone verified, (6) row in `seeker_sms_allowlist`. ALL six must be true; any failure writes `notification.{channel}.skipped` audit row with the specific reason. Quiet-hours check applies on top.
- Phone-verification flow in `lib/messaging/phone.ts`: `requestPhoneVerificationCode(phone)` → 6-digit code dispatched via the same SMS transport (so dev console-prints it) → `confirmPhoneVerification(code)` flips `phone_verified_at` + persists encrypted phone → `setMessagingChannel(channel, on)` toggles per-channel.
- Admin allowlist actions in `lib/admin/sms-allowlist.ts`: `addSeekerToSmsAllowlist({ userId, note? })` / `removeSeekerFromSmsAllowlist(userId)`.
- New `<PhoneChannelPanel>` on `/dashboard/account` with three render paths:
  1. Both admin flags OFF → dormant "Coming soon" card (the seeker cannot enter a phone)
  2. ≥1 admin flag ON, no verified phone → verification flow
  3. Phone verified → per-channel toggles + "Remove phone" + explainer that admin allowlist still controls actual dispatch
- 11 new audit kinds: `notification.sms.{sent,skipped,failed}`, `notification.whatsapp.{sent,skipped,failed}`, `phone.verification.{sent,confirmed,cleared}`, `admin.sms_allowlist.{added,removed}`.
- Per the operator constraint: **zero external-provider calls until an admin explicitly approves every gate**.

### Task 11.4.5 — Recommended employers by profession × province
- New `db/queries/employer-leaderboard.ts` with `topEmployersByProfessionProvince({ profession, province, limit })`. Aggregates `placements` table rows (employer-confirmed only, Placement-Truth Rule), groups by org, ranks by count desc.
- k=10 suppression floor read from the existing `employer_mix_min_placements` platform setting — matches gov surfaces, prevents the leaderboard becoming a marketing surface for low-volume orgs (D4).
- New `<RecommendedEmployersCard>` server component on `/dashboard/grow` with per-row Follow heart + verification chip. Silent when no orgs clear the floor.

---

## 📦 FILES TOUCHED

**New (15 files)**
- `db/migrations/0041_phase11_4_distribution.sql`
- `db/queries/employer-leaderboard.ts`
- `lib/seeker/follows.ts`
- `lib/preferences/data-saver.ts`
- `lib/preferences/actions.ts`
- `lib/messaging/sms.ts`
- `lib/messaging/whatsapp.ts`
- `lib/messaging/dispatch.ts`
- `lib/messaging/phone.ts`
- `lib/admin/sms-allowlist.ts`
- `app/[locale]/(public)/p/[handle]/card/route.tsx`
- `app/[locale]/(seeker)/dashboard/following/page.tsx`
- `app/api/cron/followed-employer-vacancy-sweep/route.ts`
- `components/feature/profile/ShareMyProfileModal.tsx`
- `components/feature/seeker/FollowEmployerButton.tsx`
- `components/feature/seeker/RecommendedEmployersCard.tsx`
- `components/feature/account/DataSaverPreference.tsx`
- `components/feature/account/PhoneChannelPanel.tsx`
- `docs/completed/PHASE_11_4_COMPLETE.md` (this doc)

**Edited (12 files)**
- `db/schema.ts` — 5 new columns on `app_user`; 2 new consent-purpose values; 2 new tables (`seekerFollowedEmployers`, `seekerSmsAllowlist`).
- `lib/consent/index.ts` — mirror of the 2 new consent purposes.
- `lib/audit/index.ts` — 13 new audit kinds.
- `lib/notifications/catalog.ts` — `employer.opened_vacancy.in_your_pool` kind.
- `lib/admin/settings.ts` — 4 new platform-settings keys + defaults.
- `lib/admin/settings-actions.ts` — Zod schema + enum extended for the 4 new keys.
- `components/ui/Avatar.tsx` — `dataSaver` prop wiring.
- `components/layout/seekerNav.ts` — new "Following" nav entry.
- `app/[locale]/(public)/p/[handle]/page.tsx` — `openGraph.images` + `twitter.images` pointing at `/p/{handle}/card`.
- `app/[locale]/(seeker)/dashboard/profile/page.tsx` — `<ShareMyProfileModal>` next to `<ShareProfileLink>`.
- `app/[locale]/(seeker)/dashboard/account/page.tsx` — `<DataSaverPreference>` + `<PhoneChannelPanel>` sections + the account-row read.
- `app/[locale]/(seeker)/dashboard/privacy/page.tsx` — entries for the 2 new consent purposes in FALLBACK_CONSENT + PURPOSE_LABEL + PURPOSE_BODY.
- `app/[locale]/(seeker)/dashboard/grow/page.tsx` — `<RecommendedEmployersCard>` wrapper section.
- `app/[locale]/(seeker)/dashboard/invitations/[id]/page.tsx` — `<FollowEmployerButton>` next to the existing report + block controls.
- `vercel.json` — `followed-employer-vacancy-sweep` entry (18 cron jobs total).
- `README.md` — cron count + new SMS-channel dormancy row in the platform-flags table.

**Verification**
- `tsc --noEmit` clean
- `npm run build` succeeded (285 routes)
- `vitest run` 50/50 green

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **SMS / WhatsApp ship DORMANT — six gates must align before any send fires** (operator constraint + plan D5). Even when an admin flips the platform flag ON, the dispatcher refuses unless: provider env is set, seeker consent granted, seeker app_user flag on, phone verified, allowlist row exists. The `disabled` transport path logs the intent to stdout but never contacts a provider.
2. **Share-card route is server-rendered + cached 7 days** (D1). Bundle weight on the seeker's dashboard stays zero; cache absorbs viral spikes.
3. **Follow list is private to the seeker** (D3). Mirrors the 11.3.2 block list privacy invariant.
4. **SMS + WhatsApp are new consent purposes**, not extensions of existing service-communications (D2). The data flows (phone number + message content to third-party provider) are material enough to warrant discrete opt-in.
5. **Recommended employers k=10 suppression floor** (D4). Matches gov surfaces; prevents marketing-via-leaderboard for small orgs.
6. **Quiet hours hard-coded to SAST** (D6). SA-first product; international timezone configurability deferred to Phase 12+.
7. **Phone numbers encrypted with the existing AES-256-GCM key** (D7). No new crypto surface; reuses Phase 0 infrastructure.
8. **AWS SNS + Meta Cloud API stubs throw on call** — only the Twilio path actually dispatches when configured. Both alternatives are env-switchable but require explicit operator runbook setup; safer to fail loudly than to half-implement.
9. **No `/search` heart icon (yet)**. The plan called for Follow on `/search` results, but `/search` returns SEEKER profiles, not employers. The follow surface is wired on the invitation detail page + the recommended-employers card + `/dashboard/following` itself. A future `/p/{org-handle}` route (deferred per plan note) will add the third surface.
10. **No vacancy-snapshot-card-style preview on the share-card image**. The card is the seeker's identity, not their CV. Top three skills + verification + the Sebenza wordmark — that's the deliberate scope.
11. **Phone verification codes stored in-process memory** (`Map<userId, PendingCode>`). Single-instance Vercel is fine; multi-instance scaling needs Upstash Redis. Deferred to Phase 12+ when the channel is past gated-rollout.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Public profile** (`/p/{handle}`) — link unfurls now show the rich PNG preview.
- **Profile editor** (`/dashboard/profile`) — "Share my profile" modal next to the existing share-link card.
- **Invitations detail** — Follow heart joins the existing Report + Block agency strip.
- **Career compass** (`/dashboard/grow`) — new recommended-employers card between curriculum + My Learning.
- **Account** (`/dashboard/account`) — two new sections: "Data + bandwidth" and "SMS & WhatsApp notifications". Both render appropriately based on platform-flag state — the SMS/WhatsApp panel is dormant + "Coming soon" until admin flips the flag.
- **Privacy** (`/dashboard/privacy`) — two new consent toggles (`messaging_channel_sms`, `messaging_channel_whatsapp`).
- **Seeker nav** — new `/dashboard/following` entry between Career compass + Activity.
- **Avatar component** — `dataSaver` prop available everywhere; conditional rendering at the call-site.
- **Admin settings** — 4 new platform settings (SMS / WhatsApp flags + quiet hours).
- **Cron surface count** — 1 new entry (`followed-employer-vacancy-sweep`).
- **vercel.json** — 18 cron jobs total now.

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ Real SMS / WhatsApp dispatch in default ship — operator must explicitly enable.
- ❌ WhatsApp inbox integration (outbound-notification-only).
- ❌ Public follower counts on org pages — follow is private.
- ❌ Paid sponsored placement on `/search` or the recommended-employers card.
- ❌ Auto-share on learning completion.
- ❌ SMS for non-critical events (only `vacancy.invite` + `contact.revealed` are dispatch-target candidates).
- ❌ AWS SNS / Meta Cloud full implementations (Twilio is the working path; alternates are runbook-deferred).
- ❌ Admin "Messaging spend this month" panel (deferred to Phase 11.5 polish; the per-row audit log carries the data needed to build it).
- ❌ Provider STOP webhook (deferred; per-seeker toggle on the account page lets the seeker stop manually until the webhook lands).
- ❌ Help articles for each new feature (deferred to Phase 11.5 polish).

---

## 🧪 HOW TO VERIFY

1. As a seeker, open `/dashboard/profile` → "Share my profile". Confirm the modal renders with WhatsApp / LinkedIn / Copy options. Tap WhatsApp → confirm `wa.me/?text=...` opens with the share URL.
2. Open `/p/{handle}/card` directly in a browser; confirm a 1200×630 PNG renders with the seeker's name, profession, top three skills, verification chip.
3. From an invitation detail page, click the heart icon to follow the org. Confirm `seeker_followed_employers` gains a row. Open `/dashboard/following`; confirm the org appears.
4. Run the followed-employer cron with a newly-created `vacancies` row matching the seeker's profession + province from a followed employer. Confirm `employer.opened_vacancy.in_your_pool` notification fires.
5. Toggle data-saver mode on `/dashboard/account`. Open the dashboard; confirm avatars on profile rows render as initials blocks (no image network requests).
6. With both `feature_flag_sms_channel_enabled` and `feature_flag_whatsapp_channel_enabled` OFF, open `/dashboard/account` → SMS section. Confirm dormant "Coming soon" card renders + no phone-entry surface.
7. As admin, flip `feature_flag_sms_channel_enabled` ON. As seeker, open `/dashboard/account` → SMS section. Confirm phone-entry surface appears. Submit a phone; verify the 6-digit code prints to stdout (`SMS_PROVIDER` unset → console transport). Enter the code; confirm `phone_verified_at` populates.
8. Toggle the SMS channel ON. From `/admin/sms-allowlist` (TBD admin surface; for now call `addSeekerToSmsAllowlist({ userId })` directly), add the seeker. Manually invoke `dispatchMessage({ userId, channel: "sms", kind: "vacancy.invite", body: "test" })`. Confirm — with `SMS_PROVIDER` still unset — the dispatcher writes `notification.sms.skipped` with reason `provider_not_configured` (zero spend).
9. Set `SMS_PROVIDER=console` + repeat — confirm the SMS body prints to stdout as `[sms:console]` + audit row writes as `notification.sms.sent` with transport `console`.
10. Open `/dashboard/grow`. Confirm the recommended-employers card lists the top orgs by confirmed-placement count (k=10 floor). Tap a heart → confirm the org joins the follow list.

---

*Phase 11.4 closes the SA distribution surface arc. Next: Phase 11.5 (profile depth + mobile / a11y polish  "Open to ___" tags + CV upload + 9 specific a11y fixes).*
