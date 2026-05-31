/**
 * Phase 10.4  Gov help index.
 *
 * Single source of truth for the gov help center. Imports every
 * article module + exposes:
 *
 *   GOV_HELP_ARTICLES      ordered flat list (HelpArticle[])
 *   findArticleBySlug      O(N) lookup for the article page
 *   articlesByCategory     grouped list for the index page sections
 *
 * Adding a new article: import it here + append to the list. The type
 * system catches a missing meta/default export at compile time.
 *
 * IMPORTANT (lesson from Phase 10.1 post-ship fix #1): `import * as`
 * yields a Module Namespace Object where the component lives at
 * `.default`, NOT `.Article`. The aggregator MUST map each module
 * through `toArticle` so `article.Article` is the React component at
 * runtime, not `undefined`. Casting the array directly with
 * `as unknown as HelpArticle[]` would typecheck cleanly + crash on
 * first article click  see PHASE_10_1_COMPLETE.md.
 */

import type { HelpArticle, GovHelpCategory } from "@/content/help/types";

//  Getting started
import * as whatSebenzaIsForGovernment from "./getting-started/what-sebenza-is-for-government";
import * as yourFirstHourOrientation from "./getting-started/your-first-hour-orientation";
import * as privacyFloorExplained from "./getting-started/privacy-floor-explained";

//  Provincial & municipal briefs
import * as readingTheLmi from "./provincial-briefs/reading-the-lmi";
import * as readingYourProvincialBrief from "./provincial-briefs/reading-your-provincial-brief";
import * as topSkillsGapsSupplyFreshness from "./provincial-briefs/top-skills-gaps-supply-freshness";
import * as citiesComingSoon from "./provincial-briefs/cities-coming-soon";

//  Shortage & opportunity
import * as shortageJustificationIndexExplained from "./shortage-opportunity/shortage-justification-index-explained";
import * as interpretingDemandAndSupplyRatios from "./shortage-opportunity/interpreting-demand-and-supply-ratios";
import * as localSupplyAvailableIncentives from "./shortage-opportunity/local-supply-available-incentives";
import * as declineReasonsAndStallReasons from "./shortage-opportunity/decline-reasons-and-stall-reasons";
//  Phase 11.4.5 cross-surface methodology note
import * as seekerLeaderboardConsistency from "./shortage-opportunity/seeker-leaderboard-consistency";

//  Curriculum & outcomes
import * as curriculumVsMarketDemand from "./curriculum-outcomes/curriculum-vs-market-demand";
import * as programmeCohortOutcomesAndRetention from "./curriculum-outcomes/programme-cohort-outcomes-and-retention";
import * as whatSuppressedCellsMean from "./curriculum-outcomes/what-suppressed-cells-mean";

//  Employer lookup & compliance
import * as perEmployerLookupWhatYouCanQuery from "./employer-lookup/per-employer-lookup-what-you-can-query";
import * as caseReferenceDocumentingYourQuery from "./employer-lookup/case-reference-documenting-your-query";
import * as readingEmploymentStatusMix from "./employer-lookup/reading-employment-status-mix";
import * as theOversightLogYourLookups from "./employer-lookup/the-oversight-log-your-lookups";

//  Exports & reports
import * as bulkCsvDownloads from "./exports-reports/bulk-csv-downloads";
import * as policyBriefAsPdf from "./exports-reports/policy-brief-as-pdf";
import * as lmiJsonPublicApi from "./exports-reports/lmi-json-public-api";

//  Account & oversight
import * as twoFactorAuthentication from "./account-oversight/two-factor-authentication";
import * as yourActivityAuditTrail from "./account-oversight/your-activity-audit-trail";

type ArticleModule = {
  meta: HelpArticle["meta"];
  default: HelpArticle["Article"];
};

function toArticle(mod: ArticleModule): HelpArticle {
  return { meta: mod.meta, Article: mod.default };
}

export const GOV_HELP_ARTICLES: HelpArticle[] = [
  whatSebenzaIsForGovernment,
  yourFirstHourOrientation,
  privacyFloorExplained,
  readingTheLmi,
  readingYourProvincialBrief,
  topSkillsGapsSupplyFreshness,
  citiesComingSoon,
  shortageJustificationIndexExplained,
  interpretingDemandAndSupplyRatios,
  localSupplyAvailableIncentives,
  declineReasonsAndStallReasons,
  seekerLeaderboardConsistency,
  curriculumVsMarketDemand,
  programmeCohortOutcomesAndRetention,
  whatSuppressedCellsMean,
  perEmployerLookupWhatYouCanQuery,
  caseReferenceDocumentingYourQuery,
  readingEmploymentStatusMix,
  theOversightLogYourLookups,
  bulkCsvDownloads,
  policyBriefAsPdf,
  lmiJsonPublicApi,
  twoFactorAuthentication,
  yourActivityAuditTrail,
].map((mod) => toArticle(mod as ArticleModule));

export function findArticleBySlug(slug: string): HelpArticle | null {
  return (
    GOV_HELP_ARTICLES.find((a) => a.meta.slug === slug) ?? null
  );
}

export function articlesByCategory(
  category: GovHelpCategory,
): HelpArticle[] {
  return GOV_HELP_ARTICLES.filter(
    (a) => a.meta.category === category,
  );
}
