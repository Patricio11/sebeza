import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "skills-youre-still-learning",
  title: "How to talk about skills you're still learning",
  shortDescription:
    "Being honest about what you're still learning is a strength, not a weakness  if you frame it as direction. Here's how.",
  category: "work_ready",
  keywords: [
    "skills",
    "learning",
    "honest",
    "growing",
    "still learning",
    "gaps",
    "training",
    "interview",
  ],
  related: [
    "learning-paths-and-proficiency",
    "adding-skills-from-the-taxonomy",
    "prepare-for-an-interview",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-06-13",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Nobody has every skill a role asks for. What employers actually
        look for is whether you&rsquo;re honest about where you are and
        moving in the right direction. Said well, &ldquo;I&rsquo;m
        still learning that&rdquo; is a strength.
      </p>

      <h2>The honest frame</h2>
      <p>
        Instead of hiding a gap or pretending it&rsquo;s not there, name
        it and show direction:
      </p>
      <Callout type="tip" title="Say it like this">
        <p>
          &ldquo;I&rsquo;ve used the basics of [skill] on [where]. I
          rate myself about a 3 out of 5  I&rsquo;m busy with [a course
          / on the job] to push it higher.&rdquo;
        </p>
      </Callout>
      <p>
        That answer does three things at once: it&rsquo;s truthful, it
        shows self-awareness, and it shows you take action. All three
        build trust.
      </p>

      <h2>It matches your profile</h2>
      <p>
        On Sebenza your skills carry a rating you set yourself  the same
        rating an employer sees. So your interview answer and your
        profile tell the <em>same</em> story. If you say
        &ldquo;intermediate&rdquo; in the room, your profile should say
        the same. Honesty that lines up is far stronger than confidence
        that doesn&rsquo;t.
      </p>

      <h2>Turn &ldquo;still learning&rdquo; into a plan</h2>
      <p>
        Your Career Compass shows which skills are in demand for your
        profession near you, and points to learning paths  many free.
        Picking one up and showing progress is exactly the
        &ldquo;moving in the right direction&rdquo; an employer wants to
        see, and it lifts your ranking in search too.
      </p>

      <Callout type="info" title="Never inflate a skill to look ready">
        <p>
          A skill you claim but can&rsquo;t do falls apart fast  on the
          job or in the interview. Rate yourself honestly. The platform
          rewards fresh, honest profiles, not inflated ones.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/grow">
        Open your Career Compass
      </DashboardLink>
    </HelpProse>
  );
}
