import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "managing-notification-preferences",
  title: "Managing notification preferences",
  shortDescription:
    "Eight notification kinds + the email channel toggle. What each one signals + which ones you should keep on no matter what.",
  category: "account",
  keywords: [
    "notification",
    "preferences",
    "email",
    "in-app",
    "channel",
    "settings",
  ],
  related: [
    "vacancy-invitations-explained",
    "contact-reveal-how-it-works",
    "uploading-certificates-and-verification",
  ],
  surfaceLink: "/dashboard/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Account page has a notification-preferences panel listing
        every kind of notification the platform sends seekers. Each one
        is on by default; you can flip the ones you don&rsquo;t want
        off, individually. The email channel as a whole can also be
        toggled &mdash; everything still appears in-app, but no email
        goes out for any kind.
      </p>

      <h2>The eight kinds</h2>
      <ul>
        <li>
          <strong>contact.revealed</strong> &mdash; an employer
          received your contact details after you granted their
          request. You almost always want this on; it&rsquo;s your
          confirmation the reveal actually completed.
        </li>
        <li>
          <strong>document.downloaded</strong> &mdash; an employer
          downloaded one of your certificates after your consent. Keep
          on so you have visibility on when files leave the platform.
        </li>
        <li>
          <strong>placement.confirmed</strong> &mdash; an employer
          logged a placement of you. Almost always relevant; keep on.
        </li>
        <li>
          <strong>qualification.verified</strong> &mdash; one of your
          certificates moved from pending to verified. Important if
          you&rsquo;re tracking verification progress.
        </li>
        <li>
          <strong>qualification.rejected</strong> &mdash; one of your
          certificates was rejected with a reason. You need this on to
          fix the issue and re-submit.
        </li>
        <li>
          <strong>profile.viewed</strong> &mdash; an employer opened
          your dossier. The noisiest kind; some seekers turn it off
          and rely on the Activity ledger instead.
        </li>
        <li>
          <strong>status.stale.warning</strong> &mdash; the platform
          noticed your status confirmation is approaching 90 days old
          and you&rsquo;re about to be down-ranked. Keep on; the
          warning is the easiest fix.
        </li>
        <li>
          <strong>account.suspended / restored</strong> &mdash;
          admin-level account changes. Always on; can&rsquo;t be
          disabled because they&rsquo;re security-critical.
        </li>
      </ul>

      <Callout type="warning" title="Some kinds can't be disabled">
        <p>
          Anything with a security or compliance purpose is mandatory:
          <em> account.suspended</em>, <em>account.restored</em>,
          <em> consent.text_updated</em> (when the POPIA consent copy
          changes and you need to re-confirm), and{" "}
          <em>account.data_export</em> (so you can spot exports you
          didn&rsquo;t trigger). These don&rsquo;t appear in the panel
          as toggleable.
        </p>
      </Callout>

      <h2>The email channel toggle</h2>
      <p>
        Above the per-kind toggles is one master switch:{" "}
        <em>Email channel</em>. Off = no emails at all, regardless of
        per-kind preferences. In-app notifications still appear on the
        Notifications page. Useful if you don&rsquo;t want Sebenza
        cluttering your work inbox; risky if you&rsquo;re not actively
        signed in often, because invitations and contact-reveal
        requests have time-sensitive windows.
      </p>

      <h2>What gets logged when you change a preference</h2>
      <p>
        Each toggle change writes an audit row capturing the kind, the
        new state, and the timestamp. Standard POPIA transparency &mdash;
        you can pull this from your data export and see exactly when
        you turned each one on or off.
      </p>

      <DashboardLink href="/dashboard/account">Open notification preferences</DashboardLink>
    </HelpProse>
  );
}
