import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getAllSettings } from "@/lib/admin/settings";
import { SettingsForm } from "@/components/feature/admin/SettingsForm";
import { EmailTestPanel } from "@/components/feature/admin/EmailTestPanel";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();
  const t = await getTranslations("adminDash.settings");
  const values = await getAllSettings();

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Platform settings"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.3  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="admin" slug="feature-flags-and-rollouts" label="Feature flags" />
        <HelpLink role="admin" slug="platform-settings-and-audit-trail" label="Settings audit trail" />
      </div>

      <p className="mb-6 text-sm text-[color:var(--color-ink-soft)]">
        Each setting saves on its own  there is no batch save. The audit log
        records the prior and new value for every change.
      </p>
      <SettingsForm values={values} />
      <div className="mt-10">
        <EmailTestPanel defaultRecipient={session.email} />
      </div>
    </DashboardMasthead>
  );
}
