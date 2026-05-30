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

| Severity | Finding | Where | Suggested fix |
|---|---|---|---|
| **High** | Public route group has no *Skip to main content* link. Authenticated routes use `DashboardShell` which provides one; the public root layout does not. | `app/[locale]/layout.tsx` | Add a skip link in the root layout that targets `<main id="main">` (the public pages should declare a `<main>` landmark; verify each one does). |
| **Medium** | The `lang` attribute on `<html>` is locale-aware (good) but the `dir` attribute is not set. Tier-3 locales include none requiring RTL today, but explicit `dir="ltr"` documents intent + protects against future Arabic addition. | `app/[locale]/layout.tsx:60` | Add `dir="ltr"` (or a locale-aware lookup) on the `<html>` tag. |
| **Medium** | `MultiSelectComboboxField` dropdown is `role="listbox"` with `aria-multiselectable="true"` but the *Suggested for this role* divider is a `<p>`, not a group label. Screen readers announce the suggestions as flat options rather than grouped. | `components/ui/MultiSelectComboboxField.tsx:308` | Wrap each section in `role="group"` with `aria-label` matching the divider text. |
| **Medium** | Run a focus-trap check on every modal-pattern (decline modal in 9.8.5, contact-reveal modal, KYC review). Tab should cycle within the modal; Esc should close. Manual verification. | various | Note results during the screen-reader pass. |
| **Low** | `aria-hidden="true"` is used heavily on icons inside buttons that DO carry an `aria-label`  perfect. Confirm by-route there are no aria-hidden=true icons inside buttons that *lack* a sibling text label. | UI primitives | Audit during the Playwright a11y pass. |
| **Low** | The cookie-consent banner is dismissible but the dismiss button announces only the icon name (X). Verify the accessible name. | `components/feature/legal/CookieConsentBanner.tsx` | Manual review during the screen-reader pass. |
| **Low** | The `<Avatar>` `aria-hidden="true"` is correct when adjacent text is the accessible label (e.g. "John Doe" next to the avatar), but standalone avatars (top-right of header) need an `aria-label` or alt = the user's display name. | `components/ui/Avatar.tsx` | Add a prop `decorative` defaulting to true; when false, set an explicit accessible name. |

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

*Last static scan: 2026-05-30. Re-run when major UI work lands.*
