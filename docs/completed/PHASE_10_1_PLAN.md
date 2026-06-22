# PHASE 10.1 PLAN  Employer help center

*Plan opened 2026-05-29. Companion: `docs/ROADMAP.md` (Phase 10 = launch). Targets sign-off before code lands.*

---

## 🎯 WHAT THIS PHASE IS

Sebenza has grown to ~23 phases of functionality on the employer side alone: vacancies, the match page chips + sort + shortlist, bulk invites, follow-up nudges, accept-rate analytics, the placements lifecycle (check-ins, departures, re-engage, retention snapshot), employer KYC, the "Other" organisation submission flow, the optional employment-verification email, team roles, dossier reveal gate, talent pools, saved searches, audit log, decline-reason analytics, the insights heatmap, billing. **No single employer  not even a power user  can be expected to know every surface exists, much less how each one works.**

Two distinct symptoms in the same gap:

- **"I'm stuck."** The user knows what they want; they can't find it / it isn't working / they hit an error.
- **"I didn't know I could."** The user has a problem; the platform already solved it; they never discovered the surface.

Phase 10.1 ships a per-role, in-product **help center** that addresses both: a browseable + searchable index of articles per employer surface, plus *"How does this work?"* deep-links on the highest-traffic surfaces so help arrives in-context.

