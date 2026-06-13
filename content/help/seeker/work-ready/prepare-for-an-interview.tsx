import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "prepare-for-an-interview",
  title: "Prepare for an interview",
  shortDescription:
    "A calm, practical way to get ready: know the role, know your own story, sort the logistics, and have honest answers for the questions you can expect.",
  category: "work_ready",
  keywords: [
    "interview",
    "prepare",
    "preparation",
    "questions",
    "tips",
    "ready",
    "meeting",
    "employer",
  ],
  related: [
    "reading-the-vacancy-spec",
    "skills-youre-still-learning",
    "spotting-job-scams",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-06-13",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        An interview is just a conversation about whether you and the
        work fit each other. You don&rsquo;t need to be perfect  you
        need to be prepared and honest. Here&rsquo;s a calm way to get
        there.
      </p>

      <h2>Before the day</h2>
      <Steps>
        <Step number={1}>
          <strong>Re-read the role.</strong> Open the invitation and
          look at the skills it asks for. Note which ones you have, and
          which you&rsquo;re still building  you&rsquo;ll talk about
          both.
        </Step>
        <Step number={2}>
          <strong>Know your own story.</strong> For each past job, be
          able to say in one sentence what you did and one thing you
          improved or learned. Your profile already lists these  read
          them back to yourself out loud.
        </Step>
        <Step number={3}>
          <strong>Sort the logistics.</strong> Confirm the time, the
          place (or the video link), and how you&rsquo;ll get there. In
          South Africa, transport and load-shedding are real  plan a
          buffer, and have a backup if the power or signal drops on a
          video call.
        </Step>
        <Step number={4}>
          <strong>Prepare two questions to ask them.</strong> Something
          like &ldquo;What does a good first three months look like?&rdquo;
          shows you&rsquo;re thinking about doing the job well.
        </Step>
      </Steps>

      <h2>Questions you can expect</h2>
      <ul>
        <li>&ldquo;Tell me about yourself&rdquo;  keep it to your work, short.</li>
        <li>&ldquo;Why this role?&rdquo;  connect it to what you can do + want to grow into.</li>
        <li>&ldquo;Tell me about a time you solved a problem&rdquo;  pick one real example.</li>
        <li>&ldquo;What are you still learning?&rdquo;  answer honestly (see the linked article).</li>
      </ul>

      <Callout type="tip" title="Honest beats impressive">
        <p>
          If you don&rsquo;t know something, say so and say how
          you&rsquo;d find out. Employers hire people they can trust
          more often than people who bluff well.
        </p>
      </Callout>

      <h2>On the day</h2>
      <p>
        Arrive a few minutes early, bring your CV (build one here if you
        haven&rsquo;t), be polite to everyone you meet, and put your
        phone on silent. If it&rsquo;s online, find a quiet spot with
        the best signal you can.
      </p>

      <DashboardLink href="/dashboard/invitations">
        See your invitations
      </DashboardLink>
    </HelpProse>
  );
}
