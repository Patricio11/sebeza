# POST-LAUNCH BACKLOG
*Opened 2026-06-10. Feature work deferred out of the pre-launch phases per the Phase 10 rule
("no new features in Phase 10 — requests collect here for Phase 11+").*

> **Sequencing note (honest):** the next milestone before public ship is still **Phase 12 — Testing & QA**
> (`ROADMAP.md` §Phase 12), which remains outstanding and has been leap-frogged by 11.x and 13.x. These
> backlog phases are **post-launch** and should not jump the QA gate. Numbered **14 / 15 / 16** to sit
> after the shipped Phase 13.x cluster (`ROADMAP.md` Phase 13.8–13.10).
>
> **Origin:** all three came out of the SAYouth competitive analysis
> (`COMPETITIVE_ANALYSIS_SAYOUTH.md` §5). They are, in priority order: the one strategic moat to *chase*
> (zero-rating), and two *buildable* seeker-side wins (readiness content, near-me framing).
>
> **Companion docs:** `ROADMAP.md` · `COMPETITIVE_ANALYSIS_SAYOUTH.md` · `TO_START_EVERY_SESSION.md` ·
> `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/`.

---

# PHASE 14 — ZERO-RATING (STRATEGIC / PARTNERSHIP, NOT CODE)
*Priority 1. The single highest-impact thing to chase. **Mostly a commercial + institutional effort, not
an engineering one.** Founder to research; build work is small and comes last.*

> **📋 Detailed plan: `docs/PHASE_14_PLAN.md`** (2026-06-13). Partnership-gated, not for implementation now;
> the plan firms up the route research, eligibility/backing gating, and the small flag-gated eng-readiness.

> **Why this is Priority 1 and yet not a sprint:** zero-rating is SAYouth's real moat
> (`COMPETITIVE_ANALYSIS_SAYOUTH.md` §2). Their site is data-free on MTN / Vodacom / Cell C / Telkom /
> Rain, so their exact-same target user — low-income, metered data, cheap Android — pays nothing to use
> it. Sebenza's No-Flash / low-data philosophy (`TO_START_EVERY_SESSION.md` Rule 1) narrows the gap but
> **"low-data" ≠ "zero-data."** Closing it is high-impact. But it is reached through *deals and backing*,
> not commits — and **honestly, it is probably only reachable with government or institutional backing**,
> which is another reason the Department partnership matters. Do not block product work on it; pursue it
> in parallel as a strategic objective.

## Task 14.1 — Research the two technical routes (founder research)
- [ ] **Route A — Direct telco zero-rating.** Each network (MTN, Vodacom, Cell C, Telkom, Rain) runs its
      own zero-rating programme. Map: who to contact, eligibility (usually requires a registered entity +
      a public-benefit / employment angle), the technical onboarding (dedicated domain/subdomain, IP
      ranges, traffic allow-listing), and cost/revenue terms.
- [ ] **Route B — `datafree.co` / biNu-style infrastructure** (the rails SAYouth uses via
      `sayouth.datafree.co`). A third party operates the zero-rated bridge across networks; you integrate
      once instead of negotiating five telco deals. Map: provider(s), onboarding, cost model, and what
      app-architecture constraints they impose (asset weight, domain structure, redirect handling).
- [ ] Output: a one-page comparison (cost · effort · time-to-live · dependency on backing) so the route
      decision is informed, mirroring the `AWS_DATABASE_OPTIONS.md` decision-doc pattern.

## Task 14.2 — Map the eligibility + backing prerequisites (honest gating)
- [ ] Confirm what each route requires that Sebenza **does not yet have**: a registered company; a
      public-benefit / government-endorsement angle; possibly a signed institutional partner. Record these
      as explicit prerequisites — zero-rating is unlikely to be grantable to a solo, pre-company applicant.
- [ ] Tie this to the partnership track: a Department / PYEI-ecosystem endorsement is plausibly the
      unlock for telco goodwill. Note the dependency explicitly in the pitch prep.

## Task 14.3 — Engineering prep so the app is "zero-rating-ready" (small, do early, cheap)
*None of this needs a telco deal in hand — it makes Sebenza a clean candidate when the deal comes.*
- [ ] **Asset-weight budget audit.** Zero-rating providers cap/scrutinise payload. Confirm the seeker
      surfaces already meet the Phase 10 / Lighthouse budget (`ROADMAP.md` Phase 10.6, `lighthouse-budgets.json`)
      and document the data-cost per key seeker journey (landing → sign-up → search → profile).
- [ ] **Domain/subdomain strategy.** Zero-rating attaches to specific hosts. Decide whether a dedicated
      low-asset host (e.g. `m.sebenzasa.com` or a `datafree` subdomain) is the zero-rated surface, and
      confirm the seeker flows work fully within one allow-listed host (no off-host asset CDNs that would
      break zero-rating or silently bill the user).
