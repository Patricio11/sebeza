import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "top-skills-gaps-supply-freshness",
  title: "Top skill gaps, supply, and freshness",
  shortDescription:
    "How the top-gap list is computed, why freshness matters more than raw supply, and how to read a province where supply looks 'low' but is actually stale.",
  category: "provincial_briefs",
  keywords: [
    "skill gap",
    "supply",
    "demand",
    "freshness",
    "stale",
    "ranking",
    "province",
  ],
  related: [
    "reading-your-provincial-brief",
    "reading-the-lmi",
    "shortage-justification-index-explained",
  ],
  surfaceLink: "/gov/provinces",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Three signals on every provincial brief are worth reading
        carefully because the obvious interpretation is often wrong:
        the top-gap list, the raw supply count, and the freshness
        breakdown. Each tells you something different; the
        relationship between them is where the policy signal lives.
      </p>

      <h2>How the top-gap list is computed</h2>
      <p>
        For each profession, the platform compares the rolling
        demand (last 13 weeks of invitation volume in that
        profession in that province) against the active-supply
        count (confirmed-active seekers with that profession as
        primary in that province). The gap is normalised against
        the national gap distribution for that profession. The top
        five are the most extreme local deficits.
      </p>

      <h2>Why raw supply is misleading</h2>
      <p>
        &ldquo;Eastern Cape has 1,200 active electricians.&rdquo;
        That number is meaningful only if you know the freshness
        breakdown. 1,200 with 800 confirmed in the last 30 days =
        a live supply. 1,200 with 200 confirmed in the last 30 days
        + 1,000 from over 90 days = a phantom supply; most of those
        profiles are stale and might be employed elsewhere,
        retired, or gone from the labour market.
      </p>

      <h2>Reading freshness honestly</h2>
      <ul>
        <li>
          <strong>Above 70% confirmed in the last 30 days:</strong>{" "}
          the supply is live; cite the count with confidence.
        </li>
        <li>
          <strong>40-70%:</strong> live but ageing; cite trends, be
          careful with absolute numbers.
        </li>
        <li>
          <strong>Below 40%:</strong> stale supply; the count
          overstates the live labour pool. Either the platform is
          under-adopted in that province / profession, or active
          seekers are not maintaining their status.
        </li>
      </ul>

      <Callout type="warning" title="A 'low supply' province is sometimes a 'low platform-adoption' province">
        <p>
          When a small province shows tiny supply counts for a
          common profession, the read isn&rsquo;t necessarily
          &ldquo;there are no such workers there.&rdquo; It might
          be &ldquo;the platform hasn&rsquo;t reached most workers
          there yet.&rdquo; Cross-check with Stats SA QLFS or
          municipal sector data before drawing supply conclusions
          about Northern Cape or rural municipalities specifically.
        </p>
      </Callout>

      <h2>Ranking professions across provinces</h2>
      <p>
        Common policy question: &ldquo;where is the
        artisan-electrician gap worst?&rdquo; The matcher answer is
        the rank of provincial gaps for that profession; the
        Provinces page doesn&rsquo;t pre-compute this view (it
        ranks <em>within</em> a province, not across), but the
        Shortage Justification Index does. See <em>Shortage
        Justification Index explained</em>.
      </p>
    </HelpProse>
  );
}
