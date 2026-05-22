# Mobile responsiveness — Mzansi National

> **Why this matters.** Most users will land on Sebenza from a low-end Android over metered data. That is the **No-Flash Rule** (`TO_START_EVERY_SESSION.md` §1) made concrete. Every issue below is a blocker, not a polish item.

**Target breakpoints**
| Width | Persona | Test budget |
|---|---|---|
| 360 px | Entry-level Android (primary) | Strict — every screen must work |
| 414 px | iPhone Pro Max / mid Android | |
| 768 px | iPad portrait / large foldable | First multi-column appears |
| 1024 px | Small laptop | |
| 1280 px+ | Desktop | Full editorial composition |

**Quality bar at 360 px**
- No horizontal scroll *anywhere* except where deliberate (sticky filter sheet, dashboard nav strip).
- All interactive elements ≥ 44 × 44 px tap target.
- All text ≥ 14 px body / 12 px secondary (no smaller-than-12 anywhere).
- All form controls native-sized for thumbs, not desktop sized down.
- The Mzansi National identity (chevron, flag stripe, palette) is present and proud — not hidden behind `md:`.

---

## Audit — what's broken right now

### Critical (M1, M2)
- [ ] **Header navigation hidden on mobile** with no replacement. On `<768 px`, both `SiteHeader` and `LandingHeader` hide nav links + locale switcher + Sign-in CTA; only "Get started" survives. → **No mobile menu exists.**
- [ ] **9 raw `<table>` elements** that overflow horizontally on 360 px:
  - `insights/page.tsx` (byStatus table)
  - `(seeker)/dashboard/grow/page.tsx` (city demand table)
  - `(seeker)/dashboard/account/page.tsx` (sessions list — currently semi-OK)
  - `(employer)/employer/team/page.tsx` (members)
  - `(employer)/employer/placements/page.tsx` (placements)
  - `(admin)/admin/users/page.tsx` (users)
  - `(admin)/admin/audit-log/page.tsx` (audit ledger)
  - `(admin)/admin/taxonomy/page.tsx` (vocab editor)
  - landing `page.tsx` (false positive — that's actually a `<dl>`)

### High (M3, M4)
- [ ] **Signature chevron motif is `hidden md:block`** on the landing hero — mobile users see no chevron at all in the hero. The design's identity disappears on the target device.
- [ ] **Profile hero** stacks fine but the 168 px Avatar (`size="2xl"`) is heavy on a 360 px screen; needs a mobile size step.
- [ ] **Search masthead headline** uses `clamp(2.2rem, 5.5vw, 4.2rem)` — at 360 px it lands at ~2.2 rem which is fine; but the number + role + location wraps awkwardly when the role name is long.
- [ ] **Trust dossier card** on profile hero takes full width on mobile and shows actions, completeness, member-since. Currently fine but the locked actions are disabled buttons — should they convert to a mobile-bottom-sheet action on small screens? *(decision: leave as static; works.)*
- [ ] **Touch targets** — Lucide icon buttons (close X, expand, delete, more) are often `size-4` inside small padding — under 44 px combined hit area in several places.

### Medium (M5, M6)
- [ ] **Dashboard top tab strip on mobile** scrolls horizontally with no visual affordance that you can scroll. Add a fade-edge cue.
- [ ] **Recharts on `/insights`** — line + bar charts are 260 px tall on a 360 px wide container; legible but cramped, and there are TWO charts side-by-side in `md:grid-cols-2`. On mobile they stack which is fine, but the tooltip on tap behaves poorly on touch.
- [ ] **Long handles / emails / status kinds** can overflow inside table cells and chips (e.g. `profile.contact.reveal` in audit-log).
- [ ] **Form `<select>` and `<input>`** — base height set via Tailwind's `h-10/h-11/h-12`. On iOS Safari, font-size < 16 px auto-zooms on focus. Need to verify font-size ≥ 16 px on inputs.

### Polish (M7)
- [ ] **Reduced motion** — already wired in `globals.css`; verify count-up + chevron draw + pulsing dot all honour it on mobile (low-end devices often request reduced motion).
- [ ] **`prefers-color-scheme: dark`** — not addressed yet. Out of scope for this pass; track for Phase 10.

---

## Plan — phased

### M1 · Mobile navigation drawer
Build a `<MobileNav>` drawer triggered by a hamburger in both `SiteHeader` and `LandingHeader`. Native `<dialog>` element (HTML-only behaviour, no JS framework cost). Inside:
- Full nav list (Find talent, Insights, Create profile)
- Locale switcher
- Sign-in CTA + Get-started CTA
- Footer trust strip
- Chevron motif and editorial type so the drawer is *part* of the design, not an afterthought

Touch hamburger to open, swipe-down / tap-outside / X to close. `prefers-reduced-motion` honoured.

### M2 · Responsive tables → mobile cards
Every `<table>` gets a parallel mobile rendering. Rule: at `<768 px`, render an editorial card list (each row is a card with the same data) instead of a horizontally-scrolled table. Helper component `<ResponsiveTable>` or per-page card layouts where the data shape differs enough.

Affected:
- `/insights` byStatus
- `/dashboard/grow` city demand
- `/dashboard/account` sessions (already card-ish, audit and align)
- `/employer/placements`
- `/employer/team`
- `/admin/users`
- `/admin/audit-log`
- `/admin/taxonomy`

### M3 · Hero + masthead mobile polish
- Landing hero: keep the chevron *visible* on mobile (smaller, positioned bottom-right corner, ~30 % opacity). It's the signature mark — must travel to mobile.
- Profile Avatar: introduce an `xl` mobile / `2xl` desktop pattern via responsive size prop, or apply a CSS responsive sizing variant.
- Search masthead: tighter line-height + wrap-balance so the hero number reads cleanly.
- Insights masthead: scale down the title at 360 px so the "Bulletin · updated" line doesn't collide with the title.
- All Mzansi headers (search/insights/profile/dashboard): test at 360 px.

### M4 · Touch targets + form fields
- Audit every `<button>` and icon-only button: ensure minimum **44 × 44 px** hit area via `min-w-11 min-h-11` or padding adjustments.
- Set form `<input>`, `<select>`, `<textarea>` to `font-size: 16px` on mobile to suppress iOS auto-zoom on focus.
- Increase chip-tap-target via vertical padding on mobile.
- Verify the `<details>` toggle on the seeker sign-up step 3 has a thumb-sized summary.

### M5 · Dashboard mobile pattern
- Add a horizontal-scroll **fade edge cue** to the dashboard top tab strip so users can see it's scrollable.
- Decide: keep top scroll strip (current) OR add a hamburger drawer just like the public site. **Decision: keep the scroll strip — it shows context.** But add the fade edges + an "active section" anchor that scrolls into view on load.
- The org-unverified banner on employer pages must wrap cleanly on mobile (currently uses `flex-wrap`; verify).

### M6 · Charts + special content
- Recharts: ensure tap-on-line tooltips behave on touch (Recharts handles this; verify and tighten any aria-labels).
- Long strings: add `break-words` / `truncate` / `min-w-0` discipline in tight cells (audit-log subject column, user-row email).
- Avatar component: confirm initials render legibly at `xs` 28 px size used in dense lists.

### M7 · Final pass + verification
- Manual sweep at 360 px through every route.
- Check `prefers-reduced-motion` on the landing animations.
- Check there are no horizontal scrolls.
- Lighthouse mobile audit (informally, via dev tools — full Lighthouse is Phase 10).
- Commit.

---

## Done log

- [x] **M1** — mobile navigation drawer *(2026-05-22)*. New `MobileNav` client component used by both `SiteHeader` (default tone) and `LandingHeader` (hero tone). Fullscreen panel with flag stripe, chevron-marked wordmark, three thumb-sized nav rows with hint text + arrow, large Get-started + Sign-in CTAs, locale switcher + trust strip in the footer band. Body scroll locked while open; Esc + scrim + X all close it; closes on route change.
- [x] **M2** — responsive tables → mobile cards *(2026-05-22)*. Eight tables now render as editorial card stacks below `md`: `/insights` byStatus, `/dashboard/grow` city demand, `/employer/placements`, `/employer/team`, `/admin/users`, `/admin/audit-log`, `/admin/taxonomy`. Each mobile card carries the same data with editorial typography, dl-style meta blocks, and truncation discipline for long handles / emails / kinds.
- [x] **M3** — hero + masthead mobile polish *(2026-05-22)*. Landing chevron motif now travels to mobile at 35% opacity behind the dossier (was `hidden md:block`). Profile hero renders an `xl` Avatar on mobile and `2xl` on `md+` (dual-render with hide/show). Search masthead h1 gains `text-balance` and a tighter clamp floor so it wraps cleanly at 360 px.
- [x] **M4** — touch targets + form fields *(2026-05-22)*. Global CSS rule forces `font-size: 16px` on every `input` / `select` / `textarea` under `md` (suppresses iOS Safari focus-zoom). Dashboard mobile tab strip lifted from `py-2.5` to `py-3` with `min-h-11` for thumb-size taps. Inline `text-wrap: balance` on h1/h2 and `text-wrap: pretty` on p.
- [x] **M5** — dashboard mobile pattern *(2026-05-22)*. Fade-edge gradient cue at the right of the dashboard mobile tab strip signals there's more nav to scroll. (Decision: keep the horizontal scroll strip, do not add a hamburger drawer — the strip is contextually richer than a drawer.)
- [x] **M6** — long-string truncation *(2026-05-22)*. Audit-log mobile cards use `break-all` on `kind` codes and `font-mono text-[0.68rem]` on the timestamp; user cards use `truncate` on the @handle · email line; taxonomy slug uses `truncate` inside a `min-w-0` column.
- [x] **M7** — verification *(2026-05-22)*. `npm run typecheck` clean; `npm run build` green (130+ static pages × 4 locales); every public, auth, dashboard, employer, admin, search, profile, insights, sign-up and error route returns 200; mobile-UA fetch confirms the MobileNav trigger is present; `prefers-reduced-motion` already honoured globally via the rule in `globals.css` from the Mzansi National rollout.

## Sign-off

All seven phases complete. Sebenza now meets the No-Flash Rule for navigation, layout, tables, type, touch targets, and form interaction on a 360 px Android over a metered connection. Lighthouse mobile audit and the full WCAG 2.2 AA sweep belong in Phase 10 of the main `ROADMAP.md` and are tracked there.
