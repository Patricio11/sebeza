import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "policy-brief-as-pdf",
  title: "Composing the Policy Brief as PDF",
  shortDescription:
    "/gov/brief is a print-styled aggregation of LMI + top shortage + top opportunity + status-mix. Browser Print  Save as PDF gives you a citation-ready brief.",
  category: "exports_reports",
  keywords: [
    "policy brief",
    "pdf",
    "print",
    "report",
    "stakeholder",
    "citation",
    "treasury",
  ],
  related: [
    "bulk-csv-downloads",
    "reading-the-lmi",
    "shortage-justification-index-explained",
  ],
  surfaceLink: "/gov/brief",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Policy Brief at <code>/gov/brief</code> is a single
        page styled for print rather than for screen interaction.
        It aggregates the headline figures most stakeholder briefs
        need: current LMI + components, top shortage cells, top
        opportunity cells, national status-mix by citizenship.
        The browser&rsquo;s File &rarr; Print &rarr; Save as PDF
        turns it into a distributable artefact.
      </p>

      <h2>What&rsquo;s on the brief</h2>
      <ul>
        <li>
          <strong>Header.</strong> Date generated, the gov user&rsquo;s
          name + department, a methodology footer link.
        </li>
        <li>
          <strong>LMI section.</strong> Current week&rsquo;s LMI +
          three components + 4-week trend.
        </li>
        <li>
          <strong>Top shortage cells.</strong> The five
          (profession × province) cells with the strongest
          shortage classification, with demand_score +
          local_supply_ratio + dominant decline reason.
        </li>
        <li>
          <strong>Top opportunity cells.</strong> The five cells
          where local supply is available + recommended incentive
          posture per cell.
        </li>
        <li>
          <strong>National status-mix.</strong> Active workforce
          breakdown by citizenship + permanent residency +
          other, suppressed cells noted in the table footer.
        </li>
        <li>
          <strong>Methodology + suppression note.</strong> Standard
          paragraph explaining the k-anonymity floor + the
          retention denominator definition. Citation-ready.
        </li>
      </ul>

      <h2>Generating the PDF</h2>
      <Steps>
        <Step number={1}>
          <p>
            Open <code>/gov/brief</code>. The page renders the
            current data; no filters or interactive controls
            (deliberate &mdash; the brief is a snapshot, not a
            sandbox).
          </p>
        </Step>
        <Step number={2}>
          <p>
            Hit Ctrl/Cmd-P (or browser menu &rarr; Print).
          </p>
        </Step>
        <Step number={3}>
          <p>
            In the print dialog, set destination to{" "}
            <em>Save as PDF</em> + paper to A4 + margins to
            Default. The print stylesheet is already tuned for
            these settings; tweaking them rarely improves the
            output.
          </p>
        </Step>
        <Step number={4}>
          <p>
            Save. Filename convention: include the date so the
            artefact is unambiguous a quarter later
            (<code>sebenza-brief-2026-05-29.pdf</code>).
          </p>
        </Step>
      </Steps>

      <Callout type="info" title="The brief is intentionally not customisable">
        <p>
          We considered adding province filters, time-window
          selectors, and other controls to the brief. We decided
          against it: the brief&rsquo;s value is precisely that
          it&rsquo;s the same artefact for every user every week.
          When a Treasury committee asks &ldquo;is this the
          Sebenza brief?&rdquo;, the answer should be unambiguous.
          For customised analysis, use the Exports page.
        </p>
      </Callout>

      <h2>What the brief deliberately doesn&rsquo;t include</h2>
      <ul>
        <li>
          Per-employer information.
        </li>
        <li>
          Municipal-level breakdowns (most cells would suppress
          anyway, see the cities-coming-soon article).
        </li>
        <li>
          Year-on-year comparisons before we have two years of
          stable data &mdash; comparing against bootstrapping-era
          numbers would be misleading.
        </li>
        <li>
          Editorial commentary from Sebenza on what the numbers
          mean. The brief presents the data; the policy
          interpretation is yours.
        </li>
      </ul>

      <DashboardLink href="/gov/brief">Open the Policy Brief</DashboardLink>
    </HelpProse>
  );
}
