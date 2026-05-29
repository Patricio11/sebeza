import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "understanding-the-audit-log-structure",
  title: "Understanding the audit-log structure",
  shortDescription:
    "The schema, the filters, the CSV export. Why some rows are hashed and others are plaintext, and how to read the kind column.",
  category: "operations",
  keywords: [
    "audit log",
    "structure",
    "schema",
    "filter",
    "kind",
    "actor",
    "hashed",
  ],
  related: [
    "incident-response-via-audit-log",
    "flagging-suspicious-activity",
    "notification-settings-for-admins",
  ],
  surfaceLink: "/admin/audit-log",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The audit log is the platform&rsquo;s single source of truth
        for what happened to whose data. Every PII-touching code path
        writes one row before returning. The Admin &rsaquo; Audit log
        surface is a filterable view over that table.
      </p>

      <h2>The schema</h2>
      <ul>
        <li>
          <strong>id</strong> &mdash; row UUID.
        </li>
        <li>
          <strong>kind</strong> &mdash; categorical, like{" "}
          <code>profile.view</code>, <code>contact.reveal</code>,{" "}
          <code>kyc.approved</code>, <code>account.suspended</code>.
          Lower-dot-cased. The full list is documented in{" "}
          <code>lib/audit/catalog.ts</code>.
        </li>
        <li>
          <strong>actor</strong> &mdash; the account that took the
          action. For automated actions (cron jobs) the actor is the
          job name with an <code>auto:</code> prefix.
        </li>
        <li>
          <strong>subject</strong> &mdash; the account whose data was
          touched. For consent grants the subject and actor are the
          same person.
        </li>
        <li>
          <strong>org</strong> &mdash; the organisation context where
          relevant (employer-org for employer actions).
        </li>
        <li>
          <strong>detail</strong> &mdash; a JSON blob with
          kind-specific fields. For <code>profile.view</code> it
          carries the viewing context (search result, dossier open,
          vacancy match); for <code>kyc.approved</code> it carries
          the document IDs reviewed; etc.
        </li>
        <li>
          <strong>created_at</strong> &mdash; timestamp.
        </li>
      </ul>

      <h2>Filters available on the surface</h2>
      <ul>
        <li>
          <strong>Kind dropdown.</strong> Pick one or more kinds
          (multi-select).
        </li>
        <li>
          <strong>Actor text.</strong> Substring search against
          actor IDs / names.
        </li>
        <li>
          <strong>Subject text.</strong> Substring search against
          subject IDs / names.
        </li>
        <li>
          <strong>Date range.</strong> Start + end, defaulting to the
          last 7 days.
        </li>
      </ul>
      <p>
        The page is paginated to 200 rows; CSV export gives you the
        full filtered set.
      </p>

      <h2>Hashed vs plaintext fields</h2>
      <p>
        Most rows are plaintext &mdash; that&rsquo;s the audit log&rsquo;s
        purpose. The exception: rows on accounts that have been
        hard-deleted have their actor and subject fields one-way-hashed,
        so the row still proves the action happened (compliance need)
        but can&rsquo;t reconstruct who it was about (POPIA need).
      </p>

      <Callout type="info" title="The kind catalog evolves; the row format doesn't">
        <p>
          New audit-log kinds get added when features land that touch
          PII in new ways. Old kinds are never renamed or removed
          &mdash; rows from 2025 still reference whatever kinds were
          live at the time. If a kind you&rsquo;re investigating
          isn&rsquo;t in the dropdown, check whether the feature was
          retired and the kind&rsquo;s rows still live but are filtered
          out of the picker; the engineering team can help if needed.
        </p>
      </Callout>

      <DashboardLink href="/admin/audit-log">Open audit log</DashboardLink>
    </HelpProse>
  );
}
