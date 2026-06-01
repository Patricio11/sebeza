/**
 * Phase 10.1  Help center content types.
 *
 * Each help article is a `.tsx` file that exports a typed `meta`
 * constant + a default React component (the article body). The
 * aggregator (`content/help/employer/_index.ts`) imports every article
 * + flattens them into the search/render-ready `HelpArticle[]`.
 *
 * Keep this file plain TypeScript (no React imports)  it's the
 * shared shape between editorial files + the search island + the
 * page renderers. Keeping it untyped-by-JSX means the seeker / admin /
 * gov help centers in follow-up phases (10.2 / 10.3 / 10.4) reuse the
 * same shape verbatim.
 */

/**
 * The seven editorial categories per D2. Categories carry display
 * order  the index page renders them in this exact sequence so the
 * IA reads top-down by user journey (getting started  daily work
 *  account / privacy).
 *
 * String enum so URLs / search-filter chips stay readable, not numeric.
 */
export type EmployerHelpCategory =
  | "getting_started"
  | "vacancies"
  | "invitations"
  | "employees"
  | "talent_search"
  | "organisation"
  | "privacy";

/**
 * Phase 10.2 — seeker categories. Parallel to the employer set but
 * the user journey is different: seekers don't post vacancies and
 * don't manage a team, but they DO need to understand profile
 * visibility, invitations from the receiving end, career growth,
 * and the consent toggles that gate every employer interaction with
 * their record.
 */
export type SeekerHelpCategory =
  | "getting_started"
  | "profile"
  | "invitations"
  | "growth"
  | "privacy"
  | "activity"
  | "account";

/**
 * Phase 10.3 — admin categories. Admin staff are platform operators
 * (Sebenza employees) running KYC review, qualification verification,
 * moderation, POPIA compliance, and oversight. The categories carry
 * the daily-work shape: verification queues first, then moderation,
 * then compliance, then taxonomy/settings, then reports.
 */
export type AdminHelpCategory =
  | "getting_started"
  | "kyc_verification"
  | "moderation"
  | "popia_compliance"
  | "taxonomy_settings"
  | "reports_oversight"
  | "operations";

/**
 * Phase 10.4 — gov categories. Gov users (labour-market analysts,
 * treasury, DHET, provinces, municipalities) see aggregated data
 * only; the categories follow their actual surfaces: orient yourself
 * → read provincial briefs → understand shortage + opportunity →
 * read curriculum-vs-demand → use employer lookup (regulated) →
 * pull exports → manage your account.
 */
export type GovHelpCategory =
  | "getting_started"
  | "provincial_briefs"
  | "shortage_opportunity"
  | "curriculum_outcomes"
  | "employer_lookup"
  | "exports_reports"
  | "account_oversight";

/**
 * Discriminated union of every role's category. `meta.category` is
 * just a string at the wire level — the category label lookup happens
 * against whichever role's CATEGORIES constant is in scope on the
 * page rendering the article. Keeping the union loose here means the
 * seeker / admin / gov help centres in Phase 10.2 / 10.3 / 10.4 don't
 * have to fork the `HelpArticleMeta` shape.
 */
export type HelpCategory =
  | EmployerHelpCategory
  | SeekerHelpCategory
  | AdminHelpCategory
  | GovHelpCategory;

