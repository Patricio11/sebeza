# Phase 2 — Identity, Auth & Consent · 📋 PLAN (rechecked 2026-05-22)

> Renamed from `PHASE_2_HANDOFF.md`. Establishes the new convention: active phase = `PHASE_N_PLAN.md`, shipped phase = `PHASE_N_COMPLETE.md`. The Phase 1 / 1.5 audit content moved to `PHASE_1_5_COMPLETE.md`.

**Goal:** Replace the mock-driven auth UI with real Better Auth — real accounts, real sessions, real consent persistence, real role-based guards, full forgot/reset/verification flows, 2FA for employer + admin.

**Rule of the seed (carried forward):** The mock data from `lib/mock/*` is the starting database. The `db/seed.ts` script makes that real. Nothing about Phase 2 invents users — Andile, Thandeka, Lerato, Discovery Bank's Naledi, and the admin all sign in as themselves.

---

## Re-checks (from conversation 2026-05-22)

### Re-check #1 — `/sign-in` does **not** ask the user to pick a role

**Today** the sign-in page has a "Sign in as" chip selector (seeker / employer / admin). That's wrong:

1. The user **is** one role — `app_user.role` says so. Asking them to declare it is theatre.
2. It's a quiet enumeration vector — an attacker can probe which role an email belongs to.
3. Real apps route by role *after* auth, never before.

**Phase 2 sign-in flow** (correct):

```
[email] [password] → submit
  │
  ├─ Better Auth verifies credentials → session candidate
  ├─ if !user.emailVerified → /verify-email (with the same email pre-filled)
  ├─ if user.role ∈ {employer, admin} AND !user.twoFactorConfigured → /setup-2fa
  ├─ if user.role ∈ {employer, admin} AND user.twoFactorConfigured → /verify-2fa (TOTP code)
  ├─ commit session cookie
  └─ redirect by user.role:
       seeker   → /dashboard
       employer → /employer
       admin    → /admin
```

The role chip stays only on **sign-up** — that's where the user actually declares what they're joining as.

### Re-check #2 — every auth surface fully wired

| Surface | Today (Phase 1.5) | Phase 2 work |
|---|---|---|
| `/sign-up` role chooser | static UI ✓ | no change |
| `/sign-up/seeker` (3 steps) | static UI ✓ | 3 Server Actions; create `app_user` + `profiles` + `consents` + (optional) `academic_profiles` atomically; send verification email |
| `/sign-up/employer` | static UI ✓ | Server Action; create `app_user` (role=employer) + `organizations` (unverified) + `organization_members` (role=owner); send verification email; force 2FA setup before any session |
| `/sign-in` | static UI with role chip ✓ | **Remove role chip.** Server Action calls Better Auth; honour email verification + 2FA; redirect by role |
| `/sign-out` | not yet | small Server Action + a button in the Dashboard / Employer / Admin `account` pages; calls Better Auth signOut; clears session cookie; redirects to `/` |
| `/verify-email` | static UI ✓ | Server Action: consume `?token=` from email link, mark `emailVerified`, optionally auto-sign-in; "Resend email" button → Server Action |
| `/forgot-password` | static form ✓ | Server Action: always respond with "Check your inbox" (anti-enumeration); send reset email if account exists |
| `/reset-password/[token]` | **NEW** | New page: new-password + confirm fields; Server Action verifies token, sets new password, invalidates other sessions, signs the user in |
| `/setup-2fa` | **NEW** | QR + manual key + verify-code; generate 8 backup codes (downloadable / printable) |
| `/verify-2fa` | **NEW** | 6-digit code field; rate-limited; backup-code fallback |
| `/dashboard/privacy` (revoke) | static UI ✓ | Wire revoke buttons to a Server Action that updates `consents.state = revoked` + writes `audit_log` row |
| `/dashboard/privacy` (export) | static UI ✓ | Server Action that produces JSON dump (profile + experience + quals + consents + own audit-log rows); emailed signed link (Phase 8 sends real email; Phase 2 console) |
| `/dashboard/privacy` (erasure) | static UI ✓ | Server Action: `profiles.deleted_at = now()`; nightly cron does hard delete after 30 days (cron is Phase 8) |

