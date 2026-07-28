# PHASE 32 — SECURITY REMEDIATION + THE WELCOME EMAIL

*Opened 2026-07-28. Executes the findings of the four-sweep security audit run against the tree at
`862a432` (auth/session · authorization coverage · injection & data exposure · dependency scan),
plus the founder's addition: **new users must receive a real welcome email**, not just a verification
link.*

*Companion docs: `ROADMAP.md` · `TO_START_EVERY_SESSION.md` · `docs/popia/DPIA.md` · `docs/SECURITY.md`.*

> **Discipline (unchanged, non-negotiable):** every task lands with `npm run test:all` green + E2E
> (both flag states where flagged) at desktop **and** 360px + clean migrations before its commit.
> Every rule holds (No-Flash, POPIA-First, Redaction, Verification-Honesty, Location-Not-Nationality).
> **Work strictly in order: 32.1 → 32.2 → 32.3 → 32.4.** Each task is independently committable so a
> regression is always bisectable to one change.

> **Context that sets the urgency:** the deployment checklist is still unchecked and
> `BETTER_AUTH_URL` points at localhost — Sebenza is **not public yet**. Every item below is
> therefore cheap to fix now and expensive to fix after launch. 32.1 must not survive to launch day.

---

## 🎯 GOAL

Close every exploitable finding from the audit, with a bias toward **structural** fixes (the class of
bug cannot recur) over spot fixes, and give every new user an honest, useful welcome email.

**Non-goals:** no new features, no schema redesign, no re-litigating shipped product decisions.

---

## 🔴 TASK 32.1 — CRITICAL: two unauthenticated Server Actions

**Thesis: a function exported from a `"use server"` file is a PUBLIC HTTP ENDPOINT with a stable
action id. Two internal helpers crossed that boundary by accident.** Both are anonymously callable
today. This task ships first, alone, and fast.

### 32.1.1 — `supersedeEmploymentVerifications` (destructive, anonymous)
- **Where:** `lib/profile/employment-verification.ts:571` (file has `"use server"` at line 1).
- **Exposure:** takes `{ profileId, priorEmployerOrgId }` straight from the caller with **no session
  check**. An anonymous request flips a victim's `pending`/`verified` employment verification to
  `superseded`, redacts the stored contact email, and fires a bogus notification. Irreversible.
  Profile ids are visible to any verified employer via the invite funnel; org ids are enumerable.
- [ ] **Fix (structural, preferred):** move the function into a NEW plain module
      `lib/profile/employment-verification-internal.ts` **without** the `"use server"` directive —
      the exact pattern `lib/employer/invitations-cron.ts:4-6` already documents. Import it from
      `lib/profile/employment.ts:307` (its only legitimate caller, itself guarded by
      `verifyRole("seeker")` at `employment.ts:170`).
- [ ] **Belt-and-braces:** inside the moved function, assert the passed `profileId` belongs to the
      calling session where a session exists; keep it callable from the guarded path only.
- [ ] **Sweep for siblings:** grep every `"use server"` module for exported functions whose doc
      comment says "caller is responsible" / "caller passes" / "so we don't re-load the session" —
      that phrasing is the tell. Fix any other hit the same way.

### 32.1.2 — `matchVacancyCandidates` (data exposure, anonymous)
- **Where:** `lib/employer/vacancies.ts:968`.
- **Exposure:** accepts a hand-built `VacancyRow` from the wire. Returns (a) `counts.saCitizen` /
  `counts.foreignNational` for arbitrary filters — nationality-split supply data reachable nowhere
  else, directly against the Location-Not-Nationality rule; (b) `profilePhotoUrl` as the **raw
  private-bucket storage key** (the `dbProvider` wrapper that signs it is bypassed); (c) an
  anonymous write — `searchProfilesQuery` always inserts a `search_events` row, polluting the
  skills-gap analytics dataset.
- [ ] **Fix:** change the signature to `matchVacancyCandidates(vacancyId: string)` and make the first
      statement `const vacancy = await getMyVacancy(vacancyId)` (which calls `verifyEmployer()` and
      org-scopes the row); return an empty/absent result when it doesn't resolve. **Never accept a
      `VacancyRow` object from the wire.** Update the single caller
      `app/[locale]/(employer)/employer/vacancies/[id]/match/page.tsx:69`.
- [ ] Confirm the signed-URL wrapper is applied on this path so no raw storage key is returned.

