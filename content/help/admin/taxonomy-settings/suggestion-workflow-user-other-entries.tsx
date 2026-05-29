import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "suggestion-workflow-user-other-entries",
  title: "Suggestion workflow: user 'Other' entries",
  shortDescription:
    "How user-submitted 'Other' skill / profession suggestions become real taxonomy entries  promote, merge, or reject, with reasoning each user sees.",
  category: "taxonomy_settings",
  keywords: [
    "suggestion",
    "other",
    "promote",
    "merge",
    "reject",
    "user request",
    "skill picker",
  ],
  related: [
    "managing-skills-and-professions",
    "feature-flags-and-rollouts",
  ],
  surfaceLink: "/admin/taxonomy/suggestions",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When a user picks &ldquo;Other&rdquo; on the skill picker
        and types a term that isn&rsquo;t in the taxonomy, the entry
        is stored on their profile as a free-text suggestion and a
        row lands in the suggestion queue. The platform doesn&rsquo;t
        auto-promote these to canonical entries; an Operator decides
        case by case.
      </p>

      <h2>The three dispositions</h2>
      <ul>
        <li>
          <strong>Promote.</strong> Make the suggestion a canonical
          skill / profession. Use when multiple users have suggested
          the same term and it&rsquo;s a real, ongoing skill.
          Promotion fires the Add operation under the hood (with the
          extra audit context that this came from a user
          suggestion).
        </li>
        <li>
          <strong>Merge into existing.</strong> The suggestion is a
          near-synonym of something already in the taxonomy. Pick the
          canonical entry from a picker; the user&rsquo;s profile gets
          re-tagged to the canonical skill; the synonym list on the
          canonical entry gets extended with the user&rsquo;s exact
          text so future free-typers hit it.
        </li>
        <li>
          <strong>Reject.</strong> The suggestion isn&rsquo;t a skill
          (a sentence, a soft-skill cliche, a typo of nothing). The
          user&rsquo;s profile keeps the free-text but flagged as
          non-canonical; it doesn&rsquo;t participate in matching.
          The user is told it wasn&rsquo;t recognised + offered the
          picker again.
        </li>
      </ul>

      <h2>How to triage the queue</h2>
      <p>
        The queue is sorted by suggestion-count by default. Items
        with 1 suggestion are usually one-off typos; items with 5+
        suggestions are usually real gaps.
      </p>
      <ol>
        <li>
          Skim the top: anything with a count over 3 deserves a
          decision today.
        </li>
        <li>
          For each, open the suggestion to see the user contexts
          (which professions, which provinces, what other skills
          they had).
        </li>
        <li>
          Disposition: promote, merge, or reject. The form requires
          a one-sentence rationale; the user sees the rationale on
          their profile editor.
        </li>
      </ol>

      <Callout type="info" title="Write rationales the user can act on">
        <p>
          A reject rationale of &ldquo;not a skill&rdquo; tells the
          user nothing. &ldquo;&lsquo;Hard-working&rsquo; is a
          personal quality, not a skill in our matcher &mdash; try
          listing a specific technical or professional skill
          instead&rdquo; tells them what to do. Same posture as KYC
          rejection notes; the queue gets shorter when the rationale
          gets clearer.
        </p>
      </Callout>

      <h2>When to escalate</h2>
      <p>
        Suggestions that touch politically sensitive ground
        (occupations the state controls, professions with regulatory
        bodies we should align with) go to the Lead. Don&rsquo;t
        freelance a taxonomy entry for, say, &ldquo;notary public&rdquo;
        without aligning with the Law Society scope first.
      </p>

      <DashboardLink href="/admin/taxonomy/suggestions">Open suggestion queue</DashboardLink>
    </HelpProse>
  );
}
