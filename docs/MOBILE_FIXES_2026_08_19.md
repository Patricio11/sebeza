# User-reported mobile fixes + all-custom date inputs (2026-08-19)

Three items from a real user's first session, plus the founder's standing
"everything must be a custom component" rule extended to dates.

## 1. "Screen freezes when you tap the three lines" (root cause found)
The mobile drawer was `fixed inset-0` rendered INSIDE a header carrying
`backdrop-blur`. An element with a `backdrop-filter` establishes a **containing
block for `position: fixed` descendants**, so the drawer resolved against the
~60px header strip instead of the viewport: invisible drawer, body scroll still
locked by the open-state effect. That reads exactly like a frozen screen.

**Fix:** `MobileNav` portals the drawer to `<body>` (`createPortal`), immune to
any ancestor's containing block. **Never render it inline again** - the same trap
is created by `transform`, `filter`, `perspective` and `will-change`, and the new
auto-hide header uses a transform.

**Regression cover:** `tests/e2e/mobile-nav-datepicker.spec.ts` asserts the
drawer's bounding box fills the viewport (a trapped drawer is header-height) and
that body overflow is released on close.

## 2. "Top bar doesn't disappear when you scroll down"
`components/layout/StickyHeaderShell.tsx` - the bar slides away on scroll-down
and returns on scroll-up, **small screens only** (`md:translate-y-0`). rAF-
throttled passive listener with a 6px jitter threshold (No-Flash), never hides
while the body is scroll-locked, honours `prefers-reduced-motion`. Exposes
`data-hidden` for tests. Landing header is `absolute`, so it is unaffected.

## 3. "No option to select year" on date of birth
The year grid existed but the only way in was an **unlabelled title tap**.
- The title is now an explicit control with a chevron (down = drill in, up =
  collapse), matching the founder's reference picker.
- The year view titles itself **"Pick a year"**.
- New `openTo` prop; both date-of-birth fields (sign-up + profile editor) pass
  `openTo="years"`, so the decade grid is the FIRST thing shown. The existing
  anchor logic already lands the page on 2004-2015 for the 14-year age gate, so
  a 2005 birthday is one tap away.
- WCAG 2.5.3 fix found while testing: an `aria-label` was overriding the visible
  title ("Year range"), so the accessible name did not contain the visible text.
  Names are now built from `titleText`.

## 4. Every date input is now the custom picker
Converted the last six native `<input type="date">`: admin oversight (x2, via a
new **uncontrolled `name` + `defaultValue` mode** mirroring CustomSelect so plain
GET forms still submit), StudentMilestoneEditor, MarkAsHiredCard, DepartureIsland,
MarkAsFilledModal.

**Guard:** `lib/ui/house-inputs.test.ts` walks `app/` + `components/` and fails
the suite on any raw `<select>` or `type="date"` outside the custom components
(comments stripped first, so prose about `<select>` is not a false positive).

## Verified
- [x] 307 unit + 166 integration tests, typecheck, lint 0 errors
- [x] `tests/e2e/mobile-nav-datepicker.spec.ts` 3/3 (drawer geometry, header
      hide/show, year grid + 2005 visible)
- [x] role-arcs + admin-smoke + pwa-mobile-nav
- [x] Screenshots: `docs/screenshots/mobile-fixes/`
