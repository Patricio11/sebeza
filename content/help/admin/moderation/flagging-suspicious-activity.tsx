import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "flagging-suspicious-activity",
  title: "Flagging suspicious activity",
  shortDescription:
    "Eight behavioural patterns the audit log can surface  what each one likely means + when to investigate versus escalate.",
  category: "moderation",
  keywords: [
    "suspicious",
    "fraud",
    "fishing",
    "audit",
    "patterns",
    "anomaly",
    "scraping",
    "phishing",
  ],
  related: [
    "decline-reason-oversight-and-patterns",
    "understanding-the-audit-log-structure",
    "when-to-suspend-an-account",
  ],
  surfaceLink: "/admin/audit-log",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The audit log surfaces eight behavioural patterns that
        warrant investigation. Most turn out to be innocent
        (large recruiting agency, legitimate bulk operations). A few
        are not. The patterns are documented so a tired admin can
        recognise them at 11pm; investigation is what tells you
        which case you have.
      </p>

      <h2>The eight patterns</h2>
      <ul>
        <li>
          <strong>Burst of profile views from one employer.</strong>{" "}
          50+ dossiers opened in an hour. Usually a recruiter
          working a vacancy; flag for follow-up if the matching
          vacancy isn&rsquo;t open + active.
        </li>
        <li>
          <strong>Contact-reveal requests with no follow-on invitation
          or placement.</strong> Pattern of revealed contacts without
          subsequent invitation activity suggests off-platform
          poaching. Escalate.
        </li>
        <li>
          <strong>Multiple failed sign-in attempts on admin
          accounts.</strong> Anything over 5 attempts in an hour on
          an admin account is a security incident. Escalate to
          engineering on-call immediately, not as a moderation case.
        </li>
        <li>
          <strong>Account created + extensive profile view in &lt;30
          minutes.</strong> A brand-new employer org racking up
          dossier opens before placing any vacancy. Either eager or
          fishing; check whether the org KYC is in progress + how
          targeted the views look.
        </li>
        <li>
          <strong>Same IP family across multiple newly-created
          employer accounts.</strong> Suggests sock-puppet org
          creation. Cross-check the CIPC numbers + escalate.
        </li>
        <li>
          <strong>Off-hours admin activity from one admin
          account.</strong> Unusual personal-account pattern (work
          hours suddenly include 3am). Could be travel; could be
          compromise. Check with the admin out-of-band before
          assuming the worst.
        </li>
        <li>
          <strong>Gov user repeatedly looking up the same employer
          org across days.</strong> The Oversight log&rsquo;s
          headline pattern. See <em>Monitoring gov lookups for
          patterns</em>.
        </li>
        <li>
          <strong>Bulk data export by an admin without a documented
          ticket.</strong> Every admin data export should map to a
          POPIA DSR or a documented compliance task. Exports without
          one warrant a conversation, not necessarily an escalation.
        </li>
      </ul>

      <Callout type="warning" title="The audit log is reactive; you are not the IDS">
        <p>
          You will not catch every bad pattern by patrolling the
          audit log. The platform&rsquo;s engineering team runs
          automated anomaly detection that surfaces a few of these
          (admin off-hours, failed-sign-in bursts, IP-family
          patterns) as system notifications. Don&rsquo;t feel obliged
          to be human IDS; your job is to investigate well when
          something is flagged, not to find every needle yourself.
        </p>
      </Callout>

      <h2>How to investigate</h2>
      <ol>
        <li>
          Open the audit log; filter by the suspect actor + date
          range.
        </li>
        <li>
          Read the actions in sequence. Look for the narrative: what
          was the user trying to accomplish?
        </li>
        <li>
          Check the user&rsquo;s message history (where applicable)
          + their KYC documents (for orgs) + their CIPC registration.
        </li>
        <li>
          Either close the investigation with a note (&ldquo;benign
          pattern: large recruiting agency&rdquo;) or escalate with
          a structured handoff to your Lead.
        </li>
      </ol>
    </HelpProse>
  );
}
