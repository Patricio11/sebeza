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
//  Phase 11 profile additions
import * as openToTags from "./profile/open-to-tags";
import * as cvBackup from "./profile/cv-backup";
import * as sharingYourProfile from "./profile/sharing-your-profile";
import * as achievements from "./profile/achievements";
//  Phase 13.1
import * as studentModulesAndProject from "./profile/student-modules-and-project";
//  Phase 13.4
import * as studentProgressionTracker from "./profile/student-progression-tracker";

//  Vacancy invitations
import * as vacancyInvitationsExplained from "./invitations/vacancy-invitations-explained";
import * as howToAcceptDeclineOrReconsider from "./invitations/how-to-accept-decline-or-reconsider";
import * as declineReasonsAndWhatTheyMean from "./invitations/decline-reasons-and-what-they-mean";
import * as acceptedWithNoticeHowItWorks from "./invitations/accepted-with-notice-how-it-works";
//  Phase 11 invitations additions
import * as whyNoInvites from "./invitations/why-no-invites";
import * as readingTheVacancySpec from "./invitations/reading-the-vacancy-spec";

//  Skills & learning
import * as careerCompassRecommendations from "./growth/career-compass-recommendations";
import * as learningPathsAndProficiency from "./growth/learning-paths-and-proficiency";
import * as adjacentRolesAndSkillGaps from "./growth/adjacent-roles-and-skill-gaps";
import * as curriculumVsMarketDemandForStudents from "./growth/curriculum-vs-market-demand-for-students";
//  Phase 11 growth additions
import * as findingTheRightCourse from "./growth/finding-the-right-course";
import * as costAndFreeAlternatives from "./growth/cost-and-free-alternatives";
import * as upgradingToVerified from "./growth/upgrading-to-verified";
import * as switchingProfession from "./growth/switching-profession";
import * as discoveringEmployers from "./growth/discovering-employers";
import * as followingEmployers from "./growth/following-employers";

//  Consent & privacy
import * as whatConsentPurposesMean from "./privacy/what-consent-purposes-mean";
import * as contactRevealHowItWorks from "./privacy/contact-reveal-how-it-works";
import * as documentSharingAndEmployerAccess from "./privacy/document-sharing-and-employer-access";
import * as exportingYourDataPopiaSection23 from "./privacy/exporting-your-data-popia-section-23";
import * as deletingYourAccountRightToErasure from "./privacy/deleting-your-account-right-to-erasure";
//  Phase 11 privacy additions
import * as pausingSearchability from "./privacy/pausing-searchability";
import * as blockingEmployers from "./privacy/blocking-employers";

//  Activity & audit
import * as understandingYourActivityLedger from "./activity/understanding-your-activity-ledger";
import * as whoViewedYourProfile from "./activity/who-viewed-your-profile";

//  Account & security
import * as twoFactorAuthenticationSetup from "./account/two-factor-authentication-setup";
import * as resettingYourPassword from "./account/resetting-your-password";
import * as managingNotificationPreferences from "./account/managing-notification-preferences";
//  Phase 11 account additions
import * as dataSaverMode from "./account/data-saver-mode";
import * as smsAndWhatsappNotifications from "./account/sms-and-whatsapp-notifications";

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
  openToTags,
  cvBackup,
  sharingYourProfile,
  achievements,
  studentModulesAndProject,
  studentProgressionTracker,
  vacancyInvitationsExplained,
  howToAcceptDeclineOrReconsider,
  declineReasonsAndWhatTheyMean,
  acceptedWithNoticeHowItWorks,
  whyNoInvites,
  readingTheVacancySpec,
  careerCompassRecommendations,
  learningPathsAndProficiency,
  adjacentRolesAndSkillGaps,
  curriculumVsMarketDemandForStudents,
  findingTheRightCourse,
  costAndFreeAlternatives,
  upgradingToVerified,
  switchingProfession,
  discoveringEmployers,
  followingEmployers,
  whatConsentPurposesMean,
  contactRevealHowItWorks,
  documentSharingAndEmployerAccess,
  exportingYourDataPopiaSection23,
  deletingYourAccountRightToErasure,
  pausingSearchability,
  blockingEmployers,
  understandingYourActivityLedger,
  whoViewedYourProfile,
  twoFactorAuthenticationSetup,
  resettingYourPassword,
  managingNotificationPreferences,
  dataSaverMode,
  smsAndWhatsappNotifications,
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

/**
 * Phase 13.7 follow-up  audience-gated article visibility for the
 * help center index + search input. Returns the subset of articles a
 * viewer with the given context is allowed to see. Untagged articles
 * always pass through; the only tag today is `audienceRequires:
 * "student"` which requires the viewer to have an academic_profiles
 * row.
 *
 * Caller convention:
 *   visibleSeekerArticles(SEEKER_HELP_ARTICLES, { isStudent: !!me.academic })
 *
 * Adding new audience tags = extending HelpArticleMeta.audienceRequires
 * (the union) + the corresponding check below. This helper stays the
 * one place the gating logic lives.
 */
export function visibleSeekerArticles(
  articles: HelpArticle[],
  ctx: { isStudent: boolean },
): HelpArticle[] {
  return articles.filter((a) => isArticleVisible(a, ctx));
}

export function isArticleVisible(
  article: HelpArticle,
  ctx: { isStudent: boolean },
): boolean {
  const req = article.meta.audienceRequires;
  if (!req) return true;
  if (req === "student") return ctx.isStudent;
  return true;
}
