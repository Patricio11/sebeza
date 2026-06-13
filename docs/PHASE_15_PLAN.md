# PHASE 15 PLAN — WORK-READINESS CONTENT (seeker growth, buildable)

**Status:** PLANNED — ready to implement (post-QA). Priority 2.
**One line:** add the **"get ready for the work," not just "find the work"** layer — short readiness articles,
a free profile-to-CV generator, and contextual "prepare for this" surfacing — reusing infrastructure that
already exists, so it slots into the product instead of bolting a new section on.
**Origin:** `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §2/§3/§5.2 · `docs/POST_LAUNCH_BACKLOG.md` Phase 15.
**Companion docs:** `ROADMAP.md` Phase 10.1–10.4 (help-centre) · Phase 11.2 (learning loop) · Phase 13
(student lane) · `UX_UI_SPEC.md` (Mzansi National system) · `docs/MOBILE_PLAN.md` (360px floor) ·
`TO_START_EVERY_SESSION.md` (No-Flash + Verification-Honesty).

> **Why it fits Sebenza specifically.** SAYouth wraps matching in support — CV templates, interview prep,
> mock interviews, readiness training. Sebenza already has the *spine*: Career Compass + Learning Loop
> (11.2) + Student lane (13). Readiness content is the missing support layer, and **every piece slots into a
> surface that already exists** (the help-centre, the print route, the profile data, the dashboard) rather
> than needing new infrastructure. This is a cheap, high-value **retention** win that deepens the "we help
> you grow" story — and because it's text-first + low-asset, it is zero-rating-friendly (feeds 14.3).

---

## Non-negotiables for this phase (the user's bar: "smooth, great, fully responsive — national-wide")

- **Fully responsive, 360px-first.** Every surface is built mobile-first to the `docs/MOBILE_PLAN.md` bar:
  no horizontal scroll at 360px, ≥44px tap targets, ≥16px input font, text-first low-asset. The CV view in
  particular gets a *mobile-readable on-screen layout* AND an *A4 print layout* — not a desktop table
  shrunk down.
- **No-Flash.** Text + system fonts + the existing token palette. No new heavy deps, no video, no map libs.
- **Verification-Honesty.** A self-attested skill renders on the CV as the seeker's own claim, never stamped
  "verified" — matching exactly how it shows on `/p/<handle>` today.
- **No new PII.** The CV renders from data the seeker already gave, under existing consent. No new capture.
- **i18n-ready.** All copy in `messages/en.json`; zu/xh/af fall back via deepMerge until pro translation
  (Phase 10.7). Articles are English-first (the help-centre is English-first today; translation is a Phase
  10.7 follow-up, not a Phase 15 blocker).

---

## Architecture decisions (locked before build)

- **D1 — Readiness articles reuse the help-centre architecture verbatim.** Phase 10 shipped 108 hand-written
  articles as `.tsx` modules (`content/help/seeker/<category>/<slug>.tsx` exporting `meta: HelpArticleMeta`
  + a default `<HelpProse>` component), registered in `content/help/seeker/_index.ts`, rendered by the
  existing `/dashboard/help` + `/dashboard/help/[slug]` routes, surfaced by `<HelpLink>` chips. **Phase 15
  adds a new `work-ready` category to the SEEKER help centre** — same authoring model, same registry, same
  routes, same chips. No new CMS, no new route group, no new rendering. The only code in 15.1 is content
  files + one category enum entry + registry wiring.
- **D2 — The CV generator uses the print-CSS pattern, not server-side PDF.** Reuse the `/insights/print`
  approach (`<PrintActions>` client island → `window.print()` → browser "Save as PDF") over a new server PDF
  dependency or the heavier `next/og` route. Rationale: zero new server deps, browser-native PDF, lightest
  possible payload for a low-data audience (No-Flash). The CV lives at a **seeker-only authenticated route**,
  renders from `getMyProfile()`, and is print-styled to A4.
- **D3 — Generated CV ≠ uploaded CV backup (11.5.2); they are complementary.** Phase 11.5.2's `lib/profile/cv.ts`
  lets a seeker *upload* a PDF they made elsewhere (private, never an employer surface). Phase 15.2 *generates*
  a starter CV from Sebenza profile data. They coexist: the generator offers "**Save this as my CV backup**"
  which calls the existing `uploadCv` path (no new storage model). The generated CV is never auto-shared and
  never an employer surface — same privacy rule as 11.5.2.
- **D4 — Contextual surfacing is additive cards, never a nag.** Readiness shows up at the *right moment*
  (accepting a vacancy invitation; a calm dashboard entry) — progressive disclosure (2–3 most-relevant cards
  + "see all"), never a content dump and never a modal interruption.
- **D5 — No outcome claims.** No "guaranteed interview/job" framing anywhere. Readiness improves
  *preparation*, not *outcomes* (mirrors the §4 pitch discipline — be honest about the boundary).

---

## Task 15.1 — Readiness content collection ("Get work-ready")

Reuse D1. Add a `work-ready` category to the seeker help centre.

- [ ] **15.1.1 — Category + registry.** Add `"work-ready"` to the seeker help category union (the
      `SeekerHelpCategory` type) + a category label/description for the help-centre index. Wire the new
      article modules into `content/help/seeker/_index.ts` (`SEEKER_HELP_ARTICLES` flat list + `toArticle()`
      mapping). The existing `/dashboard/help` index renders the new category automatically (it iterates
      categories); the existing search island indexes the new articles automatically (it reads the flat list).
- [ ] **15.1.2 — Six v1 articles** (`content/help/seeker/work-ready/<slug>.tsx`), hand-written, plain-language,
      mobile-first, i18n-ready strings, each ending in a relevant in-platform action so content drives the
      loop rather than dead-ending:
      | Slug | Title | Ends with (surfaceLink) |
      |---|---|---|
      | `build-your-cv` | Build your CV | → the CV generator (`/dashboard/cv`, Task 15.2) |
      | `prepare-for-an-interview` | Prepare for an interview | → invitations inbox / the role's "Prepare for this" card |
      | `your-first-day` | What to expect on your first day | → status confirm on `/dashboard` |
      | `skills-youre-still-learning` | How to talk about skills you're still learning | → the Learning Loop on `/dashboard/grow` |
      | `workplace-rights-basics` | Workplace rights basics | → `/dashboard/privacy` (rights framing) |
      | `spotting-job-scams` | Spotting job scams | → the report-invite flow (Phase 11.3.3) |
- [ ] **15.1.3 — `related` cross-links.** Each article's `meta.related` points at 1–2 sibling readiness
      articles + the most relevant existing help article (e.g. `build-your-cv` relates to the existing
      `cv-backup` article), so the related-strip already in the article template stitches the collection
      together with no new code.
- [ ] **15.1.4 — `<HelpLink>` chips** dropped on the surfaces each article supports (profile editor →
      `build-your-cv`; invitations → `prepare-for-an-interview` + `spotting-job-scams`; grow →
      `skills-youre-still-learning`). Reuse the existing chip — no new component.

## Task 15.2 — CV generator (profile → printable CV)

Reuse D2 + D3.

- [ ] **15.2.1 — Route + page.** New seeker-authenticated route `app/[locale]/(seeker)/dashboard/cv/page.tsx`
      (`verifyRole("seeker")` via the existing DAL guard). Server component reads `getMyProfile()` → renders
      the CV from: display name, profession (+ secondary professions, Phase 13.10), city/province, headline,
      bio, skills (name + proficiency + years, with the **self-attested honesty preserved per D-Honesty**),
      `yearsExperience` (Phase 9.9), experiences (role/org/dates/description), qualifications (title /
      institution / year / verification state shown honestly), academic record (if student). **Renders only
      fields the seeker has** — no empty sections, honest end-states.
- [ ] **15.2.2 — Templates (2 to start, ATS-friendly).** A `?template=` param (default `classic`) selects
      between **`classic`** (single-column, maximally ATS-parseable) and **`compact`** (two-column on desktop,
      single-column on mobile + print). Both are pure HTML + the existing token palette + Fraunces/Hanken.
      A small in-page template toggle (segmented control) switches without a round-trip.
- [ ] **15.2.3 — Print styling.** Reuse the `/insights/print` pattern: a `<PrintActions>`-style client island
      with a **"Print / Save as PDF"** button firing `window.print()`, and an `@media print { @page { size:
      A4; margin: 16mm } }` block. On-screen it's a calm mobile-readable preview; in print it's clean A4.
      Hide app chrome (sidebar/nav/buttons) in `@media print`.
- [ ] **15.2.4 — Verification-Honesty on the CV.** Skills render with the same `proficiency/5` + years idiom
      as `/p/<handle>`; a qualification shows its real `verification` state (Verified / Pending / self-listed)
      — **never** inflated. A self-attested skill is the seeker's own claim, never a "verified" stamp.
- [ ] **15.2.5 — "Save as my CV backup" bridge.** A secondary action that renders the current template to PDF
      *client-side is not needed* — instead offer the honest, lightweight path: a one-line note "Printed a PDF?
      Save it as your private CV backup" linking to the existing 11.5.2 `<CvBackupEditor>` on
      `/dashboard/profile#cv-backup`. (Avoids a server-side PDF dependency; reuses the existing upload path. If
      later we want one-click capture, that's a server-PDF follow-up — out of scope for v1, recorded below.)
