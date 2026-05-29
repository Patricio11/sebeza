import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "understanding-your-activity-ledger",
  title: "Understanding your activity ledger",
  shortDescription:
    "Four KPI cards + a chronological feed. Every employer action that touches your record, recorded honestly, sorted newest-first.",
  category: "activity",
  keywords: [
    "activity",
    "audit",
    "ledger",
    "feed",
    "kpi",
    "viewers",
    "contacts",
    "reveals",
    "downloads",
  ],
  related: [
    "who-viewed-your-profile",
    "contact-reveal-how-it-works",
    "document-sharing-and-employer-access",
  ],
  surfaceLink: "/dashboard/activity",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Activity page is your audit ledger &mdash; every
        PII-touching action by an employer on your record, written as
        a row at the moment it happened. The top of the page shows four
        KPI cards summarising the headline numbers; the rest is the
        chronological feed.
      </p>

      <h2>The four KPI cards</h2>
      <ul>
        <li>
          <strong>Viewers this week.</strong> How many distinct
          organisations opened your dossier in the last 7 days, with
          a delta vs the previous 7 days. A sudden jump usually means
          your profile got picked up in a new vacancy&rsquo;s match
          results.
        </li>
        <li>
          <strong>Contact requests this week.</strong> How many
          organisations requested your contact details in the last 7
          days. Most of these you&rsquo;ll have already seen as
          notifications.
        </li>
        <li>
          <strong>Reveals (all-time).</strong> Total count of times
          you granted a contact-reveal request. Doesn&rsquo;t reset.
        </li>
        <li>
          <strong>Downloads (all-time).</strong> Total count of times
          an employer downloaded one of your certificates after your
          consent. Doesn&rsquo;t reset.
        </li>
      </ul>

      <h2>The chronological feed</h2>
      <p>
        Below the KPIs, every row in the feed is one action. Each row
        carries:
      </p>
      <ul>
        <li>
          The <strong>action kind</strong> &mdash; profile.view,
          contact.request, contact.reveal, document.download,
          consent.granted, consent.withdrawn, account.data_export, etc.
        </li>
        <li>
          The <strong>actor</strong> &mdash; the organisation name (not
          the individual employee within that org; org-level resolution
          is the right granularity for the seeker view).
        </li>
        <li>
          A short <strong>detail line</strong> &mdash; the vacancy this
          was related to (when applicable), or the document, or the
          consent purpose.
        </li>
        <li>
          The <strong>timestamp</strong> &mdash; relative for recent
          rows (&ldquo;3 hours ago&rdquo;), absolute for older ones.
        </li>
      </ul>

      <Callout type="info" title="Every row is also in your POPIA export">
        <p>
          The activity ledger is the friendly read of the same data
          you can pull down via the POPIA Section 23 export on the
          Privacy page. The ledger is selective &mdash; it shows
          PII-touching actions only, not every internal system event.
          The export is exhaustive.
        </p>
      </Callout>

      <h2>What the ledger doesn&rsquo;t show</h2>
      <ul>
        <li>
          Search appearances. If an employer ran a search you matched
          but didn&rsquo;t open your dossier, you don&rsquo;t see a
          row &mdash; appearing in a result list isn&rsquo;t a PII
          touch.
        </li>
        <li>
          Aggregate counting. If you were included in a cohort
          statistic, that&rsquo;s not a per-seeker row.
        </li>
        <li>
          Internal admin reviews of policy violations or moderation,
          unless they resulted in a change to your account.
        </li>
      </ul>

      <DashboardLink href="/dashboard/activity">Open activity ledger</DashboardLink>
    </HelpProse>
  );
}
