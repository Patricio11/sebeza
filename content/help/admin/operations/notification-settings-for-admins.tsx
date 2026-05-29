import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "notification-settings-for-admins",
  title: "Notification settings for admins",
  shortDescription:
    "Only two kinds (moderation reports + verification submissions). What the email cadence looks like, and why the inbox is intentionally quiet.",
  category: "operations",
  keywords: [
    "notifications",
    "admin",
    "moderation",
    "verification",
    "queue",
    "email",
    "inbox",
  ],
  related: [
    "admin-dashboard-tour",
    "understanding-the-audit-log-structure",
  ],
  surfaceLink: "/admin/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Admin notification preferences are deliberately minimal.
        Only two kinds exist: <em>moderation.reported</em>
        (a new profile report landed) and{" "}
        <em>verification.queued</em> (a new verification submission
        landed). Everything else surfaces inside the relevant queue
        page, not as a notification.
      </p>

      <h2>Why so few kinds</h2>
      <p>
        Two reasons. First, admin work is queue-driven; opening the
        relevant page is the natural way to see what&rsquo;s
        waiting. A per-event notification on every KYC submission
        would be noise &mdash; you&rsquo;ll see them when you open
        the queue anyway. Second, notification fatigue is real;
        keeping the admin notification channel quiet means the few
        notifications that do fire are worth reading.
      </p>

      <h2>What you can configure</h2>
      <ul>
        <li>
          <strong>moderation.reported</strong> &mdash; on by
          default for Operators + Leads (they action moderation),
          off by default for Reviewers (who can read but not
          action).
        </li>
        <li>
          <strong>verification.queued</strong> &mdash; on by default
          for everyone, since it&rsquo;s the daily bread.
        </li>
        <li>
          <strong>Email channel master switch.</strong> Off = in-app
          notifications only. Useful for admins who keep the console
          open during work hours and don&rsquo;t want their personal
          inbox cluttered.
        </li>
      </ul>

      <h2>Mandatory notifications</h2>
      <ul>
        <li>
          <strong>account.security.*</strong> (sign-in from new
          device, 2FA disabled, password changed) &mdash; cannot be
          turned off.
        </li>
        <li>
          <strong>compliance.dsr.deadline_warning</strong>
          (DSR case approaching the 30-day SLA) &mdash; Lead-tier
          only, cannot be turned off.
        </li>
        <li>
          <strong>system.incident</strong> (engineering incident
          notification) &mdash; cannot be turned off; this is how
          you find out the platform is degraded.
        </li>
      </ul>

      <Callout type="info" title="The Notifications page is paginated">
        <p>
          20 items per page on the Notifications page. The page
          shows unified moderation + verification events sorted
          newest-first. There&rsquo;s no &ldquo;mark all
          read&rdquo; button by design &mdash; in admin work, you
          should be actioning items, not just dismissing them.
        </p>
      </Callout>

      <DashboardLink href="/admin/account">Open notification preferences</DashboardLink>
    </HelpProse>
  );
}
