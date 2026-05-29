import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "your-first-hour-orientation",
  title: "Your first hour: orientation + access scope",
  shortDescription:
    "Five surfaces to open in order, what each tells you, and the access-scope question every new gov user asks.",
  category: "getting_started",
  keywords: [
    "first hour",
    "orientation",
    "tour",
    "access",
    "scope",
    "permissions",
    "new user",
  ],
  related: [
    "what-sebenza-is-for-government",
    "privacy-floor-explained",
    "reading-the-lmi",
  ],
  surfaceLink: "/gov",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        New to the gov workspace? These five surfaces &mdash; opened
        in this order &mdash; take you from &ldquo;what is this?&rdquo;
        to &ldquo;I can answer a specific policy question.&rdquo; The
        whole walkthrough takes under an hour.
      </p>

      <Steps>
        <Step number={1}>
          <p>
            <strong>Overview (/gov).</strong> The Sebenza Labour
            Market Index (LMI) with its three components and the
            week-over-week delta. Start here every Monday morning;
            it&rsquo;s the headline number policy briefs cite.
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>Provinces (/gov/provinces).</strong> Open the
            province you cover (or all 9, in sequence). Each card
            carries supply, top skill gaps, freshness signal,
            monthly trend. This is the place provincial Treasury
            briefs start.
          </p>
        </Step>
        <Step number={3}>
          <p>
            <strong>Shortage justification (/gov/shortage).</strong>{" "}
            The Skills-Shortage Justification Index. Each
            (profession &times; province) cell is classified as
            <em> genuine local shortage</em>,{" "}
            <em>local supply available</em>, or{" "}
            <em>indeterminate</em>. This is the surface DHA + Home
            Affairs reference for visa-policy work.
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>Curriculum vs demand (/gov/curriculum).</strong>{" "}
            DHET focus. What programmes are producing graduates
            vs what employers are hiring for. Province + programme
            filters. The clearest evidence base for tertiary
            curriculum review.
          </p>
        </Step>
        <Step number={5}>
          <p>
            <strong>Policy brief (/gov/brief).</strong> A print-
            optimised aggregation of LMI + top shortage + top
            opportunity + national status-mix. File &rarr; Print
            &rarr; Save as PDF for stakeholder distribution.
          </p>
        </Step>
      </Steps>

      <h2>The access-scope question</h2>
      <p>
        Most new gov users ask the same question on day one: &ldquo;can
        I see [specific seeker / specific employer / specific
        municipality]?&rdquo; The answer is structured:
      </p>
      <ul>
        <li>
          <strong>Specific seeker:</strong> never. No individual
          PII anywhere in the gov workspace.
        </li>
        <li>
          <strong>Specific employer:</strong> yes via the per-
          employer lookup, with mandatory case-reference + audit
          trail. See <em>Per-employer lookup: what you can query +
          how</em>.
        </li>
        <li>
          <strong>Specific municipality:</strong> the surface ships
          dormant until cell counts pass k=10; the analytics are
          there, just suppressed for privacy. See <em>Cities coming
          soon</em>.
        </li>
      </ul>

      <Callout type="info" title="Read the privacy floor article before you build anything">
        <p>
          Most policy questions can be answered without ever
          reaching for the per-employer lookup or testing the
          edges of suppression. Understanding the privacy floor
          first means you don&rsquo;t spend an afternoon trying to
          extract data the platform deliberately doesn&rsquo;t
          expose.
        </p>
      </Callout>

      <DashboardLink href="/gov">Open the overview</DashboardLink>
    </HelpProse>
  );
}
