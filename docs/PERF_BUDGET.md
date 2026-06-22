# Performance budget  public launch

*Opened during Phase 10.6 (PHASE_10_LAUNCH_PLAN.md). Updated as routes change. Target: ship before public launch.*

> **Floor (from `TO_START_EVERY_SESSION.md`)**: works on a low-end Android over 3G; JS budget ~150 KB on key routes; no heavy animation; no 3D; Recharts mount-gated.

---

## Methodology

Three measurements, in this order:

1. **Bundle composition** (operator)  `ANALYZE=true npm run build` (config in `next.config.ts`). Confirms the route-level JS treemap. The wrapper is lazy-loaded; install `@next/bundle-analyzer` once via `npm i -D @next/bundle-analyzer`.
2. **Lighthouse CI** (operator)  `npx @lhci/cli autorun` against the routes listed in `lighthouserc.json`. Throttling profile = Slow 3G + mid-tier CPU + 360 px mobile viewport. Assertions land in `lighthouserc.json` + `lighthouse-budgets.json`; both fail the run if a route blows the budget.
3. **Manual network walk** (operator)  Chrome DevTools  Network panel  Slow 3G preset. Confirm no waterfall longer than 2 round trips for first paint; no third-party trackers; signed photo URLs only on public reads.

---

## Route-level budget

> Fill in measured values as runs complete. Empty cells = not yet measured.
>
> **JS bundle column measured 2026-06-12 (Phase 12)** via the automated
> gate `tests/e2e/perf-budget.spec.ts`  script WIRE bytes (encoded
> transfer via `Request.sizes()`, deterministic across runs) for the
> document's own `<script src>` set on the production build, asserted on
> every `npm run test:e2e` run with zero-third-party enforcement.
> **Finding: the shared App Router baseline puts every key route ~35–50 KB
> over the 160 KB No-Flash target.** Ceilings in the gate are tight
> ratchets (measured +3 KB) so routes can only improve; the backlog
> "No-Flash bundle pass" walks them down to target. Lighthouse score
> columns remain operator-hands (full Chrome + the LHCI publish step).

| Route | Perf score | A11y score | LCP (Slow 3G) | TBT | CLS | JS bundle | Notes |
|---|---|---|---|---|---|---|---|
| `/` | _ | _ | _ | _ | _ | ⚠️ **194.2 KB** (2026-06-12) | Over target  shared baseline. Ratchet 198 KB. |
| `/search` | _ | _ | _ | _ | _ | ⚠️ **210.2 KB** (2026-06-12) | Heaviest public route (filters + roster islands). Ratchet 214 KB. |
| `/p/[handle]` | _ | _ | _ | _ | _ | ⚠️ **195.5 KB** (2026-06-12) | Over target  shared baseline. Ratchet 199 KB. |
| `/sign-in` | _ | _ | _ | _ | _ | ⚠️ **196.8 KB** (2026-06-12) | Better Auth form. Ratchet 200 KB. |
| `/sign-up/seeker` | _ | _ | _ | _ | _ | _ | 3-step wizard; ComboboxField + ConsentRow. |
| `/sign-up/employer` | _ | _ | _ | _ | _ | _ | KYC form. |
| `/dashboard` | _ | _ | _ | _ | _ | _ | Seeker overview; rank-in-pool, freshness. |
| `/dashboard/profile` | _ | _ | _ | _ | _ | _ | Largest profile editor; check MultiSelectComboboxField cost. |
| `/dashboard/invitations` | _ | _ | _ | _ | _ | _ | Inbox; lightweight. |
| `/employer/vacancies` | _ | _ | _ | _ | _ | _ | Vacancies list; static at first. |
| `/employer/vacancies/new` | _ | _ | _ | _ | _ | _ | Largest employer form. |
| `/employer/vacancies/[id]/match` | _ | _ | _ | _ | _ | _ | Match page; multi-select bulk. |
| `/admin` | _ | _ | _ | _ | _ | _ | KPIs + recent activity feed. |
| `/admin/audit-log` | _ | _ | _ | _ | _ | _ | Filterable table; check filter-form cost. |
| `/gov` | _ | _ | _ | _ | _ | _ | LMI hero; Recharts is mount-gated. |
| `/gov/curriculum` | _ | _ | _ | _ | _ | _ | Heatmaps; Recharts heavy. Verify the mount-gate. |
| `/insights` | _ | _ | _ | _ | _ | ⚠️ **291.7 KB** (2026-06-12) | **Recharts adds ~95 KB on top of the shared baseline  it ships in the route bundle; mount-gating defers EXECUTION, not TRANSFER.** Ratchet 296 KB. Fix (dynamic-import the chart islands) is the backlog No-Flash bundle pass. |
| `/privacy` | _ | _ | _ | _ | _ | _ | Mostly static prose. Should LCP < 1.5s. |
| `/paia` | _ | _ | _ | _ | _ | _ | Mostly static prose. |

