# Accessibility audit  WCAG 2.2 AA

*Opened during Phase 10.5 (PHASE_10_LAUNCH_PLAN.md). Updated as findings land. Target: ship before public launch.*

> **Floor**: WCAG 2.2 AA on every route group. Operators read this doc; the static checklist below is the contract.

---

## Methodology

Two layers, in this order:

1. **Static scan** (this commit)  grep + axe-core static rules across the component tree. Captured below.
2. **Manual screen-reader + keyboard pass** (operator)  VoiceOver (macOS), NVDA (Windows), JAWS (Windows, optional). Specific flows the plan calls out: seeker sign-up, privacy + consent, dossier, vacancy detail, decline-with-reason modal.

Each finding gets a row below + a commit. WCAG 2.2 AA is the floor; AAA is welcome where it lands cleanly.

*A Playwright + `@axe-core/playwright` automated-runtime layer is tracked in [`POST_LAUNCH_BACKLOG.md`](./POST_LAUNCH_BACKLOG.md) but deferred  no resources for the test-harness build right now. Static scan + manual passes carry the audit until that lands.*

---

## Phase 10.5 static-scan results

> Captured 2026-05-30 against commit `0059564`. Re-run as the codebase evolves.

### What looks healthy

- **`prefers-reduced-motion`** is honored in `app/globals.css` and the components that animate (`AnimatedCount`, `MobileNav`, `CustomSelect`, `Skeleton`).
- **Decorative icons** are consistently marked `aria-hidden="true"` across `ComboboxField`, `MultiSelectComboboxField`, `MonthYearPicker`, `DatePicker`, `Avatar`, `CustomSelect`. Static grep found 29+ occurrences across the UI primitives; no obvious icon-as-content without label.
- **Form inputs** all route through `TextField` / `SelectField` / `TextareaField` / `ComboboxField` / `MultiSelectComboboxField`, each of which renders a `<label htmlFor>` paired with the input id. No raw `<input>` without a label found.
- **`<img>` without `alt`**: zero occurrences found in static grep. Most image rendering uses `next/image` via `Avatar` which forces an alt.
- **Dashboard shells** include a *Skip to main content* link in `components/layout/DashboardShell.tsx:96` for the seeker / employer / admin / gov surfaces.
- **`<html lang>`** is set per-locale from the route param in `app/[locale]/layout.tsx:60`. Screen readers pick up locale-aware pronunciation.
- **Civic Editorial palette tokens** (`--color-ink` on `--color-paper`) clear the 4.5:1 contrast floor; the ochre-on-paper accent is reserved for non-text emphasis (chips, borders) where the 3:1 UI floor applies.

### Findings to address before launch