### 32.1.3 — Regression guard (so this class cannot come back)
- [ ] **New compliance test** (`tests/integration/` — extend the dormant-gates suite or add
      `server-action-guards.test.ts`): statically parse every file under `lib/` and `app/` that
      begins with `"use server"`, enumerate its exported async functions, and assert each one's
      source contains a guard call (`verifySession|verifyRole|verifyAdmin|verifyGov|verifyEmployer|
      verifyOrgVerified|getSessionUser|requireEditRole|requireOwner|isAuthorizedCron`) — with an
      explicit, commented ALLOWLIST for the deliberate exceptions (sign-up/sign-in/reset,
      `listEmployerOptions`, `flagProfile` anonymous branch, token-authenticated invite responses).
      **A new unguarded action then fails the build.**
- [ ] Also flag the build-correctness nit found en route: `lib/seeker/report-invite.ts:42` exports a
      non-async const from a `"use server"` module (Next rejects this for that directive) — move it
      to a `*-types.ts` sibling per house convention.

**Verify 32.1:** `test:all` green (incl. the new guard test) · build clean · E2E unaffected · manual
check that the employer match page still renders candidates.

---

## 🟠 TASK 32.2 — HIGH

### 32.2.1 — Suspension / erasure must terminate sessions
- **Where:** `lib/admin/moderation.ts:144-151` (`suspendUser`), `lib/profile/erase.ts:50-53`,
  `lib/auth/dal.ts:85-120` (`getSessionUser` never rechecks account state). There is **no session
  deletion anywhere in the codebase** (verified by grep). Session table: `db/schema.ts:283`.
- **Exposure:** an admin suspends an abusive employer; that employer keeps full PII-reveal access
  for up to 30 days. Self-erase signs out the *current* device only — other devices stay live.
- [ ] `suspendUser`: after the UPDATE, `await db.delete(schema.session).where(eq(schema.session.userId, user.id))`.
- [ ] `eraseMyAccount`: same delete (in addition to the existing `auth.api.signOut`), so **all**
      devices drop.
- [ ] **Defence in depth:** have `getSessionUser()` select `suspendedAt`/`deletedAt` and fail closed
      (return `null`) when either is set — so a session that somehow survives is still inert.
- [ ] **Interaction to handle:** `session.cookieCache` (`lib/auth/server.ts:94-97`) serves session
      state from a signed cookie for up to 5 minutes without a DB read, which would blunt the
      recheck. Either drop `maxAge` to ~60s or bypass the cache on the recheck path. **Decide in
      Open Q1.**
- [ ] Test: integration test proving a suspended user's existing session is dead on the next request.

### 32.2.2 — Sign-in must not disclose account state or moderation notes
- **Where:** `lib/auth/actions.ts:824-847`. The suspension/erasure lookup runs **before** any
  password verification and returns `"This account has been erased."` or
  `` `Your account is suspended: ${suspendedReason}` `` — the admin's verbatim internal note.
- **Exposure:** anyone who knows an email (no password) learns the account exists, its moderation
  state, and a private admin assessment. POPIA disclosure to an unauthenticated party.
- [ ] Move the suspension/erasure check to **after** `signInEmail()` succeeds.
- [ ] Return a single generic message — `"This account isn't available. Contact support."` — with
      **no reason string**. The reason stays in the authenticated in-app notification that already
      exists, and in the audit log.
- [ ] Fail **closed** on the DB error path (`:844-847` currently swallows errors and falls through):
      return `"Sign-in is temporarily unavailable."` rather than proceeding.
- [ ] Test: assert the pre-auth response for a suspended account is byte-identical to a
      wrong-password response.

### 32.2.3 — Password reset must revoke other sessions (the UI already promises it)
- **Where:** `lib/auth/server.ts:63-76` (no `revokeSessionsOnPasswordReset`), while
  `app/[locale]/(auth)/reset-password/page.tsx:59` tells the user *"Once set, you'll be signed out of
  any other devices."* Verification-Honesty violation as well as a security gap.
- [ ] Set `emailAndPassword: { …, revokeSessionsOnPasswordReset: true }`.
- [ ] Same treatment for `reset2faForUser` (`lib/auth/two-factor.ts:235-239`), which currently clears
      the TOTP row while leaving the target's live sessions intact.
- [ ] Test: reset the password, assert a previously-issued session is rejected.

