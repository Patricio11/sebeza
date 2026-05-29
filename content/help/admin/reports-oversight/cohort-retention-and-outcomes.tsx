import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "cohort-retention-and-outcomes",
  title: "Cohort retention + outcomes",
  shortDescription:
    "How the platform measures whether confirmed hires stick. The 3/6/12/24 month check-in cron + what the 'placement truth' rule actually delivers.",
  category: "reports_oversight",
  keywords: [
    "retention",
    "cohort",
    "placement",
    "outcomes",
    "check-in",
    "hire",
    "placement truth",
  ],
  related: [
    "decline-reasons-aggregate-stats",
    "monitoring-gov-lookups-for-patterns",
    "platform-settings-and-audit-trail",
  ],
  surfaceLink: "/admin/oversight",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza&rsquo;s Placement-Truth rule says a hire only counts
        when it&rsquo;s confirmed via the platform &mdash; logged by
        the employer with the audited contact-reveal step. The
        retention numbers we publish (to gov, to ourselves, to the
        public) are derived from that confirmed-placement set, not
        from self-report or third-party data.
      </p>

      <h2>How retention is measured</h2>
      <ul>
        <li>
          A placement is logged with a start date.
        </li>
        <li>
          The platform runs the placement-status-check-due cron at
          T+3 months, T+6 months, T+12 months, then annually. Each
          check pings the employer to confirm the placement is still
          active.
        </li>
        <li>
          The employer responds: <em>active</em>,{" "}
          <em>departed</em> (with structured reason), or{" "}
          <em>moved internally</em>. If no response in 14 days, the
          state stays as it was; the absence of a response is itself
          recorded.
        </li>
        <li>
          Retention numbers count placements that are still{" "}
          <em>active</em> (or <em>moved internally</em>) at each
          check-in window. Departed (any reason) counts as
          not-retained from that window onward.
        </li>
      </ul>

      <h2>What the retention panel shows</h2>
      <ul>
        <li>
          Cohort retention curves: of placements logged in Q1, what
          % were still active at 3 / 6 / 12 / 24 months. Plotted by
          cohort + by profession.
        </li>
        <li>
          Departure-reason distribution: across departures, what
          structural reasons dominate. (Sebenza never asks for the
          dismissal reason; the seven structured categories are
          neutral.)
        </li>
        <li>
          Differential retention: do placements through Verified
          Employers retain better than Sebenza Employer tier? Does
          retention vary by employer KYC tier? Where does the data
          suggest the platform&rsquo;s trust signals are working +
          where they aren&rsquo;t?
        </li>
      </ul>

      <Callout type="warning" title="Cohort numbers cannot be backfilled">
        <p>
          A placement that was never logged on the platform doesn&rsquo;t
          enter the cohort, even if the parties later confirm it
          happened. The platform&rsquo;s integrity depends on this
          line; we don&rsquo;t take retroactive self-report as
          equivalent to the audited contact-reveal flow. The
          retention chart is honest because we&rsquo;re strict about
          what it counts.
        </p>
      </Callout>

      <h2>Why the curves matter</h2>
      <p>
        Two reasons. First, internally: if hires through Sebenza
        retain worse than the national baseline, the platform is
        worth less than it claims to be, and we need to know. Second,
        externally: government partners use the retention curves as
        a labour-market signal in their own briefs. The numbers have
        to be defendable in front of a Treasury committee, not just
        useful internally.
      </p>
    </HelpProse>
  );
}
