# Phase 2 — Live Sign-In Smoke Test

> Run this after `npm run db:migrate && npm run db:seed` have completed against your real Neon database. Every box ticked = Phase 2 is verifiably done end-to-end and we can commit.

---

## 0 · Start the dev server

```bash
npm run dev
```

Then open `http://localhost:3000` in a browser.

---

## 1 · Sign-in routes by role (the headline check)

The seed password is `sebenza-dev-2026` for **every** seeded account. The `/sign-in` page has **no role chip** — credentials identify the user; the server routes by `app_user.role`.

Visit `http://localhost:3000/sign-in` and try each account in turn:

| # | Account | Email | Password | Should land on | ✅ |
|---|---|---|---|---|---|
| 1 | Admin | `admin@sebenza.co.za` | `sebenza-dev-2026` | `/admin` | ☐ |
| 2 | Employer · Discovery Bank owner | `naledi.khumalo@discovery.co.za` | `sebenza-dev-2026` | `/employer` | ☐ |
| 3 | Seeker · Andile | `andile-z@example.co.za` | `sebenza-dev-2026` | `/dashboard` | ☐ |
| 4 | Seeker · Thandeka | `thandeka-m@example.co.za` | `sebenza-dev-2026` | `/dashboard` | ☐ |
| 5 | Seeker · Kabelo | `kabelo-m@example.co.za` | `sebenza-dev-2026` | `/dashboard` | ☐ |

Between accounts, sign out via the account-page button (top-right user menu → Account → Sign out) so each test starts clean.

---

## 2 · Proxy guards (unauthenticated bounce)

While signed out, open each URL — every one should redirect to `/sign-in?next=<original-path>` (URL-encoded):

| URL | Expected redirect | ✅ |
|---|---|---|
| `http://localhost:3000/dashboard` | `/sign-in?next=%2Fdashboard` | ☐ |
| `http://localhost:3000/dashboard/privacy` | `/sign-in?next=%2Fdashboard%2Fprivacy` | ☐ |
| `http://localhost:3000/employer` | `/sign-in?next=%2Femployer` | ☐ |
| `http://localhost:3000/admin` | `/sign-in?next=%2Fadmin` | ☐ |
| `http://localhost:3000/en/admin/audit-log` | `/sign-in?next=%2Fen%2Fadmin%2Faudit-log` | ☐ |

The proxy strips the locale prefix when deciding whether to guard, so locale-prefixed URLs work the same as non-prefixed ones.

---

## 3 · Consent persistence + audit-log write

1. Sign in as **Andile** (`andile-z@example.co.za`)
2. Visit `http://localhost:3000/dashboard/privacy`
3. Toggle the `Contact reveal` consent **off** → should flip to *Revoked*
4. Toggle it back **on** → should flip to *Granted* with today's timestamp
5. Sign out, sign in as **Admin** (`admin@sebenza.co.za`)
6. Visit `http://localhost:3000/admin/audit-log`
7. You should see two new rows at the top:
   - `consent.revoke` actor=Andile's user id
   - `consent.grant`  actor=Andile's user id

✅ Boxes:
- ☐ Toggle visually flips and persists across reload
- ☐ Both `consent.revoke` and `consent.grant` rows visible on `/admin/audit-log`
- ☐ Admin overview `/admin` KPI "Audit events 24h" shows the bumped count

---

## 4 · Email transport — verification email lands in Mailtrap

1. Sign out
2. Visit `http://localhost:3000/sign-up` → choose **Job seeker**
3. Fill the 3-step form with a throwaway email (e.g. `smoketest@example.co.za`) + password `smoketest-9999`
4. Submit step 3 — should redirect to `/verify-email?email=smoketest@example.co.za`
5. Open Mailtrap → your sandbox inbox should have a branded **"Verify your email — Sebenza"** email (SA flag stripe header, Fraunces "One tap to confirm…")
6. Click the verify link in the email → should land on `/dashboard` (auto-sign-in after verification)

✅ Boxes:
- ☐ Sign-up form completes without error
- ☐ Email arrives in Mailtrap with branded template
- ☐ Verification link signs the user in and routes to `/dashboard`
- ☐ `app_user.email_verified = true` after click (verify in `npm run db:studio` or psql)

---

## 5 · Forgot password — anti-enumeration + branded email

