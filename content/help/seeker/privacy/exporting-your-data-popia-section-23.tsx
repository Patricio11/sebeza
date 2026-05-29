import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "exporting-your-data-popia-section-23",
  title: "Exporting your data (POPIA Section 23)",
  shortDescription:
    "Section 23 of POPIA says you can ask for every piece of personal data a responsible party holds about you. Here's the export button + what's in the file.",
  category: "privacy",
  keywords: [
    "export",
    "popia",
    "section 23",
    "data subject rights",
    "json",
    "download",
    "audit log",
  ],
  related: [
    "what-consent-purposes-mean",
    "deleting-your-account-right-to-erasure",
    "understanding-your-activity-ledger",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        POPIA Section 23 grants every data subject the right to ask a
        responsible party (in this case, Sebenza) for confirmation that
        their personal information is being processed, and to receive
        a copy of that information. On Sebenza, this is one button on
        the Privacy &amp; consent page.
      </p>

      <h2>What&rsquo;s in the export</h2>
      <p>
        The export is a JSON file containing every row in our database
        that references your account. Specifically:
      </p>
      <ul>
        <li>
          Your profile, including encrypted fields decrypted to
          plaintext for the export only (the database stays encrypted).
        </li>
        <li>
          Every skill, qualification, work-history row, and consent-
          state row.
        </li>
        <li>
          Every invitation you ever received, with the employer&rsquo;s
          org name and the full lifecycle history.
        </li>
        <li>
          Every audit-log row that mentions you: profile views, contact
          requests, document downloads, consent flips, status
          confirmations, account changes.
        </li>
        <li>
          Every notification we sent you and the channel it went out
          on.
        </li>
      </ul>

      <h2>What&rsquo;s <em>not</em> in the export</h2>
      <ul>
        <li>
          Other people&rsquo;s data, even if it&rsquo;s linked to yours.
          An employer&rsquo;s name appears in your audit rows; the
          employer&rsquo;s full record does not.
        </li>
        <li>
          Aggregate statistics. Once data is anonymised into cohort
          counts, your individual contribution can&rsquo;t be
          un-aggregated.
        </li>
        <li>
          System-internal logs (HTTP request logs, database query logs)
          that don&rsquo;t reference you by ID.
        </li>
      </ul>

      <Callout type="info" title="The export itself is audit-logged">
        <p>
          Triggering the export writes an{" "}
          <em>account.data_export</em> audit row. We log it for two
          reasons: it&rsquo;s a POPIA-required transparency control
          (you can see, in your own audit ledger, that you exported
          your data), and it&rsquo;s a security signal (a sudden
          spike of exports across an org can indicate account
          compromise).
        </p>
      </Callout>

      <h2>How long it takes</h2>
      <p>
        For most accounts, the export is ready within a few seconds.
        For accounts with thousands of audit rows or large certificate
        files, it can take up to a couple of minutes. The Privacy page
        shows a progress indicator; once ready, you get a download
        link. The link is valid for 24 hours, then expires for
        security.
      </p>

      <DashboardLink href="/dashboard/privacy">Open Privacy &amp; consent</DashboardLink>
    </HelpProse>
  );
}
