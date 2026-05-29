import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-sebenza-is",
  title: "What Sebenza is for employers",
  shortDescription:
    "A 60-second orientation: outcomes platform, not a job board. Everything follows from this.",
  category: "getting_started",
  keywords: [
    "about",
    "overview",
    "intro",
    "outcomes",
    "not a job board",
    "placement",
    "what is",
  ],
  related: ["dashboard-tour", "team-roles"],
  surfaceLink: "/employer",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza is South Africa&rsquo;s national talent-intelligence
        platform. From your side, the difference from a typical job board
        is in <strong>three deliberate choices</strong> &mdash; everything
        else on this dashboard follows from them.
      </p>

      <h2>One: vacancies are private hiring specifications</h2>
      <p>
        When you create a vacancy, you don&rsquo;t publish a job ad. The
        platform reverse-matches the spec against the live talent pool
        and returns ranked candidates. Then <strong>you</strong> choose
        who to invite. There is no inbox of applications to triage; no
        public listing page; no spammed-by-recruiters experience for the
        seeker.
      </p>
      <p>
        That&rsquo;s why the form asks for fields a job ad doesn&rsquo;t:
        work availability (full-time / contract / seasonal), minimum
        years of experience, minimum NQF level, optional season window.
        Each is an axis the matcher uses. Each is also optional &mdash;
        blank means &ldquo;don&rsquo;t constrain on this.&rdquo;
      </p>

      <h2>Two: every match honours seeker consent</h2>
      <p>
        You can&rsquo;t bulk-mail every name in the matcher. The platform
        checks each seeker&rsquo;s vacancy-invite consent state before
        firing your invite; if they revoked, the invite is silently
        skipped (per-person reasons stay in your org&rsquo;s audit log,
        never on the UI &mdash; that would leak consent state).
      </p>
      <p>
        This is the line that makes seekers actually accept invites.
        It&rsquo;s also a POPIA-§11 lawful-basis posture &mdash; the
        platform processes seeker data because the seeker explicitly
        opted into being reverse-matched.
      </p>

      <h2>Three: a hire only counts when it&rsquo;s confirmed here</h2>
      <p>
        The retention numbers on /insights, the
        &ldquo;hires-that-stuck&rdquo; line you see at month 12 &mdash;
        all of it counts only placements that were logged on Sebenza,
        with the audited contact-reveal step that gates Mark-as-Hired.
        The platform exists to make that signal honest.
      </p>
      <p>
        Practically: when you hire someone, log the placement. It takes
        90 seconds. The check-in cron tracks them at 3 / 6 / 12 months,
        then annually. You can mark departures with a structured
        category (resigned / contract ended / moved internally /
        retrenched / dismissed / mutual separation / other). The
        platform never asks for the <em>reason</em> behind a dismissal
        &mdash; that&rsquo;s HRIS territory and we deliberately stay out
        of it.
      </p>

      <Callout type="tip" title="One mental model">
        <p>
          A vacancy is a question to the talent pool. An invite is a
          conversation request. A placement is a confirmed answer. Every
          surface on your dashboard maps to one of those three.
        </p>
      </Callout>

      <DashboardLink href="/employer">Open your overview</DashboardLink>
    </HelpProse>
  );
}
