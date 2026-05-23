# Phase 2  Identity, Auth & Consent · 📋 PLAN (rechecked 2026-05-22)

> Renamed from `PHASE_2_HANDOFF.md`. Active plans live at the top of `docs/`; completion docs move to `docs/completed/` when the phase ships. The Phase 1 / 1.5 audit content lives in `docs/completed/PHASE_1_5_COMPLETE.md`.

**Goal:** Replace the mock-driven auth UI with real Better Auth  real accounts, real sessions, real consent persistence, real role-based guards, full sign-up + sign-in + sign-out + email verification + forgot/reset flows. **2FA enforcement deferred to Phase 7.**

**Rule of the seed (carried forward):** The mock data from `lib/mock/*` is the starting database. The `db/seed.ts` script makes that real. Nothing about Phase 2 invents users  Andile, Thandeka, Lerato, Discovery Bank's Naledi, and the admin all sign in as themselves.

---

## Re-checks (decisions locked 2026-05-22)

### Re-check #1  `/sign-in` does **not** ask the user to pick a role ✅ LOCKED

**Today** the sign-in page has a "Sign in as" chip selector (seeker / employer / admin). That's wrong:

1. The user **is** one role  `app_user.role` says so. Asking them to declare it is theatre.
2. It's a quiet enumeration vector  an attacker can probe which role an email belongs to.
3. Real apps route by role *after* auth, never before.

**Phase 2 sign-in flow** (correct):

```
[email] [password] → submit
  │
  ├─ Better Auth verifies credentials → session candidate
  ├─ if !user.emailVerified → /verify-email (with the same email pre-filled)
  ├─ commit session cookie
  └─ redirect by user.role:
       seeker   → /dashboard
       employer → /employer
       admin    → /admin
```

The role chip stays only on **sign-up**  that's where the user actually declares what they're joining as.

### Re-check #2  every auth surface fully wired ✅ LOCKED

