import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { listForUser } from "@/lib/notifications/query";
import { NotificationsList } from "@/components/feature/notifications/NotificationsList";

export default async function SeekerNotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await verifyRole("seeker");
  const PAGE = 20;
  // Fetch PAGE+1 to detect "is there an older page" without a second query.
  const probe = await listForUser({ limit: PAGE + 1 });
  const hasMore = probe.length > PAGE;
  const items = hasMore ? probe.slice(0, PAGE) : probe;

  return (
    <DashboardMasthead
      role="seeker"
      workspaceLabel={user.name}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="notifications"
      pageEyebrow="Inbox"
      pageTitle="Notifications"
      pageSubtitle="Every reveal, download, and verification decision lands here. The audit log keeps the legal record; this is your bell."
    >
      <NotificationsList
        initialItems={items}
        initialHasMore={hasMore}
        emptyState={{
          title: "No notifications yet.",
          body: "When an employer reveals your contact, downloads a document, or logs a hire, you'll see it here.",
          ctaHref: "/dashboard/activity",
          ctaLabel: "See your activity timeline",
        }}
      />
    </DashboardMasthead>
  );
}
