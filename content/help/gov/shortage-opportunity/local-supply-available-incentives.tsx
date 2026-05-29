import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "local-supply-available-incentives",
  title: "Local supply available: designing incentives",
  shortDescription:
    "The Opportunity surface  cells where the platform has live local supply. The policy lever for placement incentives rather than visa relaxation.",
  category: "shortage_opportunity",
  keywords: [
    "opportunity",
    "local supply",
    "incentives",
    "policy",
    "yes",
    "available",
    "local hiring",
  ],
  related: [
    "shortage-justification-index-explained",
    "interpreting-demand-and-supply-ratios",
    "decline-reasons-and-stall-reasons",
  ],
  surfaceLink: "/gov/opportunity",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Local-Hiring Opportunity surface (<code>/gov/opportunity</code>)
        is the inverse of the shortage view: it filters the
        justification index to cells classified <em>local supply
        available</em>. These are the (profession × province) cells
        where employers are hiring, candidates exist, but the match
        isn&rsquo;t happening. The policy levers here are different
        from shortage cells.
      </p>

      <h2>Why a separate surface</h2>
      <p>
        A shortage cell tells you to either import workers or train
        new ones. An opportunity cell tells you neither &mdash; the
        workers are there &mdash; but something else is blocking
        placement: pay, geography within the province, employer
        verification gaps, decline-reason patterns. The right policy
        tool here is incentive design, not supply intervention.
      </p>

      <h2>Reading the opportunity heatmap</h2>
      <p>
        Same axes as the shortage heatmap (profession × province),
        same suppression floor, same cell-detail panel. The visual
        difference is that the map shows only the opportunity cells
        in colour; everywhere else is greyed out. This is
        deliberate: scanning a wall of grey forces you to focus on
        the policy-relevant cells.
      </p>

      <h2>The four incentive postures</h2>
      <p>
        Once you&rsquo;ve identified an opportunity cell, the
        cell-detail panel + the decline-reason aggregate help
        narrow what kind of incentive would work:
      </p>
      <ul>
        <li>
          <strong>Salary band incentive.</strong> When salary-not-
          competitive dominates declines in the cell, the gap is
          pay. A wage-subsidy or a tax-credit for employers paying
          above a local-median band can close it.
        </li>
        <li>
          <strong>Mobility incentive.</strong> When location-related
          decline reasons dominate (the cell is &ldquo;Western Cape
          electrician&rdquo; but the open vacancies are clustered
          in a peri-urban node, while supply is in a township),
          transport / relocation incentives close the geography
          gap.
        </li>
        <li>
          <strong>Employer-readiness incentive.</strong> When the
          employer KYC tier mix in the cell skews to Sebenza-tier
          (the lowest), the constraint is on the employer side &mdash;
          they look unverified, candidates decline. KYC subsidies
          for SMEs in the cell improve match rate.
        </li>
        <li>
          <strong>Information incentive.</strong> When the gap is
          neither salary nor location nor verification, candidates
          may simply not know about the opportunity. The platform
          can surface awareness through targeted notifications to
          opted-in seekers; this is a no-cost lever.
        </li>
      </ul>

      <Callout type="info" title="The opportunity surface is a policy invitation, not a recruiting tool">
        <p>
          Each cell tells you which policy lever might work; it
          doesn&rsquo;t tell you which seeker to point at which
          employer. The platform&rsquo;s aggregate-only posture
          extends here: opportunity cells are population-level
          signals, not introduction queues. If a policy
          intervention then drives matches on the platform, those
          matches happen through the normal seeker-employer flow
          with full consent.
        </p>
      </Callout>

      <DashboardLink href="/gov/opportunity">Open Opportunity map</DashboardLink>
    </HelpProse>
  );
}
