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
- [x] **Fix (structural, preferred):** move the function into a NEW plain module
      `lib/profile/employment-verification-internal.ts` **without** the `"use server"` directive —
      the exact pattern `lib/employer/invitations-cron.ts:4-6` already documents. Import it from
      `lib/profile/employment.ts:307` (its only legitimate caller, itself guarded by
      `verifyRole("seeker")` at `employment.ts:170`).
- [x] **Belt-and-braces** *(adjusted):* the trust contract is documented in the new module's header
      rather than enforced by an in-function assert — once the function is unreachable from the wire,
      its sole caller (`updateCurrentEmployment`, `verifyRole("seeker")`-gated) already derives
      `profileId` from the session and never from the request.
- [x] **Sweep for siblings** *(superseded, better):* rather than grepping for the tell-tale comment
      phrasing ("caller is responsible" / "caller passes"), the 32.1.3 scanner checks **every**
      exported action structurally — it cannot be fooled by a helper that simply lacks the comment.

### 32.1.2 — `matchVacancyCandidates` (data exposure, anonymous)
- **Where:** `lib/employer/vacancies.ts:968`.
- **Exposure:** accepts a hand-built `VacancyRow` from the wire. Returns (a) `counts.saCitizen` /
  `counts.foreignNational` for arbitrary filters — nationality-split supply data reachable nowhere
  else, directly against the Location-Not-Nationality rule; (b) `profilePhotoUrl` as the **raw
  private-bucket storage key** (the `dbProvider` wrapper that signs it is bypassed); (c) an
  anonymous write — `searchProfilesQuery` always inserts a `search_events` row, polluting the
  skills-gap analytics dataset.
- [x] **Fix:** change the signature to `matchVacancyCandidates(vacancyId: string)` and make the first
      statement `const vacancy = await getMyVacancy(vacancyId)` (which calls `verifyEmployer()` and
      org-scopes the row); return an empty/absent result when it doesn't resolve. **Never accept a
      `VacancyRow` object from the wire.** Update the single caller
      `app/[locale]/(employer)/employer/vacancies/[id]/match/page.tsx:69`.
- [x] Confirm the signed-URL wrapper is applied on this path so no raw storage key is returned.
      (Moot now: the action is employer-gated + org-scoped, so the anonymous key-leak path is gone.)

### 32.1.3 — Regression guard (so this class cannot come back)
- [x] **New guard test**  landed as `lib/security/server-action-guards.test.ts` (the **unit**
      project, not integration: it is pure static analysis and needs no DB, so it fails FAST on every
      `npm test`). **Mutation-tested**: adding a deliberately unguarded action makes the suite fail
      and name it; removing it returns green. Two real delegation patterns are resolved rather than
      allowlisted  `auth.api.*({ headers })` (Better Auth verifies the session from forwarded
      headers) and same-file helpers (the four `lib/seeker/invitations.ts` responders funnel into
      `respond()`, which starts with `verifyRole("seeker")`). 16 allowlist entries, each stating WHY
      it is deliberately public. `setTestimonialCampaign` got an explicit `verifyAdmin()` rather than
      an allowlist entry — it inherited one via `updateSetting`, but a reader shouldn't have to trace
      into another module to know a public endpoint is safe.
      *(Placed in the unit project instead of `tests/integration/` as originally sketched: static
      analysis needs no database, and a security guard should fail in under a second.)*
- [x] **Correction to the audit claim + fixed anyway:** the build does **not** fail on this (verified:
      `npm run build` clean before the change), so it was a convention issue rather than a build error.
      Fixed regardless because it was a real footgun: `REPORT_INVITE_REASON_LABEL` was imported by the
      CLIENT component `ReportInvitationControl.tsx`, i.e. a client bundle reaching into a Server
      Action module for a constant. Types + the label map now live in
      `lib/seeker/report-invite-types.ts` per house convention, and both importers were repointed.

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
- [x] `suspendUser`: session rows deleted immediately after the UPDATE  suspension now takes effect
      on the next REQUEST, not the next sign-in.
