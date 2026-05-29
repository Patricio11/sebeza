import {
  HelpProse,
  Callout,
  Steps,
  Step,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "contact-reveal-how-it-works",
  title: "Contact reveal: how it works",
  shortDescription:
    "Employers can't see your email or phone until you actively reveal it. The four-step flow, plus what gets audit-logged.",
  category: "privacy",
  keywords: [
    "contact",
    "reveal",
    "email",
    "phone",
    "request",
    "audit",
    "privacy",
  ],
  related: [
    "what-consent-purposes-mean",
    "your-public-profile-url",
    "understanding-your-activity-ledger",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Your email and phone number are <strong>never</strong> visible
        to employers by default &mdash; not on your public profile, not
        on your dossier, not after they invite you. Contact details
        unlock through an explicit two-step reveal you control.
      </p>

      <h2>The four-step flow</h2>
      <Steps>
        <Step number={1}>
          <p>
            <strong>The employer requests contact.</strong> From your
            dossier or from an accepted invitation, the employer hits
            &ldquo;Request contact details.&rdquo; You get a
            notification (in-app + email if you have email channel on).
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>You decide.</strong> The request lands in your
            Activity feed and in the linked invitation thread. You
            choose <em>Reveal</em>, <em>Decline</em>, or <em>Reveal
            with redaction</em> (reveal email only, not phone, or
            vice-versa).
          </p>
        </Step>
        <Step number={3}>
          <p>
            <strong>The reveal is recorded.</strong> If you choose
            reveal, the platform writes one audit row capturing
            who-revealed-what-to-whom + when. The employer gets a
            notification and the contact details land on their dossier
            view for that one organisation.
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>You can see the trail.</strong> The reveal shows up
            in your Activity ledger as a <em>contact.reveal</em> row.
            It&rsquo;s also exportable via your POPIA Section 23 data
            export.
          </p>
        </Step>
      </Steps>

      <h2>When the request button is greyed out</h2>
      <p>
        Two reasons:
      </p>
      <ul>
        <li>
          Your <em>Contact reveal</em> consent is off. Flipping it off
          disables every employer&rsquo;s ability to request contact
          details &mdash; the button is greyed out everywhere.
        </li>
        <li>
          The employer hasn&rsquo;t earned a reveal yet. Contact
          requests are only enabled after either (a) you accepted one
          of their invitations or (b) they explicitly opened your
          dossier and there&rsquo;s a 30-day reveal window per
          POPIA-compatible &ldquo;legitimate interest&rdquo; posture.
        </li>
      </ul>

      <Callout type="info" title="The 30-day window matters">
        <p>
          Once an employer requests contact and you reveal, the reveal
          is scoped to that organisation for 30 days. After 30 days,
          they have to request again (and you have to confirm again)
          if they want fresh contact details. This is what stops your
          email living in someone&rsquo;s CRM forever.
        </p>
      </Callout>
    </HelpProse>
  );
}
