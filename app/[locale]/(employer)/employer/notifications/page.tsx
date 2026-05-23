import { setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyRole } from "@/lib/auth/dal";
import { listForUser } from "@/lib/notifications/query";
import { NotificationsList } from "@/components/feature/notifications/NotificationsList";

export default async function EmployerNotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("employer");
  const PAGE = 20;
  const probe = await listForUser({ limit: PAGE + 1 });
  const hasMore = probe.length > PAGE;
  const items = hasMore ? probe.slice(0, PAGE) : probe;

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="notifications"
      pageEyebrow="Inbox"
      pageTitle="Notifications"
      pageSubtitle="Verification decisions, new matches on saved searches, and org-wide events for every member."
    >
      <NotificationsList
        initialItems={items}
        initialHasMore={hasMore}
        emptyState={{
          title: "No notifications yet.",
          body: "Saved-search matches and verification decisions will appear here.",
          ctaHref: "/search",
          ctaLabel: "Search talent",
        }}
      />
    </DashboardShell>
  );
}
