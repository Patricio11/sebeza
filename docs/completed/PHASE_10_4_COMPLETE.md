# PHASE 10.4 COMPLETE — GOVERNMENT HELP CENTER
*Shipped 2026-05-29. Final role of the four-role help-centre suite. 23 hand-written articles across 7 categories, 21 in-context HelpLink chips on the 8 highest-traffic gov analytics surfaces.*

> **One-line summary**: A browseable + searchable help center at `/gov/help` covering the gov workspace — orientation + privacy floor, provincial briefs, shortage + opportunity, curriculum + outcomes, employer lookup, exports, account + oversight. Aggregate-only data posture documented end-to-end; the "watch the watchers" oversight model surfaced explicitly so gov users understand the symmetric trust posture.

Commits:

- (this commit) — Phase 10.4 ship: GovHelpCategory types + 23 articles + 8 deep-link surfaces

This is the final help centre. The role-agnostic refactor done in Phase 10.2 meant adding gov required only: a new role tag on the type union, one new BASE_PATH entry on HelpLink, and the content + pages.

---

## 🎯 WHAT SHIPPED

### A — Type extension (`content/help/types.ts`)

- New `GovHelpCategory` string-enum (`getting_started`, `provincial_briefs`, `shortage_opportunity`, `curriculum_outcomes`, `employer_lookup`, `exports_reports`, `account_oversight`).
- `HelpCategory` union widened to include it. Seeker + employer + admin types continue to work unchanged.
- New `GOV_HELP_CATEGORIES` constant: label + description + display order. IA reads top-down by frequency of daily work (orient → provincial → shortage/opportunity → curriculum → lookup → exports → account).

### B — Reused infrastructure (Phase 10.2 refactor still serving)

- `HelpLink` got a fourth role: `"gov"` (basePath `/gov/help`). Default stays `"employer"`.
- `HelpSearchIsland` already role-agnostic — no changes needed.
- `HelpProse` reused verbatim.

### C — Gov pages

- **Index** `/gov/help` — hero search bar + 7 category sections with article cards. When `?q=` is present, the search island takes over with ranked results.
- **Article** `/gov/help/[slug]` — breadcrumb back to index/category + article body inside a centered `max-w-3xl` reading column + "Related" strip in 2 columns. No `meta.updatedAt` rendered.

Both auth-gated by `verifyGov()`.

### D — Nav entry (`components/layout/govNav.ts`)

New `{ key: "help", label: "Help", href: "/gov/help", icon: HelpCircle }` inserted between Policy brief and My account.

### E — 23 articles (across 7 categories)

**Getting started (3)**
- `what-sebenza-is-for-government` — four operating principles for the gov lens (confirmed-not-self-reported; aggregates not individuals; regulated lookup; symmetric audit)
- `your-first-hour-orientation` — five surfaces in order; the access-scope question every new gov user asks
- `privacy-floor-explained` — why k=10, how suppression manifests in heatmaps + CSVs + briefs, sub-querying doesn't defeat the floor

**Provincial & municipal briefs (4)**
- `reading-the-lmi` — three components (activity, conversion, persistence); geometric mean; reading the delta honestly
- `reading-your-provincial-brief` — what each card shows; using the brief in a Treasury sitting
- `top-skills-gaps-supply-freshness` — why raw supply misleads; reading freshness; cross-checks with Stats SA
- `cities-coming-soon` — why the municipal surface ships dormant; the threshold logic; substitute workflow today

**Shortage & opportunity (4)**
- `shortage-justification-index-explained` — three classifications; four signals driving them; opinionated classifier disclaimer
- `interpreting-demand-and-supply-ratios` — 1.0 baseline; thresholds; three edge cases that generate false signals
- `local-supply-available-incentives` — opportunity vs shortage; four incentive postures (salary / mobility / employer-readiness / information)
- `decline-reasons-and-stall-reasons` — aggregate policy diagnostic; what dominant reasons signal; not employer-specific

**Curriculum & outcomes (3)**
- `curriculum-vs-market-demand` — two-axis alignment; reading a programme row; province + programme filters
- `programme-cohort-outcomes-and-retention` — 6/12/24/36-month retention; reading retention + alignment together
- `what-suppressed-cells-mean` — three reasons (k=10, composite confidence, high-sensitivity dimension); not the same as zero

