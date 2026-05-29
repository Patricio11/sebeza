import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "handling-data-subject-requests",
  title: "Handling data subject requests (DSRs)",
  shortDescription:
    "The five DSR types under POPIA, the SLA for each, and the structured workflow that turns a request into an audit-safe response.",
  category: "popia_compliance",
  keywords: [
    "dsr",
    "popia",
    "section 23",
    "data subject",
    "rights",
    "access",
    "correction",
    "deletion",
  ],
  related: [
    "processing-export-requests",
    "deletion-requests-right-to-erasure",
    "incident-response-via-audit-log",
  ],
  surfaceLink: "/admin/users",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        POPIA grants every data subject five distinct rights. Each
        triggers a different workflow in the admin console; each has
        a different statutory response window. As a Lead-tier admin
        you handle DSRs directly; Operators read-only.
      </p>

      <h2>The five rights</h2>
      <ul>
        <li>
          <strong>Right of access (s.23).</strong> &ldquo;Tell me
          what you hold about me.&rdquo; SLA: 30 days. Most
          requests are self-served via the seeker / employer
          dashboard export button; admin involvement is only when
          the user can&rsquo;t sign in or asks for an extended
          export with historical data.
        </li>
        <li>
          <strong>Right to correction (s.24).</strong> &ldquo;You
          have something wrong about me; fix it.&rdquo; SLA: 30 days.
          Almost always self-serviceable via the profile editor.
          Admin involvement is for cases where the wrong data is in
          an audit row the user can&rsquo;t edit.
        </li>
        <li>
          <strong>Right to deletion (s.24(1)(b)).</strong> &ldquo;Delete
          everything you hold about me.&rdquo; SLA: 30 days for soft-
          delete; hard-delete runs at 30 days from the soft-delete
          point. See <em>Deletion requests + right to erasure</em>.
        </li>
        <li>
          <strong>Right to object to processing (s.11(3)).</strong>{" "}
          &ldquo;Stop using my data for purpose X.&rdquo; Triggered
          when a user withdraws a consent that was the lawful basis
          for processing. Usually self-serviced via consent toggles;
          admin only when a user objects to a processing the
          platform does but the toggle UI doesn&rsquo;t expose.
        </li>
        <li>
          <strong>Right to lodge a complaint (s.74).</strong>{" "}
          Complaints go to the Information Regulator if the user
          isn&rsquo;t satisfied with our response. We don&rsquo;t
          process complaints internally; we acknowledge receipt and
          cooperate with the Regulator&rsquo;s investigation.
        </li>
      </ul>

      <h2>The workflow</h2>
      <p>
        A DSR enters the admin console either via the user-side
        self-serve button or via a formal letter to our compliance
        address (in which case Operations forwards it into the
        console as a manual case). The case carries:
      </p>
      <ul>
        <li>
          DSR type, requesting user (verified identity), date of
          request.
        </li>
        <li>
          Statutory response deadline (auto-computed; visible as
          a red countdown badge inside 7 days of expiry).
        </li>
        <li>
          A response template that the requesting user will see when
          you disposition.
        </li>
        <li>
          A free-text internal note field that does NOT go to the
          user.
        </li>
      </ul>

      <Callout type="warning" title="The deadline is statutory">
        <p>
          The 30-day SLA is not internal &mdash; it&rsquo;s the
          response window POPIA mandates. Missing the deadline is a
          regulatory violation, not a missed internal goal. The
          countdown badge on the case turns red 7 days before; if a
          case is still open with 3 days left, escalate to your
          Lead immediately.
        </p>
      </Callout>

      <h2>What gets logged</h2>
      <p>
        Every DSR case writes audit rows for: case opened, case
        viewed (per admin per session), disposition issued. Internal
        notes are stored encrypted + accessible only to admins on
        the case; they are <em>not</em> visible to the requesting
        user even on a subsequent s.23 request (they are
        attorney-work-product equivalent: our internal reasoning,
        not personal data we hold about the user).
      </p>
    </HelpProse>
  );
}
