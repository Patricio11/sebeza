# Phase 3 — The Talent Profile · 📋 PLAN (opened 2026-05-22)

> Active plans live at the top of `docs/`. When this phase ships, this file moves to `docs/completed/PHASE_3_PLAN.md` and `docs/completed/PHASE_3_COMPLETE.md` is written. Convention pinned in `docs/TO_START_EVERY_SESSION.md`.

**Goal:** Replace the mock-driven profile editor with real Server Action CRUD over the Phase 2 database. Add **Supabase Storage** uploads for CV / certificates / profile photo. Stand up the **time-aware employment-status engine** that is Sebenza's differentiator over the incumbent registry.

**Rule of the seed (still in force):** The mock profiles from `lib/mock/*` are the starting database — Andile, Thandeka, Lerato et al. Their profiles already exist after Phase 2's seed. Phase 3 doesn't reinvent users, it gives them the ability to edit themselves.

---

## Re-checks (decide before kickoff)

### Re-check #1 — Supabase Storage, not Cloudflare R2 ✅ LOCKED (Phase 1.5)
The Phase 1.5 vendor pass already swapped R2 → Supabase Storage. Schema column is `qualifications.document_storage_key` (vendor-neutral name). Phase 3 wires the upload + signed-URL path.

- **One Supabase project**, two private buckets: `documents` (CV + certs) and `photos` (profile pictures).
- Server-side **service-role key** in `lib/storage/supabase.ts` — never shipped to client.
- All reads return **signed URLs** with short TTL (60s for downloads, 5min for image renders).
- File path convention: `documents/{userId}/{qualificationId}.{ext}`, `photos/{userId}.{ext}`.

### Re-check #2 — Profile editor: one big form or 4 surfaces?
Phase 1.5 already split the editor into `/dashboard/profile` (identity + professional + skills + location + headline + bio), `/dashboard/experience` (CRUD list), `/dashboard/qualifications` (uploads), and a Studies block on `/dashboard/profile` (only when `academic` exists).

**Decision:** keep the four surfaces. Each one gets its own Server Action. Optimistic UI via React 19 `useOptimistic` where the round-trip is cheap (toggles, deletes); plain action with revalidation everywhere else.

### Re-check #3 — National ID — display / edit policy
The ID is encrypted on save (`encryptField`) and is **never echoed back**. The profile editor shows:
- A masked badge: "ID number on file · encrypted" (no last-4 hint either — too easy to brute the front-9 from public info)
- A "Change ID number" affordance that reveals a single field (current never displayed; new value validated for SA ID checksum)
- Removing the ID is allowed but warned ("Verification cannot proceed without an ID on file")

### Re-check #4 — Status engine: where does the nudge logic live?
- `lib/status.ts` — pure functions: `freshnessBand(confirmedAt)` returns `fresh | ageing | stale`; `confidenceWeight(band)` returns 1.0 / 0.7 / 0.4 for search ranking.
- `profiles.statusConfirmedAt` already exists.
- **Re-confirm action** (`reconfirmStatus`) flips `statusConfirmedAt = now()` and writes an audit-log entry.
- **Nudge cron** — Phase 8 wires the actual scheduled job (Vercel Cron Route Handler + Resend). Phase 3 ships the pure logic + the dashboard banner that prompts re-confirmation when the band tips.

### Re-check #5 — Skills picker: controlled vocab only
`SKILLS` taxonomy (15 entries seeded in Phase 1.5; 100+ in Phase 7). Server Action validates every skill slug against `schema.skills`. No free-text — keeps search clean.

