import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-sebenza-is-for-job-seekers",
  title: "What Sebenza is for job seekers",
  shortDescription:
    "A 60-second orientation: outcomes platform, not a job board. Why you don't apply  employers come to you.",
  category: "getting_started",
  keywords: [
    "about",
    "overview",
    "intro",
    "outcomes",
    "not a job board",
    "reverse matching",
    "what is",
  ],
  related: [
    "your-first-hour-profile-setup",
    "vacancy-invitations-explained",
    "what-consent-purposes-mean",
  ],
  surfaceLink: "/dashboard",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza is South Africa&rsquo;s national talent-intelligence
        platform. From your side, the difference from a job board comes
        down to <strong>three deliberate choices</strong> &mdash;
        everything else on this dashboard follows from them.
      </p>

      <h2>One: you don&rsquo;t apply  employers come to you</h2>
      <p>
        There&rsquo;s no &ldquo;apply&rdquo; button anywhere on Sebenza.
        Employers create private hiring specs (we call them{" "}
        <em>vacancies</em>). The platform reverse-matches each spec
        against the live talent pool and returns ranked candidates. The
        employer then chooses who to <em>invite</em>. If they invite
        you, you get a vacancy invitation in your inbox; you accept,
        decline, or ask to be reconsidered later.
      </p>
      <p>
        That means you spend your time on the part that actually moves
        your career &mdash; keeping your profile current &mdash; not on
        application admin.
      </p>

      <h2>Two: nothing happens without your consent</h2>
      <p>
        Six POPIA consent toggles gate every employer interaction with
        your record. The defaults are conservative: searchability and
        contact-reveal are on so the platform is useful to you;
        vacancy-matching, outcomes-research, and a couple of other
        purposes are off until you opt in. You can flip any of them
        from the Privacy &amp; consent page at any moment, and you can
        export or delete everything we hold about you with a single
        button.
      </p>

      <h2>Three: the rank you see is honest</h2>
      <p>
        Your Overview page shows your live rank in the (profession ×
        province) pool. It&rsquo;s computed from three things: how
        complete your profile is, how recently you confirmed your work
        status, and a small citizen boost where applicable. There&rsquo;s
        no &ldquo;featured&rdquo; tier you can pay into. If a rank
        change would help, the dashboard tells you exactly which next
        step would move it.
      </p>

      <Callout type="tip" title="One mental model">
        <p>
          Your profile is the answer the matcher gives to thousands of
          employer questions every day. Every field you fill in makes
          you findable for one more specific question. Every consent
          toggle controls who&rsquo;s allowed to ask.
        </p>
      </Callout>

      <DashboardLink href="/dashboard">Open your overview</DashboardLink>
    </HelpProse>
  );
}
