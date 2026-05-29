import {
  HelpProse,
  Callout,
  Steps,
  Step,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "inviting-team",
  title: "Inviting team members",
  shortDescription:
    "How team invites work + what happens when the invitee is already a Sebenza user.",
  category: "organisation",
  keywords: [
    "invite team",
    "team invite",
    "member",
    "invite member",
    "add member",
    "colleague",
    "team",
  ],
  related: [
    "team-roles",
    "two-factor",
    "kyc",
  ],
  surfaceLink: "/employer/team",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Once your organisation is verified (KYC complete), invite
        colleagues to join your team at{" "}
        <strong>/employer/team</strong>. The flow is email-based; the
        invitee gets a signup link valid for 14 days.
      </p>

      <h2>Sending an invite</h2>
      <Steps>
        <Step number={1}>
          <p>
            On <strong>/employer/team</strong>, hit{" "}
            <strong>Invite member</strong>.
          </p>
        </Step>
        <Step number={2}>
          <p>
            Enter the colleague&rsquo;s work email + pick a role
            (Owner / Recruiter / Viewer). Read the team-roles article
            first if you&rsquo;re unsure which one applies.
          </p>
        </Step>
        <Step number={3}>
          <p>
            Submit. The platform sends an email to the address; the
            row appears in the Team list with a <em>pending</em> pill
            until they accept.
          </p>
        </Step>
      </Steps>

      <h2>What the invitee sees</h2>
      <p>
        If the email isn&rsquo;t a Sebenza user yet, the link leads to
        a sign-up flow that creates their account + joins your
        organisation in one step. If the email IS already a Sebenza
        user (e.g. they signed up earlier as a seeker), they sign in
        as usual + accept the org-membership; their existing account
        is reused.
      </p>
      <Callout type="info" title="Same person, two roles">
        <p>
          A user can be both a seeker AND a team member of an employer
          org &mdash; the platform doesn&rsquo;t prevent dual roles.
          Their /dashboard and /employer surfaces stay separate; they
          switch between them via the role chip in the global nav. No
          data crosses between the two sides.
        </p>
      </Callout>

      <h2>Tracking + managing invites</h2>
      <p>
        On <strong>/employer/team</strong>, the Pending invites section
        shows everyone you&rsquo;ve invited who hasn&rsquo;t accepted
        yet. Each row shows:
      </p>
      <ul>
        <li>email + chosen role</li>
        <li>invite date + days until expiry</li>
        <li>Resend (re-sends the email; resets the 14-day clock)</li>
        <li>Revoke (cancels the invite; the link stops working)</li>
      </ul>

      <h2>Roles can change later</h2>
      <p>
        An Owner can change any team member&rsquo;s role any time
        without re-inviting. The change writes an audit row + the
        member sees the new role on their next page load. You
        don&rsquo;t need to remove + re-invite for a role swap.
      </p>

      <Callout type="warning" title="Don't share invite links">
        <p>
          Each invite link is single-use + tied to the email address
          on the invite. Sharing it doesn&rsquo;t work &mdash; the
          signup form checks the email matches. Always send via the
          platform&rsquo;s own email; don&rsquo;t forward.
        </p>
      </Callout>
    </HelpProse>
  );
}
