# Phase 3 — The Talent Profile · ✅ COMPLETE

**Shipped:** 2026-05-22

> Phase 3 replaced the mock-driven `/dashboard/profile`, `/dashboard/experience` and `/dashboard/qualifications` with real Server Action CRUD over the Phase 2 database, added the time-aware employment-status engine that is Sebenza's differentiator, and stood up Supabase Storage for CV / certificate / profile-photo uploads. Every PII-touching action audit-logs. National IDs encrypted on save and never echoed back — POPIA-First Rule held.

---

## 1 · What shipped

### Status engine (the differentiator)
- [`lib/status.ts`](../../lib/status.ts) — canonical implementation:
  - `freshnessBand(at)` → `fresh | ageing | stale` with the documented day windows (<30 / <90 / ≥90)
  - `freshnessConfidence(band)` → 1.0 / 0.6 / 0.25 for ranking weighting
  - `daysSince(at)` and `freshnessSummary(at)` (band + days + `nudge` + `urgent` flags)
- `lib/mock/helpers.ts` now re-exports from `lib/status.ts` so the Phase 4 ranking SQL and the mock provider share one source of truth
- Bands drive: dashboard nudge banner emphasis, the live "Talent Pulse" pulse-question copy, and (in Phase 4) the search-ranking SQL

### Profile read path
- [`lib/profile/me.ts`](../../lib/profile/me.ts) — `getMyProfile()` reads the signed-in user's profile + skills + experience + qualifications + (optional) academic from the DB in parallel; shaped as `PublicProfile` with two extras (`profileId`, `hasNationalId`)
- Every dashboard page now uses this instead of the `MOCK_HANDLE = "andile-z"` hardcode

### Server Actions
- [`lib/profile/actions.ts`](../../lib/profile/actions.ts)
  - `updateProfileBasics` — identity + location + professional + bio in one save; recomputes `completeness` against live counts
  - `updateSkills` — replaces the `profile_skills` set in a single transaction; controlled-vocab enforced
  - `setStatus` — updates status AND `statusConfirmedAt = now()`
  - `reconfirmStatus` — touches only `statusConfirmedAt`
  - `changeNationalId` — SA Luhn-validated, `encryptField()`'d, never echoed back
  - `removeNationalId` — soft remove; verification flows pause without one
- [`lib/profile/experience.ts`](../../lib/profile/experience.ts) — `addExperience` / `updateExperience` / `deleteExperience`; date-order validation; ownership-scoped
- [`lib/profile/qualifications.ts`](../../lib/profile/qualifications.ts) — `addQualification` / `uploadQualificationDocument` / `deleteQualification`; documents land in Supabase Storage with the storage key on the row; document upload flips state `unverified → pending`
- [`lib/profile/photo.ts`](../../lib/profile/photo.ts) — `uploadProfilePhoto` / `removeProfilePhoto`; previous photo cleaned up best-effort
- [`lib/id-number.ts`](../../lib/id-number.ts) — SA ID Luhn checksum + light date sanity + digits-only normaliser

### Supabase Storage layer (server-only)
- [`lib/storage/supabase.ts`](../../lib/storage/supabase.ts) — service-role client, marked `"server-only"` so a stray client import errors at build time; bucket name + TTL constants
- [`lib/storage/upload.ts`](../../lib/storage/upload.ts)
  - Content-type allow-list + size limit (PDF/JPEG/PNG up to 10 MB for docs; JPEG/PNG/WebP up to 5 MB for photos)
  - **Magic-byte sniffing** — we don't trust the browser's `Content-Type`; the claimed MIME must match the sniffed signature
  - Per-user **rate limit** (5 uploads / 10 min) via in-memory map; Upstash replaces this in Phase 9
  - Path convention: `{userId}/{documents|photos}/{id}.{ext}`
- [`lib/storage/signed.ts`](../../lib/storage/signed.ts) — `signedDocumentUrl(key)` (60 s TTL) and `signedPhotoUrl(key)` (5 min TTL)

### Client islands (`components/feature/profile/`)
- `StatusCard.tsx` — Talent Pulse with status picker + "Yes still …" re-confirm; replaces the previously-static card on `/dashboard`
- `StatusNudgeBanner.tsx` — top-of-dashboard banner; only renders when band ≠ fresh; soft (yellow) when ageing, urgent (red) when stale
- `ProfileBasicsForm.tsx` — display name + nationality + location + profession + seniority + bio; React 19 form action; inline success/error
- `SkillsEditor.tsx` — controlled-vocab picker via portaled `CustomSelect`, 1–5 proficiency dots, replace-on-save
- `NationalIdControls.tsx` — view (encrypted-on-file badge) / change (with SA ID checksum validation) / confirm-remove flows
- `ExperienceManager.tsx` — inline add / edit / delete; "current role" toggle; client-side date-order validation
- `QualificationsManager.tsx` — list + add (creates row) + per-row "Upload document" file picker + delete
- `AvatarEditor.tsx` — file picker with **client-side resize to 512 px** via canvas + JPEG re-encode at 0.85; multipart FormData → `uploadProfilePhoto`

