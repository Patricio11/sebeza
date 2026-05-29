import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "accepted-with-notice-how-it-works",
  title: "Accepted with notice: how it works",
  shortDescription:
    "If you're employed and need to give notice, this state lets you say yes without breaking faith with your current employer. 1, 2, or 3 months.",
  category: "invitations",
  keywords: [
    "notice",
    "accepted with notice",
    "current employer",
    "handover",
    "notice period",
    "1 month",
    "2 months",
    "3 months",
  ],
  related: [
    "how-to-accept-decline-or-reconsider",
    "employment-history-entry",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        If an invitation comes in while you&rsquo;re happily employed
        but the role is good enough that you want to say yes,{" "}
        <strong>Accepted with notice</strong> is the state to use. You
        commit to the move; you tell the new employer how long you need
        to leave your current role cleanly; both sides plan around
        that.
      </p>

      <h2>The three notice options</h2>
      <p>
        When you accept, the confirmation panel asks &ldquo;Do you need
        a notice period?&rdquo; If yes, pick:
      </p>
      <ul>
        <li>
          <strong>1 month</strong> &mdash; most common for individual
          contributor roles in private-sector employment.
        </li>
        <li>
          <strong>2 months</strong> &mdash; common for senior
          individual contributors, or roles where you&rsquo;re mid-
          project.
        </li>
        <li>
          <strong>3 months</strong> &mdash; common for management roles,
          executive positions, or roles with explicit 90-day notice
          clauses.
        </li>
      </ul>

      <h2>What the employer sees</h2>
      <p>
        The new employer sees your invitation in <em>accepted with
        notice</em> state with the period attached
        (&ldquo;Accepted &mdash; 2 months notice&rdquo;). They know to
        plan an onboarding date that respects the period. The platform
        doesn&rsquo;t tell them <em>which</em> employer you&rsquo;re
        leaving &mdash; just the period.
      </p>

      <Callout type="tip" title="Don't pick the period from your contract on autopilot">
        <p>
          Notice periods in employment contracts are minimums. If your
          contract says 1 month but you&rsquo;re mid-project and want
          to leave well, asking for 2 months on the platform is a
          signal of professional courtesy &mdash; not a constraint
          you&rsquo;re hiding behind. Pick what&rsquo;s actually right
          for the handover, not the legal minimum.
        </p>
      </Callout>

      <h2>What happens next</h2>
      <p>
        The new employer is notified you accepted with notice. The
        contact-reveal step proceeds normally so they can reach you to
        align on start date. If your situation changes &mdash; your
        current employer asks you to stay, your new role&rsquo;s
        circumstances shift &mdash; talk to the employer directly; the
        platform won&rsquo;t auto-rescind anything on either side.
      </p>

      <DashboardLink href="/dashboard/invitations">Open invitations inbox</DashboardLink>
    </HelpProse>
  );
}
