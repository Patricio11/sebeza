# ACCESSIBILITY STATEMENT PAGE PLAN

*Follow-up flagged in `SIGNUP_CONSENT_REGROUP_PLAN.md` out-of-scope: the SiteFooter has linked `/accessibility` since Phase 9 but the route never existed, a live 404, same gap class as `/terms` (fixed 2026-07-02).*

## 🎯 GOAL

A public `/[locale]/(public)/accessibility` page, a plain-language accessibility statement mirroring the `/terms` + `/privacy` shell (SiteHeader/Footer, Civic-Editorial masthead, `Section` blocks, last-updated stamp).

## 📋 CONTENT (sourced from `docs/A11Y_AUDIT.md`: claims must match reality)

1. **Commitment + standard**: WCAG 2.2 AA is the floor across every surface; accessibility is a founding rule (No-Flash: usable on a low-end Android over 3G), not a retrofit.
2. **What we've built**: honest list from the audit's "healthy" findings: skip links, per-locale `lang`, labelled form controls, `prefers-reduced-motion` honoured, keyboard-navigable custom pickers, visible focus, 4.5:1 contrast tokens, 360px-first layouts, low-data posture + data-saver mode.
3. **Known limitations**: honest per the Verification-Honesty ethos: audit is static-scan + manual passes (automated runtime axe suite still tracked in the backlog); interface currently English with zu/xh/af fallback; ongoing work.
4. **Feedback channel**: accessibility issues to `popia@sebenzasa.com`; commitment to respond.
5. **Review cadence**: statement updated as the audit doc evolves.

## OUT OF SCOPE

- ❌ New audit work or fixing open audit findings, this page *reports* the posture, it doesn't change it.
- ❌ i18n of the statement body (matches `/terms` + `/privacy`: English body, human translation later).

## VERIFY

`/accessibility` returns 200 with the statement (footer link no longer 404s); typecheck + vitest green.
