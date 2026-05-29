import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "vacancy-invitations-explained",
  title: "Vacancy invitations explained",
  shortDescription:
    "What an invitation is, how it differs from a job ad, what arrives in your inbox, and what each piece of metadata signals.",
  category: "invitations",
  keywords: [
    "invitation",
    "vacancy",
    "invite",
    "inbox",
    "job",
    "match",
    "employer",
  ],
  related: [
    "how-to-accept-decline-or-reconsider",
    "decline-reasons-and-what-they-mean",
    "what-consent-purposes-mean",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A vacancy invitation is the platform&rsquo;s version of
        &ldquo;an employer wants to talk to you about a specific
        role.&rdquo; It&rsquo;s not an application from your side; the
        employer matched you against their private vacancy spec and
        chose to invite you specifically.
      </p>

      <h2>What you see in the inbox</h2>
      <p>
        Each invitation card carries:
      </p>
      <ul>
        <li>
          <strong>Organisation name + verification chip.</strong> Sebenza
          employer / Verified employer / Employer-verified  this
          tells you what level of due diligence the platform has done
          on them.
        </li>
        <li>
          <strong>Role title.</strong> The vacancy&rsquo;s title.
        </li>
        <li>
          <strong>Profession + seniority.</strong> The matcher axes the
          employer set on the vacancy.
        </li>
        <li>
          <strong>Province.</strong> Where the role is located.
        </li>
        <li>
          <strong>State badge.</strong> Invited / Accepted / Declined
          / Reconsidering / Withdrawn / Expired. See <em>How to accept,
          decline, or reconsider</em> for the full state machine.
        </li>
        <li>
          <strong>Invited date.</strong> When the employer sent the
          invite.
        </li>
        <li>
          <strong>Responds-by date (if set).</strong> Some employers set
          an invite-expiry window; if you don&rsquo;t respond by that
          date, the invitation auto-expires. Others leave invitations
          open indefinitely.
        </li>
      </ul>

      <h2>The personal note</h2>
      <p>
        Some invitations carry a short personal note (up to 200
        characters) from the employer. It shows below the role title
        and is the part you should actually read: it&rsquo;s often the
        signal of whether the employer is sending a bulk invite or
        actively interested in your specific profile.
      </p>

      <Callout type="info" title="No public job ad exists">
        <p>
          Invitations are <strong>not</strong> applications you sent.
          Sebenza doesn&rsquo;t have public job ads; you don&rsquo;t
          apply to anything. The employer found you, decided you fit
          their spec, and reached out. If you accept, you&rsquo;ve
          opened a conversation; if you decline, the door is closed for
          that specific vacancy.
        </p>
      </Callout>

      <h2>Why some invites land and others don&rsquo;t</h2>
      <p>
        Two gates control whether an employer can invite you at all.
        Your <em>searchability</em> consent determines whether
        you&rsquo;re in the matcher&rsquo;s pool. Your{" "}
        <em>vacancy-matching</em> consent determines whether the
        platform will let an employer fire an invitation at you. Both
        live on the Privacy &amp; consent page. If vacancy-matching is
        off, you can still be found in search, but the invite button
        on your dossier will be greyed out for employers.
      </p>

      <DashboardLink href="/dashboard/invitations">Open invitations inbox</DashboardLink>
    </HelpProse>
  );
}
