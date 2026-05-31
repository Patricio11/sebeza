import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "discovering-employers",
  title: "Recommended employers by profession + province",
  shortDescription:
    "A leaderboard of employers actively hiring in your pool. Ranked by confirmed hires, never by paid placement. Quiet by design  follow employers to surface their next role.",
  category: "growth",
  keywords: [
    "recommended",
    "employer",
    "leaderboard",
    "hiring",
    "discover",
    "placement",
  ],
  related: [
    "following-employers",
    "how-search-ranking-works",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Career Compass now surfaces a list of employers hiring in
        your profession + province. Ranking is{" "}
        <strong>confirmed hires</strong>  the number of placements
        the employer has logged via the platform&rsquo;s Mark-as-
        Hired flow.
      </p>

      <h2>Ranking rules</h2>
      <ul>
        <li>
          Counted: employer-confirmed placements only (Placement-Truth
          rule). Seeker self-reports don&rsquo;t count.
        </li>
        <li>
          Suppressed: employers with fewer than the platform-wide
          floor of confirmed hires in your pool (default 10). Matches
          the same k=10 suppression posture the gov-side surfaces
          use; prevents the leaderboard becoming a marketing surface
          for low-volume orgs.
        </li>
        <li>
          <strong>Never:</strong> paid placement. Sebenza has no
          sponsored tier. The leaderboard is purely a data signal.
        </li>
      </ul>

      <Callout type="tip" title="Follow the ones you&rsquo;d work for">
        <p>
          Each row has a follow-heart. Tapping it adds the employer
          to your private follow list  the employer is never told.
          When they open a new vacancy in your profession + province
          you get a quiet bell ping, not an email. See{" "}
          <em>Following employers</em> for the full pattern.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/grow">Open Career Compass</DashboardLink>
    </HelpProse>
  );
}
