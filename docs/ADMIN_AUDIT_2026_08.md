# ADMIN WORKSPACE AUDIT - 2026-08-15

*Founder request: "fully check the admin side to make sure everything is working smoothly."
Method: inventory every surface, drive a signed-in admin through ALL of them on the Docker
harness with full error capture, run every admin workflow spec, fix findings, keep the walk as a
permanent regression gate.*

## What was checked

- [x] **Inventory**: 22 admin routes; all 19 nav entries map to real pages (no dead links);
  detail routes (/users/[id], /help/[slug], /taxonomy/suggestions) included in the walk.
- [x] **New permanent gate `tests/e2e/admin-smoke.spec.ts`**: a signed-in admin visits every
  surface on desktop AND 360px, failing on any of: the error boundary rendering, the 404
  boundary rendering, ANY console/page error (including next-intl MISSING_MESSAGE, the
  raw-i18n-key bug class), or a page with no main landmark / no headings. Screenshots of every
  surface land in `test-results/screenshots/` per run (gitignored by design).
- [x] **Admin workflow specs re-run**: admin-custom-skills, admin-learning-paths,
  admin-skill-prereqs, integrations (hub + SMS enable + consent-gated announcement),
  ai-coach-switch (ack gate), testimonials (approve → landing rail). 18/18 green both viewports.
- [x] **Admin-adjacent server flows** already covered elsewhere this week: taxonomy suggestion
  lifecycle incl. the new approval loop (integration, 141/141), org vetting + moderation +
  compliance assertions (compliance suite 30/30).

## Findings + fixes

- [x] **FINDING (fixed): React #418 hydration crash on /admin/taxonomy/suggestions.**
  `new Date(...).toLocaleDateString()` with NO locale argument in a server-rendered client
  component: the server's default ICU locale and the visitor's browser locale can format
  differently, and React tears down to a client re-render with a console error on every load.
  Fixed with a deterministic house formatter `formatDateZA()` (explicit en-ZA + Africa/
  Johannesburg + fixed options) in `lib/utils.ts`.
- [x] **Same latent bug swept platform-wide** (five more call sites, same fix):
  ShortlistsManager (employer), NotificationBell + NotificationsList (all roles), KycPanel
  (seeker, two spots).
- [x] No other findings: no dead nav entries, no error/404 boundaries, no missing i18n keys, no
  console errors on any admin surface after the fix.

## Verify

- [x] Admin smoke walk green, desktop + 360px (22 surfaces each, screenshots captured).
- [x] 6 admin workflow specs green both viewports (18 tests total).
- [x] typecheck + unit suite green after the formatter sweep.

*Rule going forward: never call `toLocaleDateString()` / `toLocaleString()` without an explicit
locale in anything server-rendered; use `formatDateZA()` (or an Intl formatter with explicit
locale + timeZone) instead.*
