# PRODUCT-ENGINEERING BLUEPRINT

*A reusable starter for building serious, non-generic web products.*

This document is the **portable distillation** of what a working production codebase does to feel non-generic — distinct from the SaaS-template look that dominates B2B apps in 2026. It is **not a design system in the sense of "pick a colour and a font."** It is a discipline: a small set of principles, a set of structural patterns, and a set of engineering invariants that together make a product feel like it was *made by someone who cared*.

The blueprint is **fully neutral**. It does not name a brand, a country, a colour palette, an industry, or a typography pairing. Every concrete choice you see is presented as a *type of decision* you must make for your own product — not as the decision itself.

How to use this document:

- Read it once cover-to-cover before you write a line of code on a new project.
- Adopt §1 (Principles) verbatim. They survive any rebrand.
- Adapt §2 (Aesthetic) to your domain. The *categories* of choice are the point, not the specific values.
- Copy §3 (Component patterns) and §4 (Engineering invariants) into your own `docs/` folder. They transfer 1:1.
- Run the §7 quality gates on every commit. They are what stops a "looks great in screenshots" product from being a "broken in production" product.

---

## §0 — TABLE OF CONTENTS

1. **Principles** — the small set of non-negotiable rules
2. **Aesthetic discipline** — typography, palette, motion, density (as decision categories)
3. **Component patterns** — what to build, in what categories, with what design intent
4. **Engineering invariants** — the cross-cutting patterns that make the design ship
5. **Layout & responsive** — mobile-first, sheet-vs-popover, touch targets
6. **Accessibility commitments** — WCAG 2.2 AA as a hard requirement
7. **Quality gates** — typecheck, lint, tests, compliance, build
8. **Documentation discipline** — plans, completion records, rule books
9. **Adoption checklist** — how to apply this blueprint to a new project

---

## §1 — PRINCIPLES (non-negotiable)

These eight rules govern every decision in the codebase. When two rules conflict, the higher-numbered rule yields. When a rule conflicts with a "wow factor" instinct, **the rule wins, every time**.

### 1.1 Performance & accessibility win over visual flourish

Every page must be usable on the cheapest device your target market actually owns, over the worst connection that market commonly experiences. No 3D, no hero video, no heavy animation libraries by default. JS budget per page is a number you commit to in writing — and enforce in CI. If a "stunning" design choice would push you past it, the design choice yields.

The single best heuristic: **does this load on a 5-year-old Android over 3G in under 2 seconds?** If not, simplify.

### 1.2 Compliance-first from commit one

If your product touches personal data, financial data, healthcare data, government data, or any other regulated category — consent capture, encryption-at-rest, audit logging, soft-delete, and right-to-erasure are **built in from the first migration**, not bolted on before launch. Retrofitting these is more expensive than building them right, and the security/compliance posture you ship with is the one regulators evaluate you on.

Concretely: every code path that touches sensitive data calls a single audit-log helper. Every PII column is encrypted at-rest if it could identify an individual. Every consent decision is stored with the version of the consent text the user saw and the timestamp.

### 1.3 Honesty-first product language

Never display a positive trust signal (verified, approved, certified, complete) for self-reported data. Default state is always the lowest-trust state. Badges must reflect reality even when reality is "we don't know yet."

Concretely: a "verified" badge appears only after a verifiable action (admin review, third-party check, document upload + approval). If nothing has been verified, the badge says `unverified`, not nothing. Showing nothing is worse — it hides the question and tricks the user into assuming verification.

### 1.4 Freshness is part of truth

Time-stamp every status, every count, every dashboard number. Stale data is **down-ranked, marked, and gently nudged for refresh** — not silently presented as current. Analytics surfaces must distinguish fresh from stale and never average them blindly.

A status field that says "Open to work" with no `confirmedAt` is a bug. Add the timestamp, surface its age, and decay confidence over time.

### 1.5 Public payloads carry no secrets, ever

Define a `PublicProfile` (or equivalent) TypeScript type that is the **only shape** ever sent to public surfaces — search results, indexable pages, embeds. PII (ID numbers, raw contact details, document storage keys, file blobs) lives in private types that the public type cannot extend. The type system enforces redaction at compile time.

