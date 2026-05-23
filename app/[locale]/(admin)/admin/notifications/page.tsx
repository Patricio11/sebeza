import { setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { listForUser } from "@/lib/notifications/query";
import { NotificationsList } from "@/components/feature/notifications/NotificationsList";

export default async function AdminNotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const items = await listForUser({ limit: 50 });

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="notifications"
      pageEyebrow="Inbox"
      pageTitle="Notifications"
      pageSubtitle="Profile reports, verification submissions, and other moderation signals."
    >
      <NotificationsList
        initialItems={items}
        emptyState={{
          title: "Nothing to triage.",
          body: "When a profile is reported or a queue fills, you'll see it here first.",
          ctaHref: "/admin",
          ctaLabel: "Back to overview",
        }}
      />
    </DashboardShell>
  );
}