- [x] `eraseMyAccount`: same delete alongside the existing `auth.api.signOut`, so **all** devices
      drop  not just the one that clicked erase.
- [x] **Defence in depth:** `getSessionUser()` now selects `suspendedAt`/`deletedAt` and fails closed
      (returns `null`) when either is set, or when the user row has vanished entirely. One indexed PK
      lookup, memoised per render pass by the existing `cache()`.
- [x] **Open Q1 RESOLVED (operator, 2026-07-28): `cookieCache.maxAge` 5 min → 60s.** The blind
      window in which a suspension/role change is invisible is now bounded at one minute, and the
      DAL re-check (which always hits the DB) closes it on the next request.
- [x] Test: `tests/integration/session-revocation.test.ts` (4 cases  sessions deleted, suspension
      recorded, restore does NOT resurrect old cookies, DAL fails closed on a stale session).
      **Mutation-tested:** reverting the delete leaves 1 live session and the suite fails.

### 32.2.2 — Sign-in must not disclose account state or moderation notes
- **Where:** `lib/auth/actions.ts:824-847`. The suspension/erasure lookup runs **before** any
  password verification and returns `"This account has been erased."` or
  `` `Your account is suspended: ${suspendedReason}` `` — the admin's verbatim internal note.
- **Exposure:** anyone who knows an email (no password) learns the account exists, its moderation
  state, and a private admin assessment. POPIA disclosure to an unauthenticated party.
- [x] Moved the suspension/erasure check to **after** `signInEmail()` succeeds  reaching it now
      proves the caller owns the credentials. Also **revokes the session Better Auth just issued**
      for the accepted password (found while implementing: without this the suspended user walks
      away holding a valid cookie).
- [x] **No reason string, ever.** *Adjusted from the plan's wording:* since the branch is now
      post-authentication, an honest `"Your account is suspended. Contact support…"` is safe and is
      better UX than a vague "isn't available"  the caller has proved they own the account. The
      admin's free-text note stays internal (the `account.suspended` notification and the audit log
      carry the explanation). Pre-authentication, nothing is disclosed at all.
- [x] Fails **closed** on the DB error path via `accountModerationState()`'s explicit
      `"unavailable"` state  the previous bare `catch {}` let a partial outage admit a suspended
      user.
- [x] Test: `tests/integration/signin-disclosure.test.ts` (5 cases  suspended vs healthy with a
      wrong password are byte-identical; the admin note never reaches the client; unknown vs known
      addresses are indistinguishable; erased behaves likewise; and with the CORRECT password the
      user is told honestly AND their freshly-issued session is revoked).
      **Mutation-tested:** reinstating the old pre-auth branch makes the suite fail and print the
      leaked note verbatim.

### 32.2.3 — Password reset must revoke other sessions (the UI already promises it)
- **Where:** `lib/auth/server.ts:63-76` (no `revokeSessionsOnPasswordReset`), while
  `app/[locale]/(auth)/reset-password/page.tsx:59` tells the user *"Once set, you'll be signed out of
  any other devices."* Verification-Honesty violation as well as a security gap.
- [x] Set `emailAndPassword: { …, revokeSessionsOnPasswordReset: true }`  the reset page's promise
      ("you'll be signed out of any other devices") is now true.
- [x] Same treatment for `reset2faForUser`  it now deletes the target's sessions alongside the TOTP
      row. An admin resets 2FA precisely when the second factor is suspect, so sessions established
      under the OLD factor must not survive.
- [x] Test: the 2FA-reset revocation is pinned in `session-revocation.test.ts` (mutation-tested:
      removing the delete leaves 1 live session and the suite fails).
      *Note on scope:* `revokeSessionsOnPasswordReset` is enforced inside Better Auth's own reset
      endpoint, which needs its full HTTP token round-trip  covering it meaningfully belongs in an
      E2E pass rather than a unit stub, so it is exercised there rather than faked here.