A compliance assertion in your test suite samples public surfaces and fails the build if any private field leaks. This is the structural defence; the type system is the first line.

### 1.6 Three-layer auth

Every protected route is gated three times: **(1) edge proxy** (the user-experience redirect — keep them out of the wrong page entirely), **(2) data-access layer** (the real authorization check — the only one that matters), **(3) every Server Action / mutation** (defence-in-depth — never trust that the caller is who they claim to be).

The proxy is for UX. The DAL is for security. Server Actions are for "the proxy was bypassed and the DAL was somehow misconfigured" — and they still refuse the operation.

### 1.7 Mock-first development with a stable data seam

Build the entire UI against typed mock data behind a single seam (e.g. `lib/data/provider.ts`). When the database lands, you flip the seam from `mockProvider` to `dbProvider` — and **no page changes**. Same types, same shape, same behaviour.

This decouples UI work from backend work, lets a designer review at production fidelity months before the DB schema is final, and makes the first real-database deploy boring instead of terrifying.

### 1.8 Rules win over instinct

When a rule above conflicts with a design instinct, the rule wins. Document the conflict in a code comment so the next reader knows the choice was deliberate.

---

## §2 — AESTHETIC DISCIPLINE

This section is about *categories of decision*, not specific values. Whatever values you pick must be defended on these grounds.

### 2.1 The reconciliation: stunning AND fast

A stunning product can still be fast. The trick is to source distinctiveness from things that **cost nothing at runtime**:

| Stunning comes from | NOT from |
|---|---|
| A distinctive type pairing (two faces — one for display, one for body) | Heavy hero video / 3D / WebGL |
| A confident palette used with restraint, not literal-everywhere | Decorative animation everywhere |
| Asymmetric editorial layouts, generous space, strong hierarchy | Generic SaaS card grids on every page |
| 2–3 *signature* interactions, repeated across the product | Framer Motion on every element |
| Mobile-first identity: distinctive at 360 px, not just at desktop | A desktop-only stunning |
| Meticulous detail: cursor states, focus rings, empty states | Spectacle over clarity |

Commit to a JS budget and a font budget at the start of the project. Treat them as launch-blockers.

### 2.2 Typography: pick two variable fonts, deliberately

Pick two **variable** fonts — one display, one body. Avoid the defaults (Inter, Roboto, system-ui) unless your brand is the kind that demands invisibility. The pairing is the cheapest and most durable source of distinctiveness in your product.

- **Display face**: characterful, with personality. Used for headlines, hero, numbers that matter. Optical sizing if the family supports it.
- **Body face**: highly legible at small sizes. Used for UI, paragraphs, labels.
- Subset to the scripts your product actually serves. `font-display: swap`. Preload only the two weights you use above the fold.
- Type scale uses `clamp()` for fluid sizing. One scale per app — no per-page deviations.

### 2.3 Palette: semantic tokens, not literal colours

Every colour in the codebase is a CSS variable with a **semantic name**, not a hex value:

```css
--color-ink           /* primary text */
--color-ink-soft      /* secondary text, captions */
--color-paper         /* page background */
--color-surface       /* card / panel background */
--color-surface-sunk  /* wells, inputs */
--color-hairline      /* dividers, subtle borders */
--color-brand         /* the primary action colour */
--color-brand-strong  /* hover / active state */
--color-brand-tint    /* faint background tint for callouts */
--color-accent        /* the secondary highlight */
--color-accent-tint
--color-danger        /* errors, alerts only — never decorative */
```

**Rules of palette construction:**

- Light-default. Public trust reads better in light. Dark mode is optional and ships later.
- Every text/background pair meets WCAG AA contrast (≥ 4.5:1 body, ≥ 3:1 large).
- Reserve one colour for `danger` and use it for nothing else. The instant it shows up on a decoration, it stops being a useful alert signal.
- Avoid neon. Avoid pure black on pure white. Soften both ends — warmer-than-paper, near-black-not-black.

### 2.4 Spacing, radius, elevation: tight discipline

- One spacing scale, in rem: `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 / 6`. Strict 8px (or 4px) rhythm.
- Three radius tokens: `sm`, `md`, `pill`. Pick a value for each and stop.
- Elevation: at most two shadow tokens (soft + medium). No neon glows, no double-shadows, no inset-on-hover.
- Touch targets minimum 44 × 44 px. Focus ring 2 px + 2 px offset, always visible on keyboard nav.

