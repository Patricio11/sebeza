# PHASE 10.3 COMPLETE — ADMIN HELP CENTER
*Shipped 2026-05-29. Cloned the Phase 10.1 / 10.2 scaffold for admin staff (Sebenza employees running KYC review, qualification verification, moderation, POPIA compliance, oversight). 28 hand-written articles across 7 categories, 8 in-context HelpLink chips on the highest-traffic admin console surfaces.*

> **One-line summary**: A browseable + searchable help center at `/admin/help` covering every major admin surface — orientation, KYC & verification, moderation, POPIA compliance, taxonomy & settings, reports & oversight, operations. Plus tiny "How does this work?" deep-link chips on 8 admin console pages. Internal-only; English-only; content as TypeScript modules.

Commits:

- (this commit) — Phase 10.3 ship: AdminHelpCategory types + 28 articles + 9 deep-link surfaces

Read **`PHASE_10_1_COMPLETE.md` → "Post-ship fixes + lessons"** first if you're cloning this scaffold for gov (10.4). The same three patterns apply; they are baked in here from the start.

---

## 🎯 WHAT SHIPPED

### A — Type extension (`content/help/types.ts`)

- New `AdminHelpCategory` string-enum (`getting_started`, `kyc_verification`, `moderation`, `popia_compliance`, `taxonomy_settings`, `reports_oversight`, `operations`).
- `HelpCategory` union widened to include it. The seeker + employer types continue to work unchanged — same loose union pattern Phase 10.2 introduced.
- New `ADMIN_HELP_CATEGORIES` constant: label + description + display order. IA reads top-down by frequency of daily work (orientation → queue → moderation → POPIA → settings → reports → operations).

### B — Reused infrastructure (Phase 10.2 refactor)

- `HelpLink` got a third role: `"admin"` (basePath `/admin/help`). Default stays `"employer"`.
- `HelpSearchIsland` already role-agnostic (props: `basePath`, `categoryLabels`, `placeholder`) — no further changes needed.
- `HelpProse` reused verbatim.

### C — Admin pages

- **Index** `/admin/help` — hero search bar + 7 category sections with article cards. When `?q=` is present, the search island takes over with ranked results.
- **Article** `/admin/help/[slug]` — breadcrumb back to index/category + article body inside a centered `max-w-3xl` reading column + "Related" strip in 2 columns. No `meta.updatedAt` rendered.

Both auth-gated by `verifyAdmin()`. Admin role gating already enforces 2FA + admin-tier session.

### D — Nav entry (`components/layout/adminNav.ts`)

New `{ key: "help", label: "Help", href: "/admin/help", icon: HelpCircle }` inserted between Notifications and Platform settings.

### E — 28 articles (across 7 categories)

**Getting started (4)**
- `what-sebenza-is-for-admins` — four operating principles for the admin posture (audit-everything; defaults err for user; minimal PII; no scale-thumbing)
- `first-login-and-2fa-setup` — invite link, password, mandatory TOTP, backup codes
- `admin-dashboard-tour` — every nav entry top-to-bottom; what's in queue work vs reference
- `team-roles-and-permissions` — Reviewer / Operator / Lead; what each can and can't do; how to escalate

**KYC & verification (5)**
- `reviewing-seeker-id-submissions` — the four checks; three dispositions; what audit logs on each
- `qualification-review-and-saqa-workflow` — standard-institution vs non-standard path; SAQA referral
- `organisation-kyc-verification` — four documents; three badge tiers; the substitution pattern to watch for
- `approval-rejection-and-appeals` — writing rejections users can act on; the appeal queue; reversing your own decision
- `manual-verification-path` — when standard + SAQA don't apply; the Evidence panel; the audit posture

**Moderation (5)**
- `reading-profile-reports` — six reason categories; three aggregate-count patterns; triage by priority
- `when-to-suspend-an-account` — three tiers (warn / restrict / full suspend); bright-line behaviours
- `suspension-appeals-and-restoration` — appeal queue contents; the two-key reversal rule
- `decline-reason-oversight-and-patterns` — aggregate decline-reason oversight; four patterns to escalate
- `flagging-suspicious-activity` — eight behavioural patterns the audit log surfaces

