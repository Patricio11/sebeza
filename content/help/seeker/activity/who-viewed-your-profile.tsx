import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "who-viewed-your-profile",
  title: "Who viewed your profile",
  shortDescription:
    "Profile views are recorded at the organisation level, not the individual employee. Why that's the right granularity for trust.",
  category: "activity",
  keywords: [
    "viewers",
    "profile view",
    "who saw",
    "organisation",
    "employer",
    "audit",
  ],
  related: [
    "understanding-your-activity-ledger",
    "your-public-profile-url",
    "contact-reveal-how-it-works",
  ],
  surfaceLink: "/dashboard/activity",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Profile views are the most common row in your activity feed.
        Each one means an employer opened your dossier view from search
        results, a saved search, or a vacancy&rsquo;s match results.
        Each view is one row, organisation-level &mdash; not individual
        employee.
      </p>

      <h2>Why organisation, not individual</h2>
      <p>
        Two reasons.
      </p>
      <ul>
        <li>
          <strong>Privacy on the employer side.</strong> Showing you
          &ldquo;Mary at Acme viewed your profile&rdquo; would expose
          Mary&rsquo;s recruiting workload to you. Recruiters open
          dozens of dossiers a day across many vacancies; individual-
          level resolution would create a real privacy problem for
          them. Org-level keeps the trust signal honest without leaking
          internal team data.
        </li>
        <li>
          <strong>You can still ask.</strong> If an organisation views
          your profile and follows up with an invitation or contact
          request, the next row in your feed (the request) carries the
          organisation again. You see the chain &mdash; just not at
          individual resolution within their team.
        </li>
      </ul>

      <h2>Repeated views from the same organisation</h2>
      <p>
        If the same organisation opens your dossier multiple times in
        a short window, the feed groups them into a single row with a
        count (&ldquo;Acme viewed your profile (3 times)&rdquo;). This
        keeps the feed readable; recruiters often re-open the same
        dossier when comparing candidates across days.
      </p>

      <Callout type="info" title="Anonymous-style views don't exist">
        <p>
          Every view is recorded. There&rsquo;s no &ldquo;private
          browsing&rdquo; mode for employers; the platform requires
          authentication on every dossier open, and authentication
          writes the audit row. If a row exists, the view happened; if
          no row exists, no auth&rsquo;d view happened. Public-internet
          scrapers can&rsquo;t open your dossier (the route is auth-
          gated) so they never appear here.
        </p>
      </Callout>

      <h2>If a row looks wrong</h2>
      <p>
        Sebenza is responsible for audit accuracy; if you believe a row
        is wrong (e.g. it names an organisation you&rsquo;ve never
        heard of and you have reason to think your data has been
        accessed inappropriately), submit a query via{" "}
        <em>Report a concern</em> on the Activity page. Our compliance
        team investigates within 7 working days and gets back to you
        in writing &mdash; that&rsquo;s a POPIA Section 23 (e) right.
      </p>
    </HelpProse>
  );
}
