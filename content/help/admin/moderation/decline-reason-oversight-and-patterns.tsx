import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "decline-reason-oversight-and-patterns",
  title: "Decline-reason oversight + patterns",
  shortDescription:
    "How seekers' decline reasons aggregate up to platform-level oversight without leaking individual choices. What patterns to escalate.",
  category: "moderation",
  keywords: [
    "decline reason",
    "oversight",
    "aggregate",
    "patterns",
    "discrimination",
    "salary",
    "employer behaviour",
  ],
  related: [
    "reading-profile-reports",
    "decline-reasons-aggregate-stats",
    "flagging-suspicious-activity",
  ],
  surfaceLink: "/admin/moderation",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Seekers decline invitations with one of six structured
        reasons. The employer sees the aggregate breakdown for their
        own vacancies (so they can fix salary bands, role specs,
        etc.). Admins see the aggregate breakdown <em>across all
        employers</em> with a different lens: are any employers
        drawing pattern-suspicious decline distributions that hint at
        underlying bad behaviour?
      </p>

      <h2>What you can see + what you cannot</h2>
      <p>
        The Moderation page has a Decline-reason oversight panel.
        It surfaces:
      </p>
      <ul>
        <li>
          Aggregate counts per reason per employer org, anonymised by
          seeker (you never see which seeker declined which
          invitation).
        </li>
        <li>
          Cells under 10 are suppressed (k-anonymity) so a small
          employer can&rsquo;t be reverse-engineered to find
          individual seekers.
        </li>
        <li>
          Time-windowed (last 30, 90, or 365 days).
        </li>
      </ul>
      <p>
        You never see individual decline reasons attributed to named
        seekers. The structured reasons are private to the seeker /
        employer pair; oversight is on the pair-aggregate, not the
        pair itself.
      </p>

      <h2>Patterns to escalate</h2>
      <ul>
        <li>
          <strong>Salary-band-not-competitive dominating one
          employer.</strong> Usually not a moderation issue &mdash;
          the employer should fix their bands. Surface it to them
          via the platform&rsquo;s normal decline-reason employer
          card; no admin action needed.
        </li>
        <li>
          <strong>Already-employed dominating one employer.</strong>{" "}
          The employer is repeatedly inviting people who are already
          working elsewhere. Suggests they&rsquo;re using the matcher
          to sound out the market rather than to hire. Not yet a
          moderation issue but worth flagging.
        </li>
        <li>
          <strong>Wrong-type-of-role dominating one employer.</strong>{" "}
          The employer&rsquo;s vacancy spec is wrong &mdash; they&rsquo;re
          inviting full-time candidates for contract roles or vice
          versa. Same posture: surface to them.
        </li>
        <li>
          <strong>Sustained pattern of declines + a sudden
          off-platform-contact report.</strong> Escalate immediately.
          The combination suggests an employer is fishing for contact
          details rather than genuinely hiring.
        </li>
      </ul>

      <Callout type="warning" title="Decline-reason data is not enough on its own to suspend">
        <p>
          A dominant reason is a signal, not a verdict. Many of the
          patterns above have legitimate explanations &mdash; a
          start-up paying below market is not running a discrimination
          campaign. Use the panel to <em>investigate</em>, not to
          <em> conclude</em>. Suspensions require concrete behaviour
          (reports, messages, audit-log activity) supported by the
          pattern, not pattern alone.
        </p>
      </Callout>
    </HelpProse>
  );
}
