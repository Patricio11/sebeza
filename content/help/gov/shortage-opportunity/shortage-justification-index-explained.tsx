import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "shortage-justification-index-explained",
  title: "Shortage Justification Index explained",
  shortDescription:
    "Three classifications per (profession  province) cell  genuine shortage, supply available, indeterminate  and what evidence drives each.",
  category: "shortage_opportunity",
  keywords: [
    "shortage",
    "justification",
    "index",
    "classification",
    "supply",
    "demand",
    "indeterminate",
    "scarce skills",
  ],
  related: [
    "interpreting-demand-and-supply-ratios",
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
        The Skills-Shortage Justification Index is a (profession ×
        province) classifier. Each cell is labelled with one of
        three states based on supply, demand, and platform
        confidence. The index is the primary evidence base for the
        national scarce-skills list and for DHA visa-policy work.
      </p>

      <h2>The three classifications</h2>
      <ul>
        <li>
          <strong>Genuine local shortage.</strong> Demand_score is
          well above baseline + local_supply_ratio is well below
          baseline + the platform has enough records in the cell
          to be confident. These cells are where importing or
          training are both legitimate policy responses.
        </li>
        <li>
          <strong>Local supply available.</strong> Demand_score is
          present but local_supply_ratio shows live, fresh
          candidates in the province. These cells are where
          local-hiring incentives are the right policy response
          (not visa relaxation). See <em>Local supply available:
          designing incentives</em>.
        </li>
        <li>
          <strong>Indeterminate.</strong> Cell counts are below
          threshold, freshness is too low, or the signal is mixed
          (e.g. high demand + high supply + high decline rate
          suggests salary band misalignment, not a true gap). The
          platform refuses to classify; the cell tells you the
          honest answer is &ldquo;we don&rsquo;t know from this
          data alone.&rdquo;
        </li>
      </ul>

      <h2>What goes into the classification</h2>
      <p>
        Four signals drive the classifier:
      </p>
      <ul>
        <li>
          <strong>Demand_score</strong> &mdash; rolling 13-week
          invitation volume normalised against national baseline
          for the profession.
        </li>
        <li>
          <strong>Local_supply_ratio</strong> &mdash; confirmed-fresh
          provincial seeker count vs national supply ratio for the
          profession.
        </li>
        <li>
          <strong>Foreign_fill_share</strong> &mdash; the share of
          recent placements in that (profession × province) that
          went to non-citizen candidates (where the employer
          consented to citizenship reporting). Above-average shares
          tilt toward &ldquo;genuine shortage&rdquo; classifications.
        </li>
        <li>
          <strong>Decline-reason mix</strong> &mdash; if salary-not-
          competitive dominates declines for the cell, the
          classifier nudges away from &ldquo;genuine shortage&rdquo;
          (the issue is pay, not supply).
        </li>
      </ul>

      <Callout type="warning" title="The classifier is opinionated; the underlying data is in your exports">
        <p>
          The justification label is one platform&rsquo;s
          interpretation of four signals. Treasury or DHA may
          weight signals differently or apply policy thresholds
          that change the call. The classification is a starting
          point + the export carries the underlying numbers so you
          can recompute under your own thresholds. Don&rsquo;t
          treat the label as gospel; treat it as a defensible
          starting position.
        </p>
      </Callout>

      <DashboardLink href="/gov/shortage">Open Shortage Justification</DashboardLink>
    </HelpProse>
  );
}