### 32.2.4 — Rate-limit the auth surface (the current exemption rests on a false premise)
- **Where:** `lib/auth/actions.ts:808-818` documents a deliberate "no sign-in rate limit" decision
  premised on Better Auth's own limiter. **That limiter only runs for requests routed through
  `auth.handler` (`/api/auth/*`)** — Sebenza calls `auth.api.signInEmail()` directly from a Server
  Action, so it never applies. Same for the two-factor plugin's `{window:10, max:3}` rule vs
  `lib/auth/two-factor.ts:112-163`. Existing buckets: `reveal`, `upload`, `search`, `coach`
  (`lib/rate-limit/types.ts`).
- [ ] New buckets + wiring:
      - `signin` — per **IP** (not per email: a per-email lock is a DoS vector against the victim).
      - `2fa-verify` — per session/IP, ~5 per 5 min, on `verifyTotp` **and** `verifyBackupCode`.
        Unthrottled 6-digit TOTP is brute-forceable today.
      - `email-send` — on `requestPasswordReset` + `resendVerificationEmail` (both public, both
        currently unthrottled → mailbox flooding + SMTP-reputation burn).
      - `invite` — per org on `bulkInviteToVacancy` / `bulkInviteByHandles` (the 50-per-call cap is
        not a global cap).
- [ ] **Rewrite the stale comment block** at `actions.ts:808-818` to record the corrected reasoning.
- [ ] Note for the operator: the limiter is in-memory per instance
      (`lib/rate-limit/memory.ts`); on serverless the effective cap multiplies by instance count.
      Upstash env vars already exist in `.env.example`. Flag as an operator item, not a code item.

### 32.2.5 — Dependency upgrades (separate commit, own verification)
- [ ] **Next.js 16.2.6 → 16.2.12** (patch, non-semver-major). Closes 9 advisories incl. SSRF in
      Server Actions, unauthenticated disclosure of internal Server Function endpoints, cache
      confusion, and DoS. Transitively fixes the bundled `sharp` + `postcss` advisories.
- [ ] **Better Auth 1.6.11 → ≥1.6.22.** Closes CVSS **8.3** account takeover via pre-account
      hijacking, plus the CVSS 7.7 stored-XSS advisory.
- [ ] **nodemailer 8.0.7 → latest** — CVSS 6.5 improper TLS certificate validation in OAuth2 token
      fetch (we use SMTP auth, so exposure is limited) + CRLF header-injection advisories. Check for
      breaking changes; ≥9 is a major bump, so treat as its own step.
- [ ] After each upgrade: `test:all` + **full** E2E at both viewports + a manual sign-in/2FA smoke.
      Do NOT run a blanket `npm audit fix --force`.

### 32.2.6 — Open redirect on `?next=` (4 sites)
- **Where:** `lib/auth/actions.ts:867` and `:887`; `lib/auth/two-factor.ts:126-128` and `:155-157`.
  All four guard with `next.startsWith("/")`, which accepts `//evil.example` and `/\evil.example`
  (protocol-relative). `components/feature/auth/TwoFactorVerifyForm.tsx:41` then calls
  `window.location.assign()` on it raw.
- **The fix already exists and is unused here:** `lib/nav/safe-internal-path.ts` rejects `//`,
  backslashes, `://` and CR/LF, and has tests covering exactly these payloads.
- [ ] Replace all four checks with `safeInternalPath(next, roleHome(role))`.
- [ ] Add a test asserting `//evil.example` and `/\evil.example` fall back to the role home.

---

## 🟡 TASK 32.3 — MEDIUM

- [ ] **32.3.1 Unverified orgs can bulk-invite.** `requireEditRole()` (`lib/employer/invitations.ts:642`)
      uses the permissive `verifyEmployer()`; the sibling seeker-invite path correctly uses
      `verifyOrgVerified()` (`lib/employer/seeker-invitations.ts:96,275,322`). The server action is
      weaker than its own UI gate (`app/[locale]/(public)/search/page.tsx:161-183` requires
      `verification === "verified"`). → switch to `verifyOrgVerified()`. Check whether
      `createVacancy` should follow (drafting a vacancy pre-verification may be intentional —
      **Open Q2**).
- [ ] **32.3.2 Gov user can enumerate the employer register.** `lib/gov/employer-lookup.ts:121`
      passes raw user input to `ilike()`; submitting `%` (or `A%`, `B%`, …) walks every organisation
      one row at a time, defeating the documented "no partial-match / no leaderboard" guarantee at
      `:108-111`. Same pattern at `lib/gov/oversight-query.ts:111` (which correctly uses `escapeLike`
      30 lines later) and `lib/profile/employment.ts:93` (low impact). → use
      `eq(lower(name), lower(input))` for the exact-match cases and `escapeLike` for the prefix case.
