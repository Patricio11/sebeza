import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyEmployer } from "@/lib/auth/dal";
import { listForUser } from "@/lib/notifications/query";
import { NotificationsList } from "@/components/feature/notifications/NotificationsList";

export default async function EmployerNotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Phase 9.10  use verifyEmployer (permissive) to get the live org
  // context for the workspaceLabel. verifyRole gave us the user but
  // no org name; the dashboard shell needs the real org's name from
  // the DB, not the static MOCK_EMPLOYER fallback.
  await verifyEmployer();
  const PAGE = 20;
  const probe = await listForUser({ limit: PAGE + 1 });
  const hasMore = probe.length > PAGE;
  const items = hasMore ? probe.slice(0, PAGE) : probe;

  return (
    <DashboardMasthead
      role="employer"
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
    </DashboardMasthead>
  );
}