### 2.5 Motion: cheap and purposeful

Motion is a budget like JS. Spend it on **2–3 signature interactions** that repeat across the product:

- One hero reveal on the landing page (staggered fade/translate via CSS keyframes — no JS library).
- One interaction-triggered animation (focus, hover, transition) per repeated element.
- One state-change animation for the product's core mechanic (e.g. a status indicator that draws in over a slow second).

Everything else is instant. All motion lives inside `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`. Always.

### 2.6 Iconography: one library, used sparingly

Pick one icon library (Lucide is a good default — outline, line-weight consistent, tree-shakeable). Import per-icon, never the whole library. Icons should be the supporting cast, not the lead — let typography carry the hierarchy.

---

## §3 — COMPONENT PATTERNS

Categorised by role. Each category lists the **design intent**, not a specific implementation. Build the components that make sense for your product; the categories below are the ones you almost certainly need.

### 3.1 Form fields

A `<FieldShell>` wrapper provides:
- The label (uppercase tracked, small caps, semantic)
- The optional right-aligned badge slot (e.g. "Encrypted on save", "Optional", "Required")
- The input slot (passed as children)
- The hint / error slot below

A `<TextField>` composes `<FieldShell>` + a styled `<input>`. Variants for type live as separate components when behaviour diverges:

- `<PasswordField>` — same prop shape as TextField minus `type`, with a built-in show/hide eye toggle. Toggle is `tabIndex={-1}` so a Tab from the input goes to the next form field — keyboard users rarely need it, accidental password reveal on a shared screen is the bigger harm.
- `<TextareaField>` — same shell, taller input, with max-length surfaced as a character counter.
- `<SelectField>` — server-friendly; wraps native `<select>` so it works without JS. A separate `<CustomSelect>` (client-only, portaled) replaces it where mobile sheets matter.

**Rule:** server-component-friendly inputs (TextField, SelectField, TextareaField) live in one file with no `"use client"`. Client-only inputs (PasswordField, CustomSelect, ComboboxField, DatePicker) live in their own files with `"use client"`. This keeps `TextField` cheap to import from server pages without dragging an unnecessary client boundary into the bundle.

### 3.2 Pickers

Three picker patterns cover almost every selection use case:

- **`<ComboboxField>`** — single-select with type-to-filter. The filter rank algorithm sorts by "starts with" first, then "contains," then earliest-substring. Supports an optional `leading: string` slot per option (e.g. a flag emoji for a country picker) that is **excluded from the filter rank** — so typing "south" still ranks "South" entries first, not after the flag character.
- **`<DatePicker>` / `<MonthYearPicker>`** — three-view popover (day → month → year) with arrow-key navigation, range-clampable via `min` / `max`, and mobile-first behaviour (bottom-sheet on phones, dropdown on `md+`).
- **`<CustomSelect>`** — for short option lists where a combobox is overkill. Portaled into `document.body` so no ancestor `transform` / `overflow` displaces it. Desktop: anchored popover. Mobile: full-screen bottom sheet with backdrop + thumb-sized close.

Every picker emits the same value contract its native equivalent would (string for single-select, `string[]` for multi). Drop-in replacement; no parent rewrite.

### 3.3 Status indicators

Three categories of status indicator, each with a strict honesty rule:

- **`<VerificationBadge>`** — `unverified / pending / verified / rejected`. Default is unverified. Never auto-promotes.
- **`<StatusChip>`** — encodes a state + its freshness in one glyph. Solid ring for fresh, half-ring for ageing, dashed outline for stale. Always carries text + ARIA + relative time. Never colour-only.
- **`<ProfileCompleteness>`** — 0–100 % progress indicator. Honest about what counts; the formula is documented next to the component.

### 3.4 Layout shells

A small set of shells wrap every page in the product:

