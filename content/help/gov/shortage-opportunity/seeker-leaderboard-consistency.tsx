import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "seeker-leaderboard-consistency",
  title: "Recommended-employer leaderboard  same k=10 floor as gov surfaces",
  shortDescription:
    "A note for policy analysts. The seeker-side recommended-employers list uses the same k=10 suppression posture you see on gov surfaces. No paid placement.",
  category: "shortage_opportunity",
  keywords: [
    "leaderboard",
    "recommended",
    "k=10",
    "suppression",
    "consistency",
    "placement",
    "ranking",
  ],
  related: [
    "shortage-justification-index-explained",
    "what-suppressed-cells-mean",
  ],
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Phase 11.4 shipped a recommended-employers leaderboard on
        the seeker-side Career Compass page. Methodology note for
        gov analysts: the leaderboard&rsquo;s suppression posture
        is identical to the floor you see across gov surfaces.
      </p>

      <h2>What the leaderboard counts</h2>
      <ul>
        <li>
          Employer-confirmed placements only (Placement-Truth
          rule). Seeker self-reports are excluded.
        </li>
        <li>
          Scoped to (profession × province) cells, matching the
          seeker&rsquo;s pool.
        </li>
        <li>
          Suppressed when the cell&rsquo;s confirmed-hire count
          falls below the platform setting{" "}
          <code>employer_mix_min_placements</code> (default 10).
          This is the same setting that drives the floor for
          per-employer mix lookup + the justification index
          cells. Adjusting the floor up via admin settings
          tightens both surfaces in lockstep.
        </li>
      </ul>

      <Callout type="info" title="Why the consistency note matters">
        <p>
          If you analyse the gov-side LMI + Justification Index
          and want to reason about the seeker-side experience,
          this article tells you the methodology is the same.
          Seekers see the same suppression behaviour for the same
          reasons. There is no separate paid tier biasing the
          seeker view.
        </p>
      </Callout>

      <h2>What this means for policy</h2>
      <p>
        An employer who passes the k=10 floor in (profession,
        province) appears on seekers&rsquo; recommended list and
        in your justification + mix surfaces. An employer below
        the floor is invisible to both. The leaderboard cannot be
        used to bypass the suppression  the same cell-count gate
        applies.
      </p>
    </HelpProse>
  );
}
