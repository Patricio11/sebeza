# PLAN - ERROR SURFACES + PERFORMANCE CHECK

*Founder request (2026-08-13): "check on performance and error handling like 404, create a nice
404 page that fits our branding, really good."*

## Findings before the work

- `app/[locale]/not-found.tsx` exists and is lightly branded, but sparse: one CTA, no search, no
  helpful links. `app/[locale]/error.tsx` is branded with retry + home.
- **Gap 1:** no catch-all route, so URL shapes that fail the locale layout's validation fall
  through to Next's PLAIN WHITE default 404. Fix: the documented next-intl pattern, a
  `[...rest]` catch-all inside `[locale]` that calls `notFound()`, so every unknown path renders
  the branded 404 inside the locale layout (the proxy rewrites unknown prefixes to `en/...`).
- **Gap 2:** no `app/global-error.tsx`, so a root-layout crash renders Next's unbranded screen.
  Fix: a minimal branded one with inline styles (it replaces the layout, so Tailwind CSS is not
  guaranteed to load).
- Performance: the No-Flash budget is enforced by `tests/e2e/perf-budget.spec.ts` (script wire
  bytes per key route, tight ratchets over the 160 KB target, zero third-party). Run it to prove
  Phases 33/34 + /marketing didn't regress; the new 404 must add ZERO client JS.

## TASKS

- [x] Revamp `app/[locale]/not-found.tsx`: giant Fraunces 404 numerals, flag stripe, bulletin
  eyebrow, warm honest copy, a ZERO-JS search form (plain GET to /search) and quick links (Find
  talent · Insights · Create a free profile · How Sebenza works). SiteHeader + SiteFooter stay.
- [x] `app/[locale]/[...rest]/page.tsx` catch-all calling `notFound()` (specific routes always
  win over a catch-all; this only catches paths nothing else matched).
- [x] `app/global-error.tsx`: branded last-resort boundary, inline styles, html/body included.
- [x] `app/[locale]/error.tsx` polish: show the error digest as a support reference code.
- [x] `messages/en.json` errors namespace extended (zu/xh/af deep-merge fallback).

## VERIFY

- [x] Unknown path returns HTTP 404 with the branded page; bad-locale shapes too; real routes
  unaffected (landing/search/marketing 200).
- [x] The 404 ships zero route-specific client JS.
- [x] `tests/e2e/perf-budget.spec.ts` green on the Docker harness (no ratchet regressions).
- [x] typecheck + unit vitest green; screenshots for the founder.
