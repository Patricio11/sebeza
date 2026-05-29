import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "decline-reasons-and-stall-reasons",
  title: "Decline reasons + stall reasons: aggregate policy signals",
  shortDescription:
    "How seeker decline reasons + employer stall reasons aggregate up into a policy diagnostic. What dominant reasons in a cell suggest about the right intervention.",
  category: "shortage_opportunity",
  keywords: [
    "decline reasons",
    "stall reasons",
    "salary",
    "policy",
    "diagnostic",
    "aggregate",
  ],
  related: [
    "shortage-justification-index-explained",
    "local-supply-available-incentives",
    "interpreting-demand-and-supply-ratios",
  ],
  surfaceLink: "/gov/shortage",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Two structured-reason streams flow up from individual
        platform actions to gov-level aggregates: seekers&rsquo;
        decline reasons (when they say no to an invitation) and
        employers&rsquo; stall reasons (when a vacancy goes open
        for weeks without producing a hire). Both surface on the
        Shortage page as aggregate cards beside the heatmap.
      </p>

      <h2>The seeker decline-reason aggregate</h2>
      <p>
        Six structured categories: <em>already employed</em>,{" "}
        <em>salary band not competitive</em>,{" "}
        <em>location doesn&rsquo;t work</em>,{" "}
        <em>skills mismatch</em>, <em>wrong type of role</em>,{" "}
        <em>other</em>. The aggregate card shows the distribution
        per (profession × province) cell, with the dominant reason
        as the headline. Suppressed below the k-anonymity floor like
        every other cell.
      </p>

      <h2>The employer stall-reason aggregate</h2>
      <p>
        Vacancies that go 30+ days without a hire prompt the employer
        to optionally record a stall reason. Five categories:{" "}
        <em>candidate pool too small</em>, <em>candidates declined
        too often</em>, <em>internal hiring delays</em>,{" "}
        <em>role spec changed</em>, <em>other</em>. The aggregate
        shows the distribution per cell.
      </p>

      <h2>What dominant reasons signal</h2>
      <ul>
        <li>
          <strong>Salary-not-competitive dominates decline.</strong>{" "}
          The gap is pay. Whatever the headline shortage signal
          says, this cell isn&rsquo;t a supply problem in the
          structural sense; it&rsquo;s a wage problem. Visa
          relaxation here would import workers willing to accept
          below-market wages &mdash; not the typical policy goal.
        </li>
        <li>
          <strong>Already-employed dominates decline.</strong> The
          supply exists but is locked into other employment. Either
          the platform&rsquo;s reach is good (people who would have
          moved already did) or wage dynamics aren&rsquo;t
          attractive enough to pull people out. Different policy
          read.
        </li>
        <li>
          <strong>Candidates-declined-too-often dominates
          stall.</strong> The employer is hitting the pool but the
          pool keeps saying no. Read with the decline aggregate:
          if salary dominates declines, this is the same story from
          two sides.
        </li>
        <li>
          <strong>Candidate-pool-too-small dominates stall.</strong>{" "}
          The employer is exhausting the matcher. Either a true
          shortage or the employer&rsquo;s spec is too narrow
          (under-counted requirement axes). Cross-check with the
          supply ratio in the same cell.
        </li>
      </ul>

      <Callout type="info" title="The aggregates do not tell you about specific employers">
        <p>
          The decline + stall aggregates are population-level. They
          tell you what&rsquo;s happening across the cell, not
          which employer is having which problem. The per-employer
          lookup is a separate, audited surface; the aggregate
          cards do not link to it.
        </p>
      </Callout>
    </HelpProse>
  );
}