- **`<LandingHeader>`** — public marketing pages. Absolute over the hero. Transparent until scroll.
- **`<SiteHeader>`** — sticky internal-page header. Same on every authenticated route.
- **`<SiteFooter>`** — same on every page. Contains POPIA / privacy / language-switcher / trust strip.
- **`<MobileNav>`** — full-screen drawer used by both headers below `md`. Body-scroll-locked. Closes on Esc, scrim tap, close button, or route change.
- **`<DashboardShell>`** — role-themed (different accent strip per role) sidebar + main panel. Used by every authenticated workspace route.
- **`<AuthShell>`** — wraps every sign-in / sign-up / verify-email / reset-password page. Carries the brand chrome + a right-hand "how this works" sidebar slot.

### 3.5 Lists (the editorial roster pattern)

Default list-style is **editorial, not card-grid**. A list row has:
- Avatar / leading glyph (one column)
- Identity column: name + verification badge + meta line
- Status / chip column: chips + freshness
- Optional action column on the right

Rows are separated by **hairline rules**, not by card outlines. This single layout choice is one of the cheapest ways to look distinctively serious instead of generically SaaS.

### 3.6 Empty / loading / error / redacted / offline states

Define all five for every data surface:

- **Loading**: skeleton (never spinner-only). The skeleton matches the shape of the eventual data.
- **Empty**: helpful copy + a clear next action. Never a sad face emoji.
- **Error**: plain language, a retry action, the offending input highlighted if it was a validation problem.
- **Redacted**: locked panel with a clear reason ("This is visible to verified employers only"). Never a broken layout where data should be.
- **Offline**: cached last results + a small banner ("Showing your last 20 results from 4 minutes ago — reconnect to refresh").

A product is judged on its edge cases. Wire all five before any page is "done."

---

## §4 — ENGINEERING INVARIANTS

These are the cross-cutting code patterns that make the design *ship without breaking*. They look boring. They are what separates a product that loads on the first try in production from one that needs three tries.

### 4.1 Server vs client component discipline

For Next.js App Router (or any framework with a server/client split):

- **Default is server.** No `"use client"` unless the component has interactive state, browser-only APIs, or a hook that needs the client runtime.
- **A `"use client"` directive propagates.** Anything that imports a client component (transitively) becomes part of the client bundle. Audit which low-level components you mark client — adding `"use client"` to a leaf used everywhere bloats the whole app.
- **When in doubt, split.** Make a small client-only wrapper that contains the interactive bit; let the rest stay server. The `<PasswordField>` pattern (client-only wrapper of a server-friendly `<TextField>`) is the canonical example.

### 4.2 Form-draft persistence (the locale-switch trap)

Any form that takes more than 30 seconds to fill in **must persist its in-flight state** to `sessionStorage`. The reason: in a multi-locale app, the locale switcher swaps the URL and remounts the page tree — which wipes every `useState` in the form. The user loses everything.

Single shared hook:

```ts
const { clear } = useSessionDraft(KEY, {
  state: persistableSlice,         // pre-filter sensitive fields
  onRestore: (draft) => applyDraft(draft),
});
// On successful submit:
clear();
```

**Three invariants the hook enforces:**

1. **Passwords / blobs / secrets are never written.** Callers pass a pre-filtered slice. The hook does not introspect.
2. **Restoration runs in `useEffect`, not initial `useState`.** Otherwise SSR markup doesn't match first client render — hydration mismatch warnings, real bugs in concurrent mode.
3. **Silent failure on disabled storage.** Private browsing, enterprise policy, quota errors — all swallow cleanly. The form still works without restoration.

`sessionStorage`, not `localStorage`. Tab-scoped. No long-lived half-completed forms on shared computers.

### 4.3 Hydration safety

Hydration mismatches are not a stylistic warning — they're a real concurrency hazard. Common causes + fixes:

- **Reading from `window` / `localStorage` in `useState` initialiser.** Move to `useEffect`. Render a stable initial state, then update.
- **Random IDs in render** (e.g. `useId()` used incorrectly, `Math.random()` for stable IDs). Use `useId()` correctly or hash a stable input.
- **`new Date()` in render.** Pass the timestamp from the server as a prop; render relative time client-side via `useEffect`.
- **Browser extensions injecting attributes.** Some extensions (security suites, password managers, grammar checkers) walk the DOM and inject attributes before React hydrates. Apply `suppressHydrationWarning` to `<body>` to absorb the attribute-level noise — but only on `<body>`, never broadly, because it disables real hydration validation on its subtree.

### 4.4 Email transport: SMTP-only, vendor-agnostic