| Surface | Today (Phase 1.5) | Phase 2 work |
|---|---|---|
| `/sign-up` role chooser | static UI ✓ | no change |
| `/sign-up/seeker` (3 steps) | static UI ✓ | 3 Server Actions; create `app_user` + `profiles` + `consents` + (optional) `academic_profiles` atomically; send verification email |
| `/sign-up/employer` | static UI ✓ | Server Action; create `app_user` (role=employer) + `organizations` (unverified) + `organization_members` (role=owner); send verification email |
| `/sign-in` | static UI with role chip ✓ | **Remove role chip.** Server Action calls Better Auth; honour email verification; redirect by role |
| `/sign-out` | not yet | small Server Action + button on every dashboard account page; calls Better Auth signOut; clears session cookie; redirects to `/` |
| `/verify-email` | static UI ✓ | Server Action: consume `?token=` from email link, mark `emailVerified`, optionally auto-sign-in; "Resend email" button → Server Action |
| `/forgot-password` | static form ✓ | Server Action: always respond with "Check your inbox" (anti-enumeration); send reset email if account exists |
| `/reset-password/[token]` | **NEW** | New page: new-password + confirm fields; Server Action verifies token, sets new password, invalidates other sessions, signs the user in |
| `/dashboard/privacy` (revoke) | static UI ✓ | Wire revoke buttons to a Server Action that updates `consents.state = revoked` + writes `audit_log` row |
| `/dashboard/privacy` (export) | static UI ✓ | Server Action that produces JSON dump; emails signed link via the email transport (see Re-check #4) |
| `/dashboard/privacy` (erasure) | static UI ✓ | Server Action: `profiles.deleted_at = now()`; nightly cron does hard delete after 30 days (cron is Phase 8) |

### Re-check #3  2FA enforcement deferred to Phase 7 ✅ LOCKED

The plan briefly proposed shipping 2FA in Phase 2; user decision is to **defer to Phase 7**.

**What this means for Phase 2:**
- We do **not** build `/setup-2fa` or `/verify-2fa`.
- We do **not** enable Better Auth's twoFactor plugin.
- The sign-in flow has no 2FA branch  password is enough.
- The existing employer + admin account pages keep their "Configure 2FA" disabled button as a UI scaffold (the same one shipped in Phase 1.5).

**What this means for Phase 7:**
- A new Task 7.2 in `ROADMAP.md` covers full 2FA rollout: setup + verify + backup codes + forced setup for existing employer/admin users on next sign-in + the twoFactor plugin wire-up.

This is a deliberate tradeoff. Phase 2 ships faster; Phase 7 hardens the integrity layer. Until Phase 7, employer + admin sign-in is password-only  fine for the staging environment we'll run Phase 2 on, **not** acceptable for production with real PII. Pre-production Phase 7 close-out is therefore a launch blocker; pinned in the launch checklist of `ROADMAP.md`.

### Re-check #4  Email transport: Mailtrap (dev) + Resend (prod) via env ✅ LOCKED

Single abstraction: `lib/email/send.ts` picks transport from `EMAIL_TRANSPORT`:

- `EMAIL_TRANSPORT=mailtrap`  dev. SMTP via `nodemailer` to Mailtrap's sandbox inbox (`sandbox.smtp.mailtrap.io`). Emails captured in the Mailtrap web UI; nothing leaves the sandbox.
- `EMAIL_TRANSPORT=resend`  production. Via the `resend` SDK with a verified sender domain.
- `EMAIL_TRANSPORT=console` (or unset)  fallback. Email contents logged to terminal. Useful for first-boot before either provider is configured.

Better Auth's `sendVerificationEmail` / `sendResetPassword` callbacks call `send()` from this module. Same module is used by Phase 2.4 (data-export email link) and every later phase that needs to email a user.

**Env vars** (already updated in `.env.example`):
```env
EMAIL_TRANSPORT=mailtrap        # mailtrap | resend | console
EMAIL_FROM=Sebenza <noreply@sebenza.co.za>

# Mailtrap (dev / staging)
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USER=
MAILTRAP_PASS=

# Resend (prod)
RESEND_API_KEY=
```

### Re-check #5  Better Auth tables coexisting with our schema ✅ LOCKED

Better Auth needs four tables alongside ours: `user` (extends our `app_user`  we map the column), `session`, `account` (stores the password hash), `verification` (email-verify + password-reset tokens).

Strategy: run `npx @better-auth/cli generate` once during Phase 2 kickoff, **review** the emitted schema, merge into `db/schema.ts`, then `npm run db:generate` to produce a single migration. **Decide before running `db:generate`** so we don't end up with two competing migration namespaces.

### Re-check #6  Documentation convention ✅ LOCKED

Established:
- **Active phase:** `docs/PHASE_N_PLAN.md` (planning + recheck)  at the top of `docs/`.
- **Shipped phase:** `docs/completed/PHASE_N_COMPLETE.md` (retrospective + verification + handoff items).
- **Always-on:** `ROADMAP.md`, `TO_START_EVERY_SESSION.md`, `UX_UI_SPEC.md`, `MOBILE_PLAN.md`  all at the top of `docs/`.

Every phase that ships triggers:
1. Write `docs/completed/PHASE_N_COMPLETE.md`
2. Tick the phase header in `ROADMAP.md` ✅
3. Update `TO_START_EVERY_SESSION.md` Current State block
4. Open the next phase's `docs/PHASE_(N+1)_PLAN.md`
5. Commit with `Phase N complete + Phase N+1 opens` in the message

---

## Implementation plan

### 1. Install + scaffold (~30 min)
- `npm i better-auth nodemailer resend`
- `npm i -D @types/nodemailer`
- `npx @better-auth/cli generate` → review the schema diff
- Merge Better Auth tables into `db/schema.ts` (matching our naming + the `app_user.role` column we already have)
- Create `lib/auth/server.ts`  Better Auth instance with Drizzle adapter, email+password, email-verify, password-reset
- Create `lib/email/send.ts`  transport abstraction (mailtrap / resend / console)
- Wire Better Auth's `sendVerificationEmail` / `sendResetPassword` to `lib/email/send.ts`
- Create `app/api/auth/[...all]/route.ts`  Better Auth catch-all handler
- `npm run db:generate && npm run db:migrate && npm run db:seed`

### 2. Wire `lib/auth/guard.ts` to real sessions (~30 min)
- `getSessionUser()` reads the Better Auth session from cookies
- `requireRole(role)` redirects to `/sign-in?next=<current>` on miss
- `requireOrgVerified()` checks `organization_members` + `organizations.verification`
- Add `proxy.ts` rules (alongside next-intl) for the `(seeker)` / `(employer)` / `(admin)` route groups

### 3. Server Actions for sign-up + sign-in + sign-out (~90 min)
- `lib/auth/actions.ts` houses all auth Server Actions: `signUpSeeker`, `signUpEmployer`, `signIn`, `signOut`, `sendVerificationEmail`, `verifyEmail`, `forgotPassword`, `resetPassword`
- Each action: Zod-validate input → call Better Auth → write to our tables in transaction → audit-log → return result
- Wire the existing sign-up forms (`/sign-up/seeker` step 1/2/3, `/sign-up/employer`) to these actions via React 19 form actions
- Wire `/sign-in` (after removing the role chip) to `signIn`
- Add sign-out button to every dashboard account page

### 4. New page (~30 min)
- `/reset-password/[token]`  new-password form, calls `resetPassword`

### 5. Consent + audit persistence (~45 min)
- Wire `/dashboard/privacy` revoke buttons to `revokeConsent` action
- Update `lib/audit.logAccess()` to write to the `audit_log` table (keep ring buffer as a tail)
- Switch `/admin/audit-log` page to read from the DB

### 6. Verification + commit (~30 min)
- Build + smoke-test every auth surface
- Manual test: sign up Andile → verify email (Mailtrap inbox) → sign in → land on `/dashboard`
- Manual test: sign up Discovery Bank → verify → sign in → land on `/employer` (no 2FA challenge yet  Phase 7)
- Manual test: admin sign in → `/admin`
- Move `PHASE_2_PLAN.md` → write `docs/completed/PHASE_2_COMPLETE.md`
- Tick Phase 2 in `ROADMAP.md`; update Current State in `TO_START_EVERY_SESSION.md`
- Open `docs/PHASE_3_PLAN.md` (CV/photo upload + profile CRUD via Server Actions)

---

## Acceptance criteria (Phase 2 is DONE when every box ticks)

- [ ] Andile signs in with `andile-z@example.co.za` + seeded password → lands on `/dashboard`
- [ ] Naledi (Discovery Bank) signs in → lands on `/employer` (no 2FA gate; Phase 7)
- [ ] Admin signs in → lands on `/admin` (no 2FA gate; Phase 7)
- [ ] Unauthed user hitting `/dashboard` redirects to `/sign-in?next=/dashboard`
- [ ] Sign-up writes user + profile + consents + (optional) academic in one transaction; failure rolls back
- [ ] Verification email lands in Mailtrap (dev)  link verifies the user
- [ ] Forgot-password always shows "Check your inbox" (no enumeration); reset link works once then expires
- [ ] Sign-out clears the session cookie and redirects to `/`
- [ ] Revoking `searchability` consent removes the seeker from `/search` results immediately
- [ ] `lib/audit.logAccess()` writes to the `audit_log` table; `/admin/audit-log` reads from the DB
- [ ] `EMAIL_TRANSPORT=console` fallback also works (so the seed-then-smoke loop runs without Mailtrap credentials)
- [ ] `npm run build` clean; every existing route still 200 under `next start`

---

## Out of scope for Phase 2 (don't blur the line)

- **2FA** (`/setup-2fa`, `/verify-2fa`, twoFactor plugin)  Phase 7 Task 7.2
- **Document/CV/photo upload to Supabase Storage**  Phase 3
- **Postgres FTS + ranking SQL**  Phase 4
- **Employer reveal flow**  Phase 5
- **Skills-gap engine**  Phase 6
- **KYC partner integration**  Phase 8
- **Rate limiting + Upstash**  Phase 9 (Better Auth has basic in-memory rate limits which are enough for Phase 2)

---

## Risks to flag at kickoff

- **Better Auth migration vs `db:generate`.** Decide upfront whether Better Auth owns its own migration namespace or we merge its tables into `db/schema.ts`. We're going with the merge (one source of truth).
- **No 2FA gate during Phase 2.** Employer + admin sign-in is password-only. Acceptable for staging; **not acceptable for production**. The launch checklist in `ROADMAP.md` lists Phase 7 close-out as a hard blocker before public launch.
- **Mock handles vs UUIDs.** Mock profiles use slug handles (`thandeka-m`). Real `app_user.id` is a Better Auth UUID. The seed mints stable IDs (`user_thandeka-m`) so dev sessions are debuggable. Document this in `db/seed.ts` (already done).
- **POPIA cross-border posture.** Neon is `eu-central-1`. Document the cross-border note in the compliance log before the first real user signs up. Migration to AWS Cape Town `af-south-1` on Docker is tracked in Phase 9.
- **Encryption key rotation format.** Wire format already includes a `v1.` prefix. Don't simplify it during Phase 2  the rotation test is on the Phase 11 list.

---

*When this ships: write `docs/completed/PHASE_2_COMPLETE.md` and open `docs/PHASE_3_PLAN.md`.*
