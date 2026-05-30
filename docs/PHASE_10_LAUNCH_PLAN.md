# PHASE 10 LAUNCH PLAN — PUBLIC LAUNCH (Tasks 10.5  10.11)
*Opens 2026-05-24. Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/`.*

> **Renamed 2026-05-30.** Phase 10 ended up with two arcs: **10.1  10.4** = role-specific help centres (shipped first  see `docs/completed/PHASE_10_{1,2,3,4}_COMPLETE.md`), then **10.5  10.11** below = the actual public-launch tasks. Task numbers in this doc start at 10.5 to keep the help-centre numbering intact.

> **Stop signal:** the public-launch phase. Every change here is in front of real seekers, employers, and government users. Nothing risky lands here without a kill-switch.

> **UX/UI quality bar (non-negotiable, inherited from every prior side-phase):** smooth, beautiful, consistent with the Civic Editorial aesthetic, **mobile-first** by construction. No-Flash Rule applies: works on a low-end Android over 3G; JS budget ~150KB on key routes; no heavy animation. Every list, form, and modal in this phase must render cleanly at 360 px wide before it ships.

---

## 🎯 GOAL

Get Sebenza in front of South African users — seekers, employers, government — with the dignity the platform has been building toward since Phase 0. Three pillars:

1. **Accessibility (WCAG 2.2 AA)**: contrast, keyboard, screen reader, focus order, prefers-reduced-motion. Everyone uses Sebenza, including users on assistive tech.
2. **Performance budget on throttled 3G**: confirm the No-Flash Rule against measurement, not aspiration. JS budget validated on every key route, with a Lighthouse score floor in CI.
3. **Tier-1 + Tier-2 + Tier-3 localisation rollout**: professional human translation lands; consent / POPIA copy verified across all locales; the deepMerge stubs get filled in. Tier-2 + Tier-3 locales added to `i18n/routing.ts` once their catalogs cross the readiness threshold.

This is **not** a feature phase. Feature work is done. Phase 10 is the polish + audit + go-live phase.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Civic-Editorial design system** + Talent Pulse glyph as the recurring visual signature (Phase 1).
- **i18n infrastructure**: `next-intl` 4.12, `messages/en.json` as the base catalog, `zu/xh/af` stubs with `__notice` and English deepMerge fallback (Phase 1 / 9.8.3).
- **Performance posture**: No-Flash Rule encoded since Phase 0; Recharts is the only chart library and it's mount-gated; no Framer Motion; Lighthouse-aware route design throughout 4–9.8.
- **Accessibility groundwork**: semantic HTML, `aria-labelledby` on every section, focus styles on every interactive element, `prefers-reduced-motion` honoured in every CSS transition. WCAG-aware but not yet audited.
- **Sentry + rate limit + CSP**: Phase 9 shipped headers + a Sentry skeleton + an Upstash-ready rate limiter, all dormant by default. Phase 10 flips them on with the matching credentials.
- **AWS Cape Town `af-south-1` migration**: turnkey runbook at `docs/AWS_MIGRATION_RUNBOOK.md`. Phase 10 may run it (or may defer to Phase 11.x) depending on operator + partnership state. Drizzle is driver-agnostic; the swap is `db/client.ts` only.

---

## 📋 TASKS

### Task 10.5: Accessibility audit (WCAG 2.2 AA)
- [ ] Run axe-core + manual keyboard pass on every route group (`/`, `/search`, `/p/[handle]`, `/dashboard/...`, `/employer/...`, `/admin/...`, `/gov/...`, `/insights`).
- [ ] Confirm: contrast ≥ 4.5:1 (text) / 3:1 (UI), focus order matches reading order, every interactive element has an accessible name + visible focus ring, no keyboard trap, every modal can be Esc-closed, `prefers-reduced-motion` blocks the count-up + reveal animations.
- [ ] Screen-reader pass: VoiceOver on macOS + NVDA on Windows for the seeker sign-up + privacy + dossier + vacancy-detail + decline-modal flows. The decline modal in 9.8.5 is the highest-stakes form  log any surprises.
- [ ] Output: `docs/A11Y_AUDIT.md` with findings + fixes. Each finding gets a commit. WCAG 2.2 AA is the floor.

### Task 10.6: Performance budget on throttled 3G
- [ ] Lighthouse CI run against `npm run build` output, Slow 4G + Slow 3G + Mid-tier mobile CPU throttling. Floor: 90 perf / 100 a11y / 95 best-practices / 90 SEO on `/`, `/search`, `/p/[handle]`, `/dashboard`, `/employer/vacancies`.
- [ ] JS budget validation: `next build --analyze` (or equivalent) confirms ~150 KB on key routes. Any route over budget → break it down, lazy-load the offender (likely a Recharts island).
- [ ] Network panel walk: confirm public reads ship signed photo URLs only (no raw storage keys), no third-party trackers, no waterfall longer than 2 round trips for first paint.
- [ ] Output: `docs/PERF_BUDGET.md` with the route-by-route table + the Lighthouse JSON snapshots.

### Task 10.7: Tier-1 + Tier-2 + Tier-3 localisation rollout
- [ ] **Tier-1**: `zu` / `xh` / `af` catalogs filled in via professional human translation. The `__notice` stubs in `messages/{zu,xh,af}.json` get replaced. Consent + POPIA copy (D8 vacancy invites + the 9.7 reframed nationality-mix copy + the seeker sign-up step 2) is the high-stakes block.
- [ ] **Tier-2**: `nso` (Sepedi), `tn` (Setswana), `st` (Sesotho), `ts` (Xitsonga), `ve` (Tshivenda), `ss` (siSwati), `nr` (isiNdebele) — the remaining seven official SA languages. Translation per Tier-1.
- [ ] **Tier-3**: `pt` (Portuguese), `fr` (French), `sw` (Swahili). For SADC users + the foreign-national community already in SA. Optional at launch; queued for the first month post-launch unless partnership timing forces.
- [ ] Each tier adds its locales to `i18n/routing.ts` once the catalog crosses readiness (consent copy 100 % done; UI copy ≥ 80 % done with English deepMerge for the rest).
- [ ] **Never machine-translate** consent / POPIA / legal copy. The rule from Phase 1 still holds.

### Task 10.8: Live-credentials flip (Resend + Sentry + rate-limit + KYC + SAQA)
- [ ] Flip `EMAIL_TRANSPORT=resend` in prod env + set `RESEND_API_KEY` (already wired; just credentials). Verify a smoke email lands.
- [ ] Flip `feature_flag_email_notifications` ON in `/admin/settings` (already supported; just toggle).
- [ ] Sentry DSN set in env. The Phase 9 skeleton goes live.
- [ ] Rate limiter: Upstash credentials set; flip the dormant in-memory limiter onto Upstash. Verify `429` lands correctly on a synthetic abuse run.
- [ ] KYC + SAQA: `feature_flag_kyc_provider` + `feature_flag_saqa_worker` ON only when the partnership confirms. Otherwise stay dormant.

### Task 10.9: AWS Cape Town af-south-1 migration (optional in this phase)
- [ ] Decision point: run the `docs/AWS_MIGRATION_RUNBOOK.md` swap now (POPIA in-country residency before public launch) OR defer to Phase 11.x once partnership confirms scale. Operator call.
- [ ] If running: Drizzle stays the same, `db/client.ts` swaps from `@neondatabase/serverless` to `pg` driver, the schema + migrations + queries + seed are unchanged. Verify with the existing test + compliance suite.

### Task 10.10: Smoke + soak
- [ ] Synthetic-traffic soak against the seeded DB: 100 concurrent search sessions × 30 minutes. Confirm no 5xx, no rate-limiter breaks, no Sentry exceptions outside the expected noise floor.
- [ ] End-to-end browser test of the eight golden paths: (1) seeker sign-up + first-profile, (2) employer org sign-up, (3) /search → /p/[handle] → /employer/dossier reveal, (4) saved-search + new-matches cron, (5) employer vacancy create → invite → seeker accept → placement log, (6) seeker decline-with-reason → /gov/shortage decline-reason cell, (7) admin moderation queue, (8) /gov data exports.

### Task 10.11: Doc + comms convention
- [ ] On ship: `docs/completed/PHASE_10_LAUNCH_COMPLETE.md` (the launch-arc completion doc; sibling of the four `PHASE_10_{1,2,3,4}_COMPLETE.md` help-centre docs already in `completed/`); tick the launch tasks in `ROADMAP.md` ✅ + date; refresh **Current State** in `TO_START_EVERY_SESSION.md` to reflect public-launch posture; tag the release in git.

---

## 🚫 OUT OF SCOPE FOR PHASE 10 (explicit guardrails)

- ❌ **New features**. The whole point is to ship what's built. Feature requests collect in a backlog file (`docs/POST_LAUNCH_BACKLOG.md`) for Phase 11+.
- ❌ **Schema changes that aren't bug fixes**. Pure migration work that's not addressing a launch blocker waits for Phase 11.
- ❌ **Charting library / heavy animation**. The Civic Editorial bar / Recharts mount-gated combo is the rule; no new chart engines.
- ❌ **Anonymous / unattributed flows on any seeker-facing surface**. Every invite + every contact + every analytics export still attributes the actor.

---

## 🧭 WHY PHASE 10 IS A FENCE

Phase 1 → 9.8 built a system. Phase 10 lets it loose without breaking trust on day one. The discipline here is the inverse of every earlier phase: *resist* adding anything. The accessibility audit, the perf budget, and the translation rollout are the work. The credentials flip is the moment. After that, Sebenza is live.

*Plan opened 2026-05-24. Target: ship before any post-launch feature work begins.*
