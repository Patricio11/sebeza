# PHASE 15 COMPLETE — Work-Readiness Content (2026-06-13)

**Status:** ✅ shipped. Plan: `docs/completed/PHASE_15_PLAN.md`.
**One line:** added the **"get ready for the work," not just "find the work"** layer — readiness articles, a
profile→CV generator, and contextual surfacing — entirely on infrastructure that already existed.

Built off the SAYouth competitive analysis (`docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §5.2): SAYouth wraps
matching in support (CV templates, interview prep); Sebenza had the spine (Career Compass + Learning Loop +
Student lane) but not the readiness layer. Phase 15 adds it — and because every piece reuses an existing
surface (the help-centre, the print route, the profile data, the dashboard cards), it slotted in rather than
bolting on.

---

## What shipped

### 15.1 — "Get work-ready" article collection (reused the Phase-10 help-centre architecture)
- New `work_ready` seeker help category (`content/help/types.ts`) — placed after `growth`, auto-renders in
  the help index + search + breadcrumbs (both iterate the constants/registry; **zero page changes**).
- **6 hand-written articles** (`content/help/seeker/work-ready/`), plain-language, SA-context, each ending
  in an in-platform action: `build-your-cv` · `prepare-for-an-interview` · `your-first-day` ·
  `skills-youre-still-learning` · `workplace-rights-basics` · `spotting-job-scams`.
- Registered in `content/help/seeker/_index.ts`; `related` cross-links stitch the collection to siblings +
  existing articles (e.g. `build-your-cv` ↔ `cv-backup`). `/dashboard/cv` added to the help index's
  surface-label map.

### 15.2 — CV generator (`/dashboard/cv`) — the marquee piece
- New seeker-only route renders a clean, printable CV **from the seeker's own profile** (`getMyProfile()`):
  name, profession (+ secondary professions), location, contact, bio, skills, experience, qualifications,
  studies. Renders only the sections the seeker has (honest end-states; an empty-profile state nudges to the
  profile editor).
- **Print-CSS pattern** (D2 — reused `/insights/print`): a `<CvPrintButton>` client island fires
  `window.print()` → browser "Save as PDF". **No server-side PDF dependency** — lightest path for a low-data
  audience.
- **Two ATS-friendly templates** via `?template=` (D2): `classic` (single column, default) and `compact`
  (two-column at `md+` and in print, single column on a phone). In-page segmented toggle, no round-trip cost.
- **Verification-Honesty (D-honesty / 15.2.4):** skills show the seeker's own rating ordered strongest-first
  with a plain "self-rated" footnote — **never** stamped "verified"; qualifications show their **real**
  verification state (Verified / Pending / Self-listed). The CV tells the same story as `/p/<handle>`.
- **Privacy (D3):** seeker-only, never an employer surface, never indexed, never auto-shared (same rule as
  the 11.5.2 CV backup). A "save as my CV backup" bridge links to the existing `<CvBackupEditor>` — no new
  storage model. No new audit kind (viewing/printing one's own data is not a disclosure; §23 export already
  covers the fields).

### 15.3 — Contextual surfacing (D4 — right moment, never a nag)
- **`<GetWorkReadyCard>`** (full + compact) — surfaces the 2–3 most-relevant guides by deterministic profile
  context (pending invites → interview + scams; student → first-day + still-learning; thin profile →
  still-learning; else → interview + rights), always leading with a one-tap CV. Resolves titles from the
  help registry (one source of truth). Wired into `/dashboard` (full) + `/dashboard/grow` (compact, beside
  the Student lane / learning loop).
- **"Prepare for this role"** card on the invitation detail page (`/dashboard/invitations/[id]`) — shown only
  while the invitation is live or accepted (`invited` / `reconsidering` / `accepted` / `accepted_with_notice`),
  never on decline/expiry/withdrawal. Links to the interview guide, the CV builder, and the scams guide.
- **HelpLink chip** `build-your-cv` added to the profile editor's chip row beside `cv-backup`.

---

## Non-negotiables met

- **Fully responsive, 360px-first:** every new surface built mobile-first; the CV is a mobile-readable
  on-screen view + a clean A4 print layout (not a shrunk desktop table). E2E asserts **zero horizontal
  overflow at 360px** on `/dashboard/cv` and that the dashboard work-ready card surfaces — passing on the
  `mobile-360` project.
- **No-Flash:** text + the existing token palette + system fonts; no new heavy deps, no video, no map libs.
  The CV route is text-only over the shared baseline (no chart/island weight).
- **Verification-Honesty:** self-attested skills never inflated (15.2.4).
- **No new PII / no new migration / no new consent purpose:** the CV renders from data already held under
  existing consent.
- **i18n-ready:** all new chrome in `messages/en.json` (`seekerDash.cv` 35 keys + `seekerDash.workReady` 9
  keys); zu/xh/af fall back via deepMerge until pro translation (Phase 10.7). Articles are English-first like
  the existing 108 (translation rides the Phase 10.7 rollout).

## Verification (2026-06-13)

- `npm run test:all` → typecheck ✅ · lint ✅ (0 errors; new files clean) · **318 vitest tests** ✅
- `npm run build` → ✅ (the `/dashboard/cv` route compiles)
- `npm run test:e2e` (seeker arc) → **10/10** at desktop + 360px, incl. 2 new Phase 15 tests (CV renders from
  real profile data + template switch + no overflow; dashboard work-ready card visible)

## Files

**New:** `content/help/seeker/work-ready/*.tsx` (6) · `app/[locale]/(seeker)/dashboard/cv/page.tsx` ·
`components/feature/seeker/CvPrintButton.tsx` · `components/feature/seeker/GetWorkReadyCard.tsx`.
**Edited:** `content/help/types.ts` · `content/help/seeker/_index.ts` · the seeker help index (surface label)
· `app/[locale]/(seeker)/dashboard/{page,grow/page,profile/page,invitations/[id]/page}.tsx` ·
`messages/en.json` · `tests/e2e/seeker-arc.spec.ts`.

## Out of scope / follow-ups (recorded for the backlog)

- One-click "save generated CV to my backup" (needs client→server PDF capture or a server-PDF render — weighed
  against the No-Flash cost; deferred per D2).
- Readiness-article translation (rides the Phase 10.7 Tier-2/Tier-3 rollout).
- More templates / a cover-letter generator (only if usage shows demand).
- City-level demand framing for the work-ready cards (lands naturally with Phase 16).

**Next:** Phase 16 — "Near You" (reframe the existing location engine). Its plan flags one founder decision
(§D1, the reverse-matching framing) to confirm before building.
