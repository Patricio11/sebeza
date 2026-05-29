import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "how-search-ranking-works",
  title: "How search ranking works",
  shortDescription:
    "Honest breakdown of the three signals  completeness, freshness, citizen boost  and the two gates that make rank irrelevant when failed.",
  category: "getting_started",
  keywords: [
    "ranking",
    "search rank",
    "pool",
    "freshness",
    "completeness",
    "boost",
    "algorithm",
  ],
  related: [
    "understanding-profile-completeness",
    "what-consent-purposes-mean",
    "career-compass-recommendations",
  ],
  surfaceLink: "/dashboard",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When an employer opens the matcher for a vacancy, the platform
        ranks every eligible seeker in the (profession × province) pool.
        Your rank in that pool is what the Overview shows you. There are
        three signals that move it, and two gates that make it
        irrelevant if you fail them.
      </p>

      <h2>The three signals</h2>
      <ul>
        <li>
          <strong>Completeness.</strong> The biggest single factor. See{" "}
          <em>Understanding profile completeness</em> for the exact six
          checks. The score is a fraction; the more checks you pass, the
          higher the ranking weight.
        </li>
        <li>
          <strong>Freshness.</strong> Confirmed work status. If your
          last status confirmation is more than 90 days old, the matcher
          treats your record as stale and applies a down-rank. Confirm
          monthly and the penalty never triggers.
        </li>
        <li>
          <strong>Citizen boost.</strong> Small, additive. South African
          citizens get a modest boost in their pool when the employer
          has set citizenship as a preference. The boost is small enough
          that a complete, fresh non-citizen profile out-ranks a sparse,
          stale citizen one &mdash; the gate is&nbsp;skill+freshness, not
          nationality.
        </li>
      </ul>

      <h2>The two gates</h2>
      <p>
        Below each are pass-or-fail filters. If you fail either, you
        don&rsquo;t appear in matcher results at all, regardless of how
        complete your profile is:
      </p>
      <ul>
        <li>
          <strong>Searchability consent.</strong> Toggle on the Privacy
          &amp; consent page. Off = invisible to /search. Default is on.
        </li>
        <li>
          <strong>Vacancy-matching consent.</strong> Off = visible in
          /search results but employers cannot send you a vacancy
          invite. Default is <em>off</em>; turning it on is opt-in.
        </li>
      </ul>

      <Callout type="warning" title="Why ranking isn't shown sometimes">
        <p>
          If your Overview&rsquo;s <em>Rank in pool</em> card shows
          blank, it&rsquo;s usually one of three things: you haven&rsquo;t
          set profession + province yet (the pool isn&rsquo;t defined);
          your status is stale (the matcher down-ranks you out of the
          visible pool); or searchability consent is off (you&rsquo;re
          not in the pool at all). The card tells you which.
        </p>
      </Callout>

      <h2>What does NOT move ranking</h2>
      <p>
        No paid tier exists. There&rsquo;s no &ldquo;featured profile&rdquo;
        upgrade, no recency-of-edit bump, no engagement score, no
        boost-by-paying-for-LinkedIn-Premium-equivalent. The only way
        rank moves is the three signals above. We treat that as a
        feature, not a missing one.
      </p>
    </HelpProse>
  );
}
