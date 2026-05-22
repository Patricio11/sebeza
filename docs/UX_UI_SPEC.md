# SEBENZA — UX/UI DESIGN SPECIFICATION (v2.0 — "Mzansi National")
**Companion to `ROADMAP.md`. Deep dive on Phase 1, plus expanded build detail for Phases 2–6.**
**Working name: Sebenza. National South African talent-intelligence platform.**

> Read `TO_START_EVERY_SESSION.md` first. Every rule there governs this document — especially the
> **No-Flash Rule** (works on a low-end Android over 3G) and the **POPIA-First / Redaction Rules**.
>
> **The set:** `TO_START_EVERY_SESSION.md` (context + rules) · `ROADMAP.md` (phased tasks) ·
> `MOBILE_PLAN.md` (responsiveness audit, all done) · `PHASE_2_HANDOFF.md` (Phase 1 / 1.5 audit) ·
> **this file** (design system + screen-by-screen + mock data).

> **v2.0 note.** v1 of this spec called the design *"Civic Editorial"* with an institutional teal palette.
> In May 2026 we evolved to **"Mzansi National"** — bolder national identity, SA-flag-derived palette,
> chevron motif, sharper editorial typography. v1 lives in git history; this doc reflects the built state.

---

## 0. AESTHETIC DIRECTION — "MZANSI NATIONAL"

One sentence: *the quiet authority of a national institution, with the warmth and clarity of a great
modern editorial product, dressed in the colours of the South African flag.* Proudly South African
without kitsch. Trustworthy, human, distinctive — and unmistakeably *ours*.

**The two things people remember:**
1. The **Talent Pulse** glyph — an honest, living employment-status visual (freshness rings + status
   chips) that runs through every screen. The product's mark.
2. The **abstracted Y-chevron** — derived from the SA flag (deep green outer triangle + gold inner
   triangle apex), used as the platform's signature: anchored in the landing hero, beside the
   wordmark, behind every dashboard masthead, watermarked into every generated initials avatar,
   shaped into section dividers.

### How it is stunning AND fast (the reconciliation)
| Stunning comes from | NOT from |
|---|---|
| A distinctive type pairing (Fraunces + Hanken Grotesk, optical sizing on display) | Heavy hero video / 3D |
| The SA flag-derived palette used confidently, not literally | Decorative animation everywhere |
| Asymmetric editorial layouts, generous space, strong hierarchy | Generic SaaS card grids |
| Three signature interactions: count-up stats, chevron draw-in, staggered hero reveal | Framer Motion on every element |
| Mobile-first identity: the chevron travels to 360 px; no hide-behind-`md:` | A desktop-only stunning |
| Meticulous detail: cursor states, focus rings, empty states, gated panels | Spectacle over clarity |

Total target: key routes interactive < 1.5s on throttled 3G, JS < ~150KB, fonts < ~90KB subset.
Mobile target enforced in `MOBILE_PLAN.md` (M1–M7, all done).

---

## 1. DESIGN SYSTEM

### 1.1 Typography
Two variable fonts only, subset + preloaded + `font-display: swap`. Distinctive, not Inter/Roboto/system.

- **Display (headings, hero, numbers that matter):** **Fraunces** — a warm, characterful variable serif.
  Gives editorial gravitas + humanity. Use optical sizing on large sizes.
- **Body / UI:** **Hanken Grotesk** — a warm, highly legible variable grotesque. Excellent on small screens.

```css
--font-display: "Fraunces", Georgia, serif;
--font-body: "Hanken Grotesk", system-ui, sans-serif;
```

Type scale (fluid, clamp-based):
| Token | Size (clamp) | Use |
|---|---|---|
| `display-xl` | clamp(2.5rem, 6vw, 4.5rem) | Landing hero headline (Fraunces) |
| `display-l` | clamp(2rem, 4vw, 3rem) | Section headers, big stats |
| `h1` | 1.875rem | Page titles |
| `h2` | 1.375rem | Card / section titles |
| `body` | 1rem / 1.6 line | Default (Hanken) |
| `small` | 0.875rem | Meta, labels |
| `mono-stat` | tabular-nums | Analytics numbers (Hanken tabular) |