1. Sign out
2. Visit `http://localhost:3000/forgot-password`
3. Enter **a real seeded email** (e.g. `andile-z@example.co.za`) → submit
4. Should see "Check your inbox" success state
5. Mailtrap → branded **"Reset your Sebenza password"** email arrives
6. Click the reset link → lands on `/reset-password?token=…`
7. Enter a new password (`new-password-9999`) twice → submit
8. Should land on `/sign-in`
9. Sign in with the new password → lands on `/dashboard`

Anti-enumeration check:
10. On `/forgot-password`, enter `nobody@nowhere.example` → should show the **same** "Check your inbox" message (NO error revealing the email doesn't exist)

✅ Boxes:
- ☐ Reset email arrives for real users
- ☐ Reset link works once
- ☐ New password signs in successfully
- ☐ "Check your inbox" message is identical for real and fake emails (no enumeration leak)

---

## 6 · Employer org-verified gate

1. Sign in as **Naledi** (`naledi.khumalo@discovery.co.za`)
2. Land on `/employer`
3. Check the orange unverified banner appears at the top *(Discovery Bank seed status is `verified` — if the banner shows, the seed needs updating; if not, the gate is correctly off)*
4. Visit `/employer/team` → should render the team page with Naledi as Owner
5. Sign out

✅ Boxes:
- ☐ Naledi lands on `/employer`, NOT `/dashboard` (role routing works for employer)
- ☐ Employer pages render with the gold accent strip
- ☐ Team page loads (organization_members FK works end-to-end)

---

## 7 · Admin surfaces

1. Sign in as **Admin**
2. Land on `/admin`
3. Visit each tab — every page should render with no DB errors:
   - `/admin/verifications`
   - `/admin/moderation`
   - `/admin/taxonomy`
   - `/admin/audit-log` ← contains your earlier consent toggle entries from §3
   - `/admin/users`
   - `/admin/settings`

✅ Boxes:
- ☐ Every admin page loads
- ☐ Audit-log page reads from DB (not just ring buffer)
- ☐ "2FA required" eyebrow visible on every admin page (Phase 7 will enforce; Phase 2 just shows the notice)

---

## 8 · Sanity tail (1 minute)

- ☐ `npm run typecheck` clean (`npx tsc --noEmit`)
- ☐ `npm run build` clean
- ☐ `next start` (after build) — every smoke-test path above still works on the production build
- ☐ Open the page on a mobile-sized window (360 px); confirm no horizontal scroll on `/dashboard/privacy` or `/admin/audit-log`

---

## When every box is ticked

Tell Claude: **"All smoke tests pass."** I will then:

1. Update `docs/completed/PHASE_2_COMPLETE.md` §4 to mark live DB smoke as ✅ verified
2. Commit with `Phase 2 complete + Phase 3 opens` per the doc convention
3. Move this file to `docs/completed/PHASE_2_SMOKE_TEST.md` as the test record

---

## If something fails

Common gotchas:

- **`DATABASE_URL not loaded` from `db:seed` or `db:migrate`** — both scripts load `.env.local` explicitly now (see `drizzle.config.ts` + `db/seed.ts`). If you still hit this, check the file is at the project root and the `DATABASE_URL` line is uncommented.
- **Sign-in returns "Email or password is incorrect" for a seeded account** — Better Auth requires `email_verified = true` to sign in. The seed sets every seeded account verified, but if you re-ran migrate without re-running seed (or vice versa) you may be out of sync. Re-run `npm run db:seed` to start clean.
- **Verification email doesn't arrive in Mailtrap** — confirm `EMAIL_TRANSPORT=mailtrap` in `.env.local` and that `MAILTRAP_USER` + `MAILTRAP_PASS` are set. The fallback when those are blank is the `console` transport — emails would log to your terminal instead.
- **`/dashboard` doesn't redirect when signed out** — confirm `proxy.ts` is at the project root (Next.js Edge middleware location); restart `npm run dev` if you just edited it.
- **Locale URL (`/en/dashboard`) skips the guard** — the proxy's regex `/^\/(?:en|zu|xh|af)(?=\/|$)/` strips the locale before matching. If a locale you've added isn't in that list, add it.
- **Consent toggle errors in the browser console** — check the browser network tab for the Server Action call; the action returns `{ ok: false, message }` on failure (e.g. "Not signed in" if the session cookie expired).
