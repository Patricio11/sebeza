# Phase 1.5  Auth UI + role dashboards · ✅ COMPLETE

**Shipped:** 2026-05-22 (core 2026-05-21 · Career compass 2026-05-21 · Student mode 2026-05-22 · Mobile pass 2026-05-22 · Mzansi National rollout 2026-05-22 · ESSA-positioning cleanup 2026-05-22)

> Phase 1.5 brought forward the **UI layer** of Phases 2, 3, 5 and 7 so the platform demos end-to-end as the three-role product it is. Every page reads through the `dataProvider` seam; Phase 2 swaps in Better Auth + real consent persistence without changing any of the UIs below.

---

## 1 · Surfaces shipped

### Auth (UI only  Better Auth wires in Phase 2)
- `/sign-in`  single entry for all roles (today carries a role chip  **Phase 2 removes it**; see `PHASE_2_PLAN.md`)
- `/sign-up`  role chooser: **Job seeker** vs **Employer / recruiter**. Admin sign-up notice: issued by Sebenza, not self-registered.
- `/sign-up/seeker`  3-step onboarding: identity basics → consent capture → first profile fields. Collapsible "I'm currently a student" toggle reveals academic capture.
- `/sign-up/employer`  registers an `organizations` row in state `unverified`; explains the verification gate up front.
- `/verify-email` + `/forgot-password`  UI stubs ready for Server Action wire-up in Phase 2.

### Seeker workspace (eight routes under `/dashboard`)
- Overview · Profile editor · Experience · Qualifications · **Career compass** (`/dashboard/grow`) · Activity · Privacy & consent · Account
- Career compass = demand-driven skill recommendations + projected rank delta + SA-grounded learning paths (SETA / TVET / INDLELA / SAQA-recognised, free first) + adjacent-profession overlap + city demand table
- Student lane on the Career compass when `academic` data is present: bridge headline + electives + real SA internships & graduate programmes + "where graduates go" destinations table

### Employer workspace (eight routes under `/employer`)
- Overview · Saved searches · Talent pools · Placements · Organisation · Team · Account
- Persistent org-unverified banner across every page until verification is complete

### Admin workspace (eight routes under `/admin`)
- Overview · Verification queue (qualifications + organisations) · Moderation · Taxonomy · Audit log · Users · Settings
- 2FA-required eyebrow on every page

### Errors + i18n
- `/not-found` and `/error` carry the SA flag stripe and chevron motif (even when no header loads)
- All `/[locale]/…` routes for `en` / `zu` / `xh` / `af` (non-English catalogs deep-merge-fall-back to English)

---

## 2 · Shared chrome (Mzansi National design system)

- `SiteHeader` (internal pages) + `LandingHeader` (landing)  both with the SA green/gold/red top stripe and chevron-marked wordmark
- `MobileNav`  full-screen drawer used by both headers below `md`. Body-scroll-locked. Closes on Esc, scrim, X, or route change.
- `DashboardShell`  role-themed accent strip (seeker green, employer gold, admin ink), chevron-marked workspace label, mobile top tab strip with fade-edge cue
- `SiteFooter`  charcoal ink, flag stripe top, chevron mark, trust strip
- `AuthShell`  flag stripe, chevron motif bleed, demo-mode banner
- `OrgVerificationBanner`  persistent yellow banner on every employer page when org is unverified

## 3 · Signature components

- `SAChevron`  abstracted Y-chevron motif (`mark` / `inline` / `signature` / `divider` variants)
- `StatusChip`  Talent Pulse glyph (fresh / ageing / stale rings)
- `VerificationBadge`  `unverified` / `pending` / `verified` / `rejected`. Never inflates.
- `ProfileCompleteness`  slim bar + arc variant
- `Avatar`  photo-first with deterministic SA-palette initials fallback (six palettes hash by name, faint chevron watermark). Optional verification ring (green / gold) honestly.
- `TalentRosterItem`  search-result row
- `StatCard`  Fraunces tabular numeral + inline-SVG sparkline + optional freshness confidence meter
- `DataSpine`  left-aligned vertical meta rail
- `EmptyState`, `Skeleton`, `RosterSkeleton`, `Button` (cva: primary / secondary / ghost / accent × sm / md / lg)
- `FormField` family  `TextField`, `SelectField`, `TextareaField`, `FieldShell`, `EncryptedBadge`
- `CustomSelect`  replaces every native `<select>`. **Portaled into `document.body`** so no ancestor `transform` / `overflow` ever displaces it. Desktop popover from measured trigger rect; mobile full-screen bottom sheet. Three variants: `default` / `compact` / `bare`. Full keyboard a11y.
- `AnimatedCount`  IntersectionObserver count-up, honours `prefers-reduced-motion`

