import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "learning-paths-and-proficiency",
  title: "Learning paths and proficiency",
  shortDescription:
    "Free vs paid options, why cost / access reasons are tracked, and how progress flows back into your profile.",
  category: "growth",
  keywords: [
    "learning",
    "course",
    "free",
    "paid",
    "provider",
    "abandon",
    "proficiency",
    "path",
  ],
  related: [
    "career-compass-recommendations",
    "adjacent-roles-and-skill-gaps",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Each skill recommendation on the Career compass has at least
        one <em>learning path</em> attached &mdash; a specific course,
        bootcamp, or self-study route a real person on the platform
        used to acquire that skill. The compass flags which are free,
        which cost money, and which require a specific entry credential.
      </p>

      <h2>What a learning path entry shows</h2>
      <ul>
        <li>
          <strong>Provider kind</strong> &mdash; university, online
          course platform, professional body, government programme, or
          self-study material. The label tells you what kind of
          credential (if any) you end up with.
        </li>
        <li>
          <strong>Cost</strong> &mdash; one of <em>free</em>,{" "}
          <em>low cost</em> (under R5000),{" "}
          <em>moderate cost</em> (R500030000), or{" "}
          <em>significant cost</em> (above R30000). Categorised, not
          exact &mdash; provider prices change.
        </li>
        <li>
          <strong>Proficiency on completion</strong> &mdash; beginner,
          intermediate, or advanced. A free short course will mostly
          take you to beginner; a structured year-long programme to
          advanced.
        </li>
        <li>
          <strong>Time investment</strong> &mdash; rough hours required.
          Useful for picking between two paths to the same skill when
          one is 20 hours and the other is 200.
        </li>
      </ul>

      <h2>Why cost and access reasons get tracked</h2>
      <p>
        If you start a learning path and later abandon it, the platform
        asks why &mdash; with a short list of structured reasons:{" "}
        <em>too expensive</em>, <em>needed prerequisite I don&rsquo;t
        have</em>, <em>format didn&rsquo;t work for me</em>,{" "}
        <em>found a better path</em>, <em>life happened</em>. These
        signals shape the compass for everyone: a path that 70% of
        seekers abandon for cost reasons gets de-prioritised in favour
        of free alternatives where one exists.
      </p>

      <Callout type="info" title="Free alternatives, when they exist">
        <p>
          When a paid path has a free alternative that gets to the
          same skill at the same proficiency level, the compass shows
          both with a small &ldquo;free alternative&rdquo; chip on the
          free one. We don&rsquo;t hide the paid option &mdash; the
          tradeoffs (time, structure, credential) are sometimes worth
          it &mdash; but you see both.
        </p>
      </Callout>

      <h2>Updating proficiency on your profile</h2>
      <p>
        Completing a learning path doesn&rsquo;t auto-update the
        proficiency on your profile. That&rsquo;s deliberate: a course
        completion is a signal, not a verification. After you finish,
        go to the Profile editor, update the skill&rsquo;s proficiency
        or years, and (where applicable) upload the completion
        certificate via the Qualifications page. The matcher reads
        proficiency from your profile, not from the compass.
      </p>
    </HelpProse>
  );
}