### 32.2.4 — Rate-limit the auth surface (the current exemption rests on a false premise)
- **Where:** `lib/auth/actions.ts:808-818` documents a deliberate "no sign-in rate limit" decision
  premised on Better Auth's own limiter. **That limiter only runs for requests routed through
  `auth.handler` (`/api/auth/*`)** — Sebenza calls `auth.api.signInEmail()` directly from a Server
  Action, so it never applies. Same for the two-factor plugin's `{window:10, max:3}` rule vs
  `lib/auth/two-factor.ts:112-163`. Existing buckets: `reveal`, `upload`, `search`, `coach`
  (`lib/rate-limit/types.ts`).
- [x] **New buckets + wiring** (`lib/rate-limit/types.ts` + `lib/rate-limit/client-ip.ts`):
      - `signin` 20/10min per **IP** (never per email  a per-email counter would let an attacker
        lock a victim out; the original Phase 9 DoS concern was right and is preserved).
      - `2fa-verify` 5/5min on `verifyTotp` **and** `verifyBackupCode`. The important one: a 6-digit
        TOTP is 10^6 with a ~90s window, so it was brute-forceable online by anyone holding the
        password.
      - `email-send` 5/15min on `requestPasswordReset` + `resendVerificationEmail`, keyed per IP AND
        per address. Both return `ok()` when limited so the **anti-enumeration contract survives** —
        the limit itself must not become an oracle.
      - `invite` 10 batches/hour per org on `bulkInviteToVacancy` (every entry point funnels through
        it, including the /search selection funnel), making the 50-per-call cap a real ceiling.
      - Keys are **hashed** (truncated SHA-256): rate-limit keys reach logs and the shared store, and
        a raw IP or email is personal information under POPIA.
- [x] **Rewrote the stale comment block** at `actions.ts` and the note in `rate-limit/types.ts` to
      record the correction: the old decision rested on "Better Auth handles it", which is false for
      Server Actions (its limiter only runs for requests through `auth.handler`).
- [x] Test: `tests/integration/auth-rate-limits.test.ts` (4 cases  sign-in refuses past budget;
      the key is per-IP not per-email; TOTP refuses on a tight budget; a throttled password-reset
      still returns `ok()`). **Mutation-tested:** disabling the TOTP throttle fails the suite.
- [ ] **OPERATOR:** the limiter is in-memory per instance (`lib/rate-limit/memory.ts`), so on
      serverless the effective cap multiplies by instance count. Upstash env vars are already stubbed
      in `.env.example`; wiring the adapter is an infra task, not a code one.

### 32.2.5 — Dependency upgrades (separate commit, own verification)
- [x] **Next.js 16.2.6 → 16.2.12** — all 9 advisories closed (SSRF in Server Actions,
      unauthenticated disclosure of internal Server Function endpoints, cache confusion, DoS).
      *Correction to the plan's expectation:* it did **not** transitively fix `sharp`/`postcss` —
      Next still pins both below their fixed versions (see the exposure note below).
- [x] **Better Auth 1.6.11 → 1.6.25** — CVSS 8.3 account takeover (pre-account hijacking) and the
      CVSS 7.7 stored-XSS advisory both closed. No API changes needed; the real sign-in path is
      exercised by `signin-disclosure` + `auth-rate-limits`, which pass against the new version.
- [x] **nodemailer 8.0.7 → 9.0.3** (major bump, taken deliberately as its own step). Our surface is
      just `createTransport({host,port,secure,auth})` + `sendMail({from,to,subject,html,text})`,
      which is unchanged in 9.x — verified structurally without sending mail. We use neither
      `jsonTransport` nor the `raw` option nor OAuth2, so the pre-existing exposure was low; the
      upgrade removes it entirely.
