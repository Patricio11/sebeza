import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "recommended-employer-leaderboard",
  title: "Recommended employers  when your org appears on the seeker leaderboard",
  shortDescription:
    "Career Compass shows seekers a leaderboard of employers actively hiring in their pool. Ranking is confirmed hires, never paid placement. k=10 floor.",
  category: "talent_search",
  keywords: [
    "leaderboard",
    "recommended",
    "ranking",
    "confirmed",
    "placement",
    "hires",
    "k=10",
  ],
  related: [
    "logging-a-placement",
    "follow-up-nudges",
  ],
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        On every seeker&rsquo;s Career Compass page, a section
        titled <em>Employers hiring &lt;profession&gt;s in
        &lt;province&gt;</em> lists the top organisations in their
        pool. Your org appears there if you meet the floor for
        confirmed hires in that (profession, province) cell.
      </p>

      <h2>What counts</h2>
      <ul>
        <li>
          <strong>Confirmed placements only</strong>. The
          Placement-Truth rule applies: a hire is counted when
          you log it via Mark-as-Hired, not when a seeker
          self-reports.
        </li>
        <li>
          Scoped to the seeker&rsquo;s profession + province pool.
          A confirmed hire of a developer in Gauteng counts for
          developers-in-Gauteng seekers, not for chefs-in-Western-
          Cape seekers.
        </li>
        <li>
          <strong>k=10 floor</strong>. Orgs with fewer than the
          platform-wide minimum (default 10) of confirmed hires
          in a cell are suppressed. Same suppression posture the
          gov-side surfaces use; prevents low-volume orgs being
          marketed as a leaderboard entry.
        </li>
      </ul>

      <Callout type="info" title="No paid placement, ever">
        <p>
          Sebenza has no sponsored tier on this list or on{" "}
          <code>/search</code>. Ranking is purely the confirmed-
          hire count. You cannot buy your way to the top  the
          only way up the list is to log more confirmed hires
          honestly.
        </p>
      </Callout>

      <h2>Seekers can follow your org from there</h2>
      <p>
        Each leaderboard row carries a heart icon a seeker can tap
        to add your org to their private follow list. You will{" "}
        <strong>not</strong> be notified that the follow happened.
        The platform indirectly surfaces it as new invite-list
        membership when you open your next vacancy in their pool
        (a follow + your new vacancy = a quiet bell ping to the
        seeker).
      </p>

      <DashboardLink href="/employer/help">Open employer help</DashboardLink>
    </HelpProse>
  );
}