- [ ] **15.2.6 — Privacy.** The CV route is seeker-only; the generated CV is never an employer surface, never
      indexed, never auto-shared (same rule as 11.5.2). No audit row is needed for *viewing/printing* one's own
      data for oneself (no PII leaves the session, no new disclosure); the existing data-export (§23) already
      covers the underlying fields. *(If 15.2.5's one-click-capture follow-up ever lands, it reuses the
      existing `profile.update` cv-upload audit — no new kind.)*

## Task 15.3 — Contextual surfacing (smooth, right-moment)

Reuse D4.

- [ ] **15.3.1 — "Prepare for this" card on invitation accept.** When a seeker views/accepts a vacancy
      invitation (Phase 9.8, `/dashboard/invitations/[invitationId]` + `<InvitationResponseIsland>`), show a
      calm inline **"Prepare for this role"** card: links to `prepare-for-an-interview`, a short
      role-relevant checklist (e.g. the vacancy's required skills the seeker already has vs. is still
      learning — reuse the 9.11 vacancy-vs-profile gap logic, *honest framing, no nag*), and a deep-link to
      the CV generator. Renders on accept and on the `accepted`/`accepted_with_notice` states; never on
      decline. Server-composed from data already on the invitation detail page.
- [ ] **15.3.2 — "Get work-ready" dashboard entry.** A single calm card on `/dashboard` (and a compact
      variant on `/dashboard/grow`) styled in the Mzansi National system: eyebrow + Fraunces heading + 2–3
      most-relevant readiness cards (chosen by profile state — e.g. no qualifications → surface
      `build-your-cv` + `skills-youre-still-learning`; has a pending invite → surface
      `prepare-for-an-interview`) + a "See all" link into the `work-ready` help category. Progressive, not a
      dump. Silently minimal when the seeker is fully ready.