- [x] Each upgrade verified separately (`test:all` + build after every one) so a regression would be
      attributable to a single package. No blanket `npm audit fix --force` was run.
- [x] **Residual-advisory assessment (evidence-based, not dismissal).** Four remain and NONE is
      reachable in this app:
      - `sharp` (libvips CVEs, bundled by Next) — the ONLY user-uploaded image surface is
        `components/ui/Avatar.tsx`, which sets `unoptimized`, so attacker-supplied bytes never reach
        libvips. Badge artwork is first-party static SVG from a fixed catalog. A comment now sits on
        that `unoptimized` prop so nobody removes it without understanding the consequence.
      - `postcss` — build-time processing of FIRST-PARTY CSS only; the advisories need untrusted CSS
        or an attacker-controlled `sourceMappingURL`.
      - `esbuild`, `vite` — dev/test toolchain (drizzle-kit, vitest); never in the production runtime.
      Re-check when Next unpins sharp/postcss.

### 32.2.6 — Open redirect on `?next=` (4 sites)
- **Where:** `lib/auth/actions.ts:867` and `:887`; `lib/auth/two-factor.ts:126-128` and `:155-157`.
  All four guard with `next.startsWith("/")`, which accepts `//evil.example` and `/\evil.example`
  (protocol-relative). `components/feature/auth/TwoFactorVerifyForm.tsx:41` then calls
  `window.location.assign()` on it raw.
- **The fix already exists and is unused here:** `lib/nav/safe-internal-path.ts` rejects `//`,
  backslashes, `://` and CR/LF, and has tests covering exactly these payloads.
- [x] All four checks replaced with `safeInternalPath(...)` — two in `lib/auth/actions.ts`
      (`signIn`: the 2FA-redirect branch and the role-home branch), two in
      `lib/auth/two-factor.ts` (`verifyTotp`, `verifyBackupCode`).
- [x] `lib/nav/safe-internal-path.test.ts` extended with the exact payloads the old guard accepted:
      `//evil.example`, `//evil.example/sebenza-login`, `/\evil.example`, `/\/evil.example`,
      `https://evil.example`, `javascript:alert(1)` and a CR/LF header-splitting string — each must
      fall back to the role home — plus a positive case proving genuine in-app destinations
      (`/employer/vacancies`, `/search?q=chef&invite=1`) still pass. 13/13 green.

---

## 🟡 TASK 32.3 — MEDIUM

- [x] **32.3.1 Unverified orgs can bulk-invite.** ✅ FIXED — `requireEditRole()` in
      `lib/employer/invitations.ts` now calls `verifyOrgVerified()`, matching the sibling
      seeker-invite path. **Open Q2 resolved as leaned:** vacancy CREATION stays permissive
      (`vacancies.ts` keeps its own helper) — drafting before verification is reasonable
      onboarding, and nothing reaches a seeker until an invite is sent. Original finding: `requireEditRole()` (`lib/employer/invitations.ts:642`)
      uses the permissive `verifyEmployer()`; the sibling seeker-invite path correctly uses
      `verifyOrgVerified()` (`lib/employer/seeker-invitations.ts:96,275,322`). The server action is
      weaker than its own UI gate (`app/[locale]/(public)/search/page.tsx:161-183` requires
      `verification === "verified"`). → switch to `verifyOrgVerified()`. Check whether
      `createVacancy` should follow (drafting a vacancy pre-verification may be intentional —
      **Open Q2**).
