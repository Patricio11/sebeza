import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "blocking-employers",
  title: "Blocking an employer  silent, private, no escalation",
  shortDescription:
    "When &ldquo;not interested&rdquo; is enough. Block an employer; they can&rsquo;t find you or invite you. They are never told.",
  category: "privacy",
  keywords: [
    "block",
    "employer",
    "silent",
    "private",
    "moderation",
    "report",
  ],
  related: [
    "pausing-searchability",
    "what-consent-purposes-mean",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sometimes an employer keeps inviting you, the role isn&rsquo;t
        right, the recruiter has been pushy. The block list is the
        right surface for the routine case. The report flow stays
        for misconduct.
      </p>

      <h2>What blocking does</h2>
      <ul>
        <li>
          The blocked employer cannot find your profile in their
          search results.
        </li>
        <li>
          The blocked employer cannot send you new invitations
          bulk-invite silently skips you.
        </li>
        <li>
          Existing invitations from that employer stay where they
          are. You can still accept, decline, or ignore them; the
          block doesn&rsquo;t retroactively withdraw history.
        </li>
      </ul>

      <Callout type="info" title="The employer is never told">
        <p>
          Privacy invariant. Sebenza never notifies the employer
          they&rsquo;ve been blocked, never shows them a per-org
          block count, never exposes the block in any audit log
          they can read. Same posture as a consent revoke  you
          just stop appearing on their surfaces.
        </p>
      </Callout>

      <h2>Where to block</h2>
      <p>
        Three surfaces:
      </p>
      <ul>
        <li>
          From an invitation detail page  the agency-controls strip
          carries a <em>Block this employer</em> button.
        </li>
        <li>
          From the employer&rsquo;s public profile (when one ships).
        </li>
        <li>
          Unblock from <em>Privacy &amp; consent &rarr; Blocked
          employers</em> any time.
        </li>
      </ul>

      <h2>Block vs report  when to use which</h2>
      <p>
        Block is for &ldquo;not interested&rdquo;: routine, silent,
        no admin queue. Report is for misconduct  harassment, spam,
        off-platform contact requests, bad-faith companies. Reports
        land in <code>/admin/moderation</code> for human review. The
        two are deliberately decoupled: you can block + report the
        same employer for two different reasons.
      </p>

      <DashboardLink href="/dashboard/privacy">Open Privacy &amp; consent</DashboardLink>
    </HelpProse>
  );
}
