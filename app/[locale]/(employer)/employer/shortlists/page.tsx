import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { verifyEmployer } from "@/lib/auth/dal";
import { loadPools } from "@/lib/employer/shortlists";
import { ShortlistsManager } from "@/components/feature/employer/ShortlistsManager";

export default async function ShortlistsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();
  const t = await getTranslations("employerDash.shortlists");
  const tOuter = await getTranslations("employerDash");

  const initial = await loadPools();

  return (
    <DashboardMasthead
      role="employer"
      pageEyebrow="Curated"
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
      <ShortlistsManager initial={initial} />
    </DashboardMasthead>
  );
}
