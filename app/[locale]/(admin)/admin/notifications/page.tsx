import { setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV } from "@/components/layout/adminNav";
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
  const session = await verifyAdmin();
  const PAGE = 20;
  const probe = await listForUser({ limit: PAGE + 1 });
  const hasMore = probe.length > PAGE;
  const items = hasMore ? probe.slice(0, PAGE) : probe;

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="notifications"
      pageEyebrow="Inbox"
      pageTitle="Notifications"
      pageSubtitle="Profile reports, verification submissions, and other moderation signals."
    >
      <NotificationsList
        initialItems={items}
        initialHasMore={hasMore}
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
