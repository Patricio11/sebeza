import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "team-roles-and-permissions",
  title: "Admin team roles + permissions",
  shortDescription:
    "Three admin tiers (Reviewer, Operator, Lead). What each can do, what each can't, and how to request an escalation.",
  category: "getting_started",
  keywords: [
    "roles",
    "permissions",
    "reviewer",
    "operator",
    "lead",
    "escalation",
    "team",
  ],
  related: [
    "what-sebenza-is-for-admins",
    "platform-settings-and-audit-trail",
    "when-to-suspend-an-account",
  ],
  surfaceLink: "/admin/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Admin authority is tiered. Every admin sits at one of three
        levels; the level shows on your Account page. The tiering is
        about scope of action, not hierarchy of opinion &mdash; a
        Reviewer&rsquo;s observation about a borderline case is
        equally valuable; a Lead just has the formal authority to
        execute the harder actions.
      </p>

      <h2>Reviewer</h2>
      <ul>
        <li>
          Open + read every queue (verifications, moderation, audit).
        </li>
        <li>
          Approve / reject seeker KYC submissions.
        </li>
        <li>
          Approve / reject qualification verifications where the
          institution is on the standard list.
        </li>
        <li>
          Read the audit log + oversight log.
        </li>
        <li>
          <strong>Cannot</strong> approve organisation KYC, suspend
          any account, flip a feature flag, edit the taxonomy beyond
          processing user suggestions.
        </li>
      </ul>

      <h2>Operator</h2>
      <p>
        Everything a Reviewer can do, plus:
      </p>
      <ul>
        <li>
          Approve organisation KYC (Sebenza employer / Verified
          employer / Employer-verified).
        </li>
        <li>
          Approve qualifications for non-standard institutions (with
          an attached reason note).
        </li>
        <li>
          Suspend accounts for moderation reasons (with mandatory
          reason note + escalation tag).
        </li>
        <li>
          Add or retire skills + professions in the taxonomy.
        </li>
        <li>
          <strong>Cannot</strong> flip feature flags, restore an
          account suspended by another Operator without Lead review,
          edit a province or city, view raw plaintext PII without an
          explicit KYC-review session.
        </li>
      </ul>

      <h2>Lead</h2>
      <p>
        Everything an Operator can do, plus:
      </p>
      <ul>
        <li>
          Flip feature flags + edit platform settings.
        </li>
        <li>
          Restore any account, including reversing another admin&rsquo;s
          suspension with an attached note.
        </li>
        <li>
          Edit the provinces / cities list (Stats SA aligned, edited
          rarely).
        </li>
        <li>
          Onboard new admin accounts + assign initial role tier.
        </li>
        <li>
          Approve high-sensitivity POPIA actions (account hard-delete
          before the 30-day window, manual audit-log redaction
          requests).
        </li>
      </ul>

      <Callout type="info" title="Escalation is one button">
        <p>
          When you hit an action that&rsquo;s above your tier, the
          console shows an <em>Escalate</em> button instead of the
          disabled action. Hitting it writes a structured request to
          your team&rsquo;s queue with the case context preloaded;
          your team lead sees it next time they open the console.
          Don&rsquo;t Slack the escalation; the structured queue is
          the auditable path.
        </p>
      </Callout>

      <h2>The permission matrix is in code</h2>
      <p>
        Permissions are enforced server-side via the role gate in{" "}
        <code>lib/auth/dal.ts</code>, not by hiding UI elements. A
        Reviewer who somehow constructs a POST request to the org-KYC
        approval endpoint gets a 403; the audit log records the
        attempt. The UI hides what you can&rsquo;t do as a courtesy,
        but the server is the truth.
      </p>
    </HelpProse>
  );
}