Phase 10.1 is **employer-only**. Seeker / admin / gov get the same shape in follow-up phases (10.2 / 10.3 / 10.4) once the employer flow is proven and the editorial bar is set. **English only** at v1 per the no-machine-translation rule (POPIA / consent copy can never be MT'd; help articles often explain consent flows so the same restraint applies).

---

## 🔒 LOCKED DECISIONS

### D0  Employer only at v1; English only

Three good reasons to start with the employer role:

- It's the most complex surface and the highest-leverage place to land help.
- Employer success drives placements (Placement-Truth), which drives the platform's outcomes signal.
- Building the system once + templating to seeker / admin / gov in follow-up phases lets us bake the editorial bar properly before replicating.

English only because the help articles explain consent + POPIA mechanics + the platform's verification-honesty posture; translating them is **human-translator** work, not MT. Translation lands in a future phase if/when the employer help center sees real traction.

### D1  Content lives as TypeScript modules at `content/help/employer/<slug>.tsx`

Each article is a `.tsx` file exporting:

```ts
export const meta: HelpArticleMeta = {
  slug: "vacancies-create",
  title: "Creating a vacancy",
  category: "vacancies",
  shortDescription: "Walk through every field on the new-vacancy form...",
  keywords: ["vacancy", "post", "create", "new"],
  related: ["vacancies-find-matches", "vacancies-statuses"],
  surfaceLink: "/employer/vacancies/new",
};

export default function Article() {
  return (
    <>
      <p>A vacancy is a private hiring specification...</p>
      ...
    </>
  );
}
```

Reasons over MDX / plain markdown:

- **Type-safe metadata** + the article tree is PR-reviewable like any other code.
- **No new build pipeline** (MDX needs `@next/mdx` + loader config); zero new deps.
- **Rich inline components** for callouts, steps, keyboard chips, deep-link buttons  authored in JSX, not stringy markdown.
- **Searchable in dev** (article paths follow predictable slugs).

A small set of typography components (`<HelpProse>`, `<Callout>`, `<Steps>`, `<HelpKey>`, `<DashboardLink>`) live alongside the articles so the prose stays consistent across all ~30 entries.

### D2  Seven categories, ~25–30 articles total

Editorial IA below. Article counts are estimates; final list lives in the article tree.

1. **Getting started** (3)  first-time org admin orientation.
2. **Vacancies** (6)  create, statuses, find matches, shortlist, duplicate, seasonal window.
3. **Invitations** (5)  bulk invite, personal note, follow-up nudges, accept-rate, expiry.
4. **Employees & placements** (5)  mark-as-filled, lifecycle view, status check-ins, departures + re-engage, internal notes.
5. **Talent search & dossiers** (5)  search filters, dossier reveal gate, saved searches, talent pools.
6. **Organisation & team** (4)  KYC, verification status, team roles, 2FA.
7. **Privacy & POPIA** (2)  what we hold, audit log access.

Total: ~30 articles. Each article 250–600 words. Honest about what the platform does and doesn't do (Verification-Honesty Rule applies to copy too).

### D3  Two pages: index + per-article

- `/employer/help`  index page with hero search bar + 7 category sections + article cards.
- `/employer/help/[slug]`  article view with breadcrumb back to index + the article body + a "Related" strip + a "Try it now →" deep-link when `surfaceLink` is set.

Both auth-gated by `verifyEmployer()`. The help center is in-product, not public marketing; URL routing is auth-required.

### D4  Search is client-side fuzzy, no new deps

Search index = `(title + shortDescription + keywords + category-label).toLowerCase()`. Each search keystroke filters + ranks against the full article set. ~30 articles × a few fields = trivial work; renders in under 5ms even on a low-end phone.

Ranking:
1. Exact title match  top
2. Prefix title match  next
3. Keyword exact match  next
4. Title substring  next
5. shortDescription substring  next
6. Category label substring  next

No fuzzy-distance scoring (Levenshtein / Jaro-Winkler) in v1  prefix + substring covers 95% of intent and stays under 50 LOC.

### D5  Nav entry between Notifications and Account

`EMPLOYER_NAV` gets a new entry `{ key: "help", label: "Help", href: "/employer/help", icon: HelpCircle }` sitting between Notifications and Account. The Lucide `HelpCircle` icon is small enough not to dominate the sidebar.

The user explicitly asked for it "next to sign-out"  this is the spot. Account is the last item; Help sits just above it so the most-used surfaces stay above the fold and Help is reachable with one scroll on phones.

### D6  *"How does this work?"* deep-links on the top ~8 surfaces

In-context discovery is the other half of the gap. We add a tiny `<HelpLink slug="...">` component (just an icon + "How does this work?" text + arrow) on the highest-traffic employer pages:

- `/employer/vacancies/new`  the vacancy form (so many fields people skip)
- `/employer/vacancies/[id]`  vacancy detail (lifecycle states, accept-rate strip)
- `/employer/vacancies/[id]/match`  match page (the new chip/sort/shortlist UX)
- `/employer/placements`  employees / lifecycle list
- `/employer/placements/[placementId]`  detail (check-in, departure, re-engage)
- `/employer/invites`  seeker invites
- `/search`  talent search filters
- `/employer/organisation`  KYC / verification status

NOT on every page  the goal is "in-context help when you need it," not visual clutter.

### D7  No "what's new" feed in this phase

Feature discovery via a "what's new" feed is a different problem (proactive vs reactive). Help search + browseable categories address the discoverability gap that motivated this phase; if we still see "I didn't know I could" signals after launch, a what's-new feed is a focused follow-up.

### D8  No help-search analytics at v1

Privacy-first. We could log "user searched for X" to surface gaps in our coverage, but that creates a new PII surface on a dashboard where we currently track almost nothing per-user. Future phase if needed; for v1, dev intuition + the actual support ticket volume tell us where to invest.

### D9  Articles deliberately tell the user what the platform **doesn't** do

Verification-Honesty Rule applies to help copy too. Articles say things like *"Sebenza never sends the employer a generic mass mailshot  every invite is attributed to a real role and a real recruiter"* not just to brag, but because the user might be searching for a generic-blast feature that we deliberately don't ship. Honest *"this isn't what we do"* moments build trust + save support load.

### D10  Mobile-first, civic-editorial typography

Same aesthetic bar as every other Sebenza surface: Fraunces titles, Hanken Grotesk body, generous whitespace, hairline rules, brand teal as the only colour accent. Search input is full-width on phones, category chips wrap; article body is at most 65ch wide for readability. No glossy callout boxes / SaaS-template feel.

### D11  Out-of-scope follow-ups are explicit

- Seeker help center  Phase 10.2
- Admin help center  Phase 10.3
- Gov help center  Phase 10.4
- Translation to zu/xh/af  future phase if traction warrants
- "What's new" feed  separate phase
- Interactive tutorials / walkthroughs  separate phase
- Server-side help search  not until articles exceed ~200
- Help analytics / heatmaps  not until we have a privacy story for it
- Video help content  separate phase
- User-submitted FAQ / community help  not while we're small

---

## 📦 TASK LIST

- **10.1.1 Content infrastructure**  `content/help/` directory + `HelpArticleMeta` type + `getEmployerArticles()` + `findArticleBySlug()` + `CATEGORY_LABELS` constant. Tiny module, all type-safe.
- **10.1.2 Typography components**  `<HelpProse>` wrapper + `<Callout>` + `<Steps>` + `<DashboardLink>` + `<HelpKey>`. Lives at `components/feature/help/`.
- **10.1.3 Help index page**  `/employer/help` with hero search bar (client island) + category sections + article cards. State is in URL (`?q=`) so deep-links survive refresh.
- **10.1.4 Article page**  `/employer/help/[slug]` with breadcrumb + article body + "Try it now →" CTA when `surfaceLink` is set + related-articles strip.
- **10.1.5 Search island**  `HelpSearchIsland` (client component) wraps the article list with the rank-and-filter logic per D4.
- **10.1.6 Nav entry**  `EMPLOYER_NAV` extended with the Help item per D5.
- **10.1.7 `<HelpLink>` component**  small icon + text + arrow chip. Reusable across the ~8 deep-link surfaces per D6.
- **10.1.8 Write ~30 articles**  across the 7 categories per D2. Each 250–600 words. PR-reviewable; consistent voice.
- **10.1.9 Wire `<HelpLink>` into the 8 surfaces** per D6.
- **10.1.10 Typecheck + tests + build + commit**.
- **10.1.11 PHASE_10_1_COMPLETE.md + move plan** to `docs/completed/`.

---

## 🚫 OUT OF SCOPE

- ❌ Seeker / admin / gov help centers (Phases 10.2 / 10.3 / 10.4).
- ❌ Translation to zu/xh/af (POPIA: human translators only; deferred).
- ❌ Interactive tutorials or walkthrough tours.
- ❌ "What's new" / changelog feed.
- ❌ Server-side full-text help search.
- ❌ Help-search analytics or heatmaps.
- ❌ Video help content.
- ❌ User-submitted help / community FAQ.
- ❌ Live chat / support tickets.
- ❌ AI chatbot / Q&A interface.
- ❌ Marketing-facing public help (separate sebenzasa.com surface).
- ❌ Per-feature in-product onboarding modals.

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

1. **Help articles are content, not code, but the content is the hard part.** Building the system is half a day; writing 30 quality articles is several days of careful editorial work. Locking the system shape now lets the rest of the time go into the articles.

2. **Discoverability is real.** Phase 9.19 / 9.20 / 9.22 / 9.23 alone shipped a dozen new surfaces. Even the developer who built them needs to look at the code to remember every chip + sort + nudge option. Recruiters reading email at midnight won't know about half of it without somewhere to look.

3. **In-context deep-links close the discovery loop.** The `<HelpLink>` widget on key surfaces means even users who never visit `/employer/help` directly will discover the help center through the pages they use most.

4. **One role first sets the bar.** Generic SaaS help centers feel templated and shallow. Doing employer end-to-end at the Civic Editorial bar makes seeker / admin / gov inherit a high-quality reference, not start from scratch.

---

*Plan opened 2026-05-29. Target: complete within ~2 focused days (½ day system + 1½ days editorial). Bounded scope: zero new tables, zero new audit kinds, zero new notification kinds, zero new external dependencies. Pure additive UI + content.*
