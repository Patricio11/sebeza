import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "deletion-requests-right-to-erasure",
  title: "Deletion requests + right to erasure",
  shortDescription:
    "The 30-day soft-delete then hard-delete sweep. When an admin-initiated immediate hard-delete is appropriate. What survives + why.",
  category: "popia_compliance",
  keywords: [
    "delete",
    "deletion",
    "erasure",
    "right to be forgotten",
    "soft delete",
    "hard delete",
    "30 days",
  ],
  related: [
    "handling-data-subject-requests",
    "processing-export-requests",
    "understanding-the-audit-log-structure",
  ],
  surfaceLink: "/admin/users",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A deletion request from a user is fulfilled by the same
        soft-delete  hard-delete machinery the self-serve delete
        button triggers. Most deletion requests are user-initiated
        through the dashboard; admin-initiated deletions happen for
        three specific reasons documented below.
      </p>

      <h2>The standard flow (recap)</h2>
      <ol>
        <li>
          User hits delete (or admin executes the equivalent action
          on a DSR case).
        </li>
        <li>
          Account moves to <em>soft-deleted</em>: invisible to
          search, profile URL 404s, employer interactions blocked.
          Data still in the database, flagged.
        </li>
        <li>
          30 days elapse. User can sign back in within this window
          and restore.
        </li>
        <li>
          Nightly cron sweeps soft-deleted accounts past 30 days.
          Encrypted PII gets cryptographically shredded (key-id
          deleted from the keyring); rows referencing the account
          are deleted or hashed depending on retention rules.
        </li>
        <li>
          One <em>account.hard_deleted</em> audit row persists with
          all PII fields hashed.
        </li>
      </ol>

      <h2>When admin-initiated immediate hard-delete applies</h2>
      <p>
        Lead-tier action only. Three cases:
      </p>
      <ul>
        <li>
          <strong>Court order.</strong> A signed court order
          requiring immediate erasure. Skip the 30-day window;
          execute hard-delete now.
        </li>
        <li>
          <strong>Regulator instruction.</strong> The Information
          Regulator directs the platform to delete a specific
          record. Same posture.
        </li>
        <li>
          <strong>Deceased user, family request.</strong> When
          family provides a death certificate + proof of relation,
          immediate hard-delete is the dignified response.
        </li>
      </ul>

      <Callout type="warning" title="Don't skip the 30-day window without one of the three reasons">
        <p>
          The 30-day window exists to protect users from regretted
          deletions (someone deletes in anger, wants to come back
          next week). Skipping it without a court-order /
          regulator / deceased-user trigger removes that safety net.
          We default to the standard flow even when the user is
          insistent &mdash; the 30 days protect them more than they
          inconvenience them.
        </p>
      </Callout>

      <h2>What always survives hard-delete</h2>
      <p>
        Documented in the seeker-side article (<em>Deleting your
        account</em>) but worth restating for admin context:
      </p>
      <ul>
        <li>
          Aggregate cohort statistics the user was counted in.
        </li>
        <li>
          Confirmed placements with employers (the employer&rsquo;s
          retention record stays; identifying fields stripped).
        </li>
        <li>
          A small set of POPIA-required audit rows: consent grants,
          the deletion-confirmation row.
        </li>
      </ul>
      <p>
        If a future regulator request asks about the deleted user,
        we can prove the account existed + was lawfully erased; we
        cannot reconstruct the personal data, by design.
      </p>
    </HelpProse>
  );
}
