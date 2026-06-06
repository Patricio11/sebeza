# HOMEPAGE MOBILE FIXES PLAN

*Side-fix between Phase 13.9 and Phase 12. Not a phase  two bug fixes against the landing page surfaced by user testing on a mid-size Android phone.*

> **Thesis:** Two distinct mobile bugs on `/` (the landing page):
>
> 1. The "Province or city" picker in the hero `<SearchBar>` doesn't open reliably on phones because the field is wrapped in a `<label>` that wraps the `CustomSelect` `<button>`. Tapping the label-area area dispatches a synthetic click on the wrapped button which collides with the user's actual tap on the button.
> 2. The hero headline "South Africa's" overflows horizontally on phones ≤ 360px because the responsive `clamp(3rem, 9vw, 7.2rem)` floor of 48px is too large for the 14-character word at that viewport. With no global `overflow-x: hidden` on `<body>`, the overflow leaks into horizontal page-scroll.

---

## 🎯 GOAL

After this fix ships, on every phone from 320px upward:

- Tapping the "Province or city" picker in the hero search bar opens the bottom-sheet picker reliably, every time. No more "tap does nothing" or "tap opens then immediately closes" reports.
- The headline word "South Africa's" fits within the viewport without horizontal scroll. The `SAChevron` artistic motif behind the hero stays artistic; the page never scrolls sideways.
- No regression on desktop, no regression on the other `<CustomSelect>` call-sites (`SearchFilters`, admin pages, etc.) that already work correctly.

---

## 🧱 ROOT-CAUSE ANALYSIS

### Bug 1: Label-wrapping-button antipattern in `SearchBar.Field`

`components/feature/SearchBar.tsx → Field()` (the wrapper around each cell of the hairline-divided search bar) renders a `<label>` element wrapping the cell's child. For the profession field, the child is an `<input>`  the natural form-control relationship. For the location field, the child is `<CustomSelect>` which renders a `<button>`.

**Why this breaks on mobile**: HTML's spec says a `<label>` element fires a synthetic click on the first labelable form-associated descendant when its own click event fires. A `<button>` IS labelable. So tapping the label fires a click on the button. The user's tap ALSO fires a click on the button (directly). On Android, these can sometimes collapse into one event, but in some browsers / fast taps they fire as two events, which `setOpen((o) => !o)` toggles: open → close in one tap.

**Why other `<CustomSelect>` call-sites work**: `SearchFilters.tsx → FilterGroup()` uses a `<div>` wrapper (not `<label>`); admin pages call `<CustomSelect>` directly. Only `SearchBar` wraps it in a `<label>`.

**Fix**: Change `Field()` to render `<div>` instead of `<label>` (with the eyebrow + visible label preserved as plain text since `<CustomSelect>` carries its own `aria-label`). Keep `<label>` for the profession field (native `<input>` benefits from the label association).

### Bug 2: Hero headline overflow on narrow phones

`app/[locale]/page.tsx` line 120 (and siblings) renders the headline lines at `text-[clamp(3rem,9vw,7.2rem)]`. The lower bound `3rem` = 48px. The word "South Africa's" at 48px display font  letter-spacing `-0.025em`  is roughly 280-300px wide. On a 360px phone with the hero's `px-5` (40px total padding), the content area is 320px. On a 320px phone (e.g. iPhone SE 1st-gen / older Androids), the content area is 280px. "South Africa's" exceeds both.

**Fix**: Lower the clamp's minimum from `3rem` to `2.25rem` (36px). The headline still reads as a large display headline at 36px; the word fits cleanly within 280px. Pair with `overflow-x: hidden` on `<body>` in `globals.css` as a structural safety net so any future child element with `w-[>100%]` cannot cause body-level horizontal scroll.

---

## 📋 FIXES

### Fix 1.A: `SearchBar.Field` for the location cell renders `<div>` not `<label>`

The simplest path: add a `wrapAsDiv?: boolean` prop on `Field`, defaulting to false (preserves the profession field's `<label>` behaviour). The location cell passes `wrapAsDiv`. The visible eyebrow text + label stay as plain spans; `<CustomSelect>`'s own `aria-label` carries the screen-reader association.

### Fix 1.B: Backstop  on `<button>` inside `<label>` add `onClick={e => e.stopPropagation()}` defensively

Skipped per D1: stopPropagation can break other click-handlers (the form's submit listener, future analytics). The label-vs-div fix is sufficient + cleaner.

### Fix 2.A: Lower the headline clamp

Three sibling spans on lines 120, 123, 126:
- `text-[clamp(3rem,9vw,7.2rem)]`  `text-[clamp(2.25rem,9vw,7.2rem)]`

### Fix 2.B: `overflow-x: hidden` on `<body>`

Add to `app/globals.css` `@layer base { body { ... } }`. Prevents any future child overflow from cascading into a sideways-scrolling page. Same posture as every framework default these days; the codebase has been getting away without it because nothing pre-Phase-13.9 had `w-[>100%]` children, but the hero chevron does.

---

## 🚫 OUT OF SCOPE

- ❌ Redesigning `<SAChevron>` overflow handling globally. The motif is intentional artistic clipping; the fix is the body-level safety net + the headline.
- ❌ Adding city-level granularity to the location picker. Out of scope; tracked separately.
- ❌ Rebuilding the hero for very-small-phone (<= 320px) first. The fix is responsive degradation, not a full mobile-first rewrite.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Fix the label wrapping at the `<div>` boundary, not by suppressing the synthesised click. | `event.stopPropagation()` would break submit handlers, analytics, and future click-tracking. Removing the label-button nesting is the structural fix. |
| D2 | Lower the headline clamp floor to `2.25rem`, not `2rem`. | 2rem (32px) reads too small for a hero display headline; 36px is the smallest size that still feels editorial. Tested mentally against the SA-flag-cream aesthetic. |
| D3 | Add `overflow-x: hidden` to `body`, not `html`. | `html` overflow:hidden can break `position: sticky` on iOS; body is the safer scope. |
| D4 | Preserve `<label>` for the profession field (which wraps `<input>`). | Native input + label is the correct accessibility pattern. The bug is specifically `<label>` + `<button>`. |

---

## 🧪 HOW TO VERIFY

1. On a 360px phone (Chrome DevTools or real device): tap "Province or city" in the hero. Confirm the bottom-sheet picker opens. Pick a province. Confirm it commits + closes.
2. Repeat on a 320px phone-emulated viewport.
3. Confirm desktop popover still works on the same SearchBar.
4. Visit `/search` to confirm `SearchFilters`' province picker still works (regression check).
5. On a 320px viewport, confirm the headline "South Africa's" fits within the visible width  no horizontal scroll on the page body.
6. Confirm the chevron motif is still visible upper-right  the fix is not about hiding the motif, just about preventing it from scrolling the page sideways.

---

## 📦 PROBABLE FOOTPRINT

- 2 file edits (`components/feature/SearchBar.tsx`, `app/[locale]/page.tsx`, `app/globals.css`).
- 0 schema changes.
- 0 server actions touched.
- 0 audit kinds added.
- ~30 line diff total.

---

*Plan opens for the bug fix. Both bugs are user-reported via screenshot; no DPIA implications.*