Email lives behind a single `sendEmail({ to, subject, html })` helper. The transport is `EMAIL_TRANSPORT=smtp | console`, configured via standard SMTP env vars (`SMTP_HOST / PORT / SECURE / USER / PASS / FROM / FROM_NAME`).

**Why SMTP-only:** any provider supports SMTP (Mailtrap for dev, Resend / Sendgrid / Postmark / AWS SES for prod). Provider becomes an env-var swap, not a code change. One nodemailer dependency replaces N vendor SDKs.

**Failure mode the design must catch:** in production, if `EMAIL_TRANSPORT` is unset but `SMTP_*` env vars are present, the helper **throws a clear error** rather than silently falling back to console transport. The silent-fallback trap is the most common deploy-config mistake — emails go to the server log, the framework thinks the send succeeded, the user gets nothing, and the provider dashboard stays empty.

Ship a diagnostic panel in your admin surface that sends a one-off test email and reports the actual transport that handled it. Three outcomes shown inline:
- **Green** — provider accepted the send, with message ID for cross-reference.
- **Yellow** — transport fell back to console (operator immediately sees the env-var problem).
- **Red** — raw SMTP reject reason.

### 4.5 Audit logging as a first-class concern

Every code path that touches sensitive data calls **one** audit helper:

```ts
await logAccess({
  kind: "profile.view",
  actor: session.id,
  subject: profile.id,
  meta: { /* anything relevant */ },
});
```

`AuditKind` is a TypeScript union of string literals. Adding a new audit kind requires extending the union — the type checker is the gate that prevents free-text audit kinds drifting across the codebase.

Audit rows never contain raw PII directly. The `meta` field carries IDs, counts, decisions — not names, emails, ID numbers, document contents.

### 4.6 Mock-first data seam

A single `dataProvider` interface defines every read your UI does. Phase 1 implements `mockProvider` against typed fixtures. Later phases swap in `dbProvider` against the real database — **without changing a single page**.

```ts
// lib/data/provider.ts
export interface DataProvider {
  getProfile(handle: string): Promise<PublicProfile | null>;
  searchProfiles(filters: SearchFilters): Promise<SearchResult>;
  // …
}
```

Pages import `dataProvider` (the singleton chosen by env var), never a specific implementation. The swap is config, not code. Designers can review at production fidelity months before the database is ready.

### 4.7 Compliance assertions (a class of test)

Beyond unit tests, ship a set of **runtime compliance assertions** that walk the live database and verify structural guarantees:

- "Public profile payloads never contain field X."
- "Every row in table Y has a corresponding consent row for purpose Z."
- "No aggregate analytics response below the k-anonymity floor leaves the building."

Each assertion returns `{ ok, name, message }`. They run on demand against the production database (admin-only endpoint) — a single dashboard call confirms the platform is still honest about every structural invariant you've claimed. CI runs them against a seeded test database.

The list of assertions is the platform's machine-readable trust posture. It grows over time. Each new feature that touches sensitive data should add at least one assertion.

### 4.8 Internationalisation: never machine-translate legal copy

If your product ships in multiple languages: machine-translate UI strings (and audit them later), but **never** machine-translate consent text, privacy notices, terms of service, or any other legal copy. Use a professional translator. The cost is real but small relative to the legal exposure of a mistranslated consent.

Operationally: keep one canonical-language message catalog (typically English). Other locale catalogs deep-merge against it, so a missing key falls through to the canonical string — never to "missing translation" rendered in the UI.

---

## §5 — LAYOUT & RESPONSIVE

### 5.1 Mobile-first, real-device-first

Design at **360 px width**, not at 1440. The cheap device is the median; the laptop is the edge case. Build the 360 layout first, scale up to `md` (768) and `lg` (1024) by relaxing constraints — never the other way round.

Breakpoint scale: `360 (base) → 640 (sm) → 768 (md) → 1024 (lg) → 1280 (xl)`. Most pages need only `md` and `lg` overrides; resist adding more breakpoints.

### 5.2 Sheet vs popover

- **Below `md`**: every overlay is a **full-screen bottom sheet** with a backdrop and a thumb-sized close. Inline popovers on a 360 px screen are unreachable and look broken.
- **`md+`**: anchored popovers from the trigger rect. Width capped (~320–420 px).
- Same component, two presentations. Pick the breakpoint to switch in one place — never per-component.