### Re-check #6 — Uploads: virus scan?
- Phase 3 ships **content-type allow-list** + **size limit** (5MB photos, 10MB documents) + **magic-byte sniff** (don't trust `Content-Type`).
- Server-side **rate-limit per user** (5 uploads / 10 min) via in-memory map for now; Upstash in Phase 9.
- **Virus scan** (ClamAV via lambda, or Supabase edge fn) — Phase 8 task 8.3, alongside the email comms hardening.

### Re-check #7 — Documentation convention (unchanged)
Same pattern as Phase 2:
1. Write `docs/completed/PHASE_3_COMPLETE.md` when shipped
2. Tick Phase 3 in `ROADMAP.md` ✅ + date
3. Update Current State block in `TO_START_EVERY_SESSION.md`
4. Open `docs/PHASE_4_PLAN.md` (Postgres FTS + ranking SQL + real `dbProvider`)
5. Move `PHASE_3_PLAN.md` to `docs/completed/`
6. Commit with `Phase 3 complete + Phase 4 opens` in the message

---

## Implementation plan

### 1. Supabase Storage wire-up (~60 min)
- `npm i @supabase/supabase-js`
- `.env.example` — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTOS_BUCKET=photos`, `SUPABASE_DOCUMENTS_BUCKET=documents`
- `lib/storage/supabase.ts` — service-role client (server-only)
- `lib/storage/upload.ts` — typed `uploadDocument` / `uploadPhoto` (validates content-type + size + magic bytes; returns the storage key)
- `lib/storage/signed.ts` — `signedDocumentUrl(key, ttlSec)` / `signedPhotoUrl(key, ttlSec)`
- Manual test: a 5MB photo upload via the editor lands in Supabase; the signed URL renders on `/dashboard/profile`

### 2. Profile CRUD Server Actions (~90 min)
- `lib/profile/actions.ts`:
  - `updateIdentity({ city, province, nationality, bio })` — Zod-validated; updates `profiles` row of the signed-in user
  - `updateProfessional({ profession, seniority, headline })` — same
  - `updateSkills({ skills: Array<{ slug, proficiency }> })` — replaces the profile_skills set in a transaction
  - `updatePhoto({ key })` — sets `profiles.profile_photo_url` to the storage key returned from upload
  - `changeNationalId(newIdNumber)` — validates SA ID checksum, re-encrypts, writes audit row
  - `reconfirmStatus()` — sets `statusConfirmedAt = now()`, audit row
  - `setStatus(status)` — both updates `status` and `statusConfirmedAt`
- Wire each editor form on `/dashboard/profile` to the corresponding action via React 19 `<form action={…}>`

### 3. Experience CRUD (~45 min)
- `lib/profile/experience.ts` — `addExperience`, `updateExperience`, `deleteExperience` Server Actions
- `/dashboard/experience` — wire the existing list rows + the modal "+ Add experience" form

### 4. Qualifications + uploads (~60 min)
- `lib/profile/qualifications.ts`:
  - `addQualification({ title, institution, awardedYear })` — creates the row in `unverified` state
  - `uploadQualificationDocument({ qualificationId, file })` — calls `uploadDocument`; updates `qualifications.document_storage_key`
  - `deleteQualification(id)` — soft-delete; cascades the storage key cleanup in Phase 8 cron
- `/dashboard/qualifications` — wire the upload affordance with a progress indicator (file → multipart Server Action)

### 5. Status engine + dashboard nudge (~45 min)
- `lib/status.ts` — `freshnessBand` + `confidenceWeight` + `daysSince(confirmedAt)`
- `/dashboard` overview — replace the static "Talent Pulse confirm" widget with a real, band-aware nudge banner reading from the live `profiles.statusConfirmedAt`
- "Re-confirm now" button → `reconfirmStatus` action
- Unit tests live in Phase 11; for now, a smoke test in `db/seed.ts` confirms the band math

### 6. Photo uploads on the profile editor (~30 min)
- `<AvatarEditor />` client island — drag-drop or pick; client-side compression (canvas to 512×512); upload through Server Action
- Falls back to deterministic initials (`Avatar` already supports this from Phase 1.5)

### 7. Verification + commit (~30 min)
- `npm run typecheck && npm run build` clean
- Manual test: Andile signs in → uploads a profile photo → photo renders on `/dashboard` and `/p/andile-z`
- Manual test: Thandeka adds an experience → it appears on `/p/thandeka-m`
- Manual test: re-confirm status on a stale profile → band flips back to `fresh`
- Manual test: upload a CV → admin sees it on `/admin/verifications` (already wired to read `qualifications.document_storage_key` from Phase 1.5)
- Write `docs/completed/PHASE_3_COMPLETE.md`
- Tick Phase 3 in `ROADMAP.md`
- Update Current State in `TO_START_EVERY_SESSION.md`
- Open `docs/PHASE_4_PLAN.md`
- Move `PHASE_3_PLAN.md` → `docs/completed/PHASE_3_PLAN.md`
- Commit with `Phase 3 complete + Phase 4 opens`

---

## Acceptance criteria (Phase 3 is DONE when every box ticks)

- [ ] Andile signs in → uploads a profile photo → image renders on `/dashboard` and on his public profile `/p/andile-z`
- [ ] Thandeka adds a new experience row → it shows up on `/p/thandeka-m` in chronological order
- [ ] Lerato uploads a certificate PDF → file lives in Supabase `documents` bucket; the qualification row has `document_storage_key` set; admin verification queue shows it
- [ ] National ID can be changed via "Change ID number" — old value never displayed, new value validated against SA ID checksum, re-encrypted
- [ ] Editing skills replaces the `profile_skills` set in one transaction (no orphan rows)
- [ ] Re-confirming status updates `statusConfirmedAt = now()` and writes an `audit_log` row
- [ ] Status freshness band flips correctly: 0–30d `fresh`, 30–90d `ageing`, ≥90d `stale` (unit-tested in Phase 11)
- [ ] Stale profiles show a prominent re-confirm banner on `/dashboard`
- [ ] Photo upload rejects > 5MB or non-image content-type
- [ ] Document upload rejects > 10MB or non-PDF/PNG/JPEG
- [ ] Signed URLs are short-TTL (≤ 5 min) and not cached client-side
- [ ] Every PII-touching Server Action calls `logAccess()`
- [ ] `npm run typecheck && npm run build` clean

---

## Out of scope for Phase 3 (don't blur the line)

- **Postgres FTS + ranking + the real `dbProvider`** — Phase 4
- **Employer reveal flow (contact + document access)** — Phase 5
- **Skills-gap engine** — Phase 6
- **2FA enforcement** — Phase 7
- **Virus scanning on upload** — Phase 8 (content-type + magic-byte sniff is enough for Phase 3)
- **Cron-driven status nudge emails** — Phase 8 (Phase 3 ships the in-dashboard banner only)
- **Rate limiting via Upstash** — Phase 9 (in-memory limiter is fine for Phase 3)

---

## Risks to flag at kickoff

- **Supabase service-role key leaks via `'use server'` mistakes.** Everything storage-related goes through `lib/storage/*.ts` files marked `"server-only"` so a stray client import errors at build time.
- **Multipart Server Actions** — React 19 supports multipart form submissions to Server Actions; verify the file streams as `File` (Web API) not a path string. Test on Edge before assuming.
- **SA ID checksum** — Luhn-like check; document the algo in `lib/id-number.ts` and reference SA Home Affairs spec.
- **Old document keys orphaned** when a qualification is replaced — needs a cleanup cron in Phase 8 (don't delete inline on replace; could break a live signed URL).
- **Image compression on client** — `canvas.toBlob` can be quirky on low-end Android. Test on a 360 px device profile per the No-Flash Rule.
- **Public profile photo cache** — signed URLs change every 5 min, which breaks browser caching. Either use longer TTL for the public profile photo (it's not PII) or proxy via a server-side image route that mints a fresh signed URL.

---

*When this ships: write `docs/completed/PHASE_3_COMPLETE.md` and open `docs/PHASE_4_PLAN.md` (Postgres FTS + ranking + real `dbProvider`).*
