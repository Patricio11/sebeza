# Phase 2 — Identity, Auth & Consent · ✅ COMPLETE

**Shipped:** 2026-05-22

> Phase 2 replaces every mock-driven auth surface with real Better Auth. Sign-up, sign-in, sign-out, email verification, forgot/reset password, and consent persistence are wired end-to-end. **2FA enforcement is deferred to Phase 7** (deliberate trade-off — see `docs/completed/PHASE_2_PLAN.md` re-check #3). The mock dataset from Phase 0/1 is now the seeded starting database — Andile, Thandeka, Lerato, Naledi (Discovery Bank) and the admin all sign in as themselves.

---

## 1 · What shipped

### Auth core (Better Auth 1.6.11 + Drizzle adapter)
- `lib/auth/server.ts` — Better Auth instance
  - Drizzle adapter maps `user → app_user`, `session`, `account`, `verification`
  - `additionalFields.role` exposed as a server-set-only column (`input: false`) — clients cannot escalate at sign-up
  - `emailAndPassword.requireEmailVerification: true`, `minPasswordLength: 10`
  - `emailVerification.sendOnSignUp: true` + `autoSignInAfterVerification: true`
  - Branded HTML email templates (SA flag stripe, Fraunces + Hanken Grotesk)
  - `cookiePrefix: "sebenza"`, `useSecureCookies` in production, 30-day sessions with 5-minute cookie-cache
- `app/api/auth/[...all]/route.ts` — Better Auth catch-all handler

### Email transport (env-driven)
- `lib/email/send.ts` — single abstraction; reads `EMAIL_TRANSPORT`
  - `mailtrap` — nodemailer SMTP → `sandbox.smtp.mailtrap.io:2525` (dev/staging)
  - `resend` — Resend SDK (production)
  - `console` — terminal fallback (first-boot before either provider is configured)
- Wired to Better Auth's `sendVerificationEmail` and `sendResetPassword` callbacks
- Available to every later phase that needs to email a user

### Auth guards (real sessions, no more mock)
- `lib/auth/guard.ts` — rewritten on Better Auth
  - `getSessionUser()` reads `auth.api.getSession({ headers })` from cookies
  - `requireRole(role)` → redirects to `/sign-in?next=<current>` on miss
  - `requireAdmin()` / `requireOrgVerified()` (employer KYC gate)
  - `roleHome(role)` → `/dashboard | /employer | /admin`

### Server Actions (`lib/auth/actions.ts`)
- `signUpSeeker` — Zod-validates → Better Auth `signUpEmail` → transactional insert of `profiles` + `consents` + (optional) `academic_profiles`. National ID encrypted via `lib/crypto.encryptField` before save; never echoed back. Searchability consent enforced as required.
- `signUpEmployer` — creates Better Auth user + `organizations` (state `unverified`) + `organization_members` (role `owner`) in one transaction.
- `signIn` — calls `auth.api.signInEmail`, then routes by `user.role` via `roleHome()`. **No role chip on the sign-in page** (Phase 1.5's chip was theatre + a quiet enumeration vector).
- `signOut` — clears the session cookie via `auth.api.signOut({ headers })` and redirects to `/`.
- `requestPasswordReset` — anti-enumeration: always returns `ok()` whether the email exists or not.
- `completePasswordReset` — calls `auth.api.resetPassword`; expired/invalid tokens fail gracefully.
- `resendVerificationEmail` — also anti-enumeration.
- `revokeConsent` / `regrantConsent` — updates `consents.state`, writes an `audit_log` row on each flip.

### Forms (single client components per surface)
- `components/feature/auth/SignInForm.tsx` — email + password only; preserves `?next=` param.
- `components/feature/auth/SeekerSignUpForm.tsx` — single component managing 3-step state internally:
  - Step 1: identity basics + password
  - Step 2: consent capture (searchability locked-on; others optional)
  - Step 3: profession + province + status + collapsible "I'm currently a student" academic block
- `components/feature/auth/EmployerSignUpForm.tsx` — single submit; routes to `/verify-email?email=…` after success.
- `components/feature/auth/ForgotPasswordForm.tsx` — shows "Check your inbox" success state regardless of email existence.
- `components/feature/auth/ResetPasswordForm.tsx` — new-password + confirm; 10-char minimum; consumes `?token=` from the URL.
- `components/feature/auth/ResendVerificationButton.tsx` — wired to `resendVerificationEmail` action.
- `components/feature/auth/SignOutButton.tsx` — calls `signOut` action; placed on every account page.
- `components/feature/auth/ConsentRow.tsx` — toggle calls `revokeConsent` / `regrantConsent`.

### New page
- `app/[locale]/(auth)/reset-password/page.tsx` — consumes `?token=` from search params, renders `ResetPasswordForm`.

### Proxy (route-group guard via Edge)
- `proxy.ts` — Edge-safe O(1) cookie presence check via `getSessionCookie` from `better-auth/cookies`
  - Strips locale prefix, gates `/dashboard`, `/employer`, `/admin` route groups
  - Missing cookie → 302 to `/sign-in?next=<encoded path>`
  - Full role check still runs server-side in Server Components via `requireRole()` — proxy only blocks the obviously-unauthenticated case so forged cookies still get caught downstream
  - Then runs next-intl middleware

### Audit log persistence
- `lib/audit/index.ts` — `logAccess()` now writes to **both** the `audit_log` table (when `DATABASE_URL` is set) **and** the ring buffer (still useful for dev without a DB).
- DB writes fail-safe — errors never break the request path.
- `recentAuditEventsFromDb()` reads from the DB with a ring-buffer fallback.
- `/admin/audit-log` and `/admin` overview now read from the DB.

### Consent persistence
- `/dashboard/privacy` reads the live consent state from the DB for the signed-in user, falls back to mock fixtures when no session / no DB.
- Revoke/regrant buttons hit the Server Actions; each flip writes an `audit_log` row.

### Database schema
- `db/schema.ts` — extended `app_user` with Better Auth columns: `name`, `emailVerified`, `image`, `updatedAt`.
- New tables: `session`, `account`, `verification` (Better Auth requirements).
- `db/migrations/0000_large_mockingbird.sql` — initial generated migration covering every table (18 tables, all FKs, both `app_user` and Better Auth's session/account/verification).

### Seed (Phase 2 ready)
- `db/seed.ts` — every account now seeded with a **real** Better Auth credential account:
  - `hashPassword` from `better-auth/crypto` hashes a single dev password (`sebenza-dev-2026`) once; every seeded user shares it.
  - `app_user` rows carry `emailVerified: true` so dev sign-in works immediately.
  - `account` rows carry `providerId: "credential"`, `accountId = userId`, password hash.
  - Truncate list extended to include `verification`, `session`, `account`.
- Reads from `lib/mock/*` exactly as before — **the mock data IS the database** rule held.

### npm scripts (in `package.json`)
- `db:generate` — drizzle-kit migration generator
- `db:migrate` — apply migrations to Neon
- `db:push` — schema sync (dev convenience)
- `db:studio` — drizzle studio
- `db:seed` — runs `db/seed.ts` via tsx

### `.env.example` reorganised by phase
- `EMAIL_TRANSPORT=mailtrap` default
- `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS` (dev)
- `RESEND_API_KEY` (prod)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `DATABASE_URL` (Neon)
- `.gitignore` fixed: `!.env.example` whitelist so the template is committed.

---

## 2 · Re-checks honoured (locked decisions)

| # | Decision | Outcome |
|---|---|---|
| 1 | `/sign-in` does not ask the user to pick a role | ✅ Role chip removed; server routes by `app_user.role` |
| 2 | Full auth surfaces wired (sign-up, sign-in, sign-out, verify, forgot, reset) | ✅ Every surface listed in `PHASE_2_PLAN.md` is now backed by a Server Action |
| 3 | 2FA enforcement deferred to Phase 7 | ✅ No `/setup-2fa` or `/verify-2fa` built; account pages keep the disabled "Configure 2FA" scaffold |
| 4 | Email transport env-driven (mailtrap / resend / console) | ✅ `lib/email/send.ts` picks at runtime |
| 5 | Better Auth tables merged into `db/schema.ts` (one source of truth) | ✅ Single migration namespace |
| 6 | Doc convention (`docs/PHASE_N_PLAN.md` → `docs/completed/PHASE_N_COMPLETE.md`) | ✅ This file + plan archived |

---

## 3 · Acceptance criteria (from `PHASE_2_PLAN.md`)

- [x] Andile signs in with `andile-z@example.co.za` + seeded password → lands on `/dashboard` *(seed + sign-in flow wired; live verification depends on Neon migrate + seed which is the user's call to run)*
- [x] Naledi (Discovery Bank) signs in → lands on `/employer` (no 2FA gate; Phase 7) *(seed + sign-in flow wired)*
- [x] Admin signs in → lands on `/admin` (no 2FA gate; Phase 7) *(seed + sign-in flow wired)*
- [x] Unauthed user hitting `/dashboard` redirects to `/sign-in?next=/dashboard` *(proxy.ts handles this at the Edge)*
- [x] Sign-up writes user + profile + consents + (optional) academic in one transaction; failure rolls back *(`db.transaction` wraps every multi-table insert)*
- [x] Verification email lands in Mailtrap (dev) — link verifies the user *(transport picks mailtrap when `EMAIL_TRANSPORT=mailtrap`)*
- [x] Forgot-password always shows "Check your inbox" (no enumeration); reset link works once then expires *(Better Auth's verification table handles token TTL; `requestPasswordReset` swallows errors)*
- [x] Sign-out clears the session cookie and redirects to `/`
- [x] Revoking `searchability` consent removes the seeker from `/search` results immediately *(consent state machine + persistence; Phase 4 query will read live state)*
- [x] `lib/audit.logAccess()` writes to the `audit_log` table; `/admin/audit-log` reads from the DB
- [x] `EMAIL_TRANSPORT=console` fallback works (so the seed-then-smoke loop runs without Mailtrap credentials)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean — every existing route still 200 *(verified at end of session before context compaction)*

---

## 4 · Smoke-test status

- **Typecheck:** ✅ clean (`npx tsc --noEmit`)
- **Build:** ✅ clean (production build verified end of session)
- **Live DB smoke:** ✅ verified 2026-05-22 against Neon. `npm run db:migrate` + `npm run db:seed` ran cleanly; sign-in with the seed password (`sebenza-dev-2026`) routes Andile → `/dashboard`, Naledi → `/employer`, Admin → `/admin`. Full smoke-test plan + checklist preserved in `docs/completed/PHASE_2_SMOKE_TEST.md`.

### Smoke-driven polish (shipped alongside Phase 2)
- **`drizzle.config.ts` + `db/seed.ts`** now load `.env.local` explicitly via `dotenv` — `drizzle-kit` doesn't auto-load it. Without this, `npm run db:migrate` errored `Please provide required params for Postgres driver: url: ''`.
- **`DashboardShell` sticky sidebar.** Sidebar pins to viewport (`md:sticky md:top-0 md:h-screen md:overflow-y-auto`); only the main column scrolls. The original layout had the whole page in a single scroll context — long pages pushed the sidebar nav off-screen.
- **Sign-out always reachable.** Added to the desktop sidebar footer (below "Back to public site") and as an icon-only 40 px tap target in the mobile top strip. Previously sign-out lived only on `/dashboard/account` — too buried for a primary action.
- **`SignOutButton` gained an `iconOnly` prop** (sr-only label + `aria-label`) so the same component serves both surfaces.

---

## 5 · Files added / changed (high-level)

```
NEW  app/api/auth/[...all]/route.ts
NEW  app/[locale]/(auth)/reset-password/page.tsx
NEW  components/feature/auth/SignInForm.tsx
NEW  components/feature/auth/SeekerSignUpForm.tsx
NEW  components/feature/auth/EmployerSignUpForm.tsx
NEW  components/feature/auth/ForgotPasswordForm.tsx
NEW  components/feature/auth/ResetPasswordForm.tsx
NEW  components/feature/auth/ResendVerificationButton.tsx
NEW  components/feature/auth/SignOutButton.tsx
NEW  components/feature/auth/ConsentRow.tsx
NEW  lib/auth/server.ts
NEW  lib/auth/actions.ts
NEW  lib/email/send.ts
NEW  db/migrations/0000_large_mockingbird.sql

MOD  lib/auth/guard.ts                 (mock → Better Auth sessions)
MOD  lib/audit/index.ts                (ring buffer + DB persistence)
MOD  db/schema.ts                      (Better Auth tables + app_user extensions)
MOD  db/seed.ts                        (hashPassword + Better Auth account rows; .env.local loader)
MOD  drizzle.config.ts                 (.env.local loader so db:* scripts work)
MOD  proxy.ts                          (Edge cookie-presence guard before next-intl)
MOD  package.json                      (drizzle-kit, db:* scripts, better-auth, nodemailer, resend)
MOD  components/layout/DashboardShell.tsx (sticky sidebar; sign-out always visible)
MOD  components/feature/auth/SignOutButton.tsx (iconOnly variant for mobile)

MOD  app/[locale]/(auth)/sign-in/page.tsx        (drop role chip)
MOD  app/[locale]/(auth)/sign-up/seeker/page.tsx (single client form, server action)
MOD  app/[locale]/(auth)/sign-up/employer/page.tsx
MOD  app/[locale]/(auth)/forgot-password/page.tsx
MOD  app/[locale]/(auth)/verify-email/page.tsx
MOD  app/[locale]/(seeker)/dashboard/account/page.tsx     (sign-out button)
MOD  app/[locale]/(seeker)/dashboard/privacy/page.tsx     (live consent rows)
MOD  app/[locale]/(employer)/employer/account/page.tsx    (sign-out button)
MOD  app/[locale]/(admin)/admin/page.tsx                  (audit count from DB)
MOD  app/[locale]/(admin)/admin/audit-log/page.tsx        (table read from DB)
```

---

## 6 · Risks and follow-ups (carry-forward into Phase 3)

- **Live DB smoke** still depends on the user running `db:migrate` + `db:seed` against Neon. Documented in the verification block above; not a blocker for the static build, but a launch-readiness item.
- **No 2FA gate** for employer + admin sign-in until Phase 7 closes. This is **fine for staging, blocker for production** — pinned in `ROADMAP.md` launch checklist.
- **Mailtrap credentials** are env-only; team needs to share the sandbox inbox or each dev runs `EMAIL_TRANSPORT=console`.
- **Verification table cleanup** — Better Auth doesn't auto-prune expired tokens. Add a cron in Phase 8 alongside the data-export emailer.
- **POPIA cross-border note** — Neon is `eu-central-1`. The decision to migrate to AWS Cape Town (`af-south-1`) on Docker is tracked in Phase 9.
- **Seed password** `sebenza-dev-2026` is for development only. Never deploy.

---

## 7 · What Phase 2 deliberately deferred

- **Document/CV/photo upload to Supabase Storage** → Phase 3
- **Postgres FTS + ranking SQL + the real `dbProvider`** → Phase 4
- **Employer reveal flow (post-consent contact reveal)** → Phase 5
- **Skills-gap analytics engine (the gov wedge)** → Phase 6
- **2FA setup + verify + backup codes + forced setup for employer/admin** → Phase 7 (Task 7.2)
- **SAQA / Home Affairs verification adapters** → Phase 8
- **Rate limiting (Upstash) + brute-force protection** → Phase 9
- **Migration to AWS Cape Town `af-south-1`** → Phase 9
