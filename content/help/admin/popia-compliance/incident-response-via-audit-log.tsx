import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "incident-response-via-audit-log",
  title: "Incident response via the audit log",
  shortDescription:
    "When a user reports unauthorised access: how to reconstruct the timeline, what to communicate, when to file an Information Regulator notification.",
  category: "popia_compliance",
  keywords: [
    "incident",
    "breach",
    "unauthorised access",
    "audit",
    "timeline",
    "regulator",
    "notification",
  ],
  related: [
    "understanding-the-audit-log-structure",
    "flagging-suspicious-activity",
    "handling-data-subject-requests",
  ],
  surfaceLink: "/admin/audit-log",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A user reports their data was accessed when it shouldn&rsquo;t
        have been &mdash; an employer they don&rsquo;t recognise
        showing up in their activity feed, a certificate downloaded
        by an org they never granted consent to, an email received
        outside a documented flow. These are the moments the audit
        log earns its keep.
      </p>

      <h2>The four-step incident response</h2>
      <ol>
        <li>
          <strong>Acknowledge within 24 hours.</strong> Even if you
          haven&rsquo;t investigated yet. The acknowledgement says
          &ldquo;we received your report at HH:MM on YYYY-MM-DD;
          we&rsquo;re investigating; we&rsquo;ll respond within 7
          days.&rdquo; That&rsquo;s it.
        </li>
        <li>
          <strong>Reconstruct the timeline.</strong> Open Audit log;
          filter by the reporter&rsquo;s account ID + the date
          range. Walk the rows in order. The narrative you&rsquo;re
          looking for: was there an authorised event we missed
          telling the user about (legitimate) or was there an action
          without lawful basis (incident)?
        </li>
        <li>
          <strong>Disposition.</strong> Three outcomes:
          <ul>
            <li>
              <em>Misunderstanding:</em> the action was lawful + the
              user just didn&rsquo;t recognise the org name. Respond
              to the user explaining what happened + why.
            </li>
            <li>
              <em>Internal error:</em> a bug or process failure caused
              data to flow where it shouldn&rsquo;t have, but no
              actor accessed it with intent. Engineering ticket +
              user notification + post-mortem.
            </li>
            <li>
              <em>Confirmed breach:</em> data was accessed without
              lawful basis by a third party with intent. Trigger
              the breach-notification flow below.
            </li>
          </ul>
        </li>
        <li>
          <strong>Respond to the user.</strong> Whichever outcome.
          The user gets a written response inside 7 days with the
          finding + the action taken. Vague responses
          (&ldquo;we&rsquo;ve looked into it&rdquo;) are not
          acceptable; specific (&ldquo;the audit log shows X
          accessed Y on Z under W consent&rdquo;) is what POPIA s.23
          requires.
        </li>
      </ol>

      <h2>The Information Regulator notification</h2>
      <p>
        POPIA s.22 requires notification of the Information Regulator
        and the affected data subject when a breach&rsquo;s scope is
        likely to cause real harm. The Regulator&rsquo;s timeline is
        &ldquo;as soon as reasonably possible&rdquo; (typically read
        as 72 hours). The decision to file is Lead-tier; if
        you&rsquo;re investigating an incident and the disposition
        looks like <em>confirmed breach</em>, escalate to your Lead
        before you draft the user response &mdash; the user
        notification + the Regulator notification go out together.
      </p>

      <Callout type="warning" title="Do not delete or amend audit rows during an incident">
        <p>
          The audit log is the platform&rsquo;s evidence of what
          happened. Pruning rows because they&rsquo;re
          &ldquo;misleading&rdquo; or adding context rows because
          they&rsquo;d &ldquo;clarify&rdquo; is tampering with the
          record. Even if the tampering would honestly improve the
          investigation, it undermines every future investigation.
          The log is what it is; document your reasoning in the
          case, not by editing the log.
        </p>
      </Callout>
    </HelpProse>
  );
}
