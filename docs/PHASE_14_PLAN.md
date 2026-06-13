# PHASE 14 PLAN — ZERO-RATING (STRATEGIC / PARTNERSHIP)

**Status:** PLANNED — **not for implementation now.** Partnership- and company-gated. Research runs in
parallel; the engineering work is small, late, and conditional on a route + backing existing.
**Priority:** 1 (highest *impact*), but reached through deals + institutional backing, not commits.
**Origin:** `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §2 + §5.1 · `docs/POST_LAUNCH_BACKLOG.md` Phase 14.
**Companion docs:** `AWS_DATABASE_OPTIONS.md` (decision-doc pattern to mirror) · `TO_START_EVERY_SESSION.md`
(Rule 1 No-Flash) · `lighthouse-budgets.json` / `docs/PERF_BUDGET.md` (asset-weight floor) ·
`docs/popia/` (cross-host data-residency note).

> **Read this first — why a "Priority 1" phase is not a sprint.** Zero-rating is SAYouth's real moat: their
> site is data-free on MTN / Vodacom / Cell C / Telkom / Rain, so the *exact* low-income, metered-data,
> cheap-Android user Sebenza targets pays nothing to use it. Sebenza's No-Flash philosophy narrows the gap
> but **"low-data" ≠ "zero-data."** Closing it is high-impact — and it is almost certainly only reachable
> *with* a registered company **and** government/institutional backing. The honest posture: pursue it as a
> standing strategic objective tied to the Department partnership; **do not block product work (Phases 15,
> 16, or anything else) on it.** Build nothing that *claims* zero-rating before a deal is signed
> (Verification-Honesty Rule applies to product claims).

---

## Definition of done (for THIS planning phase, not the deal)

This phase is "planned-complete" when:
1. The two technical routes (14.1) are researched into a one-page decision doc mirroring
   `AWS_DATABASE_OPTIONS.md`.
2. The eligibility/backing prerequisites (14.2) are written down honestly and tied to the partnership track.
3. The **cheap, do-early engineering readiness** (14.3) is the only code that lands — and only because it
   makes Sebenza a clean candidate *when* a route appears. It ships value on its own merits (lighter app,
   honest outbound-link UX) even if zero-rating never happens.

The *deal itself* is out of scope for any engineering phase. This doc is the map, not the territory.

---

## Task 14.1 — Research the two technical routes (founder/operator research, NOT code)

- [ ] **Route A — Direct telco zero-rating.** Each network (MTN, Vodacom, Cell C, Telkom, Rain) runs its
      own zero-rating / "reverse-billing" programme. Map per network: who to contact, eligibility (usually a
      registered entity + a public-benefit / employment angle), technical onboarding (dedicated
      domain/subdomain, published IP ranges, traffic allow-listing, TLS/SNI requirements), and cost/revenue
      terms (who pays the data — the telco as CSI, or Sebenza).
- [ ] **Route B — `datafree.co` / biNu-style infrastructure** (the rails SAYouth uses via
      `sayouth.datafree.co`). A third party operates the zero-rated bridge across all five networks; you
      integrate once instead of negotiating five telco deals. Map: provider(s), onboarding, cost model, and
      the app-architecture constraints they impose (asset-weight caps, mandatory domain structure, redirect
      handling, off-host asset rules).
- [ ] **Output:** a one-page `docs/ZERO_RATING_OPTIONS.md` comparing **cost · effort · time-to-live ·
      dependency-on-backing**, ending in a recommendation — exactly the shape of `AWS_DATABASE_OPTIONS.md`.

## Task 14.2 — Map the eligibility + backing prerequisites (honest gating)

- [ ] Confirm, per route, what Sebenza **does not yet have**: a registered company; a documented
      public-benefit / government-endorsement angle; possibly a signed institutional partner. Record each as
      an explicit prerequisite — zero-rating is unlikely to be grantable to a solo, pre-company applicant.
- [ ] Tie this to the partnership track: a Department / PYEI-ecosystem endorsement is plausibly the unlock
      for telco goodwill. Note the dependency in the pitch prep, and note the §4 partnership-posture framing
      from the competitive analysis ("integrate and complement, not compete") as the credible on-ramp.

## Task 14.3 — Engineering readiness (small, cheap, do early — ships value regardless)

*None of this needs a telco deal in hand. Each item is independently worth doing for a national low-data
audience; together they make Sebenza a clean zero-rating candidate when a route appears.*

- [ ] **14.3.1 — Asset-weight evidence.** The Phase 12 perf gate (`tests/e2e/perf-budget.spec.ts`) already
      measures script wire-bytes per key seeker route; it found the shared baseline ~35–50 KB over the 160 KB
      target (see `docs/PERF_BUDGET.md`). Land the backlog **"No-Flash bundle pass"** (dynamic-import the
      `/insights` chart islands; trim the shared baseline) so the seeker journey landing → sign-up → search →
      profile demonstrably meets budget, and **document the data-cost per key seeker journey** in
      `ZERO_RATING_OPTIONS.md`. *(This is the readiness item with the most standalone value.)*
- [ ] **14.3.2 — Domain/subdomain strategy.** Zero-rating attaches to specific hosts. Decide whether a
      dedicated low-asset host (e.g. `m.sebenzasa.com`, or a `datafree` subdomain) is the zero-rated surface,
      and **confirm the seeker flows work fully within one allow-listed host** — no off-host asset CDNs that
      would break zero-rating or silently bill the user. Audit current off-host dependencies: Supabase signed
      Storage URLs (profile photos / docs), any font/CDN origin, the `next/og` card route's image fetches.
      Record which must move on-host for a zero-rated surface.
- [ ] **14.3.3 — External-link honesty interstitial.** SAYouth warns users before any link leaves the
      zero-rated zone and bills data. Replicate it: a small **"this link uses data"** interstitial on every
      *outbound* link (Phase 11.2.1 learning-path URLs, employer external sites, etc.). **Reuse the existing
      outbound-CTA island from Phase 11.2.1 as the hook point** — extend it with the interstitial rather than
      adding a new mechanism. Behind a `feature_flag_zero_rating_host` so it only appears on the zero-rated
      host (no behaviour change for the normal site until a deal exists).
- [ ] **14.3.4 — Data-saver default on the zero-rated host.** `app_user.data_saver_mode` (Phase 11.4.3) +
      the `Save-Data` header floor already exist. Make the zero-rated host **default to data-saver semantics**
      (transform-narrowed images via the Phase 11.5.4 `signedPhotoUrl(key,{width})`, deferred below-fold via
      the Phase 11.5.5 `<LazySection>`) so a zero-rated session is as light as possible. Same flag as 14.3.3.

> **Sequencing of 14.3:** 14.3.1 is the only item worth doing *eagerly* (it's the No-Flash bundle pass, which
> is on the backlog anyway and helps every user). 14.3.2 is a half-day audit that informs the decision doc.
> 14.3.3 + 14.3.4 are flag-gated and dormant — build them only once a route in 14.1 looks real, so they're
> not dead code.

---

## Out of scope (explicit)

- ❌ Building any zero-rating "feature" before a route (14.1) **and** backing (14.2) exist. 14.3 is
      *readiness + standalone value*, never delivery of zero-rating itself.
- ❌ Promising users zero-rated access in any product copy before a deal is signed.
- ❌ Negotiating telco deals as an engineering task — that is founder/operator + partnership work.
- ❌ A second codebase or a separate "lite" app. The zero-rated host is the *same* Next.js app served from an
      allow-listed origin with data-saver defaults — not a fork.

## Compliance / wiring (only the readiness items that ship)

- [ ] **POPIA cross-host note.** If a `datafree`/telco bridge proxies traffic, document the processor
      relationship in `docs/popia/` (a bridge that sees request metadata is a sub-processor). Add to the DPIA
      sub-processor register *before* any live zero-rated traffic — not after.
- [ ] **No new PII.** None of 14.3 captures new data. The interstitial + data-saver default are presentation.
- [ ] **Flags:** `feature_flag_zero_rating_host` (default OFF) gates 14.3.3 + 14.3.4 so the normal site is
      unchanged until a deal lands.
- [ ] **Doc convention on any ship:** the only thing that "completes" here is 14.3.1 (folds into the bundle
      pass) + the `ZERO_RATING_OPTIONS.md` decision doc. There is no `PHASE_14_COMPLETE.md` until a deal +
      live zero-rated host exist; until then this stays a standing strategic objective.

---

## Summary

| Item | Type | Who | Blocking dependency |
|---|---|---|---|
| 14.1 route research | Operator research → decision doc | Founder | None (do now) |
| 14.2 eligibility/backing | Operator research → pitch prep | Founder | Tied to partnership track |
| 14.3.1 asset-weight | Engineering (= backlog bundle pass) | Dev | None — ships value to all users |
| 14.3.2 domain audit | Engineering (half-day audit) | Dev | None — informs the decision |
| 14.3.3 outbound interstitial | Engineering, flag-gated dormant | Dev | A real route in 14.1 |
| 14.3.4 data-saver default | Engineering, flag-gated dormant | Dev | A real route in 14.1 |

**Recommended action now:** research 14.1 + 14.2 in parallel (slow, external); do 14.3.1 as part of the
No-Flash bundle pass whenever that runs; defer 14.3.2–14.3.4 until a route looks real. **Do not let any of
this gate Phases 15 or 16.**

*Planned 2026-06-13. Source: `docs/COMPETITIVE_ANALYSIS_SAYOUTH.md` §2/§5. Sequenced against `ROADMAP.md` v2.2.*
