# PHASE 10.2 COMPLETE — SEEKER HELP CENTER
*Shipped 2026-05-29. Cloned the Phase 10.1 employer scaffold for seekers; baked in all three post-ship fixes from the start. 27 hand-written articles across 7 categories, 8 in-context HelpLink chips on the highest-traffic seeker surfaces.*

> **One-line summary**: A browseable + searchable help center at `/dashboard/help` covering every major seeker surface (profile, qualifications, invitations, career compass, consent, activity, account), plus tiny "How does this work?" deep-link chips on 8 high-traffic dashboard surfaces. English-only at v1; content as TypeScript modules; shared infrastructure with the employer help centre.

Commits:

- (this commit) — Phase 10.2 ship: types + role-agnostic infra refactor + 27 articles + 8 deep-link surfaces

Read `PHASE_10_1_COMPLETE.md` &rarr; "Post-ship fixes + lessons" first if you're cloning this scaffold for admin (10.3) or gov (10.4). The same patterns apply.

---

## 🎯 WHAT SHIPPED

### A — Type extensions (`content/help/types.ts`)

- New `SeekerHelpCategory` string-enum (`getting_started`, `profile`, `invitations`, `growth`, `privacy`, `activity`, `account`).
- New `HelpCategory = EmployerHelpCategory | SeekerHelpCategory` union; `HelpArticleMeta.category` widened to this union so a single meta shape serves both roles (admin / gov will join the union in 10.3 / 10.4).
- New `SEEKER_HELP_CATEGORIES` constant: label + description + display order, parallel to the employer constant.

### B — Role-agnostic infrastructure refactor

Phase 10.1 hardcoded `/employer/help` in two components. Phase 10.2 made both role-agnostic so 10.3 and 10.4 can reuse them verbatim:

- **`HelpLink`** — new `role?: "employer" | "seeker"` prop (defaults to `"employer"` so Phase 10.1 chips don't need edits). Base path is `/employer/help` or `/dashboard/help` per role.
- **`HelpSearchIsland`** — now accepts `basePath`, `categoryLabels`, and `placeholder` props. The category-label lookup that was hardcoded to `EMPLOYER_HELP_CATEGORIES` is now passed in. URL writes go to `${basePath}?q=…` and result cards link to `${basePath}/${slug}`. The employer index page was updated to pass the three new props.

### C — Seeker pages

- **Index** `/dashboard/help` — hero search bar + 7 category sections with article cards. When `?q=` is present, the search island takes over with ranked results.
- **Article** `/dashboard/help/[slug]` — breadcrumb back to index/category + article body inside a centered `max-w-3xl` reading column + "Related" strip in 2 columns (broken/self slugs silently dropped). No `meta.updatedAt` rendered (Phase 10.1 fix #3 inherited).

Both auth-gated by `verifyRole("seeker")` + `getMyProfile()`.

### D — Nav entry (`components/layout/seekerNav.ts`)

New `{ key: "help", label: "Help", href: "/dashboard/help", icon: HelpCircle }` inserted between Notifications and Privacy & consent — mirrors the placement on the employer side (between Notifications and Account).

### E — 27 articles (across 7 categories)

**Getting started (4)**
- `what-sebenza-is-for-job-seekers` — outcomes platform from the seeker's side; the three deliberate choices
- `your-first-hour-profile-setup` — six concrete steps from empty profile to findable
- `understanding-profile-completeness` — the six binary checks; what's NOT counted
- `how-search-ranking-works` — three signals + two gates; no paid tier exists

**Profile & visibility (5)**
- `setting-up-your-profile-photo` — optional, leverage; what works, what doesn't
- `adding-skills-from-the-taxonomy` — controlled vocabulary; proficiency + years; why five
- `uploading-certificates-and-verification` — three-state lifecycle; why default is unverified
- `your-public-profile-url` — what's public; what stays private; what 404s when consent is off
- `employment-history-entry` — fields, gaps, students, the opt-in employment verification flow

**Vacancy invitations (4)**
- `vacancy-invitations-explained` — what an invitation is + what's NOT a job ad
- `how-to-accept-decline-or-reconsider` — full state machine; when to use each
- `decline-reasons-and-what-they-mean` — six structured categories + why not free-text
- `accepted-with-notice-how-it-works` — 1/2/3 month notice; what the employer sees

**Skills & learning (4)**
- `career-compass-recommendations` — demand × gap × adjacency; the projected-rank-boost is honest
- `learning-paths-and-proficiency` — free vs paid; abandon reasons tracked; manual proficiency update
- `adjacent-roles-and-skill-gaps` — modelling adjacency; the smallest gap; demand caveat
- `curriculum-vs-market-demand-for-students` — student-only card; the gap as roadmap

**Consent & privacy (5)**
- `what-consent-purposes-mean` — six POPIA purposes; defaults; what off changes
- `contact-reveal-how-it-works` — four-step flow; 30-day window; how reveals are audit-logged
- `document-sharing-and-employer-access` — per-document consent; download = audit row
- `exporting-your-data-popia-section-23` — JSON shape; what's in / not in; the export is logged
- `deleting-your-account-right-to-erasure` — 30-day soft-delete; cryptographic shred; what survives

**Activity & audit (2)**
- `understanding-your-activity-ledger` — four KPIs + chronological feed; what's not shown
- `who-viewed-your-profile` — org-level (not individual) resolution; why; repeated views grouped

**Account & security (3)**
- `two-factor-authentication-setup` — TOTP + backup codes; manual recovery path
- `resetting-your-password` — email-link flow; 60-min expiry; sessions invalidated
- `managing-notification-preferences` — eight kinds + email-channel master switch; mandatory kinds

Total **27 articles**.

### F — 8 HelpLink deep-link surfaces

| Surface | Chips |
|---|---|
| `/dashboard` (overview) | How ranking works · Profile completeness · Career compass |
| `/dashboard/profile` | Profile photo guide · Adding skills · Work history |
| `/dashboard/qualifications` | How verification works |
| `/dashboard/invitations` | How invitations work · Accept, decline, reconsider · Decline reasons explained |
| `/dashboard/grow` | How recommendations work · Learning paths · Adjacent roles |
| `/dashboard/activity` | Reading your ledger · Profile viewers |
| `/dashboard/privacy` | Consent purposes explained · Export your data (s.23) · Delete your account |
| `/dashboard/account` | Enable 2FA · Reset your password · Notifications guide |

18 chips total across 8 surfaces.

---

## 🧠 LESSONS BAKED IN FROM PHASE 10.1 POST-SHIP

All three fixes documented at the bottom of `PHASE_10_1_COMPLETE.md` were inherited from the start:

1. **Aggregator maps `default` → `Article`.** `content/help/seeker/_index.ts` uses the `toArticle(mod as ArticleModule)` pattern. No `as unknown as HelpArticle[]` shortcut. Tested by clicking every article: no runtime `<Body />` of undefined.
2. **Width belongs at the page level.** The article page wraps `<article>` + Related in `<div className="mx-auto max-w-3xl">`. `HelpProse` is width-agnostic. Related strip is `md:grid-cols-2`.
3. **No `updatedAt` rendered.** The field stays in meta for editorial discipline; the article view never surfaces it.

The Phase 10.1 commit checklist passes for every seeker article without further edits.

---

## 📦 FILES TOUCHED

**New (37 files)**
- 27 article files under `content/help/seeker/{category}/{slug}.tsx`
- `content/help/seeker/_index.ts`
- `app/[locale]/(seeker)/dashboard/help/page.tsx`
- `app/[locale]/(seeker)/dashboard/help/[slug]/page.tsx`
- `docs/completed/PHASE_10_2_COMPLETE.md` (this doc)

**Edited (12 files)**
- `content/help/types.ts` — added `SeekerHelpCategory`, `HelpCategory` union, `SEEKER_HELP_CATEGORIES`; widened `meta.category`
- `components/feature/help/HelpLink.tsx` — added `role` prop; default `employer`
- `components/feature/help/HelpSearchIsland.tsx` — made role-agnostic via `basePath` + `categoryLabels` + `placeholder` props
- `app/[locale]/(employer)/employer/help/page.tsx` — pass new search-island props
- `components/layout/seekerNav.ts` — Help nav entry between Notifications and Privacy
- 7 seeker dashboard pages — `<HelpLink>` chips wired (overview, profile, qualifications, invitations, grow, activity, privacy)
- `app/[locale]/(seeker)/dashboard/account/page.tsx` — chips wired

**Verification**
- `tsc --noEmit` clean
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully; both `/[locale]/dashboard/help` and `/[locale]/dashboard/help/[slug]` registered

**Zero**: new tables, new audit kinds, new notification kinds, new external deps.

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **No `<HelpLink>` on /dashboard/experience or /dashboard/notifications.** The Help nav entry covers them; surface complexity doesn't yet justify the chip.
2. **No `<HelpLink>` on the public `/p/[handle]` profile page.** That route is public, no nav, no auth — the help center is reachable from /dashboard once signed in, which is the right place for a seeker to be when reading about their own visibility.
3. **No per-article "Was this useful?" feedback.** Same posture as Phase 10.1: help analytics are deferred until there's a privacy story.
4. **No JSON-LD / SEO.** Auth-gated routes; search engines never see them.
5. **No seeker-specific search island.** Reused `HelpSearchIsland` as-is via the role-agnostic refactor in §B. The same component will serve admin + gov.
6. **No cross-role search.** A seeker searching their help center doesn't get employer-help hits, and vice-versa. The roles' help centers are scoped to the role's actual surfaces — cross-role results would be confusing.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Seeker nav** — gains the Help entry between Notifications and Privacy & consent.
- **8 seeker dashboard pages** — gain unobtrusive `<HelpLink>` chips near the page header.
- **Two new routes registered** in the production build (`/[locale]/dashboard/help` + `/[locale]/dashboard/help/[slug]`).
- **Employer help centre** — unchanged behaviour; only the search island's calling convention changed (the page passes three new props now).
- **No new tables, audit kinds, notification kinds, or external deps.**

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ Admin / gov help centers (Phases 10.3 / 10.4)
- ❌ Translation to zu/xh/af (POPIA: human-translator only; deferred)
- ❌ Interactive tutorials / walkthrough tours
- ❌ "What's new" / changelog feed
- ❌ Server-side full-text help search
- ❌ Help-search analytics or heatmaps
- ❌ Video help content
- ❌ User-submitted help / community FAQ
- ❌ Live chat / support tickets
- ❌ AI chatbot / Q&A interface
- ❌ Marketing-facing public help (separate sebenzasa.com surface)
- ❌ Per-feature in-product onboarding modals

---

## 🧪 HOW TO VERIFY

1. Sign in as a seeker. Confirm the **Help** entry appears in the sidebar between Notifications and Privacy & consent, with the `HelpCircle` icon.
2. Open `/dashboard/help`. Verify the hero search bar is the first interactive element + the 7 category sections render below in declared order (Getting started → Profile & visibility → Vacancy invitations → Skills & learning → Consent & privacy → Activity & audit → Account & security).
3. Each section should list its articles as cards with title + shortDescription + (where set) the "Try it" surface chip.
4. Type "consent" in the search bar. Expect: instant filter to articles matching that token; URL updates to `?q=consent`; refresh preserves the state. Top hit should be `what-consent-purposes-mean`.
5. Click any card. The article page should render with:
   - breadcrumb back to Help center + category anchor
   - article body inside the centered `max-w-3xl` reading column (no right gutter)
   - "Try it now →" CTA when `surfaceLink` is set
   - Related strip at the bottom in 2 columns (broken / self-references silently dropped)
6. Visit `/dashboard/help/totally-bogus-slug`. Expect: Next.js notFound page.
7. Visit `/dashboard`, `/dashboard/profile`, `/dashboard/qualifications`, `/dashboard/invitations`, `/dashboard/grow`, `/dashboard/activity`, `/dashboard/privacy`, `/dashboard/account` — each should carry one or more `<HelpLink>` chips near the page header. Clicking any chip should land on the correct article.
8. Open the employer help centre (`/employer/help`) signed in as an employer. Verify it still works end-to-end (the Phase 10.2 refactor changed only the calling convention; behaviour is unchanged).

---

*Phase 10.2 closes the seeker side of the discoverability gap. The 27 articles parallel the editorial bar set in Phase 10.1, with content tuned to the seeker's actual journey (profile, invitations, consent, growth, audit) — not a mirror of the employer's. The role-agnostic refactor of HelpLink + HelpSearchIsland makes 10.3 (admin) and 10.4 (gov) follow the same pattern with even less infrastructure work. Same trust posture as Phase 10.1: mobile-first, English-only, civic-editorial tone, honest about what the platform does + does not do.*