## 4 · Mobile pass (M1–M7 from `MOBILE_PLAN.md`, all ✅)

- M1  Mobile navigation drawer (replaced *no mobile menu at all*)
- M2  Responsive tables → mobile cards on 8 surfaces (no horizontal scroll anywhere on 360 px)
- M3  Hero + masthead mobile polish (chevron motif now travels to mobile)
- M4  Touch targets + 16 px form fields (kills iOS Safari focus auto-zoom)
- M5  Dashboard tab strip fade-edge cue
- M6  Long-string truncation (audit-log codes, user emails, taxonomy slugs)
- M7  Final 360 px sweep + verification

## 5 · Tone & positioning

- **ESSA never appears in product copy.** Sebenza stands on what it *is*, not on what something else *isn't*. Tone rule pinned at the top of `TO_START_EVERY_SESSION.md` and `ROADMAP.md`.
- The Difference / comparison section was replaced by a **Principles** section: 4 honest commitments (Employment data · Skills gap visibility · Verification · Built for).
- Pulse strip headline: *"South Africa, at work. Right now."* (no incumbent reference)

## 6 · Schema completeness work (closed before Phase 2 kickoff)

- `profiles.profile_photo_url` (Supabase Storage key  Phase 3)
- `academic_profiles` table (Student mode, 1:1 with profiles)
- `institutions` table (21 SA universities / UoTs / UNISA / TVETs / INDLELA)
- `organization_members` table (employer team page persistence target)
- `organizations` enriched: registration_number / industry / size_band / city / country
- Enums added: `institution_kind`, `organization_member_role`
- `qualifications.document_storage_key` (renamed from `document_r2_key`  vendor-neutral)

## 7 · Vendor decisions

- **Storage:** Supabase Storage (replaces Cloudflare R2). Used standalone  auth is Better Auth, DB is Neon.
- **Hosting path (decided):** Neon `eu-central-1` for Phase 2 → AWS Cape Town `af-south-1` on Docker by Phase 9 for POPIA in-country residency. Drizzle is driver-agnostic so the swap is `db/client.ts` only.

## 8 · Seed script (Phase 2-ready)

- `db/seed.ts` reads from `lib/mock/*` (single-sourced) and inserts via Drizzle
- Idempotent  `TRUNCATE … CASCADE` then INSERT in FK-safe order
- Deterministic IDs (`user_thandeka-m`, `prof_thandeka-m`, etc.)
- Seeds: 9 provinces + ~25 cities + 13 professions + 15 skills + 21 institutions + 1 admin + 1 employer-owner + 8 seekers + their profiles + skills + experience + qualifications + academic records + Discovery Bank + 1 org member + 2 placements + initial consents

---

## 9 · Verification at the time of shipping

- `npm run typecheck` clean
- `npm run build` green  every static route generated across en/zu/xh/af (~130 prerendered files)
- Every route returns 200 under `next start` (33 unique paths + 4 locales + 404 sanity check)
- Mobile-UA fetch confirms `MobileNav` trigger ships in the SSR output
- No `<select>` or `cursor: default` button regressions

---

## 10 · Commits (on `master`)

```
7cfaa24 docs: track Postgres hosting path (Neon now -> AWS Cape Town later)
7ad443a Phase 1 finish + Phase 2 readiness (Supabase Storage, seed, handoff)
021dc50 Remove ESSA from product copy; position on our own merits
65c2264 Cursor: pointer on every clickable element
e59e216 CustomSelect: portal the panel out so it never displaces content
dc163bf Replace every native <select> with CustomSelect
d4263a5 Mobile pass: stunning + functional at 360 px (No-Flash Rule made real)
6d0d7c6 Roll Mzansi National across every remaining surface
1f0b526 Apply Mzansi National system-wide + redesign public profile
2a56cb7 Landing: Mzansi National redesign  SA flag palette + chevron motif
b51ead9 commiting the docs
9fedd44 Add Phase 1.5: auth UI, role dashboards, Career compass, Student mode
```

---

## 11 · What Phase 1.5 deliberately deferred

- **Real auth, sessions, consent persistence, 2FA, password reset, email verification**  Phase 2 (see `PHASE_2_PLAN.md`)
- **Real profile CRUD via Server Actions + R2/Supabase document upload**  Phase 3
- **Postgres FTS + ranking SQL + the real `dbProvider`**  Phase 4
- **Employer reveal flow + Mark-as-hired**  Phase 5
- **Skills-gap engine + demand-vs-curriculum dataset (the government wedge)**  Phase 6
- **Student-side filter "open to internships / graduate programmes"**  Phase 4 (schema flags already exist)
- **SAQA + institution verification of `academic_profiles.verification`**  Phase 8