---

## JS budget posture

### Encoded floor

`lighthouse-budgets.json` enforces:

- **Script**: 160 KB per route (the No-Flash ~150 KB target + 10 KB headroom).
- **Stylesheet**: 40 KB.
- **Image**: 200 KB.
- **Font**: 100 KB (Fraunces + Hanken Grotesk subsets).
- **Third-party**: 0 (no trackers, no analytics SDKs, no third-party fonts loaded client-side).

A route that ships more than budget fails the LHCI assertion + the build pipeline.

### Known heavy contributors

- **Recharts**: only used on `/insights`, `/gov`, `/gov/curriculum`, `/gov/provinces/[slug]`. The `experimental.optimizePackageImports` config in `next.config.ts` keeps tree-shaking aggressive. Each chart is rendered behind a client-mount gate (the chart-island only mounts after the page paints).
- **Lucide icons**: tree-shaken per import; never `import * from "lucide-react"`.
- **`next-intl` messages**: the active locale's JSON ships per route; English deepMerge fallback means missing keys don't add weight.
- **Better Auth**: required on auth-related routes; minimised footprint at last build.

### Optimisation playbook  if a route blows budget

1. Run `ANALYZE=true npm run build` and read the treemap for the offending route.
2. If a Recharts chunk shows up on a non-insights route, the mount-gate is leaky  audit the imports.
3. If a Lucide icon block is large, check for star-imports (`import { * } from`).
4. If a feature component is large, consider `dynamic()` import with `ssr: false` for client islands.
5. Re-measure with the same lighthouserc.json runs to confirm the budget is back below floor.

---

## Manual network walk

> Operator-driven; pending.

Checklist for each key route:

- [ ] No third-party domains in the Network panel.
- [ ] Photo URLs are signed (e.g. `?token=...&expires=...`) on public reads. Confirm no raw storage keys.
- [ ] First-paint chain is no more than: HTML  CSS  font  hero image. No JS in the chain.
- [ ] No 404s on assets.
- [ ] HTTP/2 multiplexing observed for static asset reads.
- [ ] Cache-Control headers on static assets set appropriately (long max-age for hashed bundles; revalidate for HTML).

---

## Sentry + rate-limit posture

Performance + reliability cross over here: Sentry catches the production errors that perf regressions surface; the rate limiter protects perf headroom by absorbing abusive traffic.

- **Sentry**: Phase 9 shipped the skeleton; `SENTRY_DSN` env var flips it on. Verify the DSN points at the right project before public launch.
- **Rate limiter**: `lib/limiter/` ships an in-memory limiter by default; `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` flip it to Upstash. Confirm 429 lands correctly under a synthetic abuse run (Task 10.6).

---

## Running the audit

1. `npm run build && npm run start` (separate terminal).
2. Bundle composition: `ANALYZE=true npm run build` (requires `@next/bundle-analyzer` installed). Open `.next/analyze/client.html`.
3. Lighthouse CI: `npx @lhci/cli autorun`. The JSON snapshots write to `.lighthouseci/`.
4. Manual: walk the network panel checklist above on Slow 3G.

The LHCI run is reproducible; commit the JSON outputs alongside this doc if you want to track perf-over-time.

---

*Last measured: pending operator run. Re-run after every major route change.*
