import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "platform-settings-and-audit-trail",
  title: "Platform settings + audit trail",
  shortDescription:
    "Beyond feature flags: cron-schedule windows, retention durations, email-channel test panel, and the per-setting audit history view.",
  category: "taxonomy_settings",
  keywords: [
    "settings",
    "platform",
    "audit trail",
    "history",
    "cron",
    "retention",
    "email test",
  ],
  related: [
    "feature-flags-and-rollouts",
    "team-roles-and-permissions",
    "understanding-the-audit-log-structure",
  ],
  surfaceLink: "/admin/settings",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Platform settings page hosts feature flags plus a handful
        of other tunable values: cron-schedule windows for batch
        jobs, default retention durations, the email-channel test
        panel. Each setting is a separate editor with its own audit
        trail visible inline.
      </p>

      <h2>What lives on the Settings page</h2>
      <ul>
        <li>
          <strong>Feature flags.</strong> Documented in the previous
          article.
        </li>
        <li>
          <strong>Cron-schedule windows.</strong> The hours of day
          various nightly jobs run (status-stale-warning,
          hard-delete sweep, etc.). Adjust to align with low-traffic
          windows; default is 02:0004:00 SAST.
        </li>
        <li>
          <strong>Retention durations.</strong> How long soft-deleted
          accounts wait before hard-delete (default 30 days); how
          long audit rows are kept (default 5 years); how long
          expired invitations stay in the seeker inbox (default 90
          days). Increasing is fine; decreasing requires Lead +
          compliance signoff because shortening a retention window
          can put us out of POPIA Section 14 compliance.
        </li>
        <li>
          <strong>Email channel test panel.</strong> Sends a sample
          of every email-template kind to a nominated test address.
          Use after any email-template change in code to verify
          rendering before flipping the broadcast flag.
        </li>
      </ul>

      <h2>The audit-history view per setting</h2>
      <p>
        Below each editor, an &ldquo;Audit history&rdquo; expandable
        panel shows every change to that specific setting: who, when,
        before, after, reason note. This lets you check a
        setting&rsquo;s recent history before you change it &mdash;
        if a Lead set the value to X two weeks ago with a reason note,
        flipping to Y without re-reading that note is asking for
        surprises.
      </p>

      <Callout type="info" title="The setting-history view is not the same as the audit log">
        <p>
          The Audit log surface shows every PII-touching action
          across the platform. The setting-history view is a
          per-setting slice of the same underlying table, surfaced
          here for ergonomic context. They&rsquo;re the same data,
          different lens. Either works for forensic reconstruction.
        </p>
      </Callout>

      <h2>What is NOT on the Settings page</h2>
      <ul>
        <li>
          User account settings (those are on each user&rsquo;s
          dashboard).
        </li>
        <li>
          Per-employer settings (those are on each
          organisation&rsquo;s admin surface inside the employer
          dashboard).
        </li>
        <li>
          Engineering toggles for code-level behaviour (those live in
          environment configuration; flipping them is a deploy, not
          a flag).
        </li>
      </ul>

      <DashboardLink href="/admin/settings">Open platform settings</DashboardLink>
    </HelpProse>
  );
}