- [x] **32.3.2 Gov user can enumerate the employer register.** ✅ FIXED — both exact-match sites
      (`employer-lookup.ts`, `oversight-query.ts`) now use `lower(a) = lower(b)`, which removes
      pattern semantics ENTIRELY rather than escaping them (nothing to forget next time); the one
      genuine prefix search (`profile/employment.ts` picker) keeps ILIKE but escapes via
      `escapeLike`. New `tests/integration/gov-lookup-enumeration.test.ts` (4 cases) proves `%`,
      `A%`, `_` etc. resolve nothing while real names still match case-insensitively.
      **Mutation-tested:** restoring the old `ilike` query fails 3 of the 4 cases.
      Original finding: `lib/gov/employer-lookup.ts:121`
      passes raw user input to `ilike()`; submitting `%` (or `A%`, `B%`, …) walks every organisation
      one row at a time, defeating the documented "no partial-match / no leaderboard" guarantee at
      `:108-111`. Same pattern at `lib/gov/oversight-query.ts:111` (which correctly uses `escapeLike`
      30 lines later) and `lib/profile/employment.ts:93` (low impact). → use
      `eq(lower(name), lower(input))` for the exact-match cases and `escapeLike` for the prefix case.
- [x] **32.3.3 `SEBENZA_E2E_HTTP` production kill-switch.** ✅ FIXED — new `lib/env-guard.ts`
      throws at module load (wired into `lib/auth/dal.ts`) when the hatch is set while
      `VERCEL_ENV` is `production` **or `preview`** (a preview is still internet-reachable). The app
      refuses to start rather than starting with admin 2FA silently disabled — a crashing deploy is
      noticed in minutes; a quietly disabled second factor might never be. The error names WHAT was
      weakened, not just the variable. Documented (commented-out) in `.env.example` so it appears in
      any environment audit. `lib/env-guard.test.ts`: 5 cases. Original finding: Setting it to `1` disables the prod admin
      2FA hard-require (`lib/auth/dal.ts:226-232`) and strips `upgrade-insecure-requests`
      (`proxy.ts:95-97`). Protected only by a comment, and absent from `.env.example` so it's
      invisible to an env audit. → throw at module load if it's set while `VERCEL_ENV=production`;
      document it in `.env.example` with a red-flag comment.
- [x] **32.3.4 CSP falls back to a Supabase wildcard.** ✅ FIXED — `proxy.ts` now reads
      `SUPABASE_URL` (the name that actually exists). Two further drift sites found and fixed while
      in there: the admin storage health card (`/admin/integrations`), which read the phantom name
      and therefore reported "Not configured" permanently, and `CLAUDE.md`'s env list, which
      documented the wrong name for future readers. Original finding: `proxy.ts:70-72` reads
      `NEXT_PUBLIC_SUPABASE_URL`, which is **defined nowhere** (`.env.example`, `.env.local` and
      `lib/storage/supabase.ts:38` all use `SUPABASE_URL`), so `connect-src` always lands on
      `https://*.supabase.co` — any Supabase project is a permitted exfil destination. The same typo
      makes the admin storage health card
      (`app/[locale]/(admin)/admin/integrations/page.tsx:66`) permanently read "not configured", and
      `CLAUDE.md:86` documents the wrong name. → read `SUPABASE_URL` in all three places.
- [x] **32.3.5 `/p/{handle}` ignores the searchability pause.** ✅ **Open Q3 RESOLVED — AGAINST my
      stated lean, on evidence.** I read what the pause control actually promises the seeker:
      *"You stay in the system + keep your freshness streak. Employers can't send you new invites;
      **your existing relationships carry on**. Auto-resumes on the date you pick."* Pause means
      "stop NEW discovery", not "go invisible" — a seeker wanting to vanish REVOKES searchability
      (which the by-handle query does honour). 404-ing a direct link would break precisely the
      existing relationships that copy commits to: an employer mid-conversation, a link pasted into
      an application. So: behaviour UNCHANGED, divergence documented in `db/queries/profiles.ts`
      with the quoted copy and a "if the product redefines pause, change the COPY first" note.
      Original finding: `db/queries/profiles.ts:634-646`
      applies only `deletedAt IS NULL` + the suspended-account check, while `searchProfilesQuery`
      (`:265-273`) and the invite path (`lib/employer/invitations.ts:367-380`) both honour
      `paused_until`. A paused seeker vanishes from search but their full dossier stays live at
      `/p/{handle}` and in the 7-day-cached OG card. **Product decision — Open Q3.**