- [ ] **External-link honesty pattern.** SAYouth warns users before any link leaves the zero-rated zone
      and bills data. If Sebenza zero-rates, replicate this: an interstitial "this link uses data" notice
      on every outbound link (learning-path URLs from 11.2.1, employer external sites, etc.). Reuse the
      existing outbound-CTA island from 11.2.1 as the hook point.
- [ ] **Data-saver synergy.** The `app_user.data_saver_mode` from Phase 11.4.3 + the `Save-Data` header
      floor already exist — make the zero-rated host default to data-saver semantics (transform-narrowed
      images, deferred below-fold) so a zero-rated session is as light as possible.

## Out of scope / explicit
- ❌ Building any zero-rating "feature" before a route + backing exist. 14.3 is *readiness*, not delivery.
- ❌ Promising users zero-rated access in copy before a deal is signed (Verification-Honesty Rule applies
      to product claims too).

---

# PHASE 15 — WORK-READINESS CONTENT (SEEKER GROWTH, BUILDABLE)
*Priority 2. Lightweight, high seeker value, deepens the learning-loop "we help you grow" story
(`ROADMAP.md` Phase 11.2 + Phase 13). Cheap to add, strong retention. **Implement smooth + beautiful.**)*

> **📋 Detailed, implementation-ready plan: `docs/PHASE_15_PLAN.md`** (2026-06-13). Reuses the help-centre
> architecture for a `work-ready` article collection, the print-CSS pattern for a profile→CV generator, and
> contextual "prepare for this" cards. Decisions D1–D5 + responsive (360px) + compliance/wiring locked.

> **Why it fits Sebenza specifically:** SAYouth wraps matching in support — free CV templates, interview
> prep, mock interviews, job-readiness training (`COMPETITIVE_ANALYSIS_SAYOUTH.md` §2). Sebenza already
> has the *spine* for this: the Career Compass + Learning Loop (11.2) + Student lane (13). Readiness
> content is the missing **"get ready for the work," not just "find the work"** layer — and it slots into
> surfaces that already exist rather than needing a new section.

## Task 15.1 — Readiness content model (reuse the help-centre pattern, don't reinvent)
- [ ] Phase 10 already shipped **108 hand-written help articles across four role centres** with
      `<HelpLink>` chips (`ROADMAP.md` Phase 10.1–10.4). **Reuse that exact content architecture** for a
      new seeker-facing **"Get work-ready"** collection — same authoring model, same rendering, same chip
      mechanism. No new CMS, no new infra.
- [ ] Content set (v1, hand-written, plain-language, mobile-first, i18n-ready strings):
      *Build your CV* · *Prepare for an interview* · *What to expect on your first day* · *How to talk
      about skills you're still learning* · *Workplace rights basics* · *Spotting job scams*.
- [ ] Each article ends with a relevant in-platform action (deep-link to profile completeness, to the
      Learning Loop, to search) so content drives the loop rather than dead-ending.

## Task 15.2 — CV templates (honest, free, low-friction)
- [ ] A small set of clean, ATS-friendly CV templates as **printable HTML** (reuse the `/insights/print`
      print-CSS approach from Phase 9 / the share-card `next/og` route from 11.4.1 — pick the lighter fit).
- [ ] **Pre-fill from the seeker's own profile** where consented — name, profession, skills (with the
      self-attested honesty marker preserved), experience-in-years (9.9), qualifications. The seeker's
      data already models a CV; this is a render, not a new data capture.
- [ ] Download as PDF; never silently share or expose to employers (consistent with the 11.5.2 CV-backup
      privacy rule — seeker-controlled, not an employer surface).
- [ ] **Verification-Honesty Rule:** a self-attested skill renders on the CV as the seeker's own claim,
      never stamped "verified," matching how it shows on `/p/<handle>`.

## Task 15.3 — Interview-prep + job-readiness surfacing (smooth, contextual)
- [ ] Surface readiness content **contextually**, not as a buried library: when a seeker **accepts a
      vacancy invitation** (Phase 9.8) or **gets an interview**, show a calm inline "Prepare for this"
      card linking to the interview article + a role-relevant checklist. Right moment, not a nag.
- [ ] A single **"Get work-ready"** entry on the seeker dashboard + `/dashboard/grow`, styled in the
      Mzansi National system (`UX_UI_SPEC.md`) — beautiful, calm, not a content dump. Progressive: show
      2–3 most relevant cards, "see all" for the rest.
- [ ] **No-Flash Rule:** all readiness content is text-first, low-asset, works on a cheap phone — and is
      therefore zero-rating-friendly (feeds Phase 14.3).

## Out of scope / explicit
- ❌ Becoming an LMS / hosting video courses (same guardrail as the Learning Loop, `ROADMAP.md` Phase 11.2).
      Readiness content is short articles + templates that point onward, not coursework.
- ❌ Any "guaranteed interview / job" framing. Readiness improves preparation, not outcomes.
- ❌ Capturing new PII to build a CV — render from data already held, under existing consent.

