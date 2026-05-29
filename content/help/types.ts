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
 * Discriminated union of every role's category. `meta.category` is
 * just a string at the wire level — the category label lookup happens
 * against whichever role's CATEGORIES constant is in scope on the
 * page rendering the article. Keeping the union loose here means the
 * seeker / admin / gov help centres in Phase 10.2 / 10.3 / 10.4 don't
 * have to fork the `HelpArticleMeta` shape.
 */
export type HelpCategory = EmployerHelpCategory | SeekerHelpCategory;

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
