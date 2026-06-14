import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
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
    <DashboardMasthead
      role="employer"
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
    </DashboardMasthead>
  );
}
