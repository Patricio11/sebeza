# DASHBOARD COOKIE CRASH FIX PLAN

*Bug fix surfaced by the founder testing fresh sign-up on production: `/dashboard` renders the "Something went wrong" error boundary (RSC digest `4042959981`).*

> **Root cause (reproduced locally with the exact unredacted error):**
>
> ```
> ⨯ Error: Cookies can only be modified in a Server Action or Route Handler.
> ```
>
> `readAndSetLastSeen()` (`lib/cookies/welcome-back.ts`, Phase 11.1.3) calls `cookies().set()` from inside the `/dashboard` Server Component render. Next.js forbids cookie WRITES during RSC render — reads are fine, writes only in Server Actions / Route Handlers / Middleware. The throw happens on line 50 of the page, before any content renders, so every dashboard-overview load crashes for every signed-in seeker. Latent since Phase 11.1.3 shipped (2026-05-30); unnoticed because subsequent testing focused on /search, sign-up, vacancies, /admin — not the overview.
>
> Diagnosis trail: probed every data call on the page (`loadProfileForUser`, `getCompassForProfile`, `getSeekerActivity`, `rankInPoolQuery`, `listMyBadges`, `freshnessSummary`) as the founder's real account — all pass. Signed in as a seeded seeker on a local dev server and fetched `/dashboard` — dev overlay names the cookie error verbatim.

---

## 🎯 GOAL

`/dashboard` renders for every seeker. The welcome-back card's semantics are preserved exactly: the render reads the PREVIOUS visit timestamp; the refreshed timestamp is written after render so the NEXT visit has its reference point.

---

## 📋 FIX (Option B from the diagnosis — client island + server action)

1. **`lib/cookies/welcome-back.ts`** — `readAndSetLastSeen()` becomes `readLastSeen()`: read-only (cookie reads are legal in RSC), computes `absenceDays` from the existing cookie, NO write.
2. **`lib/cookies/welcome-back-actions.ts`** (new, `"use server"`) — `recordDashboardSeen()` does the `cookies().set()` write, which is legal inside a Server Action.
3. **`components/feature/seeker/DashboardSeenTracker.tsx`** (new, `"use client"`) — renders `null`; `useEffect` on mount fires `recordDashboardSeen()`. Idempotent overwrite, so locale switches / refires are harmless.
4. **`app/[locale]/(seeker)/dashboard/page.tsx`** — swap the call to `readLastSeen()` + mount `<DashboardSeenTracker />`.

### Options considered and rejected

- **Wrap `jar.set` in try/catch** — unbreaks the page but the cookie would NEVER be written from RSC, so the welcome-back card would never fire again. Silent feature death.
- **Set the cookie in `proxy.ts` middleware** — middleware cookie writes propagate to the downstream RSC read in the same request, so the page would read the JUST-written timestamp instead of the previous visit's, breaking the absence computation. Working around it needs a forwarded header — more moving parts than the island.

### Degradation

JS-disabled browsers never update the cookie → welcome-back card never shows for them. Acceptable: the card is a nicety, and the rest of the dashboard is server-rendered as before.

---

## 🧪 HOW TO VERIFY

1. Local dev server, signed in as a seeker: `GET /dashboard` returns the dashboard (no "Something went wrong"), zero `Cookies can only be modified` in the server log.
2. The response of the follow-up `recordDashboardSeen` action call carries the `sebenza_dash_last_seen` Set-Cookie.
3. Typecheck + vitest green.
4. Production: after deploy, founder retries the same flow (sign-in → Dashboard) — page renders.

---

*Fix-sized plan; no schema, no audit kinds, no flags. Verified `lib/cookies/welcome-back.ts` is the ONLY `cookies()` call site in the codebase — no other surface carries the same hazard.*
