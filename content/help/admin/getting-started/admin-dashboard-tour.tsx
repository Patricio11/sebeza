import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "admin-dashboard-tour",
  title: "Admin dashboard tour",
  shortDescription:
    "Every nav entry, top-to-bottom. What it does, what triggers a queue, what you'll do most days.",
  category: "getting_started",
  keywords: [
    "tour",
    "dashboard",
    "nav",
    "overview",
    "queues",
    "console",
  ],
  related: [
    "what-sebenza-is-for-admins",
    "reviewing-seeker-id-submissions",
    "reading-profile-reports",
  ],
  surfaceLink: "/admin",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Ten nav entries; the top half is your daily queue work, the
        bottom half is reference + personal. The Overview ties it
        together with KPI cards that count what&rsquo;s waiting.
      </p>

      <h2>Top half &mdash; daily work</h2>
      <ul>
        <li>
          <strong>Overview.</strong> Pending verifications, open
          reports, new users last 24h, recent audit events. This is
          where you start each shift &mdash; the queue cards link
          straight to filtered views.
        </li>
        <li>
          <strong>Verification queue.</strong> Three tabs:
          qualifications, organisations (employer KYC), seeker IDs.
          The biggest sink of admin time. Each row carries the
          submitter handle / org name, submitted date, document
          previews, and approve / reject / request-info actions.
        </li>
        <li>
          <strong>Moderation.</strong> Profile reports filed by other
          users (seeker reporting employer behaviour, employer
          reporting seeker behaviour). Each row shows reason category,
          aggregate report count for that subject, and a Take action
          button.
        </li>
        <li>
          <strong>Taxonomy.</strong> Skills, professions, provinces,
          cities. A user-suggestion queue lives here too (when a user
          picks &ldquo;Other&rdquo; on a skill picker and writes a
          new term).
        </li>
      </ul>

      <h2>Reference half</h2>
      <ul>
        <li>
          <strong>Audit log.</strong> Every PII-touching action on the
          platform, filterable by kind + actor. Your incident-response
          starting point when something looks wrong.
        </li>
        <li>
          <strong>Oversight log.</strong> A curated slice of the audit
          log focused on government employer-lookups + nationality
          exports. Watch the watchers: catches fishing patterns where
          a gov user is repeatedly looking up specific organisations
          outside policy.
        </li>
        <li>
          <strong>Users.</strong> Searchable directory across every
          role. Filter by status, role, KYC state. Suspend, restore,
          reset 2FA.
        </li>
        <li>
          <strong>Notifications.</strong> The admin&rsquo;s own
          notifications, mostly verification submissions + new
          moderation reports. Two kinds total &mdash; everything else
          surfaces in the relevant queue page directly.
        </li>
        <li>
          <strong>Platform settings.</strong> Feature flags, email
          test panel, per-setting audit trail. Most settings have a
          documented rollout posture; flipping one without reading
          its article is a fast way to break something visibly.
        </li>
        <li>
          <strong>My account.</strong> Your profile, 2FA management,
          notification preferences.
        </li>
      </ul>

      <Callout type="info" title="Where things you won't find live">
        <p>
          You won&rsquo;t find a billing surface (this is a
          public-trust platform; there&rsquo;s no employer-billing
          tier yet), an outbound marketing dashboard (those live
          outside the console), or a &ldquo;run a query against the
          DB&rdquo; tool (compliance-restricted; ask the engineering
          team). If you find yourself wanting one of those, surface
          the request through your team lead &mdash; the answer is
          usually &ldquo;we have a documented process for that.&rdquo;
        </p>
      </Callout>

      <DashboardLink href="/admin">Open admin overview</DashboardLink>
    </HelpProse>
  );
}
