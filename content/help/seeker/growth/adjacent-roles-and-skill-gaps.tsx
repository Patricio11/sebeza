import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "adjacent-roles-and-skill-gaps",
  title: "Adjacent roles and skill gaps",
  shortDescription:
    "When you want to move into a different role: how the compass shows you the gap and the smallest set of skills to close it.",
  category: "growth",
  keywords: [
    "adjacent",
    "role change",
    "career change",
    "skill gap",
    "transition",
    "pivot",
  ],
  related: [
    "career-compass-recommendations",
    "learning-paths-and-proficiency",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Career compass has a second section: <em>Adjacent
        roles</em>. It looks at your current skill stack and surfaces
        professions you&rsquo;re close to &mdash; the ones where you
        could be a credible candidate with the smallest amount of new
        learning.
      </p>

      <h2>How adjacency is computed</h2>
      <p>
        The platform models each profession in the taxonomy as a
        weighted skill bag &mdash; the skills typical of seekers in
        that profession, weighted by frequency. Your profile is also a
        skill bag. The overlap between yours and another
        profession&rsquo;s bag determines adjacency. High overlap +
        small gap = a profession you could shift into without
        starting over.
      </p>

      <h2>What an adjacent-role card shows</h2>
      <ul>
        <li>
          <strong>The role.</strong> Profession + seniority where
          known.
        </li>
        <li>
          <strong>How close.</strong> &ldquo;You already have 8 of 12
          typical skills.&rdquo; The platform shows the count and the
          fraction.
        </li>
        <li>
          <strong>The smallest gap.</strong> The 24 skills that would
          close the gap fastest. Not the whole missing set &mdash; just
          the highest-leverage ones.
        </li>
        <li>
          <strong>Local demand.</strong> Whether vacancies for that
          adjacent role are actually showing up in your province. A
          profession with high adjacency but no local demand is a
          theoretical pivot, not a practical one.
        </li>
      </ul>

      <Callout type="warning" title="Adjacency isn't endorsement">
        <p>
          The compass doesn&rsquo;t tell you whether you&rsquo;d enjoy
          an adjacent role, whether the pay is better, or whether the
          culture is one you&rsquo;d thrive in. It tells you the
          mechanical skill distance and the local demand. The rest of
          the decision is yours.
        </p>
      </Callout>

      <h2>Switching your primary profession on your profile</h2>
      <p>
        If you decide to move, switch your primary profession on the
        Profile editor. The (profession × province) pool changes; your
        ranking gets recomputed against the new pool overnight; the
        compass starts giving you recommendations against the new
        target. Your old work-history rows keep their context &mdash;
        you don&rsquo;t need to delete past roles to make the switch
        credible.
      </p>
    </HelpProse>
  );
}
