import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "dashboard-tour",
  title: "Your dashboard at a glance",
  shortDescription:
    "Tour every nav entry on your dashboard sidebar - what each one is for + where you'll spend most of your time.",
  category: "getting_started",
  keywords: [
    "tour",
    "sidebar",
    "navigation",
    "nav",
    "overview",
    "menu",
    "where is",
  ],
  related: ["what-sebenza-is", "team-roles"],
  surfaceLink: "/employer",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Your sidebar groups twelve surfaces, top to bottom in roughly
        the order of how you&rsquo;ll use them. Here&rsquo;s what each is
        for.
      </p>

      <h2>Outbound &mdash; you reaching out to candidates</h2>
      <ul>
        <li>
          <strong>Overview</strong> &mdash; landing page with quick stats
          + the freshest activity strip across your org.
        </li>
        <li>
          <strong>Search talent</strong> &mdash; the canonical search
          surface. Every filter the matcher knows about lives here.
        </li>
        <li>
          <strong>Saved searches</strong> &mdash; persisted filter sets.
          A nightly cron re-runs them + notifies on new matches.
        </li>
        <li>
          <strong>Vacancies</strong> &mdash; create, edit, manage your
          private hiring specs. The Find Matches surface lives inside
          each vacancy.
        </li>
        <li>
          <strong>Invites</strong> &mdash; people you brought to Sebenza
          via the employer-initiated invite flow (Phase 9.17 onwards).
          Distinct from inviting existing seekers to a vacancy.
        </li>
        <li>
          <strong>Talent pools</strong> &mdash; cross-vacancy shortlists
          (e.g. &ldquo;CT graduate cohort&rdquo;). Distinct from the per-
          vacancy bookmark on the match page.
        </li>
      </ul>

      <h2>Inbound &mdash; what&rsquo;s happening in your pipeline</h2>
      <ul>
        <li>
          <strong>Employees</strong> &mdash; everyone you&rsquo;ve hired
          via Sebenza, in lifecycle view: Active / Departed / All. The
          retention figure on /insights aggregates from this surface.
        </li>
      </ul>

      <h2>Settings &mdash; how your org runs on the platform</h2>
      <ul>
        <li>
          <strong>Organisation</strong> &mdash; your KYC documents,
          verification state, registered details. The admin-facing side
          of the platform.
        </li>
        <li>
          <strong>Team</strong> &mdash; members, roles, invites, 2FA
          status. Owners can do everything; Recruiters can edit; Viewers
          are read-only.
        </li>
        <li>
          <strong>Notifications</strong> &mdash; per-kind in-app + email
          preferences for every notification kind your org subscribes
          to.
        </li>
        <li>
          <strong>Help</strong> &mdash; this surface.
        </li>
        <li>
          <strong>Account</strong> &mdash; your personal account
          settings: password, email, 2FA on your user, sign-out.
        </li>
      </ul>

      <Callout type="tip" title="Mobile-first nav">
        <p>
          On phones the sidebar collapses behind the hamburger menu top-
          left. Every surface stays one tap away. Your most-used pages
          (Overview, Vacancies, Employees) are intentionally above the
          fold on a 360px viewport.
        </p>
      </Callout>
    </HelpProse>
  );
}