**POPIA & compliance (4)**
- `handling-data-subject-requests` — five DSR rights; the workflow; the statutory deadline
- `processing-export-requests` — self-serve vs the two extension paths; what stays redacted
- `deletion-requests-right-to-erasure` — soft-delete / hard-delete; when immediate hard-delete applies
- `incident-response-via-audit-log` — four-step response; the Information Regulator notification trigger

**Taxonomy & settings (4)**
- `managing-skills-and-professions` — add, retire, merge; mandatory audit
- `suggestion-workflow-user-other-entries` — promote, merge, reject; triage by count
- `feature-flags-and-rollouts` — four rollout postures; why you read the description first
- `platform-settings-and-audit-trail` — settings beyond flags; per-setting audit-history view

**Reports & oversight (3)**
- `decline-reasons-aggregate-stats` — platform-level decline distribution; what they're used for
- `cohort-retention-and-outcomes` — how Placement-Truth measurement works; the 3/6/12/24 cron
- `monitoring-gov-lookups-for-patterns` — Oversight log; four fishing patterns; the gov-relationship posture

**Operations (3)**
- `understanding-the-audit-log-structure` — schema; filters; hashed vs plaintext
- `notification-settings-for-admins` — why only two kinds; the mandatory kinds
- `troubleshooting-common-issues` — eight common problems + documented response

Total **28 articles**.

### F — 9 HelpLink deep-link surfaces

| Surface | Chips |
|---|---|
| `/admin` (overview) | Console orientation · Dashboard tour · Troubleshooting |
| `/admin/verifications` | Reviewing KYC · Qualifications + SAQA · Organisation KYC · Writing dispositions |
| `/admin/moderation` | Reading reports · When to suspend · Decline-reason oversight |
| `/admin/audit-log` | Schema + filters · Incident response · Suspicious patterns |
| `/admin/users` | When to suspend · Appeals + restoration · POPIA DSRs |
| `/admin/settings` | Feature flags · Settings audit trail |
| `/admin/taxonomy` | Managing skills · Suggestion workflow |
| `/admin/oversight` | Reading patterns · Suspicious patterns |
| `/admin/account` | 2FA setup · Roles + permissions · Notifications |

22 chips total across 9 surfaces.

---

## 🧠 LESSONS FROM PHASE 10.1 / 10.2 BAKED IN

All three Phase 10.1 post-ship fixes were inherited from day one (no follow-up commits needed):

1. **Aggregator maps `mod.default → Article`** via the `toArticle(mod as ArticleModule)` pattern. No `as unknown as HelpArticle[]` shortcut. The runtime `<Body />` undefined bug from Phase 10.1 cannot reappear.
2. **Page-level `max-w-3xl` wrapper.** Article view centres content in `<div className="mx-auto max-w-3xl">`; HelpProse stays width-agnostic; Related strip is `md:grid-cols-2`. No right-gutter bug.
3. **No `updatedAt` rendered.** Field stays in meta for editorial discipline; never surfaced in the article view.

The Phase 10.1 / 10.2 quick-reference checklist passes on first commit.

---

## 📦 FILES TOUCHED

**New (40 files)**
- 28 article files under `content/help/admin/{category}/{slug}.tsx`
- `content/help/admin/_index.ts`
- `app/[locale]/(admin)/admin/help/page.tsx`
- `app/[locale]/(admin)/admin/help/[slug]/page.tsx`
- `docs/completed/PHASE_10_3_COMPLETE.md` (this doc)

**Edited (11 files)**
- `content/help/types.ts` — added `AdminHelpCategory`, `ADMIN_HELP_CATEGORIES`; widened `HelpCategory` union
- `components/feature/help/HelpLink.tsx` — added `"admin"` to the role union + base-path map
- `components/layout/adminNav.ts` — Help nav entry between Notifications and Platform settings
- 9 admin console pages — `<HelpLink>` chips wired (overview, verifications, moderation, audit-log, users, settings, taxonomy, oversight, account)

**Verification**
- `tsc --noEmit` clean
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully; both `/[locale]/admin/help` and `/[locale]/admin/help/[slug]` registered