- [ ] **32.3.3 `SEBENZA_E2E_HTTP` production kill-switch.** Setting it to `1` disables the prod admin
      2FA hard-require (`lib/auth/dal.ts:226-232`) and strips `upgrade-insecure-requests`
      (`proxy.ts:95-97`). Protected only by a comment, and absent from `.env.example` so it's
      invisible to an env audit. → throw at module load if it's set while `VERCEL_ENV=production`;
      document it in `.env.example` with a red-flag comment.
- [ ] **32.3.4 CSP falls back to a Supabase wildcard.** `proxy.ts:70-72` reads
      `NEXT_PUBLIC_SUPABASE_URL`, which is **defined nowhere** (`.env.example`, `.env.local` and
      `lib/storage/supabase.ts:38` all use `SUPABASE_URL`), so `connect-src` always lands on
      `https://*.supabase.co` — any Supabase project is a permitted exfil destination. The same typo
      makes the admin storage health card
      (`app/[locale]/(admin)/admin/integrations/page.tsx:66`) permanently read "not configured", and
      `CLAUDE.md:86` documents the wrong name. → read `SUPABASE_URL` in all three places.
- [ ] **32.3.5 `/p/{handle}` ignores the searchability pause.** `db/queries/profiles.ts:634-646`
      applies only `deletedAt IS NULL` + the suspended-account check, while `searchProfilesQuery`
      (`:265-273`) and the invite path (`lib/employer/invitations.ts:367-380`) both honour
      `paused_until`. A paused seeker vanishes from search but their full dossier stays live at
      `/p/{handle}` and in the 7-day-cached OG card. **Product decision — Open Q3.**
- [ ] **32.3.6 Security headers skip `/api`.** `proxy.ts:141-143` excludes `api` from the matcher, so
      the POPIA data export, the 6 gov CSV exports and the 2 admin exports ship with no `nosniff`,
      no HSTS, no Referrer-Policy. → add a `headers()` entry in `next.config.ts` for `/api/:path*`
      (simpler than widening the matcher).
- [ ] **32.3.7 `trustedOrigins` hardcodes localhost in production** (`lib/auth/server.ts:37`) → gate
      the localhost entries on `NODE_ENV !== "production"`. Also make `BETTER_AUTH_URL` **required**
      in production instead of defaulting to `http://localhost:3000` (`:29`) — that default silently
      produces localhost verification/reset links if the env var is ever missing.
- [ ] **32.3.8 Anonymous report flood.** `flagProfile` (`lib/admin/moderation.ts:49-56`) is
      deliberately anonymous (correct) but each call inserts a row **and** notifies every admin, with
      no throttle or dedupe → add an `enforce()` bucket + collapse duplicate open reports per
      (handle, reason).
- [ ] **32.3.9 Sign-up email enumeration.** `lib/auth/actions.ts:1070-1072` and the
      `return e.message` fallthrough at `:1085` leak "account already exists", undoing the careful
      anti-enumeration work on the reset/resend paths → return the neutral shape and mail the
      existing owner instead. (Lower priority; note the UX trade in Open Q4.)

---

## ✉️ TASK 32.4 — THE WELCOME EMAIL (founder request)

**Thesis: a nervous, unemployed first-time user currently verifies their email and then hears
nothing. The one moment they are most likely to trust us is the moment we go silent.**

Today the only sign-up email is the Better Auth verification link (`lib/auth/server.ts:78-89`) —
correct and secure, but it explains nothing about the platform.

- [ ] **Trigger:** Better Auth exposes `emailVerification.afterEmailVerification(user, request)`
      (confirmed present in 1.6.11) — send the welcome email there, so it lands **after** the user
      has proven the address, not before. Must be non-fatal: a send failure never breaks
      verification.
- [ ] **Role-aware content.** Seeker and employer need different things. Build on
      `lib/email/templates/shell.ts` (`emailShell` + `escapeHtml`), Civic Editorial, mobile-first,
      no webfont dependency, plain-text fallback (No-Flash discipline applies to email too).