### Re-check #3 — 2FA scope decision

**Recommended: ship 2FA enforcement in Phase 2** for employer + admin roles. A national platform's security posture demands it before real PII flows. Tradeoff: TOTP setup adds friction to employer sign-up, but it's once-only and we'll back it with downloadable backup codes.

If you'd rather defer enforcement (UI shipped, hard requirement off) and switch on enforcement in Phase 7, say so before kickoff.

### Re-check #4 — Email transport during Phase 2

Phase 8 wires Resend properly. For Phase 2:

- **Default:** Better Auth console transport — emails log to terminal in dev. Verification links are clickable from the terminal output.
- **Optional:** flip to Resend's `onboarding@resend.dev` sender if you want to test in a real inbox.

Either way, no production-grade email until Phase 8.

### Re-check #5 — Better Auth tables coexisting with our schema

Better Auth needs four tables alongside ours: `user` (extends our `app_user` — we map the column), `session`, `account` (stores the password hash), `verification` (email-verify + password-reset tokens). If we enable the 2FA plugin we also get `two_factor`.

Strategy: run `npx @better-auth/cli generate` once during Phase 2 kickoff, **review** the emitted schema, merge into `db/schema.ts`, then `npm run db:generate` to produce a single migration. **Decide before running `db:generate`** so we don't end up with two competing migration namespaces.

### Re-check #6 — Documentation convention

Established with this commit:
- **Active phase:** `docs/PHASE_N_PLAN.md` (planning + recheck)
- **Shipped phase:** `docs/PHASE_N_COMPLETE.md` (retrospective + verification + handoff items)
- **Always-on:** `ROADMAP.md`, `TO_START_EVERY_SESSION.md`, `UX_UI_SPEC.md`, `MOBILE_PLAN.md`

Every phase that ships triggers:
1. Rename `PHASE_N_PLAN.md` → `PHASE_N_COMPLETE.md` (or write it fresh)
2. Tick the phase header in `ROADMAP.md` ✅
3. Update `TO_START_EVERY_SESSION.md` Current State block
4. Write the next phase's `PHASE_(N+1)_PLAN.md`
5. Commit with `Phase N complete + Phase N+1 opens` in the message

---

## Implementation plan

### 1. Install + scaffold (~30 min)
- `npm i better-auth`
- `npx @better-auth/cli generate` → review the schema diff
- Merge Better Auth tables into `db/schema.ts` (matching our naming + the `app_user.role` column we already have)
- Create `lib/auth/server.ts` — Better Auth instance with Drizzle adapter, email+password, email-verify, password-reset, 2FA plugin
- Create `app/api/auth/[...all]/route.ts` — Better Auth catch-all handler
- `npm run db:generate && npm run db:migrate && npm run db:seed`

### 2. Wire `lib/auth/guard.ts` to real sessions (~30 min)
- `getSessionUser()` reads the Better Auth session from cookies
- `requireRole(role)` redirects to `/sign-in?next=<current>` on miss
- `requireOrgVerified()` checks `organization_members` + `organizations.verification`
- Add `proxy.ts` rules (alongside next-intl) for the `(seeker)` / `(employer)` / `(admin)` route groups

### 3. Server Actions for sign-up + sign-in + sign-out (~90 min)
- `lib/auth/actions.ts` houses all auth Server Actions: `signUpSeeker`, `signUpEmployer`, `signIn`, `signOut`, `sendVerificationEmail`, `verifyEmail`, `forgotPassword`, `resetPassword`, `setupTotp`, `verifyTotp`
- Each action: Zod-validate input → call Better Auth → write to our tables in transaction → audit-log → return result
- Wire the existing sign-up forms (`/sign-up/seeker` step 1/2/3, `/sign-up/employer`) to these actions via React 19 form actions
- Wire `/sign-in` (after removing the role chip) to `signIn`
- Add sign-out button to every dashboard account page