export interface HelpArticleMeta {
  /** URL slug. Stable + permanent  becomes /employer/help/<slug>.
   *  Kebab-case, no leading slash. */
  slug: string;
  /** Title displayed in the index card + the article page <h1>. */
  title: string;
  /** One-sentence description shown on the index card + used as the
   *  search-rankable shortDescription. Cap at ~140 chars. */
  shortDescription: string;
  /** Category bucket  drives the index-page section grouping. */
  category: HelpCategory;
  /**
   * Extra search keywords beyond what's already in the title +
   * shortDescription. Lowercase, no punctuation. Used by the search
   * scorer per D4. Include synonyms users might type ("post" for
   * "create a vacancy"; "manager" for "team member") so the search
   * doesn't punish vocabulary drift.
   */
  keywords: string[];
  /**
   * Slugs of related articles. The article page surfaces these in a
   * "Related" strip at the bottom. Self-references silently
   * filter out at render time; broken slugs are ignored (we never
   * 404 the article view for a typo in `related`).
   */
  related: string[];
  /**
   * Optional dashboard surface this article helps with. When set, the
   * article page renders a "Try it now " CTA pointing here. Also
   * surfaced as a subtle link on the index card so users browsing the
   * index can deep-dive directly. NEVER a public marketing URL
   * help is in-product only.
   */
  surfaceLink?: string;
  /**
   * Last-updated date in ISO yyyy-mm-dd. Mostly editorial-discipline
   * (so authors notice stale articles); not surfaced prominently in
   * the UI  the article page shows it as small footnote text only.
   */
  updatedAt: string;
  /**
   * Phase 13.7 follow-up  audience gate.
   *
   * When set, the article only renders for viewers who satisfy the
   * named audience. Missing / undefined = visible to every viewer of
   * the role (existing behaviour for all pre-Phase-13 articles).
   *
   *   "student"  the viewer must be a seeker with an
   *              `academic_profiles` row (`MyProfile.academic` is
   *              non-null  i.e. they ticked "I'm currently a
   *              student" on their profile). Used by the two Phase
   *              13 articles  modules / elective / project capture
   *              and the progression timeline  so non-student
   *              seekers don't see help for surfaces they can't see.
   *
   * Gating happens in three places, by design:
   *   1. The help-center index filters the listed articles + sections.
   *   2. The article slug page returns notFound() for non-matching
   *      audiences (so direct URLs / share-links degrade cleanly).
   *   3. HelpLink chips on the dashboard surface are wrapped in
   *      `{me.academic && ...}` at the caller, since the chip itself
   *      has no audience awareness  the surfacing page knows the
   *      context.
   *
   * The 3 sites are intentionally NOT a single-source-of-truth helper
   * because each call carries its own context (search-island input
   * list, single-article 404, conditional chip render).
   */
  audienceRequires?: "student";
}

/**
 * Bundled meta + Article component. Resolved by the aggregator from
 * `import * as` of each article module. The renderer never imports
 * articles directly; everything goes through this shape.
 */
export interface HelpArticle {
  meta: HelpArticleMeta;
  Article: React.ComponentType;
}

/**
 * Category labels + display order. Lives next to the type so the
 * index page + the article-page breadcrumb both read from one source.
 */
export const EMPLOYER_HELP_CATEGORIES: ReadonlyArray<{
  value: EmployerHelpCategory;
  label: string;
  description: string;
}> = [
  {
    value: "getting_started",
    label: "Getting started",
    description:
      "Orient yourself in your first hour on the platform: what Sebenza is for, who can do what, and where to find things.",
  },
  {
    value: "vacancies",
    label: "Vacancies",
    description:
      "Create, edit + manage vacancies; understand the match-requirement axes; the lifecycle from draft to filled.",
  },
  {
    value: "invitations",
    label: "Invitations & matching",
    description:
      "Find candidates for a vacancy, invite them, read the response signal, and keep the pipeline honest.",
  },
  {
    value: "employees",
    label: "Employees & placements",
    description:
      "Log hires, run check-ins as time passes, capture departures, and read the retention figures.",
  },
  {
    value: "talent_search",
    label: "Talent search & dossiers",
    description:
      "Search the national talent base, save the search for recurring re-runs, and open a dossier when you're ready to reach out.",
  },
  {
    value: "organisation",
    label: "Organisation & team",
    description:
      "KYC verification, team roles, member invites, 2FA  the surface your IT team will care about.",
  },
  {
    value: "privacy",
    label: "Privacy & POPIA",
    description:
      "What data Sebenza holds about your organisation + how to read your own audit log.",
  },
];

/**
 * Phase 10.2 — seeker category labels + display order. Top-down by
 * user journey: get oriented → tune your profile → respond to
 * vacancies → grow your skills → read your audit trail → manage your
 * account + privacy controls.
 */
export const SEEKER_HELP_CATEGORIES: ReadonlyArray<{
  value: SeekerHelpCategory;
  label: string;
  description: string;
}> = [
  {
    value: "getting_started",
    label: "Getting started",
    description:
      "Orient yourself in your first hour: what Sebenza is, how the platform finds work for you, and what to fill in first.",
  },
  {
    value: "profile",
    label: "Profile & visibility",
    description:
      "What employers see, what stays private, and how to make your profile work harder for you. Verifications + completeness explained.",
  },
  {
    value: "invitations",
    label: "Vacancy invitations",
    description:
      "How invitations arrive, how to accept / decline / reconsider, and what each response signals to the employer.",
  },
  {
    value: "growth",
    label: "Skills & learning",
    description:
      "Your career compass: skill recommendations ranked by local demand, learning paths, and how to move into adjacent roles.",
  },
  {
    value: "privacy",
    label: "Consent & privacy",
    description:
      "POPIA consents, what each toggle controls, how to export your data, and how to delete your account.",
  },
  {
    value: "activity",
    label: "Activity & audit",
    description:
      "Who viewed your profile, who requested contact, what was downloaded — every PII-touching action recorded.",
  },
  {
    value: "account",
    label: "Account & security",
    description:
      "Email, password, two-factor authentication, notification preferences, sessions.",
  },
];