- [ ] **Seeker email must carry:**
      - what Sebenza is, in one honest line (found by skill + place; never a job board);
      - **the 2–3 next steps that actually improve their outcomes** — add skills, confirm status,
        complete the profile — each a deep link;
      - **a plain-language summary of the consent choices they just made**, and where to change them
        (`/dashboard/privacy`). This is the POPIA §18 transparency moment and the reason this task is
        not merely "nice to have";
      - the honest promises: we never show your ID number or contact details without your consent;
        we don't ask for ID at all right now (Phase 31);
      - a real support contact + the "we will never ask for your password" anti-phishing line.
- [ ] **Employer email must carry:** verification-before-contact-reveal expectation, 2FA
      requirement, how vacancies + invitations work, audit-log transparency (every reveal is logged),
      support contact.
- [ ] **i18n:** copy into `messages/en.json` (zu/xh/af deep-merge fallback). Per the standing rule,
      **consent/legal sentences must be human-translated, never machine-translated** — ship English
      for those until a translator signs off.
- [ ] **No new consent, no new tracking.** Transactional email only; no open-tracking pixel, no
      marketing opt-in smuggled in. If a marketing digest is ever wanted, that's its own consent
      purpose and its own phase.
- [ ] **Tests:** unit test asserting both templates escape user input and contain the required links;
      an integration test that verification triggers exactly one welcome send and that a send failure
      leaves verification successful.

---

## 🔓 OPEN QUESTIONS (decide during the task, record the answer here)

1. **Session-cache vs instant revocation (32.2.1).** Drop `cookieCache.maxAge` 5min → 60s
   (simplest, small extra DB load), or keep 5 min and bypass the cache for the suspension recheck?
   *Leaning: 60s + fail-closed recheck — simplest thing that is actually correct.*
2. **Should `createVacancy` also require a verified org (32.3.1)?** Drafting before verification may
   be deliberate onboarding UX. *Leaning: keep create permissive, gate only invite/publish.*
3. **Is `/p/{handle}` staying live during a searchability pause intentional (32.3.5)?** Three other
   surfaces treat pause as "make me invisible". Either honour it on the handle path too, or add a
   comment at `profiles.ts:634` documenting the deliberate divergence. *Leaning: honour it — the
   seeker's mental model of "pause" is almost certainly "I disappear".*
4. **Sign-up enumeration fix (32.3.9)** costs a real UX affordance ("you already have an account —
   sign in instead"). Neutral-response + email-the-owner is the secure pattern but adds a step for an
   honest user who simply forgot. *Leaning: do it, since employer accounts are the enumeration
   target that matters.*

## 🚫 OUT OF SCOPE (explicit guardrails)

- ❌ Nonce-based CSP / removing `'unsafe-inline'` — real, already tracked as a pre-launch item, but
  it needs a report-only staging pass; not bundled into a remediation phase.
- ❌ Moving rate limiting to Upstash — operator/infra decision (env vars already stubbed).
- ❌ Re-opening any shipped product decision (Phase 31 capture shape, ID dormancy, testimonials).
- ❌ Blanket `npm audit fix --force`.

## 👤 OPERATOR ITEMS (not code — carried forward, still open)

- [ ] **Rotate every secret in `.env.local`** (audit A1, still outstanding from Phase 26.1): Neon
      password, `SEBENZA_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `SEBENZA_INVITE_SIGNING_SECRET`,
      Supabase service-role key, Resend/SMTP key. They are real values sitting on disk.
- [ ] Ensure `SEBENZA_INVITE_SIGNING_SECRET` is ≥32 random bytes (`openssl rand -base64 32`) — the
      code accepts any non-empty string today (`lib/auth/invite-tokens.ts:38-48`).
- [ ] Delete the stale duplicate `EMAIL_TRANSPORT=mailtrap` line in `.env.local` (the later
      `EMAIL_TRANSPORT=smtp` wins, so sending works — but the duplicate is a trap).
- [ ] Information Officer designation + DPIA sign-off; pen-test before public launch.

---

## 📌 STATUS

- [ ] **32.1 Critical** — two unauthenticated Server Actions + the build-failing regression guard
- [ ] **32.2 High** — sessions on suspend/erase/reset · sign-in disclosure · auth rate limits ·
      dependency upgrades · open redirect
- [ ] **32.3 Medium** — 9 items
- [ ] **32.4 Welcome email** — role-aware, consent-summarising, i18n'd

*Plan opened 2026-07-28 against `862a432`. Audit method: four parallel read-only sweeps
(auth/session · authorization coverage of 64 action modules + 33 API routes · injection & data
exposure · dependency scan), every reported finding re-verified against the source before landing
here.*