- [ ] **15.3.3 — Student-lane fit.** On `/dashboard/grow`, the readiness entry sits naturally beside the
      existing Student lane (Phase 13) for student seekers — `your-first-day` +
      `skills-youre-still-learning` are especially relevant to first-job graduates. Reuse the existing
      `me.academic` gate to lightly reorder which cards surface first; no new query.

---

## Responsive + No-Flash spec (explicit — this is the "smooth, great, fully responsive" bar)

- **Articles:** inherit the existing `<HelpProse>` responsive typography (already 360px-clean). Nothing new.
- **CV generator on-screen:** single-column on mobile (`<md`), the `compact` template's second column only
  appears at `md+`. Section headers use the all-caps tracked eyebrow idiom; thin hairline rules between
  sections. Template toggle is a ≥44px segmented control. No horizontal scroll at 360px (test in the Phase 12
  E2E overflow guard).
- **CV in print:** `@page A4`, app chrome hidden, single-column for `classic`, two-column collapses to one if
  it would overflow the page width. Black-on-white, no background fills that waste ink.
- **Contextual cards:** the card idiom from `StatusCard` / `RecommendedEmployersCard` (eyebrow + Fraunces
  heading + hairline-divided rows). Bottom-sheet nothing here — these are inline cards, not modals.
