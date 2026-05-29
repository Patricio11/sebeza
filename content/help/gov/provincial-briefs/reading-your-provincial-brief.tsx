import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "reading-your-provincial-brief",
  title: "Reading your provincial labour-market brief",
  shortDescription:
    "What each card on the Provinces page tells you, how supply + demand relate, and how to use the brief in a Treasury sitting.",
  category: "provincial_briefs",
  keywords: [
    "province",
    "provincial",
    "brief",
    "supply",
    "demand",
    "treasury",
    "geography",
  ],
  related: [
    "reading-the-lmi",
    "top-skills-gaps-supply-freshness",
    "cities-coming-soon",
  ],
  surfaceLink: "/gov/provinces",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Provinces page is a 9-card grid &mdash; one per
        province. Each card is a compact summary; opening a
        province (<code>/gov/provinces/[slug]</code>) gives you the
        full brief with charts, the top-gap list, and the freshness
        signal.
      </p>

      <h2>What the headline number on each card means</h2>
      <p>
        The province card shows the active supply count: confirmed-
        active seeker profiles in that province with status confirmed
        in the last 90 days. The chip below tells you whether the
        count moved meaningfully against the rolling 13-week median
        for that province (not nationally &mdash; provincial baselines
        differ).
      </p>

      <h2>Inside the province brief</h2>
      <ul>
        <li>
          <strong>Top five gaps.</strong> The five professions with
          the largest gap between current active supply + the
          rolling demand signal in that province. The list is the
          starting point for &ldquo;where should we direct training
          investment in this province?&rdquo;
        </li>
        <li>
          <strong>Freshness breakdown.</strong> The share of
          profiles in this province with confirmed status in the
          last 30 / 60 / 90 days. Low freshness across a province
          tells you the platform isn&rsquo;t yet load-bearing
          there; high freshness tells you the data is current
          enough to cite.
        </li>
        <li>
          <strong>Monthly trend.</strong> A 12-month spark chart of
          active supply + invitation activity. Useful for
          identifying seasonal patterns or onboarding pushes.
        </li>
        <li>
          <strong>Verified-employer count.</strong> How many
          organisations in the province carry the Verified-Employer
          tier. Low counts indicate KYC capacity gaps for the
          province more than they tell you about labour supply.
        </li>
      </ul>

      <h2>Using the brief in a Treasury sitting</h2>
      <p>
        The provincial brief is designed to answer one specific
        question: &ldquo;is the labour-market data Sebenza holds
        for this province dense enough to be cited?&rdquo; If
        freshness is below 50% and the active supply is in the
        hundreds, you can cite trends but be cautious about
        absolute numbers. If freshness is above 70% + supply is in
        the thousands, the provincial figures are robust enough
        for Treasury briefs.
      </p>

      <Callout type="info" title="Open + close a province in one tab">
        <p>
          The Provinces grid uses standard nav links; opening a
          province does not break your back-navigation. Use the
          browser back button to return to the grid after each
          deep dive. The shell preserves scroll position so you
          can run through all 9 provinces without losing context.
        </p>
      </Callout>

      <DashboardLink href="/gov/provinces">Open the Provinces grid</DashboardLink>
    </HelpProse>
  );
}
