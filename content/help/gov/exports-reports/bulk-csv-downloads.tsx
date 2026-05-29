import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "bulk-csv-downloads",
  title: "Bulk CSV downloads: schemas + query parameters",
  shortDescription:
    "Seven hardened CSV exports + their schemas. What's in each, what filters are available, what suppression looks like in a CSV.",
  category: "exports_reports",
  keywords: [
    "csv",
    "export",
    "download",
    "schema",
    "bulk",
    "filters",
    "json",
  ],
  related: [
    "policy-brief-as-pdf",
    "lmi-json-public-api",
    "your-activity-audit-trail",
  ],
  surfaceLink: "/gov/exports",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Exports page is a grid of hardened download cards. Each
        card has a title, a one-sentence description of contents,
        and the available query parameters. Hit download; the
        platform writes one audit row capturing the export + the
        filter parameters; the CSV (or JSON, where indicated)
        downloads to your browser.
      </p>

      <h2>The seven export types</h2>
      <ul>
        <li>
          <strong>Outcomes</strong> &mdash; placement counts +
          retention rates by (profession × province × cohort
          quarter). Schema: cell coordinates + numeric values +
          confidence + suppression flag.
        </li>
        <li>
          <strong>LMI history</strong> &mdash; the headline LMI +
          three components, weekly back to launch. Schema: week,
          headline, activity, conversion, persistence.
        </li>
        <li>
          <strong>Audit log</strong> &mdash; your own activity
          audit trail. Schema: timestamp, kind, target, case-
          reference, IP family. (You only see your own; the full
          audit log is admin-only.)
        </li>
        <li>
          <strong>Nationality mix &mdash; status</strong> &mdash;
          employment-status mix by citizenship, by (profession ×
          province), suppressed below k=10. Schema: cell
          coordinates + status counts + suppression flag.
        </li>
        <li>
          <strong>Nationality mix &mdash; supply</strong> &mdash;
          active supply mix by citizenship, by (profession ×
          province). Same suppression rules.
        </li>
        <li>
          <strong>Justification index</strong> &mdash; the full
          (profession × province) classifier with underlying
          ratios. Schema: cell + classification + demand_score +
          local_supply_ratio + foreign_fill_share + dominant
          decline reason.
        </li>
        <li>
          <strong>Curriculum vs demand</strong> &mdash; programme
          × province alignment scores + cohort outcome rates.
          Schema: programme + province + alignment + 6/12/24/36
          month retention + suppression flag.
        </li>
      </ul>

      <h2>Query parameters per export</h2>
      <p>
        Most cards expose two filters: <em>province</em> (single or
        all) and <em>date window</em> (rolling 90 / 180 / 365 days
        or custom). A few add domain-specific filters: justification
        index adds a classification filter; curriculum adds a
        programme filter; nationality exports add a citizenship
        filter.
      </p>

      <h2>What suppression looks like in a CSV</h2>
      <p>
        Suppressed cells emit the literal token{" "}
        <code>SUPPRESSED</code> in the value columns and a{" "}
        <code>k_floor</code> = 1 in the suppression-flag column.
        Non-suppressed cells emit the numeric value + a{" "}
        <code>k_floor</code> = 0. Downstream pipelines should
        treat <code>SUPPRESSED</code> distinctly from zero or
        empty &mdash; conflating the three is the most common
        analytical mistake.
      </p>

      <Callout type="info" title="The audit row carries your filters">
        <p>
          When you download an export, the audit row records not
          just &ldquo;you downloaded this export&rdquo; but{" "}
          <em>which filter parameters you applied</em>. This means
          patterns like &ldquo;repeatedly exporting nationality
          mix for one province&rdquo; are visible in the Oversight
          log just as named-org queries are. The principle is the
          same; the friction is just less because exports are part
          of normal analytical work.
        </p>
      </Callout>

      <DashboardLink href="/gov/exports">Open Exports</DashboardLink>
    </HelpProse>
  );
}
