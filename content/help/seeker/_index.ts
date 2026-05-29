/**
 * Phase 10.2  Seeker help index.
 *
 * Single source of truth for the seeker help center. Imports every
 * article module + exposes:
 *
 *   SEEKER_HELP_ARTICLES   ordered flat list (HelpArticle[])
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

import type { HelpArticle, SeekerHelpCategory } from "@/content/help/types";

//  Getting started
import * as whatSebenzaIsForJobSeekers from "./getting-started/what-sebenza-is-for-job-seekers";
import * as yourFirstHourProfileSetup from "./getting-started/your-first-hour-profile-setup";
import * as understandingProfileCompleteness from "./getting-started/understanding-profile-completeness";
import * as howSearchRankingWorks from "./getting-started/how-search-ranking-works";

//  Profile & visibility
import * as settingUpYourProfilePhoto from "./profile/setting-up-your-profile-photo";
import * as addingSkillsFromTheTaxonomy from "./profile/adding-skills-from-the-taxonomy";
import * as uploadingCertificatesAndVerification from "./profile/uploading-certificates-and-verification";
import * as yourPublicProfileUrl from "./profile/your-public-profile-url";
import * as employmentHistoryEntry from "./profile/employment-history-entry";

//  Vacancy invitations
import * as vacancyInvitationsExplained from "./invitations/vacancy-invitations-explained";
import * as howToAcceptDeclineOrReconsider from "./invitations/how-to-accept-decline-or-reconsider";
import * as declineReasonsAndWhatTheyMean from "./invitations/decline-reasons-and-what-they-mean";
import * as acceptedWithNoticeHowItWorks from "./invitations/accepted-with-notice-how-it-works";

//  Skills & learning
import * as careerCompassRecommendations from "./growth/career-compass-recommendations";
import * as learningPathsAndProficiency from "./growth/learning-paths-and-proficiency";
import * as adjacentRolesAndSkillGaps from "./growth/adjacent-roles-and-skill-gaps";
import * as curriculumVsMarketDemandForStudents from "./growth/curriculum-vs-market-demand-for-students";

//  Consent & privacy
import * as whatConsentPurposesMean from "./privacy/what-consent-purposes-mean";
import * as contactRevealHowItWorks from "./privacy/contact-reveal-how-it-works";
import * as documentSharingAndEmployerAccess from "./privacy/document-sharing-and-employer-access";
import * as exportingYourDataPopiaSection23 from "./privacy/exporting-your-data-popia-section-23";
import * as deletingYourAccountRightToErasure from "./privacy/deleting-your-account-right-to-erasure";

//  Activity & audit
import * as understandingYourActivityLedger from "./activity/understanding-your-activity-ledger";
import * as whoViewedYourProfile from "./activity/who-viewed-your-profile";

//  Account & security
import * as twoFactorAuthenticationSetup from "./account/two-factor-authentication-setup";
import * as resettingYourPassword from "./account/resetting-your-password";
import * as managingNotificationPreferences from "./account/managing-notification-preferences";

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

export const SEEKER_HELP_ARTICLES: HelpArticle[] = [
  whatSebenzaIsForJobSeekers,
  yourFirstHourProfileSetup,
  understandingProfileCompleteness,
  howSearchRankingWorks,
  settingUpYourProfilePhoto,
  addingSkillsFromTheTaxonomy,
  uploadingCertificatesAndVerification,
  yourPublicProfileUrl,
  employmentHistoryEntry,
  vacancyInvitationsExplained,
  howToAcceptDeclineOrReconsider,
  declineReasonsAndWhatTheyMean,
  acceptedWithNoticeHowItWorks,
  careerCompassRecommendations,
  learningPathsAndProficiency,
  adjacentRolesAndSkillGaps,
  curriculumVsMarketDemandForStudents,
  whatConsentPurposesMean,
  contactRevealHowItWorks,
  documentSharingAndEmployerAccess,
  exportingYourDataPopiaSection23,
  deletingYourAccountRightToErasure,
  understandingYourActivityLedger,
  whoViewedYourProfile,
  twoFactorAuthenticationSetup,
  resettingYourPassword,
  managingNotificationPreferences,
].map((mod) => toArticle(mod as ArticleModule));

export function findArticleBySlug(slug: string): HelpArticle | null {
  return (
    SEEKER_HELP_ARTICLES.find((a) => a.meta.slug === slug) ?? null
  );
}

export function articlesByCategory(
  category: SeekerHelpCategory,
): HelpArticle[] {
  return SEEKER_HELP_ARTICLES.filter(
    (a) => a.meta.category === category,
  );
}