### 5.3 Touch targets, reachability, scroll lock

- Minimum 44 × 44 px tap targets on every interactive element.
- Primary actions in the thumb-reach zone (bottom third of the screen on mobile).
- When an overlay is open, body scroll is locked. Close on Esc, scrim tap, close button, **and route change** (the back button must close the sheet, not the page).

### 5.4 No hide-behind-`md:`

A product that's distinctive on desktop and generic on mobile has a *desktop-only* identity. The signature components (logo mark, hero, distinctive list pattern) must travel to 360 px. The reverse — distinctive on mobile, generic on desktop — is rarely a problem; the discipline is making sure the mobile is the source of truth.

---

## §6 — ACCESSIBILITY COMMITMENTS

WCAG 2.2 AA is a **hard requirement**, not an aspiration. Non-negotiable items:

- **Contrast** ≥ 4.5:1 body / ≥ 3:1 for large text and UI components.
- **Visible focus ring** on every interactive element, on keyboard nav. Never `:focus { outline: none }` without a replacement.
- **Full keyboard paths** through every page. Test by navigating with Tab only — every interactive element must be reachable in a logical order.
- **Semantic landmarks** (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`) on every page.
- **Labelled form fields** via `<label htmlFor>`, not placeholder-as-label.
- **Status indicators carry text + ARIA**, never colour-only. A status chip in the wrong colour shouldn't break the screen reader's read.
- **`prefers-reduced-motion` honoured** in every CSS animation block.
- **Tap targets ≥ 44 × 44 px**.

Audit with axe-core in development, manual screen-reader test (NVDA or VoiceOver) before launch. Accessibility issues are bugs, prioritised the same as functional bugs.

---

## §7 — QUALITY GATES

Every commit passes all five before merge. Skipping any one of them is a separate decision that must be justified in the PR.

| Gate | Command | What it catches |
|---|---|---|
| **Typecheck** | `tsc --noEmit` (or equivalent) | Type errors. The cheapest signal. Run on every save. |
| **Lint** | `eslint` (or equivalent) | Code smells, unsafe patterns (`react-hooks/refs`, `no-unescaped-entities`, etc). Set the bar high; fix warnings the same week they appear. |
| **Unit tests** | `vitest run` (or equivalent) | Logic correctness. Validate **policy meanings**, not just function outputs: when a fixture goes red, the policy has shifted — re-derive the expected value, don't change the test to make it pass. |
| **Compliance assertions** | Admin endpoint + seeded test DB | Structural guarantees: redaction, consent, k-anonymity, encryption presence. Each new sensitive-data feature adds at least one assertion. |
| **Production build** | `next build` (or equivalent) | RSC violations, missing imports, route conflicts, server/client boundary issues. The strongest signal that the app actually ships. |

If any gate fails, the commit doesn't ship. No "let me push this and fix in a follow-up." Follow-ups are how broken systems are born.

---

## §8 — DOCUMENTATION DISCIPLINE

Three documents survive across sessions and serve as the source of truth:

### 8.1 The rules book (canonical context)

A single `TO_START_EVERY_SESSION.md` (or equivalent) carries the non-negotiable rules, the current phase, and one-line summaries of every completed phase. Pasted at the top of every AI / new-developer session. Never long-form prose; always dense, scannable, navigable.

### 8.2 The phased roadmap

A `ROADMAP.md` that lists every phase from foundations through launch and beyond. Each phase header carries:
- Phase number + name
- Status (`◯ planned` / `🚧 in progress` / `✅ shipped`) + date
- 1–3 paragraphs describing what was built + why + the locked decisions
- Companion doc links (`PHASE_N_PLAN.md`, `PHASE_N_COMPLETE.md`)

Completed phases stay in the roadmap forever. The history is part of the product's design provenance.

### 8.3 Plan-before-code for any phase with a schema change

Before any phase that touches the database, write a `PHASE_N_PLAN.md` with:
- A short framing of the problem
- The **locked decisions** (D1, D2, …) with reasoning — each one a paragraph
- The task list (N.1, N.2, …) with the file paths each task touches
- What's **out of scope** (with reasons — usually deferred to a later phase)
- A "why this is the right scope" closing

This is the artifact you review with stakeholders before code lands. It's also what saves you when, six months later, someone asks "why did we decide X?" — the answer is in D-N of the plan.

After the phase ships, write `PHASE_N_COMPLETE.md` capturing what actually landed (which can deviate from the plan) and verification (typecheck, tests, build, manual smoke test).

### 8.4 The design spec (this category)

A single `UX_UI_SPEC.md` (or equivalent — the document you're reading is one such) carries the design system, signature components, layout shells, and screen-by-screen UX. It evolves with the product. Historical versions live in git history; the current version is the source of truth.

---

## §9 — ADOPTION CHECKLIST

How to apply this blueprint to a new project, in order:

### Day 1 — Foundations

- [ ] Pick your framework (Next.js App Router, Remix, SvelteKit — anything with a server/client split + good DX).
- [ ] Set up TypeScript in **strict mode** with `noUncheckedIndexedAccess`. Don't loosen these later; you'll regret it.
- [ ] Install Tailwind (or CSS variables-only — either works, but commit to one).
- [ ] Define the **palette tokens** (§2.3) and **type scale** (§2.2) in your global CSS before writing the first component.
- [ ] Pick your two variable fonts. Subset + preload + `font-display: swap`.
- [ ] Set up the five quality gates (§7). They run on every commit.

### Day 2 — Skeleton

- [ ] Create the `<FieldShell>` + `<TextField>` + `<PasswordField>` triad (§3.1). Every form in the product uses these.
- [ ] Create the layout shells (§3.4) you actually need. Most products need 2–3, not all 7.
- [ ] Define the five UI states (§3.6) and build a `<Skeleton>` component matching your primary list shape.
- [ ] Write `lib/data/provider.ts` with a `mockProvider` implementation that returns typed fixtures (§4.6).

### Day 3 — Compliance scaffolding (if your domain needs it)

- [ ] Write `lib/audit/index.ts` with the `AuditKind` union (§4.5).
- [ ] Write `lib/crypto/` for field-level encryption if you handle PII.
- [ ] Write the first compliance assertion (§4.7). It might just be "every `users.email` is lowercase" — but having the slot wired before you need it is the point.
- [ ] Define your consent model (which purposes, what version of the text, where the timestamp goes) before any form collects an email address.

### Day 4 — Documentation

- [ ] Write your `TO_START_EVERY_SESSION.md` with the rules (§1) — adapted to your domain.
- [ ] Open `ROADMAP.md` with the phases you've planned, even if you only know the first three.
- [ ] Write `UX_UI_SPEC.md` with §2 and §3 of *this* document as the starting point. Customise the palette, the typography, the signature components. Keep the structure.

### Day 5 onward — Plan-before-code

- [ ] For every phase that touches the database or the consent model, write `PHASE_N_PLAN.md` (§8.3) and get sign-off before code lands.
- [ ] After the phase ships, write `PHASE_N_COMPLETE.md`. Tick the roadmap. Update the rules book if a new rule emerged.

### Ongoing — discipline

- [ ] Every PR runs the five gates. Failures don't merge.
- [ ] Every new feature touching sensitive data adds at least one compliance assertion.
- [ ] Locale-switch test: open every form, type something, switch language, confirm draft restored.
- [ ] Production-only diagnostic: an admin test-email panel (§4.4) that confirms email actually sends.

---

## CLOSING NOTE

This blueprint exists because most production web apps in 2026 look the same — same primary colour, same Inter typeface, same card grids, same React-shaped error pages. That sameness is a *choice*: it's what happens when you optimise for "ship fast" without optimising for "be distinctive in ways that survive contact with reality."

The discipline in this document is what makes a product **distinctively itself** without being expensive. The aesthetic choices (typography pairing, semantic palette, editorial layout) cost nothing at runtime. The engineering invariants (mock-first, compliance-first, three-layer auth, form-draft persistence, loud-fail diagnostics) cost engineering time once and save user trust forever.

If you adopt §1 + §4 + §7 verbatim, you have a serious product. The rest is taste.

*— captured from the working state of a national-platform codebase, 2026-05-28. Brand-neutral; intended to be adapted to any domain that takes itself seriously.*