- **Perf:** all of 15 is text + the existing token CSS; it must not regress the Phase 12 perf-budget ratchets
  (`tests/e2e/perf-budget.spec.ts`). The CV route is a new key route — **add it to the perf-budget spec** with
  a 160 KB ceiling (it should pass comfortably; it's static-ish).

## Compliance / wiring

- [ ] All copy in `messages/en.json` under a new `seekerDash.workReady` (or `workReadiness`) namespace +
      article strings; zu/xh/af deepMerge fallback until pro translation (Phase 10.7). POPIA/consent copy is
      never machine-translated (existing rule).
- [ ] **No new migration** — the CV renders from existing profile columns; readiness articles are content
      files. Confirm in the plan's pre-flight that nothing schema-touching is needed.
- [ ] **No new audit kind for v1** (viewing/printing one's own data isn't a disclosure). If the 15.2.5
      one-click-capture follow-up ever lands, it reuses the existing `profile.update` (cv-upload) audit.
- [ ] **No new consent purpose** — render from data under existing consent; the CV is seeker-private.
- [ ] **Add the CV route to the Phase 12 E2E suite:** a seeker-arc spec that signs in, opens `/dashboard/cv`,
      asserts it renders the seeded profile's data, switches template, and has no 360px overflow + no console
      errors. Add its wire-bytes to `perf-budget.spec.ts`.
- [ ] **Doc convention on ship:** `docs/completed/PHASE_15_COMPLETE.md` + tick in `ROADMAP.md` + refresh
      `TO_START_EVERY_SESSION.md` Current State + commit `Phase 15 complete + Phase 16 opens`.

## Out of scope (explicit)

- ❌ Becoming an LMS / hosting video courses (same guardrail as the Learning Loop). Readiness is short
      articles + a CV render that point onward, never coursework.
- ❌ Any "guaranteed interview / job" framing (D5).
- ❌ Capturing new PII to build a CV — render from data already held (D3).
- ❌ Server-side PDF generation in v1 (D2 — print-CSS is lighter). The one-click "capture generated CV to
      backup" is a recorded follow-up, not v1.
- ❌ Mock interviews / scheduling / video (SAYouth's SmartWorks-style services) — a different product surface;
      not this phase.

## Follow-ups (record to `POST_LAUNCH_BACKLOG.md` on ship)

- One-click "save generated CV to my backup" (needs client→server PDF capture or a server-PDF render; weigh
  against the No-Flash cost).
- Readiness-article translation (rides the Phase 10.7 Tier-2/Tier-3 rollout — orientation/consent/rights
  articles first).
- More templates / a cover-letter generator (only if usage shows demand).

---

## Suggested build order

1. **15.1** (content + category + registry + chips) — pure content, lowest risk, immediately useful.
2. **15.2** (CV generator route + 2 templates + print) — the marquee piece; reuses print-CSS + profile data.
3. **15.3** (contextual surfacing) — wires the content + CV into the right moments.
4. Wiring: i18n keys, E2E spec, perf-budget entry, docs.

*Planned 2026-06-13. Source: `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §5.2. Sequenced against `ROADMAP.md` v2.2.*
