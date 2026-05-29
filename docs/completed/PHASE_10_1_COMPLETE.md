# PHASE 10.1 COMPLETE — EMPLOYER HELP CENTER
*Shipped 2026-05-29. Plan: [`docs/completed/PHASE_10_1_PLAN.md`](./PHASE_10_1_PLAN.md). Closes the discoverability gap that's grown with every Phase 9.x ship — ~23 phases of employer functionality, no in-product surface that tells the user what they can do or how to do it.*

> **One-line summary**: A browseable + searchable help center at `/employer/help` with 30 hand-written articles across 7 categories covering every major employer surface (vacancies, invites, employees, talent search, KYC, roles, privacy/POPIA), plus tiny "How does this work?" deep-link chips on 8 high-traffic dashboard surfaces so help arrives in-context. English-only at v1; content as TypeScript modules (no MDX pipeline, no new deps).

One commit:

- **Phase 10.1** `0c6cbdb` — infrastructure + 30 articles + 8 deep-link surfaces

---

## 🎯 WHAT SHIPPED

### A — Content infrastructure (`content/help/`)

- `content/help/types.ts` — `HelpArticleMeta`, `HelpArticle`, `EmployerHelpCategory` types + `EMPLOYER_HELP_CATEGORIES` constant with the 7 categories' labels + descriptions + display order.
- `content/help/employer/_index.ts` — aggregator that imports every article module + exposes `EMPLOYER_HELP_ARTICLES`, `findArticleBySlug`, `articlesByCategory`. Adding a new article = one import + one append.

Each article is a `.tsx` file exporting:

```ts
export const meta: HelpArticleMeta = { ... };
export default function Article() { return <HelpProse>...</HelpProse>; }
```

Type-safe metadata; PR-reviewable like any code change.

### B — Typography components (`components/feature/help/HelpProse.tsx`)

Five shared components keep voice + visual consistency across all 30 articles:

- `<HelpProse>` — body wrapper that styles `<p>`, `<h2>`, `<h3>`, `<ul>`, `<ol>` etc. with civic-editorial typography (Fraunces headings, Hanken body, 65ch body width).
- `<Callout type="info|warning|tip" title?>` — emphasis blocks with tone-distinct treatment.
- `<Steps>` + `<Step number={N}>` — numbered procedures with deliberate explicit numbering.
- `<HelpKey>` — inline keyboard-shortcut chip.
- `<DashboardLink href>` — "Try it now →" CTA pointing into the app.

### C — Search island (`components/feature/help/HelpSearchIsland.tsx`)

Client-side fuzzy search. Rank-and-filter logic per D4:

1. Exact title match → rank 0 (top)
2. Prefix title match → rank 1
3. Exact keyword match → rank 2
4. Title substring → rank 3
5. shortDescription substring → rank 4
6. Category label substring → rank 5
7. Multi-token (all tokens appear somewhere) → rank 6

Under 50 LOC, no new deps. URL-synced (`?q=`) so deep-links / refresh / share-link preserve the search.

### D — `<HelpLink>` chip component (`components/feature/help/HelpLink.tsx`)

Small dashed-border chip for in-context deep-linking from dashboard surfaces. Defaults to *"How does this work?"* label but accepts an override for surface-specific wording.

### E — Pages

- **Index** `/employer/help` — hero search bar + 7 category sections with article cards. When `?q=` is present, the search island takes over with ranked results.
- **Article** `/employer/help/[slug]` — breadcrumb back to index/category + article body + last-updated footer + "Related" strip (resolves slug references; silently drops broken ones; silently drops self-references).

Both auth-gated by `verifyEmployer()`.

### F — Nav entry (`components/layout/employerNav.ts`)

New entry `{ key: "help", label: "Help", href: "/employer/help", icon: HelpCircle }` inserted between Notifications and Account. Reachable in one scroll on a 360px viewport; most-used surfaces stay above the fold.

### G — 30 articles (across 7 categories)

**Getting started (4)**
- `what-sebenza-is` — outcomes platform, not job board; the three founding principles
- `setting-up-organisation` — KYC walk-through, four documents, what unlocks on verify
- `dashboard-tour` — every nav entry explained, top-to-bottom
- `team-roles` — Owner / Recruiter / Viewer; who can do what

**Vacancies (6)**
- `creating-a-vacancy` — every field on the new-vacancy form
- `match-requirements` — work availability, min years, min NQF, and why blank means no constraint
- `seasonal-vacancies` — seasonal vs casual vs contract; the optional season window
- `vacancy-lifecycle` — Draft → Open → Closed → Filled
- `duplicate-vacancy` — when and why to duplicate from existing
- `follow-up-nudges` — opt-in 7-day reminder; one-nudge-per-invite cap

