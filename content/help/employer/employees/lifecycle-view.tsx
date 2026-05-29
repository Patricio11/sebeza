import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "lifecycle-view",
  title: "The Employees lifecycle view",
  shortDescription:
    "Active / Departed / All tabs, tenure, check-in due badges + the sort options that make the list useful.",
  category: "employees",
  keywords: [
    "employees",
    "lifecycle",
    "view",
    "list",
    "active",
    "departed",
    "tabs",
    "tenure",
    "sort",
    "check-in due",
    "placements",
  ],
  related: [
    "check-ins",
    "departures-reengage",
    "internal-notes",
    "logging-a-placement",
  ],
  surfaceLink: "/employer/placements",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        <strong>/employer/placements</strong> is your team&rsquo;s
        Sebenza-confirmed hires. The platform&rsquo;s mental model is
        &ldquo;Employees,&rdquo; not &ldquo;Placements&rdquo; &mdash;
        the URL stays at /placements so historic deep-links keep
        resolving, but the nav label + page title use the
        recruiter-mental-model word.
      </p>

      <h2>Three tabs</h2>
      <ul>
        <li>
          <strong>Active</strong> (default) &mdash; placements where
          <em> current_status = active</em>. These are the people
          working at your org right now (per the platform&rsquo;s
          knowledge; D3 in Phase 9.20 keeps the seeker side
          independent).
        </li>
        <li>
          <strong>Departed</strong> &mdash; placements where
          <em> current_status = departed</em>. The departure date +
          category are surfaced on the row pill.
        </li>
        <li>
          <strong>All</strong> &mdash; everyone, regardless of state.
          Includes a small number of <em>unknown</em> rows (Phase 9.20
          legacy fallback for pre-9.20 placements where neither side
          told us).
        </li>
      </ul>
      <p>
        Each tab shows the count in parentheses so you can scan
        at-a-glance: <em>&ldquo;Active (12) · Departed (3) · All
        (15)&rdquo;</em>. The tab state lives in the URL{" "}
        (<em>?tab=active</em>) so deep-links + refresh preserve the
        view without a client island.
      </p>

      <h2>Sort options</h2>
      <ul>
        <li>
          <strong>Most recent hire</strong> (default) &mdash; newest
          placements first.
        </li>
        <li>
          <strong>Longest tenure</strong> &mdash; oldest hires first.
          Useful when you want a quick read of who&rsquo;s your most
          loyal contingent.
        </li>
        <li>
          <strong>Check-in due</strong> &mdash; rows past a 3 / 6 / 12-
          month-then-annual milestone without a confirmation. Use this
          when you want to clear the backlog in one sitting.
        </li>
      </ul>

      <h2>The Check-in due pill</h2>
      <p>
        On Active rows, the right-side status column carries one of
        three pills:
      </p>
      <ul>
        <li>
          <strong>Active</strong> (green, default) &mdash; the
          placement is current + within the cadence.
        </li>
        <li>
          <strong>Check-in due</strong> (amber, with the click target)
          &mdash; a milestone has passed (3 / 6 / 12 months or annual)
          and no one&rsquo;s confirmed in this period. Tap the pill
          and it opens the confirm-status modal inline &mdash; you
          don&rsquo;t need to open the detail page.
        </li>
        <li>
          <strong>Unknown</strong> (grey) &mdash; legacy / imported
          placement where neither side has confirmed since landing.
          Confirming once moves it to Active.
        </li>
      </ul>

      <Callout type="tip" title="The summary banner">
        <p>
          On the Active tab, if any employees are past a check-in
          milestone, a small banner above the list summarises:{" "}
          <em>&ldquo;N employees are past a status-check milestone (3
          / 6 / 12 months, then annual). A short check-in keeps the
          platform&rsquo;s retention figure honest.&rdquo;</em> You can
          either work through them via the Check-in due sort, or just
          click each Check-in due pill as you scroll.
        </p>
      </Callout>

      <h2>What&rsquo;s NOT on this surface</h2>
      <ul>
        <li>
          No warnings / disciplinary records / performance review fields.
          The platform deliberately stays out of HRIS territory.
        </li>
        <li>
          No payroll / leave / contract documents.
        </li>
        <li>
          No way to view non-Sebenza hires here &mdash; only placements
          confirmed via the platform appear.
        </li>
      </ul>
    </HelpProse>
  );
}
