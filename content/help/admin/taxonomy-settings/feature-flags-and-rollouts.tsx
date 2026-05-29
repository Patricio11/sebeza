import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "feature-flags-and-rollouts",
  title: "Feature flags + rollouts",
  shortDescription:
    "What's a feature flag, the four rollout postures we use, and why flipping a flag without reading its description is the fastest way to break production.",
  category: "taxonomy_settings",
  keywords: [
    "feature flag",
    "rollout",
    "settings",
    "toggle",
    "production",
    "gradual",
  ],
  related: [
    "platform-settings-and-audit-trail",
    "team-roles-and-permissions",
  ],
  surfaceLink: "/admin/settings",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A feature flag is a boolean (or sometimes a percentage) that
        gates whether a code path is active in production. Sebenza
        uses flags to ship work incrementally, run experiments, and
        keep an off-switch for problematic features. Flipping flags
        is Lead-tier action and writes audit rows the engineering
        on-call also gets paged on.
      </p>

      <h2>The four rollout postures</h2>
      <ul>
        <li>
          <strong>Default-off, opt-in by user.</strong> The user has
          to flip a toggle on their account to use the feature.
          Lowest-risk posture &mdash; the platform&rsquo;s default
          experience is unchanged.
        </li>
        <li>
          <strong>Default-on, opt-out by user.</strong> Everyone gets
          the new behaviour; users can turn it off. Riskier &mdash;
          the default experience changed for everyone.
        </li>
        <li>
          <strong>Gradual percentage rollout.</strong> Feature is on
          for X% of users (chosen by a stable hash so individual
          users either always see it or never see it). Used when we
          want to monitor real-traffic behaviour without exposing
          100% on day one.
        </li>
        <li>
          <strong>Kill switch.</strong> Feature is on for everyone;
          flag exists only to turn it off in an incident. Most
          long-shipped features eventually become kill switches.
        </li>
      </ul>

      <h2>Reading a flag&rsquo;s description before flipping</h2>
      <p>
        Each flag on the Settings page carries a description with:
      </p>
      <ul>
        <li>What it controls.</li>
        <li>Current rollout posture.</li>
        <li>
          The engineering owner (the person who shipped the flag).
        </li>
        <li>The expected consequences of flipping it.</li>
        <li>
          Whether engineering on-call should be paged before / after
          the flip.
        </li>
      </ul>
      <p>
        Read the description. Always. Some flags are safe to flip
        any time; some require coordinated rollout windows because
        flipping them mid-traffic causes user-visible inconsistency
        (a user mid-session sees one behaviour; refresh sees the
        other).
      </p>

      <Callout type="warning" title="The audit row + the paged engineer are the rollback path">
        <p>
          Every flag flip writes an audit row with before, after,
          you, and the reason note. The engineering on-call is
          paged for any flip on a flag marked
          &ldquo;page-on-flip.&rdquo; If something breaks after your
          flip, the audit row + the paged engineer&rsquo;s presence
          mean rollback is fast. If you flip without the reason
          note, rollback is slower because nobody knows what you
          were trying to accomplish.
        </p>
      </Callout>

      <h2>When in doubt, don&rsquo;t flip</h2>
      <p>
        If you don&rsquo;t understand a flag&rsquo;s description,
        ask the engineering owner before flipping. Almost every
        feature-flag-related incident in our history traces to
        someone flipping a flag during a meeting without reading
        the description. There is no rush; the feature has been off
        for weeks already, another day waiting for context is fine.
      </p>
    </HelpProse>
  );
}