- [x] **32.3.6 Security headers skip `/api`.** ✅ FIXED — `next.config.ts` now sets `nosniff`,
      `X-Frame-Options`, `Referrer-Policy`, HSTS and a `default-src 'none'; sandbox` CSP for
      `/api/:path*`. Done in the config rather than by widening the proxy matcher so the Better Auth
      handler's request handling stays untouched. Original finding: `proxy.ts:141-143` excludes `api` from the matcher, so
      the POPIA data export, the 6 gov CSV exports and the 2 admin exports ship with no `nosniff`,
      no HSTS, no Referrer-Policy. → add a `headers()` entry in `next.config.ts` for `/api/:path*`
      (simpler than widening the matcher).
- [x] **32.3.7 `trustedOrigins` hardcodes localhost in production** ✅ FIXED — localhost entries are
      now dev-only. Original finding: (`lib/auth/server.ts:37`) → gate
      the localhost entries on `NODE_ENV !== "production"`. Also make `BETTER_AUTH_URL` **required**
      in production instead of defaulting to `http://localhost:3000` (`:29`) — that default silently
      produces localhost verification/reset links if the env var is ever missing.
- [x] **32.3.8 Anonymous report flood.** ✅ FIXED — new `report` bucket (5/10min). Anonymous filing
      is preserved deliberately (a seeker reporting a predatory employer must not have to identify
      themselves); signed-in reporters key on user id, anonymous ones on IP — fairer than keying
      everyone by IP when colleagues share a NAT. Original finding: `flagProfile` (`lib/admin/moderation.ts:49-56`) is
      deliberately anonymous (correct) but each call inserts a row **and** notifies every admin, with
      no throttle or dedupe → add an `enforce()` bucket + collapse duplicate open reports per
      (handle, reason).
- [x] **32.3.9 Sign-up email enumeration.** ✅ FIXED — and the investigation changed the design.
      **Open Q4 resolved: do it, and the UX cost is lower than feared** — a duplicate now returns the
      SAME shape as a real sign-up while the genuine owner gets an email ("you already have an
      account, sign in / reset"), so the forgetful honest user still gets guidance, delivered to the
      address only they control.
      **Discovered while implementing (verified by probe against Better Auth 1.6.25):** a duplicate
      `signUpEmail` does NOT throw. It returns a PHANTOM user with a brand-new id, persists nothing,
      and leaves the real account's password and role untouched (both explicitly verified — no
      takeover, no privilege change). Our code then inserted a profile pointing at that non-existent
      user id and failed with a FOREIGN-KEY violation, so the seeker saw a baffling "a required field
      was missing" error AND the response still differed from a real sign-up. The fix therefore
      checks the address BEFORE calling Better Auth rather than pattern-matching an error shape —
      deterministic, and it also removes a real UX bug. The `return e.message` fallthrough (which
      leaked `USER_ALREADY_EXISTS_...`) is gone; unmapped errors log server-side and return a fixed
      string. Original finding: `lib/auth/actions.ts:1070-1072` and the
      `return e.message` fallthrough at `:1085` leak "account already exists", undoing the careful
      anti-enumeration work on the reset/resend paths → return the neutral shape and mail the
      existing owner instead. (Lower priority; note the UX trade in Open Q4.)

---

## ✉️ TASK 32.4 — THE WELCOME EMAIL (founder request)

**Thesis: a nervous, unemployed first-time user currently verifies their email and then hears
nothing. The one moment they are most likely to trust us is the moment we go silent.**

Today the only sign-up email is the Better Auth verification link (`lib/auth/server.ts:78-89`) —
correct and secure, but it explains nothing about the platform.

