import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "when-to-suspend-an-account",
  title: "When to suspend an account",
  shortDescription:
    "Three suspension tiers (warn, restrict, full suspend) + the bright-line behaviours that require each. Operator-tier action.",
  category: "moderation",
  keywords: [
    "suspend",
    "suspension",
    "warn",
    "restrict",
    "moderation",
    "bright line",
    "policy",
  ],
  related: [
    "reading-profile-reports",
    "suspension-appeals-and-restoration",
    "flagging-suspicious-activity",
  ],
  surfaceLink: "/admin/users",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Suspension is an Operator-tier action. Reviewers can flag a
        case for an Operator&rsquo;s attention; Operators can execute
        one of three tiers. The tiers are not a ladder you climb;
        they&rsquo;re three different responses for three different
        situations.
      </p>

      <h2>The three tiers</h2>
      <ul>
        <li>
          <strong>Warn.</strong> The account stays fully functional;
          a notification + email goes to the user explaining what
          behaviour was reported, what policy applies, and what
          happens next time. Use when the behaviour is borderline,
          the user is otherwise active in good faith, or context
          plausibly explains it.
        </li>
        <li>
          <strong>Restrict.</strong> The account stays signed-in
          but cannot send invitations (employer) or accept invitations
          (seeker), and the profile is invisible to search. Use as a
          cooling-off period for repeated low-grade reports while the
          user is given a chance to respond. Default duration is 7
          days; the system auto-restores at the end unless escalated.
        </li>
        <li>
          <strong>Full suspend.</strong> The account is signed out +
          cannot sign in; the profile returns 404. Used only for
          bright-line violations or pending an investigation.
          Indefinite duration; only a Lead can restore.
        </li>
      </ul>

      <h2>Bright-line behaviours (full suspend, no warn first)</h2>
      <ul>
        <li>
          Confirmed identity fraud (KYC submission with someone
          else&rsquo;s documents).
        </li>
        <li>
          Threats of violence in messages.
        </li>
        <li>
          Repeated discriminatory invitation patterns confirmed by
          decline-reason data across vacancies.
        </li>
        <li>
          Off-platform contact-detail harvesting (employer pattern of
          contact reveals followed by complaints they tried to bill,
          phish, or scam seekers).
        </li>
        <li>
          POPIA breach: confirmed unauthorised data sharing of seeker
          data by an employer with a third party.
        </li>
      </ul>

      <h2>What suspension does NOT do</h2>
      <ul>
        <li>
          <strong>It does not delete the account.</strong> Data stays
          intact; reversal is one click for a Lead.
        </li>
        <li>
          <strong>It does not erase audit history.</strong> All
          actions taken before suspension remain in the audit log.
        </li>
        <li>
          <strong>It does not notify other users.</strong> If a
          suspended employer had pending invitations, those move to{" "}
          <em>withdrawn</em>; seekers see the standard withdrawal
          notification, not the suspension reason.
        </li>
      </ul>

      <Callout type="warning" title="Document the chain of reasoning">
        <p>
          A suspend action without a reason note in the audit row is
          not done. Every disposition should let a future reviewer
          (or a court) reconstruct exactly why you took the action.
          &ldquo;Multiple reports&rdquo; is not a reason; the
          specific behaviour + the report numbers you reviewed is.
        </p>
      </Callout>
    </HelpProse>
  );
}
