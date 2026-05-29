import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "team-roles",
  title: "Owner, Recruiter, Viewer: who can do what",
  shortDescription:
    "The three team roles, where each one is gated, and how to pick the right one when inviting a colleague.",
  category: "getting_started",
  keywords: [
    "roles",
    "permissions",
    "owner",
    "recruiter",
    "viewer",
    "team",
    "access",
    "rbac",
  ],
  related: ["inviting-team", "setting-up-organisation", "two-factor"],
  surfaceLink: "/employer/team",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Three roles exist on every employer organisation. The choice
        flows from one question: do you want this person to be able to
        write to the platform on behalf of your org? Read-only is the
        safe default for stakeholders who just need to see what&rsquo;s
        happening.
      </p>

      <h2>Owner</h2>
      <p>
        Can do everything. Typical assignment: founder, COO, head of
        people. Owners are the only role that can:
      </p>
      <ul>
        <li>change billing details</li>
        <li>add or remove other Owners</li>
        <li>suspend / re-enable the organisation</li>
        <li>upload KYC documents + initiate verification</li>
      </ul>
      <p>
        Owners are also required to have 2FA enabled. The platform
        nudges them to set it up on first sign-in; downstream sensitive
        actions are gated on it.
      </p>

      <h2>Recruiter</h2>
      <p>
        Day-to-day operations. This is the role most members on a
        recruiting team will have. Recruiters can:
      </p>
      <ul>
        <li>create + edit + close vacancies</li>
        <li>open dossiers + reveal seeker contact</li>
        <li>send bulk invitations + write personal notes</li>
        <li>log placements + mark them departed</li>
        <li>check in on existing placements</li>
        <li>add + remove members from talent pools</li>
        <li>save searches + receive new-match notifications</li>
      </ul>
      <p>
        Recruiters can&rsquo;t change billing or KYC, and they
        can&rsquo;t add other Owners. That keeps day-to-day work
        unblocked without delegating the legal-entity surface.
      </p>

      <h2>Viewer</h2>
      <p>
        Read-only across the whole employer surface. Useful for: line
        managers who want to see candidate progress without being able
        to invite or reveal; finance / compliance team members who need
        the audit trail; an exec who occasionally checks in.
      </p>
      <p>
        Viewers see <em>everything</em> Recruiters see, including salary
        bands on vacancies and the placements lifecycle data &mdash; with
        one explicit exception: they never see the salary band on
        vacancies in the editable form. The privacy contract is about
        write access, not concealment.
      </p>

      <Callout type="info" title="Switching roles is cheap">
        <p>
          An Owner can change any member&rsquo;s role at any time from
          /employer/team. The audit log captures the change with the
          actor + before/after values. There&rsquo;s no need to remove
          and re-invite a member just to demote / promote them.
        </p>
      </Callout>

      <h2>What about your seekers?</h2>
      <p>
        Seeker accounts are completely separate from your team. A
        recruiter on your team cannot &ldquo;become&rdquo; a seeker via
        the dashboard, and a seeker cannot become a team member of your
        org via any path. The two surfaces share an authentication
        layer + nothing else.
      </p>
    </HelpProse>
  );
}
