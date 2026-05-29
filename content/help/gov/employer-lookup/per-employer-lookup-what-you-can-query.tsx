import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "per-employer-lookup-what-you-can-query",
  title: "Per-employer lookup: what you can query + how",
  shortDescription:
    "Exact-match by CIPC or registered name, case-reference required, no autocomplete. What the result panel shows + what it deliberately doesn't.",
  category: "employer_lookup",
  keywords: [
    "employer lookup",
    "per-employer",
    "cipc",
    "case reference",
    "exact match",
    "compliance",
    "regulated",
  ],
  related: [
    "case-reference-documenting-your-query",
    "reading-employment-status-mix",
    "the-oversight-log-your-lookups",
  ],
  surfaceLink: "/gov/employer-lookup",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The per-employer lookup is the only gov surface that
        queries a named organisation. It exists for compliance
        review (Treasury, DTI, DHA, provincial labour departments)
        where a specific employer&rsquo;s employment-status mix is
        the legitimate question. The surface is regulated by
        design: exact-match only, no autocomplete, mandatory case-
        reference, every lookup audit-logged.
      </p>

      <h2>How the query works</h2>
      <Steps>
        <Step number={1}>
          <p>
            Open <code>/gov/employer-lookup</code>. The form has two
            inputs: the lookup field (CIPC number or registered
            organisation name) and the case-reference field.
          </p>
        </Step>
        <Step number={2}>
          <p>
            Fill the lookup field with the <strong>exact</strong>{" "}
            CIPC number or registered name. There is no autocomplete
            + no fuzzy match. If you mistype, you get an empty
            result; if you don&rsquo;t know the exact CIPC, look
            it up in your own systems first.
          </p>
        </Step>
        <Step number={3}>
          <p>
            Fill the case-reference field with the identifier from
            your own case-management system (a ticket number, a
            policy review reference, a Treasury enquiry ID). See{" "}
            <em>Case reference: documenting your query</em>.
          </p>
        </Step>
        <Step number={4}>
          <p>
            Submit. The platform writes one audit-log row capturing
            you, the org queried, the case reference, the timestamp.
            The result panel renders below.
          </p>
        </Step>
      </Steps>

      <h2>What the result panel shows</h2>
      <ul>
        <li>
          The organisation&rsquo;s registered name, CIPC, KYC tier
          (Sebenza-employer / Verified / Employer-verified), and
          province.
        </li>
        <li>
          The active workforce count Sebenza has visibility into
          (confirmed placements still active at last check-in).
        </li>
        <li>
          The employment-status mix by nationality (citizen /
          permanent resident / other), subject to k-anonymity
          suppression like everywhere else.
        </li>
        <li>
          The platform&rsquo;s confidence band &mdash; some employers
          have many platform-confirmed placements; others have
          few. The chip tells you whether the figures are robust
          enough to cite.
        </li>
      </ul>

      <h2>What the result panel deliberately doesn&rsquo;t show</h2>
      <ul>
        <li>
          Individual employees: no names, IDs, or contact details
          of anyone working at the org.
        </li>
        <li>
          Vacancy-level data: open positions, recent invitations,
          who declined &mdash; none of it shows up here.
        </li>
        <li>
          Decline-reason data for that org: aggregate decline
          patterns are in the moderation surface (admin-only),
          not the per-employer lookup.
        </li>
        <li>
          Compliance verdicts: the platform reports what it sees;
          it doesn&rsquo;t classify the org as compliant or
          non-compliant with any regulation.
        </li>
      </ul>

      <Callout type="warning" title="The lookup is dormant when the feature flag is off">
        <p>
          The per-employer-lookup surface ships dormant. When the
          governing department&rsquo;s policy doesn&rsquo;t yet
          authorise it, the page renders an informative notice
          rather than the form. The nav entry stays visible so the
          capability is honest rather than hidden; flipping it on
          is a Lead-tier admin action documented in the admin help.
        </p>
      </Callout>

      <DashboardLink href="/gov/employer-lookup">Open per-employer lookup</DashboardLink>
    </HelpProse>
  );
}
