import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "interpreting-demand-and-supply-ratios",
  title: "Interpreting demand_score + local_supply_ratio",
  shortDescription:
    "The two numbers that drive the classifier. What '1.0' means, what ratios to flag as policy-relevant, and what edge cases generate false signals.",
  category: "shortage_opportunity",
  keywords: [
    "demand_score",
    "local_supply_ratio",
    "ratio",
    "baseline",
    "thresholds",
    "edge cases",
  ],
  related: [
    "shortage-justification-index-explained",
    "local-supply-available-incentives",
    "decline-reasons-and-stall-reasons",
  ],
  surfaceLink: "/gov/shortage",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Two numbers drive the shortage classifier:{" "}
        <code>demand_score</code> and <code>local_supply_ratio</code>.
        Both are expressed against a baseline of 1.0. Above 1.0 is
        above average; below 1.0 is below. The thresholds the
        classifier uses are documented; the values themselves are
        what you cite in briefs.
      </p>

      <h2>demand_score</h2>
      <ul>
        <li>
          <strong>1.0</strong> = invitation volume for this
          profession in this province is at the rolling 52-week
          provincial median.
        </li>
        <li>
          <strong>0.51.0</strong> = below median; the matcher is
          quieter for this (profession × province) than usual.
        </li>
        <li>
          <strong>1.01.5</strong> = above median; a busy period.
          Normal cyclic variation in many professions.
        </li>
        <li>
          <strong>1.52.5</strong> = elevated demand; worth flagging
          to relevant DHET / DTI teams.
        </li>
        <li>
          <strong>2.5+</strong> = exceptional demand. Either a real
          structural shortage or a one-off (e.g. a single large
          employer flooding the matcher); cross-check before citing.
        </li>
      </ul>

      <h2>local_supply_ratio</h2>
      <ul>
        <li>
          <strong>1.0</strong> = the ratio of confirmed-fresh
          provincial seekers to invitation volume is at the national
          baseline ratio for this profession.
        </li>
        <li>
          <strong>0.5+</strong> = adequate local supply; importing
          isn&rsquo;t the policy answer.
        </li>
        <li>
          <strong>0.20.5</strong> = thin local supply; gap is real.
        </li>
        <li>
          <strong>Below 0.2</strong> = severe local supply
          constraint. With high demand_score, &ldquo;genuine
          shortage&rdquo; classification triggers.
        </li>
      </ul>

      <h2>Edge cases that generate false signals</h2>
      <ul>
        <li>
          <strong>One large employer dominating.</strong> A single
          enterprise running a 200-vacancy push in a province
          inflates demand_score for the cells they touch without
          reflecting structural demand. The classifier&rsquo;s
          smoothing window (13 weeks) blunts this but doesn&rsquo;t
          eliminate it; check the underlying placement counts in
          the export before drawing structural conclusions.
        </li>
        <li>
          <strong>Skill name change.</strong> A taxonomy merge (see
          admin documentation) shifts profiles from one canonical
          name to another. Demand for the old name drops to zero
          overnight; demand for the new name spikes. Both look like
          shortages in their respective directions. The trend chart
          on the cell-detail panel flags this; trust it before the
          headline.
        </li>
        <li>
          <strong>Low-freshness province.</strong> A province where
          most profiles are stale will show a low local_supply_ratio
          regardless of true labour supply. Cross-reference the
          freshness signal on the Provinces page; cells flagged
          shortage in low-freshness provinces deserve a manual
          read.
        </li>
      </ul>

      <Callout type="info" title="The cell-detail panel">
        <p>
          Click any cell in the Shortage Justification heatmap to
          open the cell-detail panel. It shows the underlying
          counts, the trend, the foreign_fill_share, and the
          dominant decline reason. Almost every policy question
          about a single cell is answered by reading the panel
          rather than the headline label.
        </p>
      </Callout>
    </HelpProse>
  );
}