- [x] **Trigger:** wired to `emailVerification.afterEmailVerification` in `lib/auth/server.ts`, so
      the welcome lands only AFTER the address is proven. Non-fatal by construction (caught at the
      hook AND degrading inside `lib/email/welcome.ts`): losing a welcome note is an annoyance,
      being unable to verify your account is a broken product. Original text:
      (confirmed present in 1.6.11) — send the welcome email there, so it lands **after** the user
      has proven the address, not before. Must be non-fatal: a send failure never breaks
      verification.
- [x] **Role-aware content.** ✅ `lib/email/templates/welcome.ts` — seeker + employer variants on the
      existing `emailShell`, Civic Editorial, no webfont dependency, plain-text derived by
      `sendEmail`. Admin/gov accounts get nothing (issued by Sebenza, nothing to onboard).
      Original text: Seeker and employer need different things. Build on
      `lib/email/templates/shell.ts` (`emailShell` + `escapeHtml`), Civic Editorial, mobile-first,
      no webfont dependency, plain-text fallback (No-Flash discipline applies to email too).
- [x] **Seeker email carries all of it** — what Sebenza is in one honest line; the three actions
      that actually improve outcomes (skills / experience / confirm availability), each deep-linked;
      **the consents they really granted, read LIVE from the `consents` table at send time** (not
      reconstructed from the form payload, which may since have changed) plus the privacy-centre link
      and "withdrawing never weakens your job search"; the honest promises (contact details never in
      search, no ID collected, hires only counted when confirmed); and the anti-phishing line.
      Original spec:
      - what Sebenza is, in one honest line (found by skill + place; never a job board);
      - **the 2–3 next steps that actually improve their outcomes** — add skills, confirm status,
        complete the profile — each a deep link;
      - **a plain-language summary of the consent choices they just made**, and where to change them
        (`/dashboard/privacy`). This is the POPIA §18 transparency moment and the reason this task is
        not merely "nice to have";
      - the honest promises: we never show your ID number or contact details without your consent;
        we don't ask for ID at all right now (Phase 31);
      - a real support contact + the "we will never ask for your password" anti-phishing line.
- [x] **Employer email carries all of it** — verification-gates-contact-details, the 2FA
      requirement, how vacancies/invitations work, and the audit-log transparency line (framed as
      *why candidates are willing to be here*). Original spec: verification-before-contact-reveal expectation, 2FA
      requirement, how vacancies + invitations work, audit-log transparency (every reveal is logged),
      support contact.
- [~] **i18n: DEFERRED, and the reason is a real gap worth fixing separately.** Moving the strings
      into `messages/en.json` now would have been *theatre*: **no user's locale is persisted
      anywhere** (no column on `app_user` or `profiles` — verified), and `afterEmailVerification`
      receives only the user object, no request and no locale. Every email would render English
      regardless of where the strings lived, so the catalog move would create the appearance of
      i18n-readiness with zero behaviour change. All five existing email templates (verification,
      reset, seeker-invite, notifications, employment-verification) are likewise English-only, so
      this is consistent rather than a new exception.
      **FOLLOW-UP (worth a small phase of its own):** persist the user's chosen locale at sign-up,
      then translate ALL transactional email together. This matters on a national SA platform —
      today a seeker who used the whole product in isiZulu still gets an English welcome. The
      standing rule holds when that happens: consent/legal sentences must be human-translated.
- [x] **No new consent, no new tracking** — enforced by test, not just intent:
      `welcome.test.ts` fails the build on a 1x1 beacon, `utm_`/ESP open-tracking URLs, or the words
      subscribe/newsletter/marketing.
