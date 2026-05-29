import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "career-compass-recommendations",
  title: "Career compass: how recommendations work",
  shortDescription:
    "Skill recommendations ranked by live local demand in your (profession × province) pool. What the headline number means + how to read the top recommendation.",
  category: "growth",
  keywords: [
    "career compass",
    "recommendations",
    "skills",
    "learning",
    "demand",
    "rank boost",
    "grow",
  ],
  related: [
    "learning-paths-and-proficiency",
    "adjacent-roles-and-skill-gaps",
    "how-search-ranking-works",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Career compass page is the platform&rsquo;s answer to
        &ldquo;what should I learn next?&rdquo; The recommendations on
        the page aren&rsquo;t generic skill lists from training data;
        they come from live search-event demand in your (profession ×
        province) pool, intersected with the controlled skill
        taxonomy.
      </p>

      <h2>The headline at the top</h2>
      <p>
        The compass headline reads something like{" "}
        <em>&ldquo;You&rsquo;re ranked #14 in Software engineering in
        Western Cape. Add 2 of these skills and you&rsquo;d be
        #6.&rdquo;</em> The projection is honest: it&rsquo;s computed
        from the actual ranking weights, not a fuzzy estimate. The
        compass recommends the skills that would shift your rank the
        most, given the pool you&rsquo;re in.
      </p>

      <h2>How a recommendation is chosen</h2>
      <ul>
        <li>
          <strong>Demand signal.</strong> How often employers in your
          pool included this skill in their vacancy specs over the
          last 90 days. High-demand + you don&rsquo;t have it = strong
          recommendation.
        </li>
        <li>
          <strong>Your gap.</strong> Skills you already have at
          intermediate or above don&rsquo;t appear here; the compass
          ranks gaps, not strengths.
        </li>
        <li>
          <strong>Adjacency.</strong> Skills that are commonly held
          together with skills you already have rank higher. A Python
          developer being recommended Django is high adjacency; being
          recommended Cobol is not.
        </li>
        <li>
          <strong>Availability of learning paths.</strong> Where
          possible, the compass surfaces skills with at least one free
          or low-cost learning path on record (see the next article).
        </li>
      </ul>

      <Callout type="info" title="The top recommendation isn't 'most popular'">
        <p>
          A skill that&rsquo;s in 90% of vacancies but already in 90% of
          seeker profiles is a wash &mdash; learning it wouldn&rsquo;t
          move your rank. The compass favours skills with a real gap
          between supply (how many seekers have it) and demand (how
          many employers want it). That&rsquo;s the leverage point.
        </p>
      </Callout>

      <h2>What if your recommendations look off</h2>
      <p>
        Two common reasons. One: your profession or province on your
        profile is wrong, so the pool the compass is looking at
        isn&rsquo;t yours. Fix it on the Profile editor. Two: your
        skills list is empty or below 5, so the compass can&rsquo;t
        compute adjacency well. Add the skills you already have first;
        the recommendations will improve immediately.
      </p>

      <DashboardLink href="/dashboard/grow">Open career compass</DashboardLink>
    </HelpProse>
  );
}
