import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "achievements",
  title: "Achievement badges  what they mean and how they&rsquo;re earned",
  shortDescription:
    "Six honest milestones derived from your existing audit-log data. Awarded automatically by a nightly sweep; never revoked once earned.",
  category: "profile",
  keywords: [
    "badge",
    "achievement",
    "milestone",
    "verified",
    "placement",
    "streak",
    "views",
  ],
  related: [
    "uploading-certificates-and-verification",
    "who-viewed-your-profile",
  ],
  surfaceLink: "/dashboard",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Achievement badges surface six honest milestones on your
        dashboard. Each is derived from data the platform already
        records  no new actions required from you. A nightly cron
        checks the conditions and awards any newly-eligible badges
        silently.
      </p>

      <h2>The six badges</h2>
      <ul>
        <li>
          <strong>Verified profile</strong>  awarded the first time a
          qualification or KYC document on your profile is admin-verified.
        </li>
        <li>
          <strong>First yes</strong>  the first time you accepted a
          vacancy invitation. The first conversation on Sebenza.
        </li>
        <li>
          <strong>Ten conversations</strong>  ten accepted invitations
          across your time on the platform.
        </li>
        <li>
          <strong>Active week</strong>  five distinct employer
          organisations viewed your profile inside a 7-day window.
        </li>
        <li>
          <strong>Fresh streak</strong>  three monthly status
          confirmations in a row over 90 days.
        </li>
        <li>
          <strong>First placement</strong>  an employer confirms a
          placement of you on Sebenza (the Placement-Truth event).
        </li>
      </ul>

      <Callout type="info" title="Honest by design">
        <p>
          Badges reflect real audit-log events  no participation
          trophies. The platform never lies about what you&rsquo;ve
          done. The recent-achievements strip on your dashboard shows
          the most recent three; older ones still count + are
          tap-revealed in your profile.
        </p>
      </Callout>

      <h2>Are they shown to employers?</h2>
      <p>
        Today the badges are <strong>private to you</strong>  they
        appear on your dashboard, not on your public profile. The
        public-facing leaderboard question (showing badges on{" "}
        <code>/p/{`{handle}`}</code>) is a deliberately separate,
        more-considered feature for a future phase.
      </p>

      <DashboardLink href="/dashboard">See your achievements</DashboardLink>
    </HelpProse>
  );
}