| Severity | Finding | Where | Status |
|---|---|---|---|
| **High** | Public route group has no *Skip to main content* link. | `app/[locale]/layout.tsx` | ✅ **Fixed Phase 11.5.7** (2026-05-31). Skip link added in root layout; targets `<main id="main">` (already declared on every public page). |
| **Medium** | `<html>` has no `dir` attribute. | `app/[locale]/layout.tsx` | ✅ **Fixed Phase 11.5.8** (2026-05-31). `dir="ltr"` set explicitly; comment notes the future per-locale lookup when an RTL locale ships. |
| **Medium** | `MultiSelectComboboxField` "Suggested" / "All other" sections render as flat options, not groups. | `components/ui/MultiSelectComboboxField.tsx` | ✅ **Fixed Phase 11.5.9** (2026-05-31). Each section now wraps in `<div role="group" aria-label="...">` matching the visible divider text. |
| **Medium** | Recommendation ordinals (`01`, `02`, ...) announce as "zero one". | `app/[locale]/(seeker)/dashboard/grow/page.tsx` | ✅ **Fixed Phase 11.5.10** (2026-05-31). Wrapped in `aria-label="Recommendation N"` with the styled glyph inside an `aria-hidden` span. |
| **Medium** | City-demand gap bar is `aria-hidden` (correct) but the percentage isn't surfaced as text. | `/dashboard/grow` city-demand table | ✅ **Fixed Phase 11.5.11** (2026-05-31). Added `<span className="sr-only">{pct}% gap</span>` next to the visual bar. |
| **Medium** | `MonthYearPicker` listbox lacks `aria-activedescendant`; focused-month is invisible to AT. | `components/ui/MonthYearPicker.tsx` | ✅ **Fixed Phase 11.5.15** (2026-05-31). Container has `aria-activedescendant`; each button has `id="myp-month-{year}-{month}"`. |
| **Medium** | `<Avatar>` always announces as image. Standalone uses (header) need name; decorative uses (list row adjacent to text) should be `aria-hidden`. | `components/ui/Avatar.tsx` | ✅ **Fixed Phase 11.5.13** (2026-05-31). New `decorative` prop (default `false`); when `true`, the wrapper takes `aria-hidden="true"` and skips `role="img"`. |
| **Medium** | Focus-trap + Esc-close check on every modal-pattern (decline modal, contact-reveal modal, KYC review). | various | 🟡 **Partial** (Phase 11.5.12). New Phase 11 modals (BlockEmployer, ReportInvitation, SwitchProfession) handle it; older modals (AbandonModal, StatusCard picker, EmploymentVerification) leave focus on document body after Esc. Browser-default acceptable for launch; full focus-return sweep deferred to Phase 12. |
| **Low** | `aria-hidden="true"` icons inside buttons without sibling text. | UI primitives | Defer to the Playwright a11y pass. |
| **Low** | Cookie-consent banner dismiss button accessible name. | `components/feature/legal/CookieConsentBanner.tsx` | Manual review during the screen-reader pass. |

### Manual passes  pending (operator)

- [ ] VoiceOver on `/`, `/search`, `/p/[handle]`  read the page, navigate the search form, open a profile.
- [ ] VoiceOver on the seeker sign-up flow (3 steps including consent step).
- [ ] NVDA on Windows: same flows.
- [ ] Keyboard-only walk: Tab from top to bottom of `/employer/vacancies`. Confirm no keyboard trap; Tab order matches reading order; focus ring visible on every step.
- [ ] Esc closes every modal (KYC review, decline modal, contact-reveal, etc.).
- [ ] Screen-reader announcement of the decline-with-reason modal (Phase 9.8.5 highest-stakes form). The radio group label + reason copy must read correctly.
- [ ] Pinch-zoom to 200% on the home page  no content cut off, no horizontal scroll inside content.

---

## Running the audit

1. `npm run build && npm run start` (separate terminal).
2. Static scan: this doc captures the state at commit time; re-run grep patterns when components change.
3. Lighthouse CI (perf is in `docs/PERF_BUDGET.md`; the accessibility category lives here): `npx @lhci/cli autorun`  the a11y category must score 1.0 per `lighthouserc.json`.
4. Manual: walk the screen-reader checklist above.

---

## How findings get fixed

Each High / Medium finding lands as a separate commit cited back to this doc. The aim is to keep the audit dossier reproducible: a reviewer reading this doc + the commit history can retrace exactly what was found, what was fixed, and what was deliberately left for post-launch.

*Authoring rule*: no machine-translated copy on screen-reader content (the rule from `TO_START_EVERY_SESSION.md`). Tier-2 / Tier-3 catalog rollout (Phase 10.7) cascades into this audit  re-run the manual screen-reader pass once each locale enables.

---

## Phase 11.5 status

**7 of 8 findings closed (2026-05-31)** by the Phase 11.5 a11y batch  see `docs/completed/PHASE_11_5_COMPLETE.md` tasks 11.5.7 through 11.5.15. The 8th (modal focus-return sweep) is partial; newer modals handle it, older ones rely on browser default. Tracked for Phase 12.

---

*Last static scan: 2026-05-30. Phase 11.5 a11y batch landed 2026-05-31. Re-run when major UI work lands.*
