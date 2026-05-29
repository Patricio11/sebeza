import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "creating-a-vacancy",
  title: "Creating a vacancy",
  shortDescription:
    "Walk every field on the new-vacancy form. What's required, what's optional, what the matcher uses.",
  category: "vacancies",
  keywords: [
    "create",
    "new",
    "post",
    "vacancy",
    "vacancies",
    "form",
    "fields",
    "title",
    "skills",
    "description",
  ],
  related: [
    "match-requirements",
    "vacancy-lifecycle",
    "seasonal-vacancies",
    "duplicate-vacancy",
  ],
  surfaceLink: "/employer/vacancies/new",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        From <strong>/employer/vacancies</strong>, hit{" "}
        <strong>New vacancy</strong>. The form has four sections; the
        first two are required, the rest are optional but sharpen the
        match.
      </p>

      <h2>1. The role (required)</h2>
      <ul>
        <li>
          <strong>Role title</strong> &mdash; the label your team sees.
          The seeker also sees this on their invitation. e.g.{" "}
          <em>Senior Pastry Chef</em>, not <em>Req #4192</em>.
        </li>
        <li>
          <strong>Profession</strong> &mdash; the canonical profession
          slug. If your role doesn&rsquo;t fit any of the dropdown
          options, picking <em>Other</em> lets you submit a new
          profession to admin for review (the seeker side has the same
          surface).
        </li>
        <li>
          <strong>Province</strong> &mdash; the province the role is in.
          The matcher uses this; the seeker sees it on the invitation.
        </li>
        <li>
          <strong>Seniority</strong> &mdash; optional but useful: Junior
          / Intermediate / Senior. Influences ranking when the seeker
          has declared their seniority too.
        </li>
        <li>
          <strong>Required skills</strong> &mdash; multi-select chips
          from the canonical skill taxonomy. Pick the skills the role
          actually needs, not aspirational nice-to-haves.
        </li>
        <li>
          <strong>Description</strong> &mdash; up to 4 000 characters,
          internal-only. The seeker never sees this. Use it for
          context your team will need when they screen candidates.
        </li>
      </ul>

      <Callout type="warning" title="The description stays internal">
        <p>
          Unlike a job-board posting, the description doesn&rsquo;t go
          out to candidates. The seeker sees the title + profession +
          province + your org name on the invitation. The description
          is for your own team&rsquo;s reference.
        </p>
      </Callout>

      <h2>2. Match requirements (optional but sharpening)</h2>
      <p>
        Three axes the matcher will use if you set them. Each is
        explicit-blank-means-no-constraint &mdash; leaving the field
        empty doesn&rsquo;t mean &ldquo;0+ years&rdquo;, it means{" "}
        <em>the matcher doesn&rsquo;t care about years for this role</em>.
      </p>
      <ul>
        <li>
          <strong>Work mode + employment type</strong> &mdash; six chips:
          full-time, part-time, contract, casual, seasonal, remote,
          hybrid. Pick all that apply. None selected = the role accepts
          any work mode.
        </li>
        <li>
          <strong>Minimum years of experience</strong> &mdash; integer
          0&ndash;60. Leave blank if years aren&rsquo;t the gating factor.
          When set, seekers who haven&rsquo;t declared a years figure on
          their profile don&rsquo;t pass &mdash; we&rsquo;re honest that
          unknown is not a pass.
        </li>
        <li>
          <strong>Minimum NQF level</strong> &mdash; the seeker&rsquo;s
          highest academic record level. NQF 4 = Matric; 6 = Diploma; 7
          = Bachelor&rsquo;s; 8 = Honours; 9 = Master&rsquo;s; 10 =
          Doctorate. Leave blank for trades / hospitality / casual
          labour / sales roles &mdash; the matcher then doesn&rsquo;t
          check qualifications at all.
        </li>
      </ul>

      <h2>3. Private to your organisation</h2>
      <p>
        <strong>Salary band</strong> stays inside your workspace.
        It&rsquo;s never on any seeker-facing surface, never in /search,
        never in /p/[handle]. Viewers on your team can&rsquo;t see it on
        the form. Same posture as Phase 5 placements.salary_band.
      </p>

      <h2>4. Invitations</h2>
      <ul>
        <li>
          <strong>Days until invite expires</strong> &mdash; 14 days is
          the typical default. After expiry, both you and the seeker
          get a notification + the invite is automatically marked
          expired. Empty / 0 = invites never expire (use sparingly).
        </li>
        <li>
          <strong>Send a gentle nudge after 7 days</strong> &mdash;
          opt-in. Sends one follow-up reminder to the seeker if they
          haven&rsquo;t responded by day 7. Capped at one nudge per
          invite ever; re-nudging is harassment.
        </li>
      </ul>

      <Steps>
        <Step number={1}>
          <p>Fill the role section + any match requirements.</p>
        </Step>
        <Step number={2}>
          <p>
            Save. The vacancy lands in <strong>draft</strong> state.
            Drafts don&rsquo;t accept invites yet &mdash; they&rsquo;re
            visible to your team only.
          </p>
        </Step>
        <Step number={3}>
          <p>
            When ready, move it to <strong>open</strong> via the
            Lifecycle action row on the detail page. Open vacancies
            accept invites.
          </p>
        </Step>
      </Steps>

      <DashboardLink href="/employer/vacancies/new">
        Create a new vacancy
      </DashboardLink>
    </HelpProse>
  );
}
