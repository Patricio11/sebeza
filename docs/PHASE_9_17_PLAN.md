# PHASE 9.17 PLAN — Employer-initiated seeker invites

*Plan opened 2026-05-27. Companion: `docs/PHASE_9_16_PLAN.md`. Targets sign-off before any code lands.*

---

## 🎯 WHAT THIS PHASE IS

Today an employer (or staffing agent) who wants to bring a known candidate onto Sebenza has no path inside the platform — they have to ask the seeker to "go sign up at sebenza.co.za" via WhatsApp or email. That's a real workflow gap for SA staffing agencies, who maintain rosters of candidates and bring them to platforms in batches.

**Phase 9.17 adds:** a single-invite-at-a-time path. A verified-org employer enters an email (and optionally a name + profession + personal note), Sebenza sends a Civic-Editorial-styled invitation email, the recipient clicks a signed link and lands on a tailored sign-up page that pre-fills the name + email and collects only the remaining captures (DOB, nationality, phone, password). The employer can see their pending / joined / declined invites on a new dashboard tab; they get **no** special PII access on the joined seekers (the platform's neutrality posture is intact).

The invitation is **purely an onboarding nudge** — it doesn't tie to a vacancy. Once the seeker is on the platform, the existing Phase 9.8 vacancy-invitation flow handles role-specific outreach.

---

## 🔒 LOCKED DECISIONS

### D1 — Gate: verified orgs only

Calls go through `verifyOrgVerified()` — the same gate that already protects contact-reveal and document-download. Unverified employers (still in KYC review or draft state) cannot send seeker invites at all. Removes an entire class of abuse: bad-actor signup → bulk email-harvest → walk away.

**Why this matters:** the invitation email leaves the platform's domain carrying the org's name. Verifying the org first is the only honest way to ensure the seeker can trust "Acme Corp invited you."

### D2 — Single invite at a time (no CSV bulk in v1)

One email per submission. CSV upload follows in a v1.1 once we observe real agent usage. Reduces v1 surface (no per-row validation, no partial-success UX, no preview state machine). Rate limit (D7) caps the practical volume per day either way.

### D3 — Pure onboarding nudge — no vacancy link

The invitation does not optionally tie to a vacancy. Cleaner mental model: the agent is saying "join Sebenza, I've vouched for you"; once the seeker is on the platform, the agent uses the existing Phase 9.8 `bulkInviteToVacancy` flow to extend a role-specific invite (which already supports any consented seeker — invited-via-9.17 or self-signed-up — uniformly). Decoupling lets the two lifecycles evolve independently.

### D4 — Transparent dedupe + actionable redirect when email already has a Sebenza account

If the entered email matches an existing `app_user` row, the Server Action returns `{ ok: false, message: "This email already has a Sebenza account. Search for them by name on Talent search to invite them to a vacancy." }`. **No `seeker_invitations` row is created. No email is sent.** The audit row still fires (`org.seeker_invite.send` with `meta.dedupe = "existing_user"`) so admins can see the attempt + the failed attempt still counts against the D7.1 daily rate limit.

**Trade-off acknowledged:** this does reveal account existence to the inviter, which is a discovery oracle a malicious employer could brute-force. The D7.1 rate limit (50 attempts/day per org, **including** dedupe-hits) is the structural defence — an enumeration attack at 50 emails/day takes weeks to map any meaningful slice of the platform, by which time the admin oversight queue would have flagged the org for the failure pattern.

**Why we chose transparency over the oracle defence:** the alternative ("invitation sent" returned silently) leaves the inviter with no signal when the seeker doesn't engage — they assume the email was lost or the platform is broken, and re-send it, and re-send it. The honest "this person is already on Sebenza, search for them" path is better UX for the legitimate agent use case (which is 99% of usage) without giving up real defensive ground.

### D5 — Optional name + profession pre-fill

The invite form accepts:

- **Email (required, validated)**
- **Full name (optional)** — pre-fills the sign-up form's name field
- **Profession (optional)** — `<ComboboxField>` over the existing PROFESSIONS taxonomy; pre-fills the sign-up form's Step 3 profession field
- **Personal note (optional, ≤200 chars)** — rendered in the email body verbatim

Pre-fills are **editable** on the landing page — the seeker has full control of what they actually submit. The landing page reuses `<SeekerSignUpForm>` so profession lands on Step 3 alongside province + status, exactly where the public sign-up already asks for it; the only difference is the pre-filled starting value.

### D6 — Personal note is PII-flagged in the audit log

The 200-char note is free text written by the inviter and quoted in the recipient's inbox. POPIA personal-information territory the moment it carries anything about the recipient. The audit row's `meta.note` field is `pii: true` so any future data-export sweep treats it correctly.

### D7 — Abuse controls

Three layers:

1. **Rate limit:** 50 invite **attempts** per org per calendar day, counting **all** outcomes — successful sends, D4 dedupe-hits, D7.2 cooldown blocks, and validation failures. Counting failed attempts is what makes D4's transparent-dedupe defendable: an enumeration attacker has the same per-day ceiling whether they hit valid emails or not. Counter is per `(org_id, calendar_day)`.
2. **Per-email cooldown:** an email that has *declined* an invite from this org cannot be re-invited for 90 days. Tracked by `(org_id, lower(email), declined_at)` lookup on every send.
3. **Platform cap:** soft 500 invites/day platform-wide for the first 30 days post-ship, raised after observation. Returns a clean "try again tomorrow" error.

All three are server-side enforced + audit-logged on every block.

### D8 — Token = signed + single-use + 14-day expiry, opaque payload

Token is a signed JWT-style payload (`{ inviteId, exp }`) using HMAC-SHA256 over `SEBENZA_INVITE_SIGNING_SECRET` (new env var). The `inviteId` is a `seeker_invitations.id`; the row itself carries the email, name, profession, note, org_id. The token is **opaque** — never carries the email in the URL.

Single-use: once the seeker completes sign-up, the row flips to `accepted` and the token is rejected on any subsequent attempt. Expiry: 14 days from creation, swept nightly by `/api/cron/seeker-invite-expiry`.

### D9 — "Manage" view shows three states, no special PII access on joined seekers

The employer-side `/employer/invites` page has three sections:

- **Pending** — invites that have not yet been accepted/declined/expired. Rows show: email (masked after first 2 chars), name (if given), date sent. Actions: Withdraw, Resend (no-op if accepted/expired).
- **Joined** — seekers who completed sign-up via this invite. Rows show: handle (linked to public profile, same redaction every other employer sees), display name, joined date. **No** access to DOB, phone, or any field the platform doesn't already expose on the public profile. The employer can extend a vacancy invitation from here via the normal Phase 9.8 flow.
- **Declined** — invites the seeker explicitly declined (with optional reason). Rows show: masked email, declined date, reason if given. No re-invite button (90-day cooldown enforced by D7.2).

Critically, the "Joined" section is just a view of the inviter's history. It does **not** grant any access privilege over the seeker — the seeker is a normal Sebenza profile and the org sees exactly what `verifyOrgVerified()` already authorises.

### D10 — Three new audit kinds + one new notification kind

Audit:

- `org.seeker_invite.send` — invite created + email queued. Meta: `{ inviteId, email, name?, profession?, note?, dedupe? }` (note flagged PII).
- `org.seeker_invite.accept` — seeker completed sign-up via the link. Subject = inviteId. Meta: `{ profileId, signupCompletedAt }`.
- `org.seeker_invite.decline` — seeker explicitly clicked "Not interested" on the landing page. Meta: `{ reason? }`.
- `org.seeker_invite.withdraw` — employer cancelled a pending invite.
- `org.seeker_invite.expire` — nightly cron flipped the row.

Notification:

- `org.seeker_invite.accepted` — fires to the inviter when the seeker completes sign-up. Audience: `org_members` (any seat on the inviting org gets it; matches Phase 9.10 broadcast pattern). In-app default-on, email default-off. No dedupe.

### D11 — Email template

Reuses the existing `genericTemplate()` shell + Resend infrastructure (Phase 8). New template id: `org.seeker_invite`. Subject: `"{orgName} has invited you to join Sebenza"`. Body:

- Greeting: `"Hi {name},"` or `"Hello,"` if no name was given
- Body sentence: `"{orgName}, a verified employer on Sebenza, has invited you to set up a profile on South Africa's talent platform."`
- The personal note (if any), in a blockquote
- Primary CTA: `"Set up my profile"` → links to `/sign-up/invited/{token}`
- Decline link below: `"Not interested? Tell us so they don't ask again."` → links to `/sign-up/invited/{token}/decline`
- POPIA §16 footer (D13)

### D12 — Custom landing at `/sign-up/invited/[token]`

Server component that:

1. Verifies the token (HMAC + expiry + row state == "pending").
2. Loads the invite row (org name, pre-filled name + profession + email + note).
3. Renders a customised `<SeekerSignUpForm>` variant:
   - Step 1 collects: DOB + nationality + phone + password. Name + email pre-filled from invite (editable; email is read-only since it's the lookup key).
   - Step 2 (consents) and Step 3 (profession + province + status + academic) identical to the public sign-up. Profession pre-filled from invite if given.
4. On submit, calls a new `acceptSeekerInvitation` server action that wraps the existing `signUpSeeker` + flips the invite row to `accepted` in one transaction.

Invalid/expired tokens render an honest error page: *"This invitation link has expired (or has already been used). Ask {orgName} to send a new one, or sign up directly at /sign-up/seeker."*

### D13 — POPIA §16 transparency footer in every invite email

Every invite email carries a footer with:

- *"Why did I get this?"* — short paragraph: an employer entered your email; if you don't know them, you can decline below.
- *"Report this invite"* link → `/report-invite/{token}` — a minimal form (no auth needed, token-gated) that flags the inviter to admins. Recorded as `org.seeker_invite.reported` (new audit kind in this list — actually let's fold it into D10).

I'll add `org.seeker_invite.reported` to D10's audit list. (Edit applied directly above when this doc lands.)

---

## 📦 TASK LIST

### 9.17.1 — Migration + schema

New table `seeker_invitations`:

```sql
CREATE TYPE "seeker_invitation_state" AS ENUM (
  'pending', 'accepted', 'declined', 'withdrawn', 'expired'
);

CREATE TABLE "seeker_invitations" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id"),
  "invited_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "email" text NOT NULL,
  "name" text,
  "profession" text,
  "personal_note" text,
  "state" "seeker_invitation_state" NOT NULL DEFAULT 'pending',
  "decline_reason" text,
  "accepted_profile_id" text REFERENCES "profiles"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "responded_at" timestamp
);

CREATE INDEX "seeker_invites_org_state_idx"
  ON "seeker_invitations" ("organization_id", "state");
CREATE INDEX "seeker_invites_email_org_idx"
  ON "seeker_invitations" (lower("email"), "organization_id");
CREATE INDEX "seeker_invites_expires_idx"
  ON "seeker_invitations" ("expires_at")
  WHERE "state" = 'pending';
```

Migration `0029_phase9_17_seeker_invitations.sql`. Additive. Includes journal entry.

### 9.17.2 — Token signing helper

New `lib/auth/invite-tokens.ts`:

```ts
export function signInviteToken(inviteId: string, expiresAt: Date): string;
export function verifyInviteToken(token: string): { ok: true; inviteId: string } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };
```

HMAC-SHA256 over `SEBENZA_INVITE_SIGNING_SECRET` (new env var, documented in `.env.example`). Payload is `{ id, exp }` base64url-encoded. Same shape as the Phase 8 password-reset tokens — keep the patterns aligned.

### 9.17.3 — Server actions

In `lib/employer/seeker-invitations.ts`:

- `inviteSeeker({ email, name?, profession?, personalNote? })` — `verifyOrgVerified()` gate + zod schema + rate-limit checks (D7) + silent-dedupe check (D4) + insert row + send email + audit. Returns `{ ok: true }` either way (no info leak).
- `withdrawSeekerInvitation({ inviteId })` — verifies caller's org owns the invite + row state == `pending` + flips to `withdrawn` + audit.
- `resendSeekerInvitation({ inviteId })` — verifies + rate-limit check + re-sends email + audit (`org.seeker_invite.send` with `meta.resend: true`).
- `listOrgInvitations()` — returns `{ pending, joined, declined }` arrays for the employer dashboard.
- `reportSeekerInvitation({ token, reason? })` — token-gated (no auth), creates an admin notification + audit. The seeker doesn't need an account to report.

In `lib/auth/actions.ts` (extends existing):

- `acceptSeekerInvitation({ token, ...signUpSeekerFields })` — verifies token + delegates to `signUpSeeker` + on success flips the invite row to `accepted` and stamps `accepted_profile_id`. Wrapped in a transaction so a partial sign-up doesn't orphan the invite.
- `declineSeekerInvitation({ token, reason? })` — verifies token + flips row to `declined` + sets `decline_reason` + audit. Public path (no auth needed since the token IS the proof of identity).

### 9.17.4 — Email template

Add `org.seeker_invite` to the existing Resend template catalogue. Uses `genericTemplate()`. Phase 8 wiring already gates this behind `feature_flag_email_notifications`, so emails are dormant until the platform-level flag is flipped on — same posture as every other transactional email.

### 9.17.5 — Custom landing page

New route: `app/[locale]/(public)/sign-up/invited/[token]/page.tsx` + `decline/page.tsx` sibling.

- Token verification on the server before any UI renders. Invalid → error page (D12).
- Renders `<SeekerSignUpForm>` with a new `invitationContext?: { orgName, prefilledName?, prefilledProfession?, prefilledEmail }` prop that:
  - Pre-fills the relevant fields
  - Makes the email field read-only
  - Shows a "You've been invited by {orgName}" eyebrow above the form
  - Hides the standard sidebar "How sign-up works" copy and replaces it with invitation-specific copy

### 9.17.6 — Employer dashboard tab

New route: `app/[locale]/(employer)/employer/invites/page.tsx`. Three sections (D9), each rendering a list of cards with the actions described. New nav entry in `EMPLOYER_NAV` between "Vacancies" and "Dossier".

### 9.17.7 — Single-invite form

Client component `<InviteSeekerForm>` rendered at the top of `/employer/invites` (above the lists):

- Email (required)
- Full name (optional)
- Profession (`<ComboboxField>` over PROFESSIONS, optional)
- Personal note (textarea, 200 chars, optional)
- Submit button → `inviteSeeker` action

Success: clears the form + appends an optimistic row to the "Pending" list. Error (rate-limit, validation): inline message.

### 9.17.8 — Report-invite landing

`app/[locale]/(public)/report-invite/[token]/page.tsx`. Token-gated (no auth required). Minimal form:

- Pre-filled context: "An employer at {orgName} invited {email} to join Sebenza."
- Optional reason (textarea, 200 chars)
- "Report" button → `reportSeekerInvitation` action
- Success: thank-you page. The invite row stays in its current state (we don't auto-withdraw — admin reviews).

### 9.17.9 — Cron sweep

`app/api/cron/seeker-invite-expiry/route.ts`. Same pattern as `/api/cron/vacancy-invite-expiry` (Phase 9.8). `CRON_SECRET`-guarded. Flips `pending` rows past `expires_at` to `expired` + audits each one. Idempotent.

### 9.17.10 — Audit + notification catalog updates

Add the 6 audit kinds + 1 notification kind from D10 to:

- `lib/audit/index.ts` (`AuditKind` union)
- `lib/notifications/catalog.ts` (`NOTIFICATION_CATALOG` map)

### 9.17.11 — Compliance assertions

Add to `lib/analytics/outcomes-compliance.ts`:

- `seeker-invite-verified-org-only` — every `seeker_invitations` row's `organization_id` corresponds to an org with `verification = 'verified'` at the time of `created_at`. (Approximate: we can't time-travel, so check current state — if an org was un-verified after sending invites, the assertion stays clean.)
- `seeker-invite-cooldown-honoured` — for every `(org_id, lower(email))` pair, there's at most one row in the last 90 days where the row would violate the cooldown (i.e. a new invite created within 90 days of a prior `declined`).
- `seeker-invite-no-orphan-when-user-exists` — no `seeker_invitations` row exists where `lower(email)` matches an `app_user.email` created *before* the invite's `created_at`. Verifies D4 dedupe is enforced at create-time (the action refuses to insert when the account already exists). Different posture from the original "silent leak" version: here we audit-log the *attempt* but never persist a row that would later confuse the lifecycle.

Now **29 assertions** total on `/api/admin/outcomes-compliance`.

### 9.17.12 — Tests

Vitest fixtures for the token signing helper (round-trip, expiry, tamper detection). Same shape as the existing id-validation tests. Brings the suite to ~50 tests.

### 9.17.13 — Seed

Add 3 demo invitations on the existing Discovery Bank org:

- One `pending` (just sent, unopened)
- One `accepted` (linked to one of the existing seed seekers, with `accepted_profile_id` set + invite-created-at backdated 7 days before that seeker's sign-up)
- One `declined` (with a reason like "Not looking right now, thanks!")

So the `/employer/invites` page renders real content immediately after seed.

### 9.17.14 — DPIA + Privacy + PAIA + ROADMAP + TO_START

- **DPIA**: new section R11 covering: lawful basis (org asserts it has consent to share the email), the silent-dedupe oracle defence (D4), the cooldown + rate-limit posture (D7), the PII flag on the personal note (D6), the report-this-invite path (D13).
- **Privacy Policy Section 4 (Sub-processors) / Section 3 (Consent)** — note that an org can invite a recipient + that we respect decline + report flows.
- **PAIA Section 4 (Records held)** — add `seeker_invitations` to the profile-records list.
- **ROADMAP.md** — new Phase 9.17 entry.
- **TO_START_EVERY_SESSION.md** — new Phase 9.17 bullet.

---

## 🚫 OUT OF SCOPE FOR THIS PHASE

- ❌ **CSV bulk upload** — v1.1 once we see real volume + abuse patterns.
- ❌ **Vacancy coupling** — separate lifecycle (D3). Employer uses Phase 9.8 vacancy invitations after the seeker joins.
- ❌ **Special PII access on joined seekers** — the inviter sees what every verified employer sees, no more (D9).
- ❌ **SMS invitations** — email only in v1. SMS adds carrier + cost + DPA complexity that's not justified for v1.
- ❌ **Inviting other employers / admins** — seeker invites only. Inviting employer-side users is a different lifecycle (Phase 9.10 "Add team member" flow already exists for that).
- ❌ **Invitation tracking analytics (open rates, click rates)** — adds a tracking pixel + cookie territory that conflicts with the Cookie Consent + POPIA-First Rule. The "accepted / declined / expired" counts on the manage page are enough signal.

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

Three reasons:

1. **The agent workflow gap is real.** SA staffing agencies maintain WhatsApp + Excel rosters today. The platform needs a path inside-the-system for them, or they keep working outside the system and we lose the audit trail + the analytics signal.

2. **The infrastructure is already there.** Phase 9.10's verified-org gate + Phase 8's Resend templates + Phase 9.8's invitation lifecycle pattern + the existing `signUpSeeker` action. This phase is mostly composition + a new table; no new infrastructure category.

3. **The POPIA framing is sharp + defendable.** Verified-org-only + silent-dedupe + cooldown + report-this-invite + PII flag on the note + audit-log everything. We can defend every choice to the Information Officer with a single-sentence justification rooted in POPIA §11, §16, or §19.

---

*Plan opened 2026-05-27. Target: complete before Phase 10 (public launch) opens. Bounded scope (~1 focused session given the existing infrastructure).*
