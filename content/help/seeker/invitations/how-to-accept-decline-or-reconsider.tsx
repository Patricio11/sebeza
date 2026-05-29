import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "how-to-accept-decline-or-reconsider",
  title: "How to accept, decline, or reconsider",
  shortDescription:
    "The full invitation state machine + when to use each response. Decline closes the door for that vacancy; reconsider keeps it ajar.",
  category: "invitations",
  keywords: [
    "accept",
    "decline",
    "reconsider",
    "response",
    "state",
    "lifecycle",
    "withdraw",
  ],
  related: [
    "vacancy-invitations-explained",
    "decline-reasons-and-what-they-mean",
    "accepted-with-notice-how-it-works",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Open an invitation from the inbox and you see three primary
        actions: <strong>Accept</strong>, <strong>Decline</strong>, and{" "}
        <strong>Reconsider later</strong>. Each one is a deliberate
        signal to the employer and a transition in the invitation&rsquo;s
        state machine.
      </p>

      <h2>The states</h2>
      <ul>
        <li>
          <strong>Invited</strong> &mdash; the starting state. The
          employer sent the invite; you haven&rsquo;t responded yet.
        </li>
        <li>
          <strong>Accepted</strong> &mdash; you said yes. The platform
          opens the next step (which is usually the contact-reveal flow
          so the employer can reach out to schedule a conversation).
        </li>
        <li>
          <strong>Accepted with notice</strong> &mdash; you said yes
          but you&rsquo;re currently employed and need a notice period
          to leave your current role cleanly. See <em>Accepted with
          notice: how it works</em>.
        </li>
        <li>
          <strong>Declined</strong> &mdash; you said no, optionally with
          a structured reason. This invitation is closed; the employer
          can&rsquo;t reopen it. They <em>can</em> send you a different
          invitation for a different vacancy later.
        </li>
        <li>
          <strong>Reconsidering</strong> &mdash; you said &ldquo;not
          now, but ask me again in 36 months.&rdquo; The platform
          keeps the invitation open in this state; if you flip it back
          to Accepted or Declined later, that lands as a normal
          response.
        </li>
        <li>
          <strong>Withdrawn</strong> &mdash; the employer cancelled
          their invite (most often because the vacancy was filled or
          closed). The card stays in your inbox as record but the
          invitation is no longer actionable.
        </li>
        <li>
          <strong>Expired</strong> &mdash; the responds-by date passed
          without a response. Auto-set by the platform.
        </li>
      </ul>

      <Callout type="warning" title="Decline is final">
        <p>
          A declined invitation can&rsquo;t be un-declined. If you
          decline by accident, contact the employer outside the
          platform; the invitation row stays in declined state.
        </p>
      </Callout>

      <h2>Walking through Accept</h2>
      <Steps>
        <Step number={1}>
          <p>
            Hit <strong>Accept</strong>. A confirmation panel opens
            asking whether you&rsquo;re currently employed and need a
            notice period.
          </p>
        </Step>
        <Step number={2}>
          <p>
            If you&rsquo;re free to start immediately, confirm. The
            invitation moves to <em>accepted</em> and the employer is
            notified.
          </p>
        </Step>
        <Step number={3}>
          <p>
            If you need a notice period, pick the months (1, 2, or 3).
            The invitation moves to <em>accepted with notice</em> and
            the employer sees the period; see the next article.
          </p>
        </Step>
      </Steps>

      <h2>When to use Reconsider</h2>
      <p>
        Use <strong>Reconsider later</strong> when the role is
        genuinely interesting but the timing is wrong &mdash; you just
        started somewhere else, you&rsquo;re finishing a degree, you
        promised a current employer 12 more months. The employer sees
        the state and knows the door is ajar, not closed. They can
        decide whether to circle back when the time you suggested
        passes.
      </p>

      <DashboardLink href="/dashboard/invitations">Open invitations inbox</DashboardLink>
    </HelpProse>
  );
}
