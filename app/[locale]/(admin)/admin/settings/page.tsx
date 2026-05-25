import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { getAllSettings } from "@/lib/admin/settings";
import { SettingsForm } from "@/components/feature/admin/SettingsForm";

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
    <DashboardShell
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="settings"
      pageEyebrow="Platform settings"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <p className="mb-6 text-sm text-[color:var(--color-ink-soft)]">
        Each setting saves on its own  there is no batch save. The audit log
        records the prior and new value for every change.
      </p>
      <SettingsForm values={values} />
    </DashboardShell>
  );
}
