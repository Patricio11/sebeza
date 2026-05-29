import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "cities-coming-soon",
  title: "Cities (coming soon): what the municipal surface will show",
  shortDescription:
    "The Municipalities nav entry ships dormant. Why  cell counts and what it will surface once city  profession cells exceed the k=10 floor.",
  category: "provincial_briefs",
  keywords: [
    "cities",
    "municipalities",
    "coming soon",
    "municipal",
    "city",
    "k-anonymity",
    "floor",
  ],
  related: [
    "reading-your-provincial-brief",
    "privacy-floor-explained",
    "what-suppressed-cells-mean",
  ],
  surfaceLink: "/gov/provinces",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Municipalities nav entry is documented in the code but
        hidden from the live nav until the underlying analytics
        cross the privacy-floor threshold. This article explains
        why + what the surface will show when it ships.
      </p>

      <h2>Why it ships dormant</h2>
      <p>
        City-level analytics slice the data more finely than
        provincial. A (profession × city) cell has, by definition,
        a smaller underlying population than a (profession ×
        province) cell. Most city cells, today, are below the
        k=10 floor. The platform&rsquo;s posture is to ship the
        surface only when most cells will return real values
        rather than suppression chips &mdash; otherwise the
        municipal page would be a sea of <em>limited data</em>
        and the policy signal would be drowned by suppression
        noise.
      </p>

      <h2>What &ldquo;most cells&rdquo; means</h2>
      <p>
        The launch threshold is set by Sebenza compliance: when
        the population-weighted share of (profession × city) cells
        across the country&rsquo;s top 60 municipalities is at or
        above 60% non-suppressed in the rolling 13-week window,
        the surface flips on. Currently we sit in the 1530% band,
        depending on the week. We expect to cross the threshold
        within 612 months of broader platform adoption.
      </p>

      <h2>What the surface will show</h2>
      <ul>
        <li>
          A search interface for municipalities (autocomplete on
          the official Stats SA list of 257 municipalities).
        </li>
        <li>
          Per-municipality supply + demand by profession, with
          the same heatmap interaction model as the provincial
          surface.
        </li>
        <li>
          A spillover view: when a city&rsquo;s supply is too
          small to surface but the adjacent metro&rsquo;s is large
          (e.g. small municipalities adjacent to Cape Town,
          eThekwini, Johannesburg), the surface will show the
          metro figure with a spillover annotation.
        </li>
        <li>
          A municipal subset of the Shortage Justification Index,
          with cells classified using the same logic as the
          provincial index.
        </li>
      </ul>

      <Callout type="info" title="Why the nav entry isn't visible yet">
        <p>
          We considered keeping the entry visible with a
          coming-soon badge to be transparent about platform
          capability. We decided against it for the public launch:
          a visible-but-dead-end nav entry signals
          &ldquo;feature in progress&rdquo; to users who
          aren&rsquo;t reading documentation, which over-promises.
          The route still exists; if you have the URL, the page
          renders a coming-soon notice with the threshold logic
          explained. Once the threshold is crossed, we flip the
          nav entry visible in a one-line change.
        </p>
      </Callout>

      <h2>How to plan briefs in the meantime</h2>
      <p>
        For city-level questions today, the workable substitute is
        the provincial brief filtered to the urban-corridor
        professions. It loses geographical resolution but holds
        the trend signal &mdash; city-level dynamics in the major
        metros track provincial dynamics with a small lag. Cite
        provincial figures with a city-level caveat rather than
        guessing at city-level values from incomplete data.
      </p>
    </HelpProse>
  );
}
