import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
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
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="shortlists"
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
    </DashboardShell>
  );
}
