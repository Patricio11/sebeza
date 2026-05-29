import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "reading-the-lmi",
  title: "Reading the Sebenza LMI",
  shortDescription:
    "The three components, how the headline is computed, and how to read the week-over-week delta without over-interpreting noise.",
  category: "provincial_briefs",
  keywords: [
    "lmi",
    "labour market index",
    "headline",
    "components",
    "weekly",
    "delta",
    "overview",
  ],
  related: [
    "reading-your-provincial-brief",
    "top-skills-gaps-supply-freshness",
    "what-sebenza-is-for-government",
  ],
  surfaceLink: "/gov",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Sebenza Labour Market Index (LMI) is the headline number
        on the Overview page. It&rsquo;s a single weekly figure that
        compresses three components into one indicator policy briefs
        can cite. The number itself is less useful than knowing how
        to read the components.
      </p>

      <h2>The three components</h2>
      <ul>
        <li>
          <strong>Activity.</strong> Volume of vacancy invitations
          fired against confirmed-active seeker profiles this week,
          normalised against the rolling 13-week median. Above
          baseline = the matcher is busy; below = quiet.
        </li>
        <li>
          <strong>Conversion.</strong> Share of those invitations
          that landed in <em>accepted</em> or <em>accepted with
          notice</em> states. Tracks whether activity is producing
          actual hiring conversations, not just spray-and-pray
          inviting.
        </li>
        <li>
          <strong>Persistence.</strong> Share of confirmed placements
          from 3-month, 6-month, and 12-month cohorts still active
          at their check-in. The retention signal &mdash; whether
          hires are sticking.
        </li>
      </ul>

      <h2>How the headline is composed</h2>
      <p>
        The headline LMI is a weighted geometric mean of the three
        components, normalised so 100 = the rolling 52-week median.
        Geometric (not arithmetic) means one bad component drags the
        index more than one good component lifts it &mdash; intentional;
        labour markets are more vulnerable to single-component breakdown
        than upside surprise.
      </p>

      <h2>Reading the week-over-week delta</h2>
      <p>
        The Overview shows a delta vs last week. Two postures for
        reading it honestly:
      </p>
      <ul>
        <li>
          <strong>Single-week movement is noise unless the magnitude
          is large.</strong> A 2-point swing week-over-week is within
          normal volatility; report on the 4-week moving direction,
          not the single tick.
        </li>
        <li>
          <strong>Decompose before you cite.</strong> An LMI change is
          a composite; before citing it in a brief, look at which
          component moved. &ldquo;LMI down 6 points because activity
          fell&rdquo; is a different policy story than &ldquo;LMI
          down 6 points because persistence dropped.&rdquo;
        </li>
      </ul>

      <Callout type="info" title="The nationality-split toggle">
        <p>
          The Overview has an optional split that breaks the
          underlying employment-status mix by citizenship (SA citizens
          / permanent residents / other). Useful for DHA-adjacent
          policy work; suppressed below the k-anonymity floor like
          everything else. Default-off; you turn it on per-session.
        </p>
      </Callout>

      <DashboardLink href="/gov">Open the overview</DashboardLink>
    </HelpProse>
  );
}
