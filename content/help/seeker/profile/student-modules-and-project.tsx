import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "student-modules-and-project",
  title: "Student modules, electives, project topic  why we ask",
  shortDescription:
    "Three optional fields that sharpen the matcher beyond your programme + field of study. Independent of your credential; safe to edit any semester.",
  category: "profile",
  keywords: [
    "student",
    "modules",
    "elective",
    "project",
    "dissertation",
    "topic",
    "curriculum",
    "semester",
  ],
  related: [
    "career-compass-recommendations",
    "curriculum-vs-market-demand-for-students",
    "open-to-tags",
  ],
  surfaceLink: "/dashboard/profile#academic",
  updatedAt: "2026-06-01",
  // Visible only to seekers who flagged themselves as students. A
  // non-student seeker has no academic surface to act on, so the
  // article would only generate confusion.
  audienceRequires: "student",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Programme + field of study tell us what you signed up to
        study. The three new fields tell us what you&rsquo;re{" "}
        <em>actually doing this semester</em>  the granular signal
        that lets Career Compass differentiate between two students
        in the same programme.
      </p>

      <h2>What we capture (all optional)</h2>
      <ul>
        <li>
          <strong>Current modules</strong>  a list of the modules
          you&rsquo;re registered for this semester. Up to eight.
          Free text  the matcher fuzzy-matches your input against
          the editorial curriculum catalogue.
        </li>
        <li>
          <strong>Elective you chose</strong>  the one elective you
          picked when you had options. Surfaces from year 2.
          Strong intent signal  it&rsquo;s the bit of your degree
          you actually had control over.
        </li>
        <li>
          <strong>Project / dissertation topic</strong>  one
          sentence describing your final-year project or
          dissertation. Surfaces from year 3. The single strongest
          skill signal we can capture; one good sentence can
          identify 5+ skills cleanly.
        </li>
      </ul>

      <Callout type="info" title="Independent of your credential">
        <p>
          These three fields don&rsquo;t affect your SAQA / institution
          verification. Editing them never reopens the qualification
          verification flow. They describe your current context  not
          the credential itself  so they&rsquo;re always safe to
          update at the start of each semester.
        </p>
      </Callout>

      <h2>Why we don&rsquo;t show them on your public profile</h2>
      <p>
        These fields are <strong>private to you</strong>. Employers
        viewing <code>/p/{`{your-handle}`}</code> see your programme,
        field of study, NQF level, expected graduation  not your
        module list or your project topic. The project topic in
        particular can carry identifying detail; the default-private
        posture is the right one. The matcher uses them; the public
        profile doesn&rsquo;t expose them.
      </p>

      <h2>What about the editorial catalogue?</h2>
      <p>
        Behind the scenes, Sebenza maintains an editorial mapping
        from module labels to skills (e.g. <em>&ldquo;Database
        Systems&rdquo; &rarr; SQL, PostgreSQL, schema design,
        normalisation</em>). When you declare your modules, the
        matcher intersects them with this catalogue, then
        intersects again with current employer demand. The result
        on Career Compass is more specific than programme-level
        recommendations alone.
      </p>
      <p>
        The catalogue grows editorially. If a module you typed
        isn&rsquo;t in the catalogue yet, the matcher silently
        skips it  no error, no nudge. Programme-level
        recommendations still surface as today.
      </p>

      <DashboardLink href="/dashboard/profile#academic">
        Edit your studies
      </DashboardLink>
    </HelpProse>
  );
}