**Zero**: new tables, new audit kinds, new notification kinds, new external deps.

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **English-only.** Admin staff are trained internal users; translation isn't a launch blocker, and the editorial discipline of admin docs (regulatory references, structured workflows) makes machine translation actively dangerous. Deferred indefinitely.
2. **No per-article "Was this useful?" feedback.** Same posture as Phases 10.1 / 10.2.
3. **No HelpLink on `/admin/notifications`.** The Notifications page is a paginated inbox with no friction surface that warrants a chip; the Help nav entry is one click away.
4. **No HelpLink on `/admin/taxonomy/suggestions`.** The suggestion queue inherits the taxonomy chip context; the article is reachable from the taxonomy parent.
5. **No JSON-LD / SEO.** Auth-gated routes; search engines never see them.
6. **No cross-role search.** An admin searching their help center doesn't get seeker/employer hits, and vice-versa. The roles' help centers are scoped to the role's actual surfaces.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Admin nav** — gains the Help entry between Notifications and Platform settings.
- **9 admin console pages** — gain unobtrusive `<HelpLink>` chips near the page header.
- **Two new routes registered** in the production build (`/[locale]/admin/help` + `/[locale]/admin/help/[slug]`).
- **Employer + seeker help centres** — unchanged behaviour; the role-agnostic refactor done in Phase 10.2 means adding admin required only a new BASE_PATH entry and a new role tag on the type union.
- **No new tables, audit kinds, notification kinds, or external deps.**

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ Government help center (Phase 10.4)
- ❌ Translation to zu/xh/af (admin docs are English-only by design)
- ❌ Interactive tutorials / walkthrough tours
- ❌ "What's new" / changelog feed
- ❌ Server-side full-text help search
- ❌ Help-search analytics or heatmaps
- ❌ Video help content
- ❌ Live chat / support tickets
- ❌ AI chatbot / Q&A interface
- ❌ External-facing operator handbook (this content is internal-only; never exposed publicly)
- ❌ Per-feature in-product onboarding modals

---

## 🧪 HOW TO VERIFY

1. Sign in as an admin (2FA required). Confirm the **Help** entry appears in the sidebar between Notifications and Platform settings, with the `HelpCircle` icon.
2. Open `/admin/help`. Verify the hero search bar is the first interactive element + the 7 category sections render below in declared order (Getting started → KYC & verification → Moderation → POPIA & compliance → Taxonomy & settings → Reports & oversight → Operations).
3. Each section should list its articles as cards with title + shortDescription + (where set) the "Try it" surface chip.
4. Type "suspend" in the search bar. Expect: instant filter; URL updates to `?q=suspend`; refresh preserves state. Top hit should be `when-to-suspend-an-account`.
5. Click any card. The article page should render with:
   - breadcrumb back to Admin help + category anchor
   - article body inside the centered `max-w-3xl` reading column
   - "Try it now →" CTA when `surfaceLink` is set
   - Related strip at the bottom in 2 columns (broken / self-references silently dropped)
6. Visit `/admin/help/totally-bogus-slug`. Expect: Next.js notFound page.
7. Visit `/admin`, `/admin/verifications`, `/admin/moderation`, `/admin/audit-log`, `/admin/users`, `/admin/settings`, `/admin/taxonomy`, `/admin/oversight`, `/admin/account` — each should carry one or more `<HelpLink>` chips near the page header. Clicking any chip should land on the correct article.
8. Open the employer + seeker help centres signed in as the relevant role. Verify they still work end-to-end (Phase 10.3 added a new role to the HelpLink union but did not change existing employer/seeker behaviour).

---

*Phase 10.3 closes the admin side of the discoverability gap. The 28 articles document not just what the console does but the editorial posture behind every action — why we audit-everything, why defaults err on the user's side, why we don't put the operator's thumb on the scale. Same trust posture as Phases 10.1 / 10.2: civic-editorial tone, honest about what the platform deliberately doesn't do, internal-only and English-only by design. Gov (Phase 10.4) is the last one and plugs into exactly the same infrastructure — types union, HelpLink role tag, page scaffold, role-agnostic search island.*
