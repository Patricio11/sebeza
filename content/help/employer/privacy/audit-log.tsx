import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "audit-log",
  title: "Audit log: who saw what, when",
  shortDescription:
    "Every PII-touching action your team takes is recorded. How to access your own org's trail.",
  category: "privacy",
  keywords: [
    "audit",
    "audit log",
    "trail",
    "history",
    "who did",
    "review",
    "compliance",
    "popia",
  ],
  related: [
    "what-we-hold",
    "dossier-reveal",
    "kyc",
  ],
  surfaceLink: "/employer/organisation",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Every PII-touching action your team takes on Sebenza writes a
        row in the platform&rsquo;s audit log. Searches, contact
        reveals, invitations, placement creates, status changes, note
        edits, KYC submissions &mdash; all logged with actor, subject,
        timestamp, and structured meta.
      </p>

      <h2>What lands in the audit</h2>
      <p>
        The audit kinds your org writes most often:
      </p>
      <ul>
        <li>
          <em>search.profiles</em> &mdash; every search query (filters
          + result count, never the matched IDs).
        </li>
        <li>
          <em>profile.contact.reveal</em> &mdash; every dossier you
          open. The 30-day Mark-as-Hired reveal-gate reads this.
        </li>
        <li>
          <em>vacancy.create / vacancy.update / vacancy.status.change</em>{" "}
          &mdash; every vacancy lifecycle event.
        </li>
        <li>
          <em>vacancy.invite / vacancy.invite.skip / vacancy.invite.
          withdraw / vacancy.invite.expire / vacancy.invite.followup</em>{" "}
          &mdash; full invitation lifecycle.
        </li>
        <li>
          <em>placement.confirm / placement.delete / placement.status.
          check / placement.note.update / placement.departed</em>{" "}
          &mdash; full placement lifecycle.
        </li>
        <li>
          <em>profile.shortlist.add / profile.shortlist.remove</em>{" "}
          &mdash; talent-pool changes.
        </li>
        <li>
          <em>org.kyc.submit / org.documents.submitted</em> &mdash;
          KYC events. Admin reviews write their own kinds.
        </li>
      </ul>

      <h2>Per-surface audit excerpts</h2>
      <p>
        Several surfaces surface a small audit slice in-context:
      </p>
      <ul>
        <li>
          <strong>Placement detail page</strong> &mdash; the Activity
          panel shows the last 10 placement-related rows for that
          placement ID + profile.
        </li>
        <li>
          <strong>Vacancy detail page</strong> &mdash; the invitation
          panel shows full lifecycle states; the placements panel
          links to per-placement detail with its own activity.
        </li>
        <li>
          <strong>Dossier page</strong> &mdash; (admin-only on
          /admin/* surfaces); the in-product seeker activity log
          surfaces reveals + invitations + status changes from your
          org&rsquo;s perspective.
        </li>
      </ul>

      <Callout type="info" title="The seeker also sees audit events">
        <p>
          From the seeker&rsquo;s /dashboard/activity page, they see
          every <em>profile.contact.reveal</em>, every shortlist add,
          every invitation, every placement event your org wrote about
          them. Two-way transparency &mdash; the same audit data feeds
          both sides.
        </p>
      </Callout>

      <h2>Exporting your org&rsquo;s audit</h2>
      <p>
        For compliance reviews or internal investigations, the full
        audit can be exported via{" "}
        <strong>/api/admin/oversight/export</strong> (admin-mediated).
        Contact Sebenza support; the request is logged + the export
        runs against your org_id scope.
      </p>
      <p>
        Most teams never need to export. The in-product audit
        excerpts cover ~95% of day-to-day &ldquo;who did what&rdquo;
        questions.
      </p>

      <Callout type="warning" title="The audit is durable">
        <p>
          Audit rows are <strong>never deleted</strong> on user action.
          Org or member deletion clears editable surfaces but keeps the
          audit trail (POPIA legal-basis + Verification-Honesty
          requirements). The audit retention policy lives in the
          platform-settings; default is indefinite for compliance.
        </p>
      </Callout>

      <h2>The PII flag</h2>
      <p>
        Some audit meta carries PII (personal notes, internal notes,
        decline-reason text, the SHA-256 hash of a third-party contact
        email from a Phase 9.23 verification consent). Those rows
        carry <em>meta.notePii = true</em> so data-export sweeps treat
        them correctly &mdash; the audit retains the PII for legal
        basis + Verification-Honesty; the export pipeline applies the
        right redaction policy on request.
      </p>
    </HelpProse>
  );
}