**Invitations & matching (5)**
- `finding-matches` — match page chips + sort + shortlist tab; honest-supply line
- `bulk-invite` — selection, 200-char personal note, what the seeker sees, skip behaviour
- `invitation-lifecycle` — Invited → Accepted / Declined / Reconsidering / Expired / Withdrawn
- `shortlist-vs-pools` — when to use per-vacancy shortlist vs cross-vacancy Talent pool
- `accept-rate-strip` — five buckets, acceptance math, reading the signal

**Employees & placements (5)**
- `logging-a-placement` — 30-day reveal gate, batch hire modal, fan-out notifications
- `lifecycle-view` — Active / Departed / All tabs, tenure, check-in-due pill, sort options
- `check-ins` — 3/6/12-month-then-annual cadence, nightly cron, the inline-confirm UX
- `departures-reengage` — 7 SA labour-relations categories, no reason recorded, re-engage modal
- `internal-notes` — 1000-char durable context, org-private, PII-flagged, what it's NOT for

**Talent search & dossiers (5)**
- `searching` — every filter; ranking; honest-supply line
- `saved-searches` — persisted filter sets + hash-diff new-match cron
- `dossier-reveal` — public vs reveal-gated fields; 30-day window for Mark-as-Hired
- `talent-pools` — cross-vacancy bookmarks; how they differ from per-vacancy shortlists
- `listed-by-seekers-badge` — Sebenza employer / Verified employer / Employer-verified pills

**Organisation & team (3)**
- `kyc` — four documents; review timing; rejection + resubmission; team-invites primer
- `inviting-team` — the email-based team invite flow + dual-account handling
- `two-factor` — TOTP setup, backup codes, recovery paths

**Privacy & POPIA (2)**
- `what-we-hold` — POPIA-§16 canonical statement of every data category
- `audit-log` — every PII-touching action recorded; how to access your org's trail

Total **30 articles**. (Plan estimated 25–30; final count 30; the inviting-team article ended up standalone in Organisation rather than folded into KYC.)

### H — `<HelpLink>` deep-links on 8 surfaces

Per D6 — in-context discovery on high-traffic pages:

| Surface | Chips |
|---|---|
| `/employer/vacancies` (list) | Create a vacancy · Lifecycle states · Duplicate an existing |
| `/employer/vacancies/new` | How to create a vacancy · Match requirements explained |
| `/employer/vacancies/[id]` | Vacancy lifecycle · Reading the accept-rate |
| `/employer/vacancies/[id]/match` | How matches work · Bulk invite guide |
| `/employer/placements` | How the Employees view works · Status check-ins |
| `/employer/placements/[placementId]` | Check-in cadence · Departures + re-engage |
| `/employer/invites` | Invitation lifecycle |
| `/employer/organisation` | KYC walkthrough · What data we hold |

16 chips total across 8 surfaces, matching D6 scope ("the top ~8 employer surfaces").

---

## ✅ LOCKED DECISIONS HONOURED

| # | Decision | Where it lives |
|---|---|---|
| **D0** | Employer only at v1; English only | Single role infra; no machine translation surface |
| **D1** | TypeScript modules at `content/help/employer/<slug>.tsx` | 30 article files + the `_index.ts` aggregator |
| **D2** | 7 categories, ~25–30 articles | `EMPLOYER_HELP_CATEGORIES` × 30 articles |
| **D3** | Two pages: index + per-article | `/employer/help` + `/employer/help/[slug]` |
| **D4** | Client-side fuzzy search, no new deps | `HelpSearchIsland` with 7-rank scoring, under 50 LOC |
| **D5** | Nav entry between Notifications and Account | `EMPLOYER_NAV` insertion |
| **D6** | "How does this work?" deep-links on top ~8 surfaces | 16 `<HelpLink>` chips across 8 pages |
| **D7** | No "what's new" feed in this phase | Not built |
| **D8** | No help-search analytics at v1 | Not built |
| **D9** | Articles tell users what the platform deliberately doesn't do | Honesty woven throughout (HRIS limits, decline-reason capture, dismissal reason, third-party PII deletion, etc.) |
| **D10** | Mobile-first, civic-editorial typography | `HelpProse` with 65ch body cap, Fraunces headings, Hanken body |
| **D11** | Out-of-scope follow-ups explicit | Preserved in the plan + this doc's out-of-scope section |

---

## 📦 FILES TOUCHED

