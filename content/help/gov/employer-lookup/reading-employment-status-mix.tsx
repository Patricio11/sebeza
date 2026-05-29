import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "reading-employment-status-mix",
  title: "Reading employment-status mix for a single employer",
  shortDescription:
    "What the citizen / permanent-resident / other breakdown tells you, what it doesn't, and three common mistakes when citing the figures.",
  category: "employer_lookup",
  keywords: [
    "employment status",
    "citizenship",
    "permanent resident",
    "mix",
    "nationality",
    "breakdown",
    "compliance",
  ],
  related: [
    "per-employer-lookup-what-you-can-query",
    "case-reference-documenting-your-query",
    "what-suppressed-cells-mean",
  ],
  surfaceLink: "/gov/employer-lookup",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        For employers with platform-confirmed placements above the
        suppression floor, the lookup result returns a breakdown of
        the active workforce by citizenship status: South African
        citizens, permanent residents, and other (typically work-
        permit holders). This is the single most consequential
        figure on the surface; three common mistakes recur when
        analysts read it.
      </p>

      <h2>What the mix tells you</h2>
      <ul>
        <li>
          What share of the org&rsquo;s platform-visible workforce
          falls into each citizenship band, as a snapshot of the
          most recent check-in cycle.
        </li>
        <li>
          A reasonable lower bound: the platform only sees placements
          confirmed through Sebenza, so the actual mix may differ
          if the org employs people whose placements weren&rsquo;t
          logged.
        </li>
      </ul>

      <h2>What the mix doesn&rsquo;t tell you</h2>
      <ul>
        <li>
          The org&rsquo;s total workforce. The platform&rsquo;s
          visibility is partial.
        </li>
        <li>
          Whether the org&rsquo;s hiring policy is biased in any
          direction; mix can reflect available labour supply in
          the org&rsquo;s sector and province more than employer
          preference.
        </li>
        <li>
          Visa or permit status for the &ldquo;other&rdquo;
          category &mdash; the platform records citizenship, not
          permit detail.
        </li>
      </ul>

      <h2>Three common mistakes</h2>
      <ul>
        <li>
          <strong>Treating the platform-visible workforce as the
          full workforce.</strong> If the platform sees 18 active
          placements at an org, that doesn&rsquo;t mean the org has
          18 employees. Cross-check against UIF / SARS workforce
          data before publishing absolute numbers in a brief.
        </li>
        <li>
          <strong>Comparing across orgs with different platform
          adoption.</strong> Org A has 80% of its real workforce
          visible on the platform; Org B has 20%. Comparing their
          mixes is comparing different denominators. The platform
          confidence chip helps; ignore it at your peril.
        </li>
        <li>
          <strong>Drawing compliance conclusions from a single
          snapshot.</strong> A mix on a single day is not a
          compliance verdict. Trends across multiple check-in
          windows are more informative; persistent patterns warrant
          investigation, single snapshots warrant noting.
        </li>
      </ul>

      <Callout type="warning" title="The mix is not the EEA-1 return">
        <p>
          Sebenza&rsquo;s mix is platform-visible employment-status
          across citizenship. It is <em>not</em> the official
          Employment Equity Act return (EEA-1, EEA-2) the
          Department of Labour collects. These are different
          datasets with different scope, definitions, and legal
          weight. Cite Sebenza for what Sebenza measures; cite
          EEA returns for what EEA returns measure. Conflating
          them in a brief is the single most common Sebenza
          misuse + the one our compliance team flags most.
        </p>
      </Callout>
    </HelpProse>
  );
}
