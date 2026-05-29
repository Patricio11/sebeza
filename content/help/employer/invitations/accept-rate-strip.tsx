import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "accept-rate-strip",
  title: "Reading the accept-rate strip",
  shortDescription:
    "Five buckets, one percentage. How the math works + how to read the signal honestly.",
  category: "invitations",
  keywords: [
    "accept rate",
    "acceptance",
    "percentage",
    "analytics",
    "metrics",
    "sent",
    "accepted",
    "declined",
    "pending",
    "expired",
  ],
  related: [
    "invitation-lifecycle",
    "follow-up-nudges",
    "bulk-invite",
  ],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        On every vacancy detail page, above the existing content: an
        Invitation outcomes strip showing five counts + one percentage.
        It&rsquo;s a quick read of how the vacancy&rsquo;s pipeline is
        actually behaving.
      </p>

      <h2>The five buckets</h2>
      <ul>
        <li>
          <strong>Sent</strong> &mdash; the total number of invitations
          on this vacancy (every state).
        </li>
        <li>
          <strong>Accepted</strong> &mdash; <em>accepted</em> +{" "}
          <em>accepted_with_notice</em>. Both count as a yes.
        </li>
        <li>
          <strong>Declined</strong> &mdash; <em>declined</em> +{" "}
          <em>reconsidering</em>. Reconsidering is a transient sub-state
          of declined; we count it as declined for the headline figure
          (it&rsquo;s still a no, even if it&rsquo;s a reversible one).
        </li>
        <li>
          <strong>Pending</strong> &mdash; <em>invited</em> only.
          Awaiting response within the expiry window.
        </li>
        <li>
          <strong>Expired</strong> &mdash; <em>expired</em> +{" "}
          <em>withdrawn</em>. Both mean &ldquo;no further action
          expected from the pipeline.&rdquo;
        </li>
      </ul>
      <p>
        The five buckets sum to <strong>Sent</strong> exactly. No
        invitation falls through the cracks.
      </p>

      <h2>The acceptance percentage</h2>
      <p>
        Top-right of the strip:{" "}
        <em>&ldquo;N% acceptance on closed responses.&rdquo;</em>
        The math is deliberately:
      </p>
      <p>
        <strong>acceptance = Accepted / (Accepted + Declined)</strong>
      </p>
      <p>
        Pending + Expired are <strong>not</strong> in the denominator.
        Including them would make the rate look worse every time
        someone slow-walks a response. The honest figure is{" "}
        <em>&ldquo;of the people who actually responded, what fraction
        said yes?&rdquo;</em>
      </p>

      <Callout type="warning" title="No responses yet means no percentage">
        <p>
          When there are no closed responses (everything is Pending or
          Sent), the strip shows{" "}
          <em>&ldquo;No responses yet&rdquo;</em> instead of 0%. A
          0% acceptance rate would falsely imply that some people said
          no &mdash; we&rsquo;d rather show nothing than mislead.
        </p>
      </Callout>

      <h2>Reading the signal</h2>
      <p>
        A few common patterns + what to do with them:
      </p>
      <ul>
        <li>
          <strong>High Pending + low Accepted/Declined</strong> &mdash;
          you sent the invites recently. Wait for the window. If the
          vacancy has follow-up nudges enabled, the strip footnote will
          remind you the cron will fire at day 7.
        </li>
        <li>
          <strong>High Declined + the decline-reasons widget on the
          vacancy list page shows {`"salary_not_competitive"`}</strong>{" "}
          &mdash; revisit the salary band before re-inviting more
          candidates.
        </li>
        <li>
          <strong>High Expired</strong> &mdash; the candidates
          weren&rsquo;t engaged enough to respond. Check your match
          requirements; you may be casting too wide a net.
        </li>
        <li>
          <strong>Low overall Sent</strong> &mdash; the supply line at
          the top of the match page tells you how many candidates
          matched; if Sent is much lower than that, you&rsquo;re only
          inviting a fraction. Open Find Matches + invite more if the
          role is real.
        </li>
      </ul>

      <h2>Privacy</h2>
      <p>
        The strip is vacancy-private. No cross-vacancy comparison, no
        per-seeker breakdown. The /insights surface aggregates the
        national picture; the per-vacancy strip stays within your
        organisation. The data is yours.
      </p>
    </HelpProse>
  );
}
