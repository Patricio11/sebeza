import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "adding-skills-from-the-taxonomy",
  title: "Adding skills from the taxonomy",
  shortDescription:
    "Why the skill picker only accepts entries from a controlled list, how proficiency and years work, and why five is the magic number.",
  category: "profile",
  keywords: [
    "skills",
    "taxonomy",
    "controlled vocabulary",
    "proficiency",
    "years experience",
    "skill picker",
  ],
  related: [
    "understanding-profile-completeness",
    "career-compass-recommendations",
    "how-search-ranking-works",
  ],
  surfaceLink: "/dashboard/profile",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The skill picker on the Profile editor only accepts entries from
        a controlled list. You can&rsquo;t free-type
        &ldquo;Excel&rdquo; if &ldquo;Microsoft Excel&rdquo; is the
        canonical entry &mdash; the search box will surface
        &ldquo;Microsoft Excel&rdquo; and require you to pick it. This
        feels limiting at first; it&rsquo;s actually what makes the
        platform work.
      </p>

      <h2>Why a controlled taxonomy</h2>
      <p>
        Without it, an employer searching for &ldquo;Microsoft
        Excel&rdquo; would miss every profile that wrote
        &ldquo;Excel&rdquo; or &ldquo;MS Excel&rdquo; or &ldquo;XLS.&rdquo;
        With it, every seeker who tagged that skill matches the
        same query &mdash; regardless of how they would have spelled
        it. The cost is a few minutes the first time you set up your
        profile. The benefit is that you&rsquo;re findable for every
        synonym, forever.
      </p>

      <h2>Proficiency + years</h2>
      <p>
        For each skill, you set two extra fields:
      </p>
      <ul>
        <li>
          <strong>Proficiency</strong>: beginner, intermediate, advanced,
          expert. Self-rated. Employers see your rating + the years; they
          generally weight years more heavily than the rating itself, so
          be honest &mdash; over-rating a skill that doesn&rsquo;t hold
          up in interview hurts more than it helps.
        </li>
        <li>
          <strong>Years of experience</strong>: integer. &ldquo;6 months
          on the job&rdquo; rounds down to 0; &ldquo;18 months&rdquo;
          rounds down to 1. The matcher uses years as a filter
          (&ldquo;at least 3 years of Python&rdquo;), so the rounding
          matters.
        </li>
      </ul>

      <h2>Why five is the magic number</h2>
      <p>
        The completeness check passes at five skills, not four. We
        chose five because it&rsquo;s the smallest list that lets
        employers filter on combinations &mdash; e.g. &ldquo;Python +
        SQL + AWS.&rdquo; A profile with two skills isn&rsquo;t
        meaningfully matchable; one with five can be filtered into a
        dozen distinct vacancy specs.
      </p>

      <Callout type="info" title="Skills not in the list">
        <p>
          If a skill you have genuinely isn&rsquo;t in the picker, scroll
          to the bottom and use the <em>Request a new skill</em> link.
          Admins review weekly and add new taxonomy entries that have
          real demand. Don&rsquo;t force a near-match in the
          meantime &mdash; the matcher will treat it as the wrong skill.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/profile">Edit your skills</DashboardLink>
    </HelpProse>
  );
}
