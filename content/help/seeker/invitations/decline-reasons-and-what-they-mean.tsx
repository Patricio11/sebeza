import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "decline-reasons-and-what-they-mean",
  title: "Decline reasons + what they mean",
  shortDescription:
    "Six structured reasons + optional free-text. What the employer sees, what stays private, why structured categories make the platform honest.",
  category: "invitations",
  keywords: [
    "decline",
    "reason",
    "salary",
    "location",
    "skills mismatch",
    "already employed",
    "feedback",
  ],
  related: [
    "how-to-accept-decline-or-reconsider",
    "vacancy-invitations-explained",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you decline an invitation, you can optionally pick a
        reason from six structured categories. The reason is shared
        with the employer in aggregate (their own decline-reason
        breakdown across all their vacancies) but never with your name
        attached &mdash; they see counts, not who said what.
      </p>

      <h2>The six categories</h2>
      <ul>
        <li>
          <strong>Already employed and not looking</strong> &mdash; the
          most common reason. You have a role you&rsquo;re happy in;
          this one isn&rsquo;t the right time.
        </li>
        <li>
          <strong>Salary band not competitive</strong> &mdash; the
          declared band (where set) doesn&rsquo;t meet what you&rsquo;re
          looking for. This is the most actionable signal for the
          employer; if their vacancy gets 70% of declines for this
          reason, the band is off.
        </li>
        <li>
          <strong>Location doesn&rsquo;t work</strong> &mdash; the
          province or city isn&rsquo;t somewhere you can or want to
          work. Remote-vs-onsite mismatches go here.
        </li>
        <li>
          <strong>Skills mismatch</strong> &mdash; the role asks for
          things you don&rsquo;t do, or doesn&rsquo;t ask for what you
          actually want to do next.
        </li>
        <li>
          <strong>Wrong type of role</strong> &mdash; full-time vs
          contract, permanent vs seasonal, IC vs management. Fundamental
          shape mismatch.
        </li>
        <li>
          <strong>Other</strong> &mdash; with optional free-text. Use
          this only when none of the above fit; if &ldquo;already
          employed&rdquo; or one of the structured options applies, use
          that instead.
        </li>
      </ul>

      <h2>Why structured categories</h2>
      <p>
        Free-text feedback is unreadable in aggregate. With structured
        categories, the platform can tell an employer{" "}
        <em>&ldquo;42 of your 60 declines for this vacancy cite salary
        as the issue&rdquo;</em> &mdash; a signal they can act on. With
        free-text, the same 42 declines become 42 different sentences
        the employer has to read and pattern-match in their head;
        almost no employer does that consistently.
      </p>

      <Callout type="info" title="Your individual reason is private to the employer">
        <p>
          The employer can see the decline-reason breakdown for{" "}
          <em>their</em> vacancies only (the aggregate counts on their
          dashboard). They cannot see who said what, and they cannot
          see decline reasons across vacancies from other organisations.
          Other seekers cannot see your reason at all.
        </p>
      </Callout>

      <h2>The optional free-text note</h2>
      <p>
        After picking a reason, you can add a short note (up to 200
        characters). The note is also private to the employer for that
        vacancy and is most useful for &ldquo;Other&rdquo; declines or
        when you want to say something specific like &ldquo;happy to be
        considered for a different role at your org.&rdquo; Don&rsquo;t
        feel obliged to write one; declining without a note is fine and
        common.
      </p>
    </HelpProse>
  );
}