### 1.2 Colour — Mzansi National (SA flag-derived, never literal)
Light-default (public trust reads better in light). Optional dark mode (Phase 10). All pairs meet WCAG AA.
The semantic tokens (`--color-brand`, `--color-paper`, `--color-ink`) resolve to SA-palette values
across the whole app; the explicit `--color-sa-*` tokens are also available for landing flourishes.

```css
/* Surfaces — SA cream, sunnier than warm paper */
--color-paper:        #FBF8F0;   /* page background */
--color-surface:      #FFFFFF;   /* cards */
--color-surface-sunk: #F3EFE7;   /* wells, inputs */

/* Ink — deep SA charcoal, near-black */
--color-ink:          #14110D;
--color-ink-soft:     #5A5249;
--color-hairline:     #E4DED4;

/* Brand — SA flag-green (slightly desaturated for screens) */
--color-brand:        #006B3C;
--color-brand-strong: #003D1F;
--color-brand-tint:   #E1F0E7;

/* Accent — SA gold (warmer + readable on cream) */
--color-accent:       #C98214;
--color-accent-tint:  #FFF3D7;

/* SA-flag-explicit tokens (used in landing flourishes + chevron motif) */
--color-sa-green:        #006B3C;
--color-sa-green-deep:   #003D1F;
--color-sa-green-soft:   #0A8C50;
--color-sa-green-tint:   #E1F0E7;
--color-sa-gold:         #F5A623;
--color-sa-gold-deep:    #C98214;
--color-sa-gold-tint:    #FFF3D7;
--color-sa-red:          #DE3831;   /* alerts only — never decorative */
--color-sa-cream:        #FBF8F0;
--color-sa-charcoal:     #14110D;

/* Semantic / Talent Pulse */
--color-employed:      #006B3C;   /* aligns with brand */
--color-open:          #C98214;   /* aligns with accent */
--color-unemployed:    #5A5249;   /* neutral, never alarmist */
--color-self-employed: #5E7A31;
--color-studying:      #2F5E8A;
--color-stale:         #B45F3C;   /* low-confidence clay */
--color-danger:        #DE3831;   /* SA red — alerts only */
--color-verified:      #006B3C;
```

### 1.3 Space, radius, elevation
- Spacing scale (rem): `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 / 6`. Keep a strict 8px rhythm.
- Radius: `--r-sm 8px` `--r-md 12px` `--r-lg 18px` `--r-pill 999px`.
- Elevation: soft, warm shadows only (`0 1px 2px rgba(26,23,20,.06), 0 8px 24px rgba(26,23,20,.06)`). No neon glows.
- Touch targets ≥ 44px. Focus ring: 2px `--brand` + 2px offset, always visible on keyboard.

### 1.4 Motion (cheap, purposeful, reduced-motion aware)
- **One** orchestrated landing reveal: staggered fade/translate of hero lines (CSS `animation-delay`).
- Search focus: input grows + filter chips reveal (transform/opacity only).
- Talent Pulse: a subtle, slow ring draw on load for fresh statuses; **no loop**.
- All wrapped in `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`.

### 1.5 Signature components (all built — see `components/ui/*`)
- **`<SAChevron>`** — the abstracted Y-chevron motif derived from the SA flag. Four variants:
  `mark` (14 × 14 wordmark accent), `inline` (24 × 24 inline glyph), `signature` (oversized hero
  watermark with a hairline draw-in animation), `divider` (banded green/gold/red strip used as a
  flag stripe at the top of every header, footer, error page).
- **`<StatusChip>`** — the Talent Pulse. Encodes status + freshness in one honest glyph:
  - Fresh (< 30d): solid filled ring, status colour. Ageing (30–90d): half ring.
    Stale (≥ 90d): dashed outline + small dot.
  - Always carries text + ARIA + relative time ("confirmed 12 days ago"). Never colour-only.
- **`<VerificationBadge>`** — `unverified` (outline, grey) / `pending` (dotted, amber) /
  `verified` (solid SA-green check) / `rejected` (red x). Never lies — never default-verified.
- **`<ProfileCompleteness>`** — slim bar or 96 px arc, 0–100 %, nudges toward completion.
- **`<Avatar>`** — photo-first with a deterministic SA-palette initials fallback. Six palettes
  hash by name so the same person renders the same avatar across the platform. Optional
  verification ring (green for `verified`, gold for `pending`). Faint chevron watermark in every
  generated fallback — the Sebenza signature, even on initials.