/**
 * Phase 10.3 — admin category labels + display order. The IA reads
 * top-down by frequency of daily work: get oriented → review the
 * verification queue → moderate accounts → process POPIA / DSR work
 * → curate taxonomy + settings → read aggregate reports → operate
 * the platform.
 */
export const ADMIN_HELP_CATEGORIES: ReadonlyArray<{
  value: AdminHelpCategory;
  label: string;
  description: string;
}> = [
  {
    value: "getting_started",
    label: "Getting started",
    description:
      "Orient yourself as a new admin: what the console is for, how to set up 2FA on day one, and what each nav entry does.",
  },
  {
    value: "kyc_verification",
    label: "KYC & verification",
    description:
      "The daily verification queue: seeker IDs, organisation KYC, qualifications. How to review, when to approve, how to write a reject reason that helps the user.",
  },
  {
    value: "moderation",
    label: "Moderation",
    description:
      "Profile reports, suspensions + restorations, appeals, the suspicious-activity signals you should escalate.",
  },
  {
    value: "popia_compliance",
    label: "POPIA & compliance",
    description:
      "Data subject rights (export, deletion, correction), audit-log incident response, and the consent posture you defend.",
  },
  {
    value: "taxonomy_settings",
    label: "Taxonomy & settings",
    description:
      "Curating the skill + profession taxonomy, processing user 'Other' suggestions, and managing feature flags + platform settings.",
  },
  {
    value: "reports_oversight",
    label: "Reports & oversight",
    description:
      "Aggregate stats, decline-reason patterns, retention cohorts, and how to monitor government employer-lookups for fishing patterns.",
  },
  {
    value: "operations",
    label: "Operations",
    description:
      "How the audit log is structured, notification preferences for admins, cron-job health, troubleshooting + the team-role permissions matrix.",
  },
];

/**
 * Phase 10.4 — gov category labels + display order. IA follows the
 * actual gov user journey: orient → read provincial briefs →
 * shortage + opportunity → curriculum + outcomes → employer lookup
 * (regulated, audit-logged) → exports → account + oversight.
 */
export const GOV_HELP_CATEGORIES: ReadonlyArray<{
  value: GovHelpCategory;
  label: string;
  description: string;
}> = [
  {
    value: "getting_started",
    label: "Getting started",
    description:
      "Orient yourself as a new gov user: what Sebenza is, what aggregate data you see, what you never see, and the privacy floor that makes the platform usable as policy evidence.",
  },
  {
    value: "provincial_briefs",
    label: "Provincial & municipal briefs",
    description:
      "Reading the per-province labour-market brief: supply, demand, top gaps, freshness signals. What the (coming-soon) municipal layer will show.",
  },
  {
    value: "shortage_opportunity",
    label: "Shortage & opportunity",
    description:
      "The Shortage Justification Index and the Local-Hiring Opportunity map. How cells are classified, what each signal means, how to slice + export.",
  },
  {
    value: "curriculum_outcomes",
    label: "Curriculum & outcomes",
    description:
      "Curriculum-vs-market-demand analytics for DHET + tertiary institutions. Programme-level cohort outcomes + retention. Why small cohorts are suppressed.",
  },
  {
    value: "employer_lookup",
    label: "Employer lookup & compliance",
    description:
      "The regulated per-employer query: exact-match only, case-reference required, every lookup audit-logged. Reading employment-status mix without overreading it.",
  },
  {
    value: "exports_reports",
    label: "Exports & reports",
    description:
      "Bulk CSV / JSON downloads, the printable Policy Brief artefact, the public LMI JSON API. What each export contains + when to use which.",
  },
  {
    value: "account_oversight",
    label: "Account & oversight",
    description:
      "Two-factor authentication, sign-in security, and how to read the oversight log that records your own lookup activity for admin review.",
  },
];