**New (37 files)**
- `content/help/types.ts`
- `content/help/employer/_index.ts`
- 30 article files under `content/help/employer/{category}/{slug}.tsx`
- `components/feature/help/HelpProse.tsx` (5 typography components)
- `components/feature/help/HelpSearchIsland.tsx`
- `components/feature/help/HelpLink.tsx`
- `app/[locale]/(employer)/employer/help/page.tsx`
- `app/[locale]/(employer)/employer/help/[slug]/page.tsx`
- `docs/completed/PHASE_10_1_PLAN.md` (moved from `docs/`)
- `docs/completed/PHASE_10_1_COMPLETE.md` (this doc)

**Edited (9 files)**
- `components/layout/employerNav.ts` — Help nav entry
- 8 employer dashboard pages — `<HelpLink>` chips wired

**Verification**
- `tsc --noEmit` clean
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully; both help routes registered

**Zero**: new tables, new audit kinds, new notification kinds, new external deps.

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **`<HelpLink>` not added to `/search`.** `/search` is a public route (no auth verification). Adding a HelpLink that points to `/employer/help/searching` would 404 for non-employer viewers. The help center is reachable via the Help nav entry from /employer/* anyway, and the `searching` article is one of the most prominent in the Talent search category.

2. **No `<HelpLink>` on /employer/saved-searches, /employer/shortlists, /employer/team, /employer/notifications, /employer/account, or /employer/onboarding.** These surfaces are less complex; the Help nav entry covers them. We can add chips in a follow-up if support load suggests they're needed.

3. **No per-article "Was this useful?" feedback.** Deliberate. Help analytics are deferred (D8); collecting binary ratings without a privacy story is worse than nothing.

4. **No print stylesheet on article pages.** Recruiters occasionally print things; we'll add a print sheet if/when feedback asks. Not blocking launch.

5. **No "edit on GitHub" link on articles.** This is a closed-source platform; even if it weren't, the editorial workflow goes through PRs from the team, not the public.

6. **No JSON-LD / SEO microdata on the help pages.** They're auth-gated; search engines never see them.

7. **No `lastReviewedAt` separate from `updatedAt`.** The `updatedAt` is the date the article was last touched; reviewing-without-editing isn't tracked separately. If a quarterly review process emerges, we can add the field.

8. **The Article component is a default export, not named.** Convention chosen for ergonomic authoring (`export default function Article()`); the renderer imports `*` and reads `default`. Type safety is preserved via the `HelpArticle` interface in the aggregator.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Employer nav** — gains the Help entry between Notifications and Account.
- **8 employer dashboard pages** — gain unobtrusive `<HelpLink>` chips near the page header.
- **Two new routes registered** in the production build (`/employer/help` + `/employer/help/[slug]`).
- **Notification preferences** — no new kinds; the help center is a static surface with no notifications of its own.
- **Audit log** — no new kinds; viewing help articles is not a PII-touching action and doesn't need an audit row.

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved from the plan)

- ❌ Seeker / admin / gov help centers (Phases 10.2 / 10.3 / 10.4)
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

1. Sign in as an employer (any verification state). Confirm the **Help** entry appears in the sidebar between Notifications and Account, with the `HelpCircle` icon.
2. Open `/employer/help`. Verify the hero search bar is the first interactive element + the 7 category sections render below in declared order (Getting started → Vacancies → Invitations → Employees → Talent search → Organisation → Privacy).
3. Each section should list its articles as cards with title + shortDescription + (where set) the "Try it" surface chip.
4. Type "vacancy" in the search bar. Expect: instant filter to articles matching that token; URL updates to `?q=vacancy`; refresh preserves the state. Top hit should be `creating-a-vacancy` (exact title prefix).
5. Click any card. The article page should render with:
   - breadcrumb back to Help center + category anchor
   - article body with `HelpProse` typography
   - "Try it now →" CTA when `surfaceLink` is set
   - last-updated footer
   - Related strip at the bottom (filtered down by valid slugs)
6. Visit `/employer/help/totally-bogus-slug`. Expect: Next.js notFound page.
7. Visit `/employer/vacancies/new`, `/employer/vacancies/[id]`, `/employer/vacancies/[id]/match`, `/employer/placements`, `/employer/placements/[placementId]`, `/employer/invites`, `/employer/organisation`, `/employer/vacancies` — each should carry one or more `<HelpLink>` chips near the page header. Clicking any chip should land on the correct article.

---

*Phase 10.1 closes the discoverability gap that's grown organically with every Phase 9.x feature shipped. The 30 articles are the editorial bar; the system is small enough to clone for seeker / admin / gov in Phases 10.2 / 10.3 / 10.4 without architectural changes. Mobile-first, English-only, civic-editorial tone, honest about what the platform deliberately doesn't do — the trust posture the rest of the platform demands, now extended to its own documentation.*
