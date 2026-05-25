import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { verifyEmployer } from "@/lib/auth/dal";
import { loadSavedSearches } from "@/lib/employer/saved-searches";
import { SavedSearchesManager } from "@/components/feature/employer/SavedSearchesManager";

export default async function SavedSearchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();
  const t = await getTranslations("employerDash.savedSearches");
  const tOuter = await getTranslations("employerDash");

  const initial = await loadSavedSearches();

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="savedSearches"
      pageEyebrow="Reusable filters"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      banner={
        session.verification !== "verified" ? (
          <OrgVerificationBanner
            message={tOuter("orgUnverifiedBanner")}
            cta={tOuter("orgUnverifiedCta")}
          />
        ) : null
      }
    >
      <SavedSearchesManager initial={initial} locale={locale} />
    </DashboardShell>
  );
}
