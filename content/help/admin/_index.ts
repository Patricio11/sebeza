/**
 * Phase 10.3  Admin help index.
 *
 * Single source of truth for the admin help center. Imports every
 * article module + exposes:
 *
 *   ADMIN_HELP_ARTICLES    ordered flat list (HelpArticle[])
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

import type { HelpArticle, AdminHelpCategory } from "@/content/help/types";

//  Getting started
import * as whatSebenzaIsForAdmins from "./getting-started/what-sebenza-is-for-admins";
import * as firstLoginAnd2faSetup from "./getting-started/first-login-and-2fa-setup";
import * as adminDashboardTour from "./getting-started/admin-dashboard-tour";
import * as teamRolesAndPermissions from "./getting-started/team-roles-and-permissions";

//  KYC & verification
import * as reviewingSeekerIdSubmissions from "./kyc-verification/reviewing-seeker-id-submissions";
import * as qualificationReviewAndSaqaWorkflow from "./kyc-verification/qualification-review-and-saqa-workflow";
import * as organisationKycVerification from "./kyc-verification/organisation-kyc-verification";
import * as approvalRejectionAndAppeals from "./kyc-verification/approval-rejection-and-appeals";
import * as manualVerificationPath from "./kyc-verification/manual-verification-path";

//  Moderation
import * as readingProfileReports from "./moderation/reading-profile-reports";
import * as whenToSuspendAnAccount from "./moderation/when-to-suspend-an-account";
import * as suspensionAppealsAndRestoration from "./moderation/suspension-appeals-and-restoration";
import * as declineReasonOversightAndPatterns from "./moderation/decline-reason-oversight-and-patterns";
import * as flaggingSuspiciousActivity from "./moderation/flagging-suspicious-activity";

//  POPIA compliance
import * as handlingDataSubjectRequests from "./popia-compliance/handling-data-subject-requests";
import * as processingExportRequests from "./popia-compliance/processing-export-requests";
import * as deletionRequestsRightToErasure from "./popia-compliance/deletion-requests-right-to-erasure";
import * as incidentResponseViaAuditLog from "./popia-compliance/incident-response-via-audit-log";

//  Taxonomy & settings
import * as managingSkillsAndProfessions from "./taxonomy-settings/managing-skills-and-professions";
import * as suggestionWorkflowUserOtherEntries from "./taxonomy-settings/suggestion-workflow-user-other-entries";
import * as featureFlagsAndRollouts from "./taxonomy-settings/feature-flags-and-rollouts";
import * as platformSettingsAndAuditTrail from "./taxonomy-settings/platform-settings-and-audit-trail";

//  Reports & oversight
import * as declineReasonsAggregateStats from "./reports-oversight/decline-reasons-aggregate-stats";
import * as cohortRetentionAndOutcomes from "./reports-oversight/cohort-retention-and-outcomes";
import * as monitoringGovLookupsForPatterns from "./reports-oversight/monitoring-gov-lookups-for-patterns";

//  Operations
import * as understandingTheAuditLogStructure from "./operations/understanding-the-audit-log-structure";
import * as notificationSettingsForAdmins from "./operations/notification-settings-for-admins";
import * as troubleshootingCommonIssues from "./operations/troubleshooting-common-issues";

type ArticleModule = {
  meta: HelpArticle["meta"];
  default: HelpArticle["Article"];
};

function toArticle(mod: ArticleModule): HelpArticle {
  return { meta: mod.meta, Article: mod.default };
}

export const ADMIN_HELP_ARTICLES: HelpArticle[] = [
  whatSebenzaIsForAdmins,
  firstLoginAnd2faSetup,
  adminDashboardTour,
  teamRolesAndPermissions,
  reviewingSeekerIdSubmissions,
  qualificationReviewAndSaqaWorkflow,
  organisationKycVerification,
  approvalRejectionAndAppeals,
  manualVerificationPath,
  readingProfileReports,
  whenToSuspendAnAccount,
  suspensionAppealsAndRestoration,
  declineReasonOversightAndPatterns,
  flaggingSuspiciousActivity,
  handlingDataSubjectRequests,
  processingExportRequests,
  deletionRequestsRightToErasure,
  incidentResponseViaAuditLog,
  managingSkillsAndProfessions,
  suggestionWorkflowUserOtherEntries,
  featureFlagsAndRollouts,
  platformSettingsAndAuditTrail,
  declineReasonsAggregateStats,
  cohortRetentionAndOutcomes,
  monitoringGovLookupsForPatterns,
  understandingTheAuditLogStructure,
  notificationSettingsForAdmins,
  troubleshootingCommonIssues,
].map((mod) => toArticle(mod as ArticleModule));

export function findArticleBySlug(slug: string): HelpArticle | null {
  return (
    ADMIN_HELP_ARTICLES.find((a) => a.meta.slug === slug) ?? null
  );
}

export function articlesByCategory(
  category: AdminHelpCategory,
): HelpArticle[] {
  return ADMIN_HELP_ARTICLES.filter(
    (a) => a.meta.category === category,
  );
}
