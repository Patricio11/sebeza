import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "monitoring-gov-lookups-for-patterns",
  title: "Monitoring gov lookups for fishing patterns",
  shortDescription:
    "The Oversight log: watch the watchers. How to read government employer-lookup activity for patterns that suggest investigation outside policy.",
  category: "reports_oversight",
  keywords: [
    "oversight",
    "government",
    "gov lookup",
    "watch the watchers",
    "fishing",
    "employer lookup",
  ],
  related: [
    "decline-reasons-aggregate-stats",
    "cohort-retention-and-outcomes",
    "flagging-suspicious-activity",
  ],
  surfaceLink: "/admin/oversight",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Government users have access to certain platform surfaces
        (employer lookup for compliance review, nationality-mix
        exports for labour-market reporting). The Oversight log is
        a curated slice of the audit log focused on that government
        activity &mdash; the &ldquo;watch the watchers&rdquo; lens
        that lets us catch fishing patterns where a gov user might
        be using their access outside documented policy.
      </p>

      <h2>What the panel surfaces</h2>
      <ul>
        <li>
          <strong>Tile strip.</strong> Total events this period, gov
          employer-lookups, above-floor events (lookups against orgs
          with 10+ employees), below-floor events (lookups against
          smaller orgs, more sensitive), CSV exports.
        </li>
        <li>
          <strong>Filterable feed.</strong> Each row: actor, action,
          target org, timestamp. Filter by gov user / by employer /
          by date range.
        </li>
        <li>
          <strong>Pattern callouts.</strong> The system pre-computes a
          short list of pattern flags (&ldquo;User X looked up
          Employer Y on 6 separate days in the last 30 days&rdquo;)
          and surfaces them at the top. These are starting points for
          investigation; not verdicts.
        </li>
      </ul>

      <h2>The fishing patterns to look for</h2>
      <ul>
        <li>
          <strong>Repeated lookups on the same employer with no
          documented reason.</strong> Each gov lookup is supposed to
          have a case-reference attached. Lookups without one are
          allowed (some compliance work is preliminary) but a pattern
          of unreferenced repeats suggests personal-interest digging.
        </li>
        <li>
          <strong>Lookups concentrated on small employers in a single
          municipality.</strong> Could be legitimate (a regional
          compliance sweep) but could be a local official targeting
          businesses for non-platform reasons.
        </li>
        <li>
          <strong>Lookups followed quickly by CSV exports.</strong>
          The combination &mdash; look at an org, then export the
          decline-reason data + the nationality mix for that
          province &mdash; is heavier than typical case work and
          warrants confirming the case reference.
        </li>
        <li>
          <strong>After-hours bursts.</strong> Same pattern as the
          admin off-hours flag in <em>Flagging suspicious
          activity</em>, applied to gov users.
        </li>
      </ul>

      <Callout type="warning" title="The relationship matters">
        <p>
          Government users are platform partners; the Oversight log
          is not adversarial monitoring. Patterns that surface are
          investigated with the gov user&rsquo;s team lead, not by
          confronting the individual. The platform&rsquo;s posture
          is &ldquo;here&rsquo;s a pattern that doesn&rsquo;t match
          documented usage; can you help us understand?&rdquo; not
          &ldquo;we&rsquo;ve caught you.&rdquo; Most of the time the
          team lead explains the pattern in five minutes.
        </p>
      </Callout>

      <h2>When to escalate</h2>
      <p>
        Escalate to your Lead + (where appropriate) the
        platform&rsquo;s compliance lead when:
      </p>
      <ul>
        <li>
          A pattern persists after the team-lead conversation.
        </li>
        <li>
          The pattern involves sensitive personal data (e.g.
          targeted nationality-mix lookups against small employers
          in specific communities).
        </li>
        <li>
          The pattern looks like one official targeting one citizen
          rather than a systemic compliance task.
        </li>
      </ul>

      <DashboardLink href="/admin/oversight">Open oversight log</DashboardLink>
    </HelpProse>
  );
}