## Compliance / wiring
- [ ] All copy in `messages/en.json` (zu/xh/af deepMerge fallback until pro translation — Phase 10.7).
- [ ] Reuse existing audit kinds where possible; if a CV download warrants one, add `seeker.cv.download`.
- [ ] Doc convention on ship: `docs/completed/PHASE_15_COMPLETE.md` + tick in `ROADMAP.md`.

---

# PHASE 16 — "NEAR ME" FRAMING (REFRAME WHAT ALREADY EXISTS)
*Priority 3. **Mostly a UX-framing + copy change, not new matching logic** — the location capability is
already deeply built. **Implement smooth + beautiful.**)*

> **📋 Detailed, implementation-ready plan: `docs/PHASE_16_PLAN.md`** (2026-06-13). **⚠️ Contains one decision
> to confirm first (plan §D1):** the outline's "run `/search` for opportunities near me" doesn't fit the
> model — `/search` returns *talent* (the seeker's competitive pool), and Sebenza deliberately has no
> seeker vacancy-browse surface (reverse-matching, not a job board). The plan resolves "near you" honestly in
> reverse-matching terms: **demand near you + be-found-near-you + locality-legible invitations/employers** —
> the transport-cost win without converging toward the incumbent's post-and-apply model.

> **Honest scoping note (important):** Sebenza is **not** missing location matching. It already has
> province→city search (`ROADMAP.md` Task 1.2 line 83), location on every profile + `<TalentRosterItem>`,
> the province×profession supply heatmap with `/search?q=…&province=…` drill-downs (Phase 6 / 6.5), and
> any-province handling for remote/hybrid (Phase 13.9). **This phase foregrounds and reframes that — it
> does not rebuild it.** SAYouth's edge here is purely *framing*: they lead with "opportunities close to
> where you live" and productise the transport-cost barrier. We have the engine; we under-sell it.

## Task 16.1 — Foreground "near me" in the seeker entry point
- [ ] On the seeker landing / dashboard, lead with a **"Work near you"** framing: detect/confirm the
      seeker's city (already on the profile) and surface a one-tap **"Show opportunities near me"** that
      runs the existing province/city-scoped search — no new query, the `/search?province=…` path already
      exists (Phase 6.5 drill-down).
- [ ] Honest empty state when nothing is near: "Nothing in {city} yet — see {province}" widening to the
      existing province scope, reusing the honest end-state pattern (Phase 7 / 10).

## Task 16.2 — Make distance/locality legible on results (the transport-cost barrier)
- [ ] On `<TalentRosterItem>` (employer side) and on the seeker's opportunity views, make **locality
      prominent and human** — "Same city" / "{city}, {province}" — so the transport-cost reality SAYouth
      addresses is visible at a glance. Uses data already on the row; presentation only.
- [ ] **No new heavy map libs** (No-Flash Rule — consistent with the deliberate "no heavy map" choice on
      the Phase 6 heatmap). Text + the existing lightweight visual idiom only.

## Task 16.3 — Carry "near me" through the loop
- [ ] Vacancy match view (Phase 9.8) + Career Compass city-demand rows (11.2.6, already `/search` links)
      pick up the same "near you" framing so it's consistent end-to-end, not a one-screen gimmick.
- [ ] Respect remote/hybrid (Phase 13.9): a remote-available seeker/role isn't penalised by a strict
      "near me" filter — "near me **or** remote" is the honest default.

## Out of scope / explicit
- ❌ New geolocation capture / GPS / device-location permissions — use the city already on the profile.
      (Avoids a new PII/consent surface for a framing win.)
- ❌ Rebuilding the search/ranking engine — this is presentation + entry-point framing over the existing
      Phase 4 ranking + Phase 6 location scope.
- ❌ Distance-in-km precision — "same city / province" granularity matches the data and the No-Flash Rule.

## Compliance / wiring
- [ ] All new copy in `messages/en.json` (zu/xh/af fallback). Styled in the Mzansi National system.
- [ ] No new migration expected (reads existing `city`/`province`). Confirm in the plan's pre-flight.
- [ ] Doc convention on ship: `docs/completed/PHASE_16_COMPLETE.md` + tick in `ROADMAP.md`.

---

## SUMMARY TABLE

| Phase | What | Type | Effort | Blocking dependency |
|---|---|---|---|---|
| **14** | Zero-rating | Commercial / partnership (research now, small eng-prep) | Mostly non-code; needs company + backing | Registered company + likely gov/institutional backing |
| **15** | Work-readiness content | Seeker-side build (reuses help-centre + print/CV infra) | Light–medium | None (buildable now, post-QA) |
| **16** | "Near me" framing | UX reframe of existing location engine | Light | None (buildable now, post-QA) |

**Recommended order of action:** research **14** in parallel (it's slow and external); build **15** then
**16** after **Phase 12 (Testing & QA)** clears, since both touch seeker surfaces that the QA pass should
cover. Neither 15 nor 16 should jump the QA gate — `ROADMAP.md` Phase 12 stays the next milestone.

*Opened 2026-06-10. Source: `COMPETITIVE_ANALYSIS_SAYOUTH.md` §5. Sequenced against `ROADMAP.md` v2.1.*