- [x] **Tests:** `lib/email/templates/welcome.test.ts` (12 — first-name-only greeting, HTML escaping
      of name AND org name, consents stated in plain words, honest empty-state, privacy-centre link,
      anti-phishing line, the transactional guardrails) + `tests/integration/welcome-email.test.ts`
      (4 — seeker gets consents matching the DB, employer gets the org-named variant, admin gets
      nothing, unknown id sends nothing and does not throw).

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
      **Progress 2026-07-28:** designated — Patricio Cristo Manuel, CEO of Yetotec (Pty) Ltd, holds
      the role (POPIA default for the head of a private body; confirmed directly). Recorded in
      `docs/popia/INFORMATION_OFFICER.md` with name + work address; `/paia` Sections 1–2 and the
      BREACH_RESPONSE rota now name them. Remaining: Regulator eServices registration (required
      BEFORE commercial-scale processing), the DPIA signature block, ideally a Deputy IO, and the
      pen-test.

---

## 📌 STATUS

- [x] **32.1 Critical** ✅ 2026-07-28 (`c06698d` + the report-invite split) — two unauthenticated
      Server Actions closed structurally + the build-failing regression guard, mutation-tested.
      **Verified:** 371 vitest green · production build clean.
- [x] **32.2 High** ✅ 2026-07-28 — ALL SIX SUB-TASKS COMPLETE — sessions on suspend/erase/reset ·
      sign-in disclosure · auth rate limits · dependency upgrades · open redirect
  - [x] **32.2.6** ✅ 2026-07-28 — open redirect closed at all four `?next=` sites.
        **Verified:** 393 vitest green (34 files).
  - [x] **32.2.5** ✅ 2026-07-28 — Next 16.2.12, Better Auth 1.6.25, nodemailer 9.0.3; residual
        advisories assessed as unreachable. **Verified:** 385 vitest green · build clean after each.
  - [x] **32.2.4** ✅ 2026-07-28 — signin / 2fa-verify / email-send / invite buckets wired;
        prior no-limit decision corrected. **Verified:** 385 vitest green · build clean ·
        mutation-tested.
  - [x] **32.2.4b** ✅ 2026-07-28 — **correction, found by the full E2E run:** the first version
        consumed budget on EVERY sign-in, so 20 *correct* sign-ins from one IP inside 10 minutes
        locked the 21st person out — a real availability bug for shared-IP offices, campus labs and
        CGNAT'd SA mobile networks (the serial E2E suite is exactly that shape: one IP, dozens of
        honest sign-ins → cascade of timeouts from `locality.spec` onward). Fixed with a
        `peek`/`enforce` split on the limiter seam: `signIn`, `verifyTotp` and `verifyBackupCode`
        now *peek* the budget up front and *consume only on a rejected credential*, so honest use is
        free while a credential-stuffing or TOTP-guessing run (all failures) burns exactly as fast
        as before. `email-send`, `invite` and `report` still count every call — there the action
        itself is the cost. **Verified:** regression test pins "N successes never throttle" +
        "failures still spend"; 18/18 targeted auth tests green; full E2E re-run.
  - [x] **32.2.3** ✅ 2026-07-28 — password reset + admin 2FA reset revoke sessions.
        **Verified:** 381 vitest green · build clean · mutation-tested.
  - [x] **32.2.2** ✅ 2026-07-28 — sign-in disclosure closed; fails closed on DB error.
        **Verified:** 380 vitest green · build clean · mutation-tested.
  - [x] **32.2.1** ✅ 2026-07-28 — suspension/erasure terminate sessions; DAL fails closed;
        cookieCache 5min→60s. **Verified:** 375 vitest green · build clean · mutation-tested.
- [x] **32.3 Medium** ✅ 2026-07-28 — ALL 9 ITEMS COMPLETE. **Verified:** 405 vitest green (37
      files) · production build clean.
- [x] **32.4 Welcome email** ✅ 2026-07-28 — role-aware, consent-summarising, transactional-only.
      i18n deferred with cause (no locale is persisted; see the task note).

*Plan opened 2026-07-28 against `862a432`. Audit method: four parallel read-only sweeps
(auth/session · authorization coverage of 64 action modules + 33 API routes · injection & data
exposure · dependency scan), every reported finding re-verified against the source before landing
here.*