- **`<TalentRosterItem>`** — the search-result row (see §2.2). Uses `<Avatar>` + `<StatusChip>` +
  `<VerificationBadge>` + `<ProfileCompleteness>`. The product's signature list element.
- **`<StatCard>`** — Fraunces tabular numeral + tiny inline-SVG sparkline + optional freshness
  confidence meter. Lives on `/insights` and the landing pulse strip.
- **`<DataSpine>`** — left-aligned vertical meta rail (`<dl>`), editorial cadence.
- **`<EmptyState>`**, **`<Skeleton>`** / **`<RosterSkeleton>`**, **`<Button>`** (CVA: primary /
  secondary / ghost / accent × sm / md / lg).
- **`<FormField>`** family — `TextField`, `SelectField`, `TextareaField`, `FieldShell`,
  `EncryptedBadge` (the chip rendered next to the ID-number input).
- **`<CustomSelect>`** — replaces every native `<select>` on the platform. Portaled into
  `document.body` (so no ancestor `transform` / `overflow` ever displaces it). Desktop:
  anchored popover from measured trigger rect. Mobile: full-screen bottom sheet with backdrop
  + thumb-sized Close. Three variants: `default` (h-12, matches `TextField`), `compact` (h-10
  pill), `bare` (no chrome — used inside the SearchBar's hairline-divided cells).
- **`<AnimatedCount>`** — single client island for IntersectionObserver-triggered count-up on
  stat numerals. Honours `prefers-reduced-motion`.

### 1.6 Layout shells (chrome that wraps every page)
- **`<LandingHeader>`** — absolute over the hero, chevron-marked wordmark, transparent until
  scroll; `MobileNav` trigger below `md`.
- **`<SiteHeader>`** — sticky internal-pages header with the SA flag stripe across its top edge.
- **`<SiteFooter>`** — charcoal ink, flag stripe at the top, chevron mark, trust strip
  (POPIA-first · WCAG 2.2 AA · Works on 3G · 4 launch languages).
- **`<MobileNav>`** — full-screen drawer used by both headers below `md`. Body-scroll-locked.
  Closes on Esc, scrim, X, or route change.
- **`<DashboardShell>`** — role-themed accent strip on the sidebar (seeker = green, employer =
  gold, admin = ink), chevron-marked workspace label, mobile top tab strip with fade-edge cue.
  Used by every seeker / employer / admin route.
- **`<AuthShell>`** — flag stripe, chevron motif bleed, demo-mode banner, chevron-marked
  eyebrow + Fraunces editorial headline. Wraps every `/sign-in`, `/sign-up*`, `/verify-email`,
  `/forgot-password`.
- **`<OrgVerificationBanner>`** — persistent yellow banner on every employer page when the
  organisation is unverified.
- **`<DataSpine>`** — left-aligned vertical meta rail used on results + profile for an editorial feel.
- **`<StatCard>`** — analytics number block; Fraunces numeral, tabular, tiny trend sparkline (SVG).

---

## 2. PHASE 1 — SCREEN BY SCREEN (production-grade UI, mock data)

All screens: mobile-first (design at 360px → scale up), AA accessible, redaction-enforced, mock-data-driven
so the backend slots in behind typed fixtures (see §4).

### 2.1 Landing Page  `/`
**Goal:** in 5 seconds, a job seeker understands "I can get found for what I do," an employer
understands "I can find skilled people near me," and government sees credibility.

Layout (top → bottom):
1. **Slim trust bar:** wordmark (Fraunces) left; "Find talent" / "Create profile" right. No clutter.
2. **Hero (editorial, no media):**
   - `display-xl` headline in Fraunces: *"Find skilled people. Near you. For real."* (staggered reveal)
   - One-line subhead in Hanken (`ink-soft`).
   - **The search bar IS the hero** — large, central: `[ Profession / skill ]  [ Location ]  [ Search ]`.
     Autocomplete from taxonomy; recent/popular searches as chips below ("Chefs · Cape Town", "Developers · Joburg").
3. **Live national pulse strip** (3 `StatCard`s, mock now): "X profiles · Y confirmed hires this month ·
   Z skills in demand." Tabular numerals, tiny sparkline. This is the credibility hook for government.
4. **Three honest value cards** (no glassmorphism — flat, warm surfaces, accent hairline):
   - "Trusted profiles" (verification), "Live availability" (Talent Pulse), "Real employment data" (analytics).
5. **For employers / For government** split section — two clear paths.
6. **Footer:** POPIA/privacy, PAIA manual, persistent language switcher (Tier 1: English · isiZulu · isiXhosa · Afrikaans — see §3.1).

States: fonts-not-loaded fallback; JS-off the search still submits (progressive enhancement).

### 2.2 Search Results  `/search?role=chef&location=cape-town`
**This is the core USP. Make it unforgettable through layout, not effects.**

- **Sticky search header:** the query stays editable; result count in Fraunces ("**142** chefs in Cape Town").
- **Left filter rail (desktop) / filter sheet (mobile):** skill, location (province→city), employment status,
  seniority, verification level, nationality (optional, never default-on). "Citizens highlighted" toggle (per rules).
- **The Talent Roster** (NOT a card grid — a refined editorial list). Each `<TalentRosterItem>`:
  ```
  ┌───────────────────────────────────────────────────────────┐
  │ [avatar/initials]  Thandeka M.            ● Verified        │
  │  DataSpine │ Senior Chef · Cape Town                        │
  │            │ Skills: Pastry · Menu design · Kitchen mgmt    │
  │            │ ◔ Open to work · confirmed 8 days ago          │  ← StatusChip (fresh)
  │            │ Completeness ▰▰▰▰▱ 82%        [ View profile ] │
  └───────────────────────────────────────────────────────────┘
  ```
  - Ranking: relevance × status freshness × completeness × citizen-highlight.
  - **Redaction enforced:** no surname in full until reveal, no ID, no docs, no contact in payload.
  - Stale statuses visibly lower + dashed chip — honesty is the differentiator.
- **States:** loading = skeleton roster rows; empty = helpful "no chefs in Cape Town yet — broaden location?"
  with suggestions (this empty state also feeds `searchEvents` = skills-gap signal).
- Pagination: cursor-based, data-light, "load more."

### 2.3 Public Profile  `/p/[handle]`  — "the civic dossier"
- **Header:** name (redacted by viewer role), profession, location, `VerificationBadge`, `StatusChip`.
- **DataSpine layout:** left rail = at-a-glance (location, status freshness, completeness, member since);
  right = bio, skills (chips with proficiency), experience timeline, qualifications.
- **Qualifications:** show title + institution + verification state ONLY. Documents are gated.
- **Contact / documents:** locked panel → "Verified employers can request contact." Reveal = consent check
  + audit log (Phase 2/5). Seeker sees who viewed (transparency builds trust).
- **Report / privacy** affordances visible.

### 2.4 Seeker Dashboard  `/dashboard` (seeker)
- **Top:** "Your visibility" — completeness arc + a single clear next action ("Add 2 skills to rank higher").
- **Talent Pulse card:** big honest status control — "Are you still open to work?" one-tap confirm →
  updates `statusConfirmedAt`. This is the freshness engine's human surface. Nudge banner if stale.
- **Who's viewed you / contacted you** (transparency).
- **Profile editor entry, qualifications, privacy/consent center.**
- Mobile: bottom tab bar (Home · Profile · Activity · Account); desktop: collapsible sidebar.

### 2.5 Employer Dashboard  `/employer`
- **Org verification banner** if `unverified` (can search, cannot reveal contact/docs until verified).
- **Search + saved searches + shortlists (talent pools).**
- **"Mark as hired"** prompt on a shortlisted candidate → writes `placements` (the analytics gold).
  Make this one tap with a tiny incentive nudge ("Help map SA's job market — confirm this hire").
- Contact reveal flow → consent + audit log, with clear "this access is recorded" notice.

### 2.6 Analytics / Policy Dashboard  `/insights` (gov/admin; public aggregate view later)
- **The government wedge, made beautiful and honest.**
- `StatCard` row: total active talent, confirmed hires (period), unemployment-by-status (freshness-weighted).
- **Charts (Recharts, lightweight):** registrations & placements over time; demand by skill/location
  (from `searchEvents`); skills-gap leaderboard ("most-searched, least-filled").
- **Freshness disclosure:** every figure shows a confidence indicator — we never present stale data as fact.
  This single honesty feature is the platform's wedge.
- Exports: aggregate-only CSV/PDF, audit-logged, zero PII.

### 2.7 Admin / Moderation  `/admin`
- Verification queue (qualifications, orgs) with approve/reject + reason.
- Reported-profile review; taxonomy management; audit-log viewer (who saw what PII).

### 2.8 Cross-cutting UI states (define once, reuse)
For EVERY data surface specify: **loading** (skeleton, never spinner-only), **empty** (helpful + action),
**error** (plain language + retry), **offline** (cached last results + banner), **redacted** (locked panel,
never a broken layout). A national system is judged on its edge cases.

---

## 3. RESPONSIVE & ACCESSIBILITY (non-negotiable)
- Breakpoints: 360 (base) · 768 (tablet) · 1024 (desktop) · 1280 (wide).
- Mobile nav = bottom tab bar (thumb-reachable). Desktop = collapsible sidebar. Filters = sheet on mobile.
- WCAG 2.2 AA: contrast ≥ 4.5:1 body / 3:1 large; visible focus; full keyboard paths; semantic landmarks;
  labelled form fields; `StatusChip` and `VerificationBadge` carry text + ARIA, never colour-only.
- `prefers-reduced-motion` honoured everywhere. Tap targets ≥ 44px.

### 3.1 Localization (next-intl) — a national platform speaks the nation's languages
- **Routing:** `app/[locale]/…`; locale detected from `Accept-Language`, overridable; choice persisted per user.
- **Switcher:** persistent, in header and footer, each language labelled in its own name (Zulu shows "isiZulu").
- **Launch (Tier 1):** English (base) · isiZulu · isiXhosa · Afrikaans. Fast-follow + full official set per `ROADMAP.md` Phase 10.
- **All UI text in catalogs** (`messages/en.json`, `zu.json`, …) — zero hardcoded strings. **ICU message format**
  for plurals and noun-class agreement (Bantu languages decline by noun class — naive interpolation reads wrong).
- **Legal/consent copy = human translation only.** A mistranslated POPIA/consent screen is a legal liability, not a polish bug.
- **Fonts:** confirm Fraunces + Hanken Grotesk cover required diacritics (esp. Tshivenda ṅ ḓ ṱ ḽ ṋ in Tier 3); subset per locale.
- **Layout:** all SA languages are LTR (no RTL work). Budget ~30% text expansion (isiXhosa/Afrikaans run longer) — flexible labels, never fixed-width.

---

## 4. MOCK DATA LAYER (so the backend slots in cleanly)
Typed fixtures in `lib/mock/`, shaped to the Drizzle schema so Phase 4 swaps mock → real with no UI change.
Components read from a `dataProvider` interface; flip an env flag from `mock` to `db`.

```ts
// lib/mock/types.ts  — mirrors the schema, redaction-aware
export type EmploymentStatus = "employed" | "unemployed" | "self_employed" | "studying" | "open_to_work";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface PublicProfile {            // what search/public CAN expose (redacted)
  handle: string;
  displayName: string;                       // "Thandeka M." — redacted surname
  profession: string;
  seniority: "junior" | "intermediate" | "senior" | null;
  city: string; province: string;
  nationality: string | null;                // shown, never a gate
  isCitizen: boolean;                         // drives optional highlight only
  topSkills: { name: string; proficiency: number }[];
  status: EmploymentStatus;
  statusConfirmedAt: string;                  // ISO → freshness band derived in UI
  verification: VerificationStatus;
  completeness: number;                       // 0..100
  // NO id number, NO documents, NO contact here — ever.
}

export interface AnalyticsSnapshot {
  totalActive: number;
  confirmedHiresThisMonth: number;
  byStatus: Record<EmploymentStatus, { count: number; freshnessConfidence: number }>;
  demandBySkill: { skill: string; searches: number; matches: number }[]; // gap = searches >> matches
  trend: { month: string; registrations: number; placements: number }[];
}
```

```ts
// lib/mock/profiles.ts  — representative, realistic SA data
export const mockProfiles: PublicProfile[] = [
  { handle: "thandeka-m", displayName: "Thandeka M.", profession: "Chef", seniority: "senior",
    city: "Cape Town", province: "Western Cape", nationality: "South African", isCitizen: true,
    topSkills: [{name:"Pastry",proficiency:5},{name:"Menu design",proficiency:4},{name:"Kitchen mgmt",proficiency:4}],
    status: "open_to_work", statusConfirmedAt: "2026-05-13T09:00:00Z", verification: "verified", completeness: 82 },
  { handle: "sipho-k", displayName: "Sipho K.", profession: "Chef", seniority: "intermediate",
    city: "Cape Town", province: "Western Cape", nationality: "South African", isCitizen: true,
    topSkills: [{name:"Grill",proficiency:4},{name:"Prep",proficiency:5}],
    status: "employed", statusConfirmedAt: "2026-02-01T09:00:00Z", verification: "pending", completeness: 64 }, // stale → down-ranked
  { handle: "amara-o", displayName: "Amara O.", profession: "Chef", seniority: "senior",
    city: "Cape Town", province: "Western Cape", nationality: "Nigerian", isCitizen: false, // appears in CT search per Location-Not-Nationality
    topSkills: [{name:"Pastry",proficiency:5},{name:"Plating",proficiency:5}],
    status: "open_to_work", statusConfirmedAt: "2026-05-18T09:00:00Z", verification: "verified", completeness: 90 },
];
```

```ts
// lib/mock/analytics.ts
export const mockAnalytics: AnalyticsSnapshot = {
  totalActive: 48213,
  confirmedHiresThisMonth: 1147,
  byStatus: {
    open_to_work: { count: 19120, freshnessConfidence: 0.78 },
    unemployed:   { count: 14880, freshnessConfidence: 0.71 },
    employed:     { count: 9210,  freshnessConfidence: 0.66 },
    self_employed:{ count: 3300,  freshnessConfidence: 0.69 },
    studying:     { count: 1703,  freshnessConfidence: 0.82 },
  },
  demandBySkill: [
    { skill: "Software Developer", searches: 4200, matches: 1100 }, // big gap
    { skill: "Chef",               searches: 1800, matches: 1650 },
    { skill: "Electrician",        searches: 1500, matches: 480 },  // big gap
  ],
  trend: [
    { month: "2026-01", registrations: 5200, placements: 720 },
    { month: "2026-02", registrations: 6100, placements: 810 },
    { month: "2026-03", registrations: 7400, placements: 980 },
    { month: "2026-04", registrations: 8050, placements: 1030 },
    { month: "2026-05", registrations: 8800, placements: 1147 },
  ],
};
```

Mock helpers: `freshnessBand(statusConfirmedAt)` → `"fresh"|"ageing"|"stale"`; `rankProfiles()` mirrors the
real ranking so search "feels" identical pre/post backend. Build the `dataProvider` seam now (Phase 1) so
Phase 4 is a swap, not a rewrite.

---

## 5. EXPANDED BUILD DETAIL — PHASES 2–6
*(More granular than `ROADMAP.md`, now that the UI contracts above define the data each phase must serve.)*

### PHASE 2 — IDENTITY, AUTH & CONSENT (expanded)
- **2.1 Better Auth config:** email+password + email OTP; sessions in Postgres via Drizzle adapter;
  `appRole` plugin/field; 2FA (TOTP) required for `employer`/`admin`. Pin ≥1.6.5.
- **2.2 Route protection:** middleware maps route groups → roles; `requireRole()` + `requireOrgVerified()`
  server guards; every PII-touching loader calls `logAccess()`.
- **2.3 Consent state machine:** states `none → granted(version) → revoked`. Profile is **not searchable**
  until `searchability` consent granted. Store purpose + version + timestamp in `consents`.
- **2.4 Seeker onboarding:** 3 steps — identity basics → consent → first profile fields. Each step writes
  partial state (resumable). ID number captured → encrypted immediately, never echoed back.
- **2.5 Employer onboarding:** creates `organization (unverified)`; explains the verification gate up front.
- **2.6 Privacy center:** view/revoke each consent, export my data (JSON), request erasure (soft-delete → job).
- **UI contract met:** §2.4/§2.5 dashboards depend on role + consent + org-verification flags from here.

### PHASE 3 — THE TALENT PROFILE (expanded)
- **3.1 Profile editor:** autosave (debounced Server Actions), Zod-validated, optimistic UI with rollback.
- **3.2 Skills:** typeahead bound to controlled `skills` taxonomy; reject free-text (keeps search/analytics clean);
  proficiency 1–5; drives `topSkills` in the redacted payload.
- **3.3 Qualifications & uploads:** R2 signed-URL direct upload; client-side type/size guard; server re-validates;
  default `verification: unverified`; each file access audit-logged.
- **3.4 Talent Pulse engine (the differentiator):**
  - `freshnessBand()` server-side; nightly cron Route Handler scans for ageing/stale → Resend nudge.
  - One-tap "still open?" confirm endpoint updates `statusConfirmedAt` (this is §2.4's status card).
  - Search ranking + analytics both consume the freshness confidence.
- **3.5 Completeness:** deterministic scoring fn (shared client/server) powering `<ProfileCompleteness>` and nudges.

### PHASE 4 — DATA ENGINE (expanded — the swap behind the mock seam)
- **4.1 Schema** per `ROADMAP.md` §4.1; add generated `searchVector` + GIN, trigram indices, FK btrees.
- **4.2 `dataProvider` real impl** matching the mock interface from §4 exactly → UI unchanged.
- **4.3 Search query:** `websearch_to_tsquery` + `pg_trgm` similarity; ranking SQL mirrors `rankProfiles()`;
  **select-list redaction** (sensitive columns physically never selected on public paths).
- **4.4 `searchEvents` capture** on every query (terms, filters, resultCount, employerId?) → powers §2.6 gap analysis.
- **4.5 Integrity:** all mutations via Server Actions + Zod; typed query fns in `db/`; `logAccess()` enforced; tests assert no PII leaks (Phase 11 §11.4).

### PHASE 5 — EMPLOYER PORTAL (expanded)
- **5.1 Org KYC slot:** pluggable provider behind `organizations.verification`; manual admin fallback for MVP.
- **5.2 Reveal flow:** request contact/docs → consent check → audit-logged reveal → seeker notified (transparency).
- **5.3 Placement logging:** "Mark as hired" → `placements` row; prompts seeker status update (closes the freshness loop);
  **incentive design is the open product question** — solve before build (e.g., free analytics credits, recognition).
- **5.4 Shortlists / saved searches:** talent pools, reusable filters.

### PHASE 6 — ANALYTICS & POLICY (expanded)
- **6.1 Aggregation layer:** materialized views / scheduled rollups for §2.6 `StatCard`s and charts (fast, PII-free).
- **6.2 Freshness-weighted metrics:** every count carries a confidence; UI must surface it (honesty = the wedge).
- **6.3 Skills-gap engine:** `demandBySkill` from `searchEvents` (searches ≫ matches = gap) → training-partnership product + the killer government-pitch slide.
- **6.4 Exports:** aggregate CSV/PDF, audit-logged, zero PII; role-gated.

---

## 6. BUILD ORDER FOR PHASE 1 (do in this sequence)
1. Design tokens + fonts + base layout shell (paper, ink, hairlines, focus states) + **i18n seam (next-intl, `app/[locale]`, English catalog)**. Verify perf budget.
2. `dataProvider` seam + mock fixtures (§4).
3. Signature components: `StatusChip`, `VerificationBadge`, `ProfileCompleteness`, `TalentRosterItem`, `StatCard`.
4. Landing (`/`) with live search bar + pulse strip.
5. Search results (`/search`) — the roster, filters, all states.
6. Public profile (`/p/[handle]`) — civic dossier, redaction + locked panels.
7. Seeker dashboard + Employer dashboard shells (mock).
8. Insights (`/insights`) with mock analytics + charts.
9. Accessibility + 3G performance pass before calling Phase 1 done.

Ship Phase 1 as a clickable, mock-driven product you could demo to the Department tomorrow. Then Phase 2
makes it real — and because of the `dataProvider` seam, the UI doesn't change.

---

*Last Updated: 2026-05-22 · Version 2.0 (Mzansi National) · Working name: Sebenza*