### Pages wired
- `/dashboard` — real session, real status engine, banner + live StatusCard
- `/dashboard/profile` — six live sections: Photo / Identity / Location / Professional / Skills / National ID + (read-only for now) Studies block
- `/dashboard/experience` — fully working CRUD with inline form
- `/dashboard/qualifications` — fully working CRUD + per-row document upload to Supabase

### Audit log
Expanded `AuditKind` with 14 new event kinds: `profile.update`, `profile.skills.update`, `profile.status.update`, `profile.status.reconfirm`, `profile.national_id.update`, `profile.national_id.remove`, `profile.experience.{add,update,delete}`, `profile.qualification.{add,delete,document.upload}`, `profile.photo.{upload,remove}`. Every Server Action writes one.

### `.env.local` additions (already documented in `.env.example`)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=    # NOT the anon key — must bypass RLS
SUPABASE_STORAGE_BUCKET=sebenza-private
```

---

## 2 · Re-checks honoured (from `docs/completed/PHASE_3_PLAN.md`)

| # | Decision | Outcome |
|---|---|---|
| 1 | Supabase Storage (not R2); private bucket; service-role server-only | ✅ `lib/storage/*` marked `"server-only"` |
| 2 | Keep four editor surfaces (profile / experience / qualifications / studies) | ✅ Each has its own action; studies stays read-only until SAQA wires in Phase 8 |
| 3 | National ID display rule: "encrypted on file", change with Luhn, no echo back | ✅ `NationalIdControls` shows status only; new value validated + encrypted; old value never read back |
| 4 | Status engine lives in `lib/status.ts`; reconfirm via Server Action; nudge cron deferred to Phase 8 | ✅ Pure functions + dashboard banner shipped; cron is Phase 8 |
| 5 | Skills picker: controlled vocab only | ✅ Slugs validated against `SKILLS` taxonomy on both client and server |
| 6 | Uploads: content-type + size limits + magic-byte sniff + in-memory rate limit; virus scan in Phase 8 | ✅ All four enforced; ClamAV/virus scan still Phase 8 |
| 7 | Doc convention | ✅ This file + smoke test + Phase 4 plan + ROADMAP tick + Current State update + commit |

---

## 3 · Smoke-test status

- **Typecheck:** ✅ clean (`npx tsc --noEmit`)
- **Build:** ✅ clean — every dashboard route that reads session correctly marks dynamic (ƒ); static SSG holds for the routes that haven't been migrated yet (`/dashboard/account`, `/dashboard/activity`, `/dashboard/grow` — Phase 4 will swap those when `dataProvider` becomes DB-backed)
- **Live DB smoke:** see `docs/completed/PHASE_3_SMOKE_TEST.md`

---

## 3.5 · Security audit shipped alongside Phase 3

A thorough security pass landed with this phase after the user flagged a sign-in regression. Full architecture documented in `docs/SECURITY.md`.

### What was wrong before the audit

- **17 of 22 protected pages had no session guard.** Anonymous users could browse the admin queue, audit log, employer team page, etc. — the Edge proxy was the only gate, and Better Auth's own docs warn that `getSessionCookie` is NOT a security boundary.
- **Sign-in was silently broken** for any clean browser session. `auth.api.signInEmail()` called from a Server Action returns success but Better Auth's Set-Cookie header is dropped unless the `nextCookies()` plugin bridges it into Next.js's `cookies()` API. Phase 2 only seemed to work because of stale cookies left over from earlier dev testing.
- **Custom `cookiePrefix: "sebenza"`** in `lib/auth/server.ts` drifted from the proxy's `getSessionCookie(request)` call (which defaulted to `"better-auth"`). Every authenticated user was bounced back to /sign-in by the proxy's optimistic redirect.

### What's true now (three-layer model per Next.js + Better Auth docs)

| Layer | Where | What it does | Security boundary? |
|---|---|---|---|
| 1 — Edge proxy | `proxy.ts` | Optimistic cookie-presence redirect (UX speedup) | **No** |
| 2 — DAL guards | `lib/auth/dal.ts` called from every protected page | Authoritative `auth.api.getSession({ headers })` validation | **Yes** |
| 3 — Server Actions | Every action in `lib/profile/*`, `lib/auth/actions.ts` | Per-action `getSessionUser()` check + ownership scoping | **Yes** |

### Concrete changes

- **NEW [lib/auth/dal.ts](../../lib/auth/dal.ts)** — `verifySession` / `verifyRole(role)` / `verifyAdmin` / `verifyOrgVerified` / `verifyEmployer`. `getSessionUser` wrapped in React's `cache()` for per-render memoisation. Rethrows Next.js's `DynamicServerError` / `NEXT_REDIRECT` control-flow signals (the previous catch swallowed them, breaking static prerender heuristics).
- **`lib/auth/guard.ts`** → thin back-compat shim re-exporting from the DAL.
- **All 22 protected pages now call a guard** as the first awaited expression after `setRequestLocale`. 100% coverage (was 23%). Every protected route correctly marks as dynamic (ƒ) in the build output.
- **[proxy.ts](../../proxy.ts)** — kept the optimistic Edge check (UX win for unauth bounces) but doc-clarified that it is NOT a security boundary. Uses Better Auth defaults (no `cookiePrefix`) to eliminate the drift class of bugs.
- **NEW [docs/SECURITY.md](../SECURITY.md)** — full playbook covering the three layers, audit-log conventions, storage rules, encryption notes, and a phase-mapped list of intentional gaps.

### The `nextCookies()` plugin fix

The actual sign-in regression turned out to be a missing Better Auth plugin. Quoting the [Better Auth Next.js docs](https://www.better-auth.com/docs/integrations/next):

> "When you call a function that needs to set cookies, like signInEmail or signUpEmail in a server action, cookies won't be set. This is because server actions need to use the cookies helper from Next.js to set cookies."

Added `plugins: [nextCookies()]` to `lib/auth/server.ts` (must be last in array per docs). One-line change, fixed sign-in / sign-up / sign-out / password reset all at once. User verified end-to-end sign-in works against the live Neon DB after the fix.

---

## 4 · What Phase 3 deliberately deferred

- **Public profile reads from DB** (`/p/[handle]`, `/search`) — Phase 4; today these still go through the mock provider so the public surface looks unchanged
- **Postgres FTS + ranking SQL + real `dbProvider`** — Phase 4
- **Cron-driven re-confirm email nudges** — Phase 8 (Phase 3 ships the in-dashboard banner only)
- **Studies (academic) editing actions + SAQA verification** — Phase 8
- **Virus scanning on upload** — Phase 8 (Phase 3 ships content-type + magic-byte sniff)
- **Rate limiting via Upstash** — Phase 9 (in-memory limiter holds for now)
- **Employer reveal flow (post-consent contact + document access)** — Phase 5

---

## 5 · Files added / changed (high-level)

```
NEW  lib/status.ts                                       (canonical freshness engine)
NEW  lib/id-number.ts                                    (SA ID Luhn validator)
NEW  lib/profile/me.ts                                   (getMyProfile DB reader)
NEW  lib/profile/actions.ts                              (profile/status/skills/ID actions)
NEW  lib/profile/experience.ts                           (experience CRUD actions)
NEW  lib/profile/qualifications.ts                       (qualification + document actions)
NEW  lib/profile/photo.ts                                (avatar actions)
NEW  lib/storage/supabase.ts                             (server-only Supabase client)
NEW  lib/storage/upload.ts                               (validated uploaders + rate limit)
NEW  lib/storage/signed.ts                               (signed-URL helpers)

NEW  components/feature/profile/StatusCard.tsx
NEW  components/feature/profile/StatusNudgeBanner.tsx
NEW  components/feature/profile/ProfileBasicsForm.tsx
NEW  components/feature/profile/SkillsEditor.tsx
NEW  components/feature/profile/NationalIdControls.tsx
NEW  components/feature/profile/ExperienceManager.tsx
NEW  components/feature/profile/QualificationsManager.tsx
NEW  components/feature/profile/AvatarEditor.tsx

MOD  app/[locale]/(seeker)/dashboard/page.tsx            (real session + StatusCard + nudge)
MOD  app/[locale]/(seeker)/dashboard/profile/page.tsx    (live editors mounted)
MOD  app/[locale]/(seeker)/dashboard/experience/page.tsx (ExperienceManager)
MOD  app/[locale]/(seeker)/dashboard/qualifications/page.tsx (QualificationsManager)
MOD  lib/audit/index.ts                                  (14 new event kinds)
MOD  lib/mock/helpers.ts                                 (re-export status engine)
MOD  package.json                                        (+@supabase/supabase-js)
```

---

## 6 · Risks + carry-forward

- **Live smoke needs the user to upload a real photo + a real PDF cert** end-to-end to confirm the Supabase bucket name + service-role key are correctly set
- **Public profile photo display** still pending — `/p/[handle]` reads via the mock dataProvider until Phase 4 swaps to DB
- **Photo orphans** can accumulate if a user uploads many photos in sequence (we clean up best-effort, but failures don't block). Phase 8 cron sweeps the bucket.
- **In-memory rate limit** resets on every server restart and doesn't cluster — fine for staging, Upstash replaces this in Phase 9
- **Studies / academic editing** sits as a read-only block on the editor; the schema columns are all there for the editor to wire when SAQA verification lands in Phase 8