### 4. New pages (~60 min)
- `/reset-password/[token]` — new-password form, calls `resetPassword`
- `/setup-2fa` — QR + manual key + verify (gated to employer + admin who don't yet have 2FA)
- `/verify-2fa` — code field, called mid-sign-in flow

### 5. Consent + audit persistence (~45 min)
- Wire `/dashboard/privacy` revoke buttons to `revokeConsent` action
- Update `lib/audit.logAccess()` to write to the `audit_log` table (keep ring buffer as a tail)
- Switch `/admin/audit-log` page to read from the DB

### 6. Verification + commit (~30 min)
- Build + smoke-test every auth surface
- Manual test: sign up Andile → verify email (terminal link) → sign in → land on /dashboard
- Manual test: sign up Discovery Bank → verify → set up 2FA → sign in → 2FA challenge → land on /employer
- Manual test: admin sign in with 2FA → /admin
- Tick `ROADMAP.md` Phase 2; write `PHASE_2_COMPLETE.md`; open `PHASE_3_PLAN.md` (CV/photo uploads + profile CRUD)

---

## Acceptance criteria (Phase 2 is DONE when every box ticks)

- [ ] Andile signs in with `andile-z@example.co.za` + seeded password → lands on `/dashboard`
- [ ] Naledi (Discovery Bank) signs in → completes 2FA → lands on `/employer`
- [ ] Admin signs in → completes 2FA → lands on `/admin`
- [ ] Unauthed user hitting `/dashboard` redirects to `/sign-in?next=/dashboard`
- [ ] Sign-up writes user + profile + consents + (optional) academic in one transaction; failure rolls back
- [ ] Verification email logged to console (or sent if Resend wired); link verifies the user
- [ ] Forgot-password always shows "Check your inbox" (no enumeration); reset link works once then expires
- [ ] Sign-out clears the session cookie and redirects to `/`
- [ ] Revoking `searchability` consent removes the seeker from `/search` results immediately
- [ ] `lib/audit.logAccess()` writes to the `audit_log` table; `/admin/audit-log` reads from the DB
- [ ] `npm run build` clean; every existing route still 200 under `next start`

---

## Out of scope for Phase 2 (don't blur the line)

- **Real Resend templates** — Phase 8 (console transport for Phase 2 is fine)
- **Document/CV upload to Supabase Storage** — Phase 3
- **Postgres FTS + ranking SQL** — Phase 4
- **Employer reveal flow** — Phase 5
- **Skills-gap engine** — Phase 6
- **KYC partner integration** — Phase 8
- **Rate limiting + Upstash** — Phase 9 (Better Auth has basic in-memory rate limits which are enough for Phase 2)

---

## Risks to flag at kickoff

- **Better Auth migration vs `db:generate`.** Decide upfront whether Better Auth owns its own migration namespace or we merge its tables into `db/schema.ts`. We're going with the merge (one source of truth).
- **Mock handles vs UUIDs.** Mock profiles use slug handles (`thandeka-m`). Real `app_user.id` is a Better Auth UUID. The seed mints stable IDs (`user_thandeka-m`) so dev sessions are debuggable. Document this in `db/seed.ts` (already done).
- **POPIA cross-border posture.** Neon is `eu-central-1`. Document the cross-border note in the compliance log before the first real user signs up. Migration to AWS Cape Town `af-south-1` on Docker is tracked in Phase 9 (see `ROADMAP.md`).
- **Encryption key rotation format.** Wire format already includes a `v1.` prefix. Don't simplify it during Phase 2 — the rotation test is on the Phase 11 list.

---

*Open `PHASE_2_COMPLETE.md` when this ships.*
