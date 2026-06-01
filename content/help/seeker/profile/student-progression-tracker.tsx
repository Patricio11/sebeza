import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "student-progression-tracker",
  title: "Your progression timeline  what it shows + why",
  shortDescription:
    "A private chronological view of your academic journey on /dashboard/grow. Auto-derived events + four self-declared milestones the platform can't see on its own.",
  category: "profile",
  keywords: [
    "progression",
    "timeline",
    "journey",
    "milestone",
    "dissertation",
    "graduation",
    "student",
  ],
  related: [
    "student-modules-and-project",
    "career-compass-recommendations",
    "curriculum-vs-market-demand-for-students",
  ],
  surfaceLink: "/dashboard/grow#progression-h",
  updatedAt: "2026-06-01",
  // Visible only to seekers who flagged themselves as students. The
  // timeline surface itself is gated the same way on /dashboard/grow,
  // so a non-student visitor would land on an article describing a
  // surface they can't reach.
  audienceRequires: "student",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza already knows quite a bit about your journey  the
        platform sees your verified qualifications, your
        platform-confirmed placements, your completed learning items.
        The progression timeline on{" "}
        <DashboardLink href="/dashboard/grow#progression-h">
          /dashboard/grow
        </DashboardLink>{" "}
        plots all of that chronologically so you can see where you are
        + what&rsquo;s landed so far. Plus a fifth source: four
        milestones you can declare yourself.
      </p>

      <h2>What the platform sees automatically</h2>
      <ul>
        <li>
          <strong>Qualifications</strong>  every credential on your
          profile, with the verification status as a small chip.
          Anchored by the year you were awarded.
        </li>
        <li>
          <strong>Placements</strong>  only the ones an{" "}
          <em>employer confirmed</em> via Mark-as-Hired land here.
          Seeker-reported placements are deliberately excluded  the
          timeline is honest about what the platform has actually
          confirmed.
        </li>
        <li>
          <strong>Completed learning</strong>  any{" "}
          <DashboardLink href="/dashboard/grow">
            Career Compass
          </DashboardLink>{" "}
          path you marked as completed surfaces on the timeline with
          the completion date.
        </li>
      </ul>

      <h2>What you can declare yourself</h2>
      <p>
        Four milestones can&rsquo;t be auto-derived  the platform
        can&rsquo;t see them even when they happen. Tap{" "}
        <em>Add</em> under the timeline to declare:
      </p>
      <ul>
        <li>
          <strong>Dissertation submitted</strong>  the moment you
          handed in your final-year project. Academic timelines often
          surface this weeks before the institution publishes the
          result; declaring it puts it on your journey on the day it
          happened, not weeks later.
        </li>
        <li>
          <strong>Graduation date confirmed</strong>  different from
          your <em>expected</em> graduation (which is intent, captured
          at sign-up). Declare this once your institution has confirmed
          the date in writing.
        </li>
        <li>
          <strong>First job offer accepted</strong>  bridges the gap
          before an employer Mark-as-Hired flows through Sebenza. If
          you accepted offline + your employer isn&rsquo;t on the
          platform yet, this is how you mark the moment.
        </li>
        <li>
          <strong>Studies paused</strong>  honest signal when you
          stepped away from formal study. The alternative would be the
          platform pretending you&rsquo;re still in Year 3 forever.
        </li>
      </ul>
      <p>
        Each of those four can be declared once. The <em>Other</em>{" "}
        kind can repeat  use it for milestones the four kinds
        don&rsquo;t cover.
      </p>

      <Callout type="info" title="Private to you">
        <p>
          Self-declared milestones never appear on{" "}
          <code>/p/{`{your-handle}`}</code>. They live only on this
          private timeline. The one-line note is also private
          it&rsquo;s context for you, not employers.
        </p>
      </Callout>

      <h2>Verification-honesty stays intact</h2>
      <p>
        Declaring <em>first job offer accepted</em> does <strong>not</strong>{" "}
        flip a placement to platform-confirmed. Only your employer
        marking you as hired does that. The timeline shows your
        self-declared milestone with a small{" "}
        <em>Self-declared</em> chip alongside the auto-derived events
        so you can see how the platform knows what it knows.
      </p>

      <h2>The eyebrow nudge</h2>
      <p>
        Right under the year header you may see a quiet sentence
        suggesting the next step  add a qualification, declare your
        elective, declare your dissertation topic, or pick up a
        learning path. It picks the highest-impact gap; there&rsquo;s
        no pressure, just a one-line prompt. The platform stays silent
        when you&rsquo;ve handled the obvious gaps already.
      </p>

      <DashboardLink href="/dashboard/grow#progression-h">
        View your progression timeline
      </DashboardLink>
    </HelpProse>
  );
}