**Employer lookup & compliance (4)**
- `per-employer-lookup-what-you-can-query` — exact-match only; result panel contents; what it deliberately doesn't show
- `case-reference-documenting-your-query` — what makes a good reference; what doesn't; what admins see
- `reading-employment-status-mix` — what it tells you; what it doesn't; three common mistakes; not the EEA-1 return
- `the-oversight-log-your-lookups` — symmetric audit; why this protects gov users doing legitimate work

**Exports & reports (3)**
- `bulk-csv-downloads` — seven export types + schemas; query parameters; what suppression looks like in a CSV
- `policy-brief-as-pdf` — print-styled aggregation; the deliberate non-customisation; PDF naming convention
- `lmi-json-public-api` — `/api/lmi`, no auth, 5-min cache, what the endpoint commits us to publicly

**Account & oversight (2)**
- `two-factor-authentication` — mandatory TOTP; backup codes; switching devices; 12-hour session expiry; no remember-this-device
- `your-activity-audit-trail` — what's in / not in your audit trail; POPIA Section 23 rights; 7-year retention for regulated lookups

Total **23 articles**.

### F — 8 HelpLink deep-link surfaces

| Surface | Chips |
|---|---|
| `/gov` (overview) | What this is · Reading the LMI · Privacy floor |
| `/gov/provinces` | Reading provincial briefs · Gaps + freshness · Cities (coming soon) |
| `/gov/shortage` | Index explained · Reading the ratios · Decline + stall signals |
| `/gov/opportunity` | Designing incentives · Shortage index |
| `/gov/curriculum` | Reading this surface · Cohort outcomes · Suppressed cells |
| `/gov/employer-lookup` | How to query · Case reference rules · Reading the mix · Oversight log |
| `/gov/exports` | Export schemas · Policy brief PDF · LMI public API |
| `/gov/account` | 2FA setup · Audit trail + POPIA rights |

21 chips total across 8 surfaces.

---

## 🧠 LESSONS FROM 10.1 / 10.2 / 10.3 INHERITED

All three Phase 10.1 post-ship fixes baked in from day one (no follow-up commits needed):

1. **Aggregator maps `mod.default → Article`** via the `toArticle(mod as ArticleModule)` pattern.
2. **Page-level `max-w-3xl` wrapper**; HelpProse stays width-agnostic; Related strip is `md:grid-cols-2`.
3. **No `meta.updatedAt` rendered** in the article view.

---

## 📦 FILES TOUCHED

**New (35 files)**
- 23 article files under `content/help/gov/{category}/{slug}.tsx`
- `content/help/gov/_index.ts`
- `app/[locale]/(gov)/gov/help/page.tsx`
- `app/[locale]/(gov)/gov/help/[slug]/page.tsx`
- `docs/completed/PHASE_10_4_COMPLETE.md` (this doc)

**Edited (10 files)**
- `content/help/types.ts` — added `GovHelpCategory`, `GOV_HELP_CATEGORIES`; widened `HelpCategory` union
- `components/feature/help/HelpLink.tsx` — added `"gov"` to the role union + base-path map
- `components/layout/govNav.ts` — Help nav entry between Policy brief and My account
- 8 gov surfaces — `<HelpLink>` chips wired (overview, provinces, shortage, opportunity, curriculum, employer-lookup, exports, account)

**Verification**
- `tsc --noEmit` clean
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully; both `/[locale]/gov/help` and `/[locale]/gov/help/[slug]` registered

