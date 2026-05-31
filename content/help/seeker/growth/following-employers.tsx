import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "following-employers",
  title: "Following an employer  private warm-intent list",
  shortDescription:
    "Tap the heart on an invitation, an employer card, or the recommended-employers leaderboard. Private to you  the employer is never told.",
  category: "growth",
  keywords: [
    "follow",
    "employer",
    "watchlist",
    "follow list",
    "private",
    "warm intent",
  ],
  related: [
    "discovering-employers",
    "vacancy-invitations-explained",
  ],
  surfaceLink: "/dashboard/following",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Following an employer is the small &ldquo;maybe in two
        years&rdquo; capture surface the platform was missing. Tap
        the heart, and the org joins your private follow list at{" "}
        <code>/dashboard/following</code>.
      </p>

      <h2>What happens next</h2>
      <ul>
        <li>
          A nightly cron checks for new vacancies from employers you
          follow. When one opens in your profession + province, you
          get a quiet in-app notification (no email by default
          you can opt-in per channel from{" "}
          <em>Account &rarr; Notification preferences</em>).
        </li>
        <li>
          The notification dedupes at 24h per employer so a burst
          of postings doesn&rsquo;t flood your bell.
        </li>
        <li>
          Unfollow any time. The row disappears from your list;
          the bell pings stop on the next cron run.
        </li>
      </ul>

      <Callout type="info" title="The employer is never told">
        <p>
          Privacy invariant. Sebenza never tells the employer who
          follows them, never shows them a follower count, never
          adds them to any &ldquo;your followers&rdquo; list.
          Same posture as the block list  a seeker&rsquo;s
          interest is private by default.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/following">Open your follow list</DashboardLink>
    </HelpProse>
  );
}
