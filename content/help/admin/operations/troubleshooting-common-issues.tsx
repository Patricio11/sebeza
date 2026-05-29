import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "troubleshooting-common-issues",
  title: "Troubleshooting common issues",
  shortDescription:
    "Eight problems that come up regularly in admin work + the documented response for each. When to handle locally + when to page engineering.",
  category: "operations",
  keywords: [
    "troubleshooting",
    "issues",
    "problems",
    "engineering",
    "page",
    "stuck",
    "queue",
  ],
  related: [
    "understanding-the-audit-log-structure",
    "notification-settings-for-admins",
    "flagging-suspicious-activity",
  ],
  surfaceLink: "/admin",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The eight most common &ldquo;something looks wrong&rdquo;
        moments in admin work, with the documented response. None of
        these require engineering except where noted; most are self-
        serviceable with the right pattern.
      </p>

      <h2>One: a KYC submission is stuck in pending</h2>
      <p>
        Open the case; check whether it&rsquo;s actually unassigned
        or just unactioned. The standard SLA is 48 hours; cases
        older than that need triage. If the case is older than 7
        days, escalate to your Lead &mdash; it shouldn&rsquo;t exist.
      </p>

      <h2>Two: an account shows as suspended but the user says they were never told</h2>
      <p>
        Open the user&rsquo;s audit log; find the
        <em> account.suspended</em> row. Check whether the
        notification was sent (there&rsquo;s a paired{" "}
        <em>notification.sent</em> row immediately after). If the
        notification row is missing, that&rsquo;s a real issue;
        page engineering. If the notification was sent but the user
        didn&rsquo;t see it (spam folder, wrong email), re-send
        from the user&rsquo;s Users surface.
      </p>

      <h2>Three: a feature flag flip didn&rsquo;t take effect</h2>
      <p>
        Most flags are cache-backed with a 60-second TTL. Wait a
        minute then re-check. If still not effective after 5
        minutes, page engineering &mdash; the flag plumbing might
        not be respecting the change.
      </p>

      <h2>Four: the verification queue count on the Overview doesn&rsquo;t match the queue page</h2>
      <p>
        Hard refresh the Overview (Ctrl/Cmd-Shift-R). The KPI tiles
        are cached for 5 minutes; the queue page is live. If after
        a hard refresh the numbers still differ, page engineering.
      </p>

      <h2>Five: an audit-log filter returns zero results when you expect rows</h2>
      <p>
        Check the date range first &mdash; default is last 7 days,
        which often hides what you&rsquo;re investigating. Then check
        the kind name spelling; the dropdown auto-completes, but a
        copy-paste from a doc can include trailing whitespace that
        breaks the match. If the filter is right and you still see
        zero, that&rsquo;s investigative signal not a bug; either
        the action didn&rsquo;t happen or it was logged under a
        different kind than you expected.
      </p>

      <h2>Six: an admin email-test send doesn&rsquo;t arrive</h2>
      <p>
        Check spam. Then check that the email channel is enabled in
        Platform settings. If both are fine and the send doesn&rsquo;t
        arrive within 60 seconds, page engineering.
      </p>

      <h2>Seven: a user reports their data export is empty</h2>
      <p>
        Open their account; check the audit log for an{" "}
        <em>account.data_export</em> row in the last 24 hours. If
        present, the export ran; the empty result is real (the
        account genuinely has no data, which is unusual but
        possible for freshly-created accounts). If absent, the
        download endpoint failed to record a successful export;
        page engineering with the user&rsquo;s account ID.
      </p>

      <h2>Eight: you can&rsquo;t take an action you think you should be allowed to</h2>
      <p>
        Check your role tier on the Account page first; many
        actions are Operator or Lead only. If the role is right,
        the action might be blocked by an in-flight investigation
        on the account (suspensions during DSR processing, for
        example). If neither explains it, page engineering with
        the URL of the action you&rsquo;re trying to take.
      </p>

      <Callout type="info" title="When you page engineering">
        <p>
          Always include: the account ID(s) involved, the URL of
          the page you were on, a screenshot if visual, and the
          last-known good state if the problem appeared mid-action.
          Vague pages (&ldquo;something&rsquo;s broken in the
          console&rdquo;) chew up triage time; specific ones get
          resolved fast.
        </p>
      </Callout>
    </HelpProse>
  );
}
