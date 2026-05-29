/**
 * Phase 10.1  Employer help index.
 *
 * Single source of truth for the employer help center. Imports every
 * article module + exposes:
 *
 *   EMPLOYER_HELP_ARTICLES  ordered flat list (HelpArticle[])
 *   findArticleBySlug       O(1) lookup for the article page
 *   articlesByCategory      grouped map for the index page sections
 *
 * Adding a new article: import it here + append to the list. The type
 * system catches a missing meta/Article export at compile time.
 */

import type { HelpArticle, EmployerHelpCategory } from "@/content/help/types";

// ── Getting started ─────────────────────────────────────────────────
import * as whatSebenzaIs from "./getting-started/what-sebenza-is";
import * as settingUpOrganisation from "./getting-started/setting-up-organisation";
import * as dashboardTour from "./getting-started/dashboard-tour";
import * as teamRoles from "./getting-started/team-roles";

// ── Vacancies ───────────────────────────────────────────────────────
import * as creatingAVacancy from "./vacancies/creating-a-vacancy";
import * as matchRequirements from "./vacancies/match-requirements";
import * as seasonalVacancies from "./vacancies/seasonal-vacancies";
import * as vacancyLifecycle from "./vacancies/vacancy-lifecycle";
import * as duplicateVacancy from "./vacancies/duplicate-vacancy";
import * as followUpNudges from "./vacancies/follow-up-nudges";

// ── Invitations ─────────────────────────────────────────────────────
import * as findingMatches from "./invitations/finding-matches";
import * as bulkInvite from "./invitations/bulk-invite";
import * as invitationLifecycle from "./invitations/invitation-lifecycle";
import * as shortlistVsPools from "./invitations/shortlist-vs-pools";
import * as acceptRateStrip from "./invitations/accept-rate-strip";

// ── Employees & placements ──────────────────────────────────────────
import * as loggingAPlacement from "./employees/logging-a-placement";
import * as lifecycleView from "./employees/lifecycle-view";
import * as checkIns from "./employees/check-ins";
import * as departuresReengage from "./employees/departures-reengage";
import * as internalNotes from "./employees/internal-notes";

// ── Talent search & dossiers ────────────────────────────────────────
import * as searching from "./talent-search/searching";
import * as savedSearches from "./talent-search/saved-searches";
import * as dossierReveal from "./talent-search/dossier-reveal";
import * as talentPools from "./talent-search/talent-pools";
import * as listedBySeekersBadge from "./talent-search/listed-by-seekers-badge";

// ── Organisation & team ─────────────────────────────────────────────
import * as kyc from "./organisation/kyc";
import * as inviteMembers from "./organisation/inviting-team";
import * as twoFactor from "./organisation/two-factor";

// ── Privacy & POPIA ─────────────────────────────────────────────────
import * as whatWeHold from "./privacy/what-we-hold";
import * as auditLog from "./privacy/audit-log";

/**
 * `import * as` yields a Module Namespace Object where each named
 * export is a property + the default export lives at `.default`. The
 * article files use the natural authoring pattern (named `meta` +
 * default React component); the aggregator maps each module to the
 * `{ meta, Article }` shape the renderer expects, so `article.Article`
 * is the React component, not `undefined`.
 */
type ArticleModule = {
  meta: HelpArticle["meta"];
  default: HelpArticle["Article"];
};

function toArticle(mod: ArticleModule): HelpArticle {
  return { meta: mod.meta, Article: mod.default };
}

export const EMPLOYER_HELP_ARTICLES: HelpArticle[] = [
  whatSebenzaIs,
  settingUpOrganisation,
  dashboardTour,
  teamRoles,
  creatingAVacancy,
  matchRequirements,
  seasonalVacancies,
  vacancyLifecycle,
  duplicateVacancy,
  followUpNudges,
  findingMatches,
  bulkInvite,
  invitationLifecycle,
  shortlistVsPools,
  acceptRateStrip,
  loggingAPlacement,
  lifecycleView,
  checkIns,
  departuresReengage,
  internalNotes,
  searching,
  savedSearches,
  dossierReveal,
  talentPools,
  listedBySeekersBadge,
  kyc,
  inviteMembers,
  twoFactor,
  whatWeHold,
  auditLog,
].map((mod) => toArticle(mod as ArticleModule));

export function findArticleBySlug(slug: string): HelpArticle | null {
  return (
    EMPLOYER_HELP_ARTICLES.find((a) => a.meta.slug === slug) ?? null
  );
}

export function articlesByCategory(
  category: EmployerHelpCategory,
): HelpArticle[] {
  return EMPLOYER_HELP_ARTICLES.filter(
    (a) => a.meta.category === category,
  );
}