**Zero**: new tables, new audit kinds, new notification kinds, new external deps.

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **English-only.** Gov users are trained analysts; technical content (k-anonymity, classifier methodology, POPIA references) is content where machine translation risks legal misstatement. Deferred indefinitely.
2. **No per-article feedback.** Same posture as Phases 10.1 / 10.2 / 10.3.
3. **No HelpLink on `/gov/brief`.** The Policy Brief is a print-rendered artefact with no interactive controls; adding a chip would clutter the print output. The Help nav entry is one click away.
4. **No HelpLink on `/gov/provinces/[slug]`.** The province deep-dive inherits the provincial-briefs chip from the parent grid.
5. **No JSON-LD / SEO.** Auth-gated routes; search engines never see them.
6. **No cross-role search.** A gov user searching their help center doesn't get seeker/employer/admin hits.
7. **Cohort-retention article was already documented for seekers + employers + admins from different angles.** The gov-side article focuses on the policy-evidence read of cohort retention; it doesn't duplicate the platform-mechanics content.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Gov nav** — gains the Help entry between Policy brief and My account.
- **8 gov surfaces** — gain unobtrusive `<HelpLink>` chips near the page header.
- **Two new routes registered** in the production build (`/[locale]/gov/help` + `/[locale]/gov/help/[slug]`).
- **Employer + seeker + admin help centres** — unchanged behaviour; role-agnostic refactor from Phase 10.2 continues to serve.
- **No new tables, audit kinds, notification kinds, or external deps.**

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ Translation to zu/xh/af (gov technical content is English-only by design)
- ❌ Interactive tutorials / walkthrough tours
- ❌ "What's new" / changelog feed
- ❌ Server-side full-text help search
- ❌ Help-search analytics or heatmaps
- ❌ Video help content
- ❌ Live chat / support tickets
- ❌ AI chatbot / Q&A interface
- ❌ Public methodology paper (technical methodology lives here; a public-facing white paper is a separate artefact for later)
- ❌ Per-feature in-product onboarding modals

---

## 🧪 HOW TO VERIFY

1. Sign in as a gov user (2FA required). Confirm the **Help** entry appears in the sidebar between Policy brief and My account, with the `HelpCircle` icon.
2. Open `/gov/help`. Verify the hero search bar is the first interactive element + the 7 category sections render below in declared order (Getting started → Provincial & municipal briefs → Shortage & opportunity → Curriculum & outcomes → Employer lookup & compliance → Exports & reports → Account & oversight).
3. Each section should list its articles as cards with title + shortDescription + (where set) the "Try it" surface chip.
4. Type "suppress" in the search bar. Expect: instant filter; URL updates to `?q=suppress`; refresh preserves state. Top hits should include `what-suppressed-cells-mean` and `privacy-floor-explained`.
5. Click any card. The article page should render with:
   - breadcrumb back to Gov help + category anchor
   - article body inside the centered `max-w-3xl` reading column
   - "Try it now →" CTA when `surfaceLink` is set
   - Related strip at the bottom in 2 columns
6. Visit `/gov/help/totally-bogus-slug`. Expect: Next.js notFound page.
7. Visit `/gov`, `/gov/provinces`, `/gov/shortage`, `/gov/opportunity`, `/gov/curriculum`, `/gov/employer-lookup`, `/gov/exports`, `/gov/account` — each should carry one or more `<HelpLink>` chips near the page header. Clicking any chip should land on the correct article.
8. Sign in as the other three roles in turn. Verify each role's help centre still works end-to-end. The Phase 10.4 changes only added a new role to the unions and base-path map; they didn't change existing behaviour.

---

## 🎉 PHASE 10 (HELP CENTERS) COMPLETE

This commits the fourth and final role-specific help centre. Phase 10's four sub-phases together delivered:

- **108 hand-written articles** across the four roles
  - 30 employer (Phase 10.1)
  - 27 seeker (Phase 10.2)
  - 28 admin (Phase 10.3)
  - 23 gov (Phase 10.4)
- **4 auth-gated help centres** at `/employer/help`, `/dashboard/help`, `/admin/help`, `/gov/help`
- **8 routes** registered in production (4 indexes + 4 article views)
- **~80 in-context HelpLink chips** across 33 high-traffic dashboard surfaces
- **Shared infrastructure**: one `HelpProse` typography set, one role-agnostic `HelpSearchIsland`, one role-tagged `HelpLink`, one `HelpArticle` shape
- **Zero new tables, audit kinds, notification kinds, or external deps** across the entire Phase 10 arc

The trust posture documented in 108 articles is the same posture the platform was built on: aggregate-only for outsiders, redaction by default, audit everywhere, honest about what we deliberately don't do, civic-editorial tone throughout. Same posture as the rest of Sebenza, now extended to the platform's own documentation.

---

*Phase 10.4 closes the four-role help-centre suite. The gov articles are the editorial bar for translating platform mechanics into policy-evidence-ready statements — what to cite, what not to cite, what the suppression chip means, why the LMI commits us publicly. Future phases can clone the scaffold for new roles if the platform ever adds one; the infrastructure is already there.*
