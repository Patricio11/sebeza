import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "follow-up-nudges",
  title: "Follow-up nudges",
  shortDescription:
    "The opt-in 7-day reminder cron - when to enable it, what the seeker sees, and the one-nudge-per-invite cap.",
  category: "vacancies",
  keywords: [
    "nudge",
    "reminder",
    "follow up",
    "follow-up",
    "7 day",
    "7-day",
    "cron",
    "reminder email",
    "harassment",
  ],
  related: [
    "creating-a-vacancy",
    "bulk-invite",
    "invitation-lifecycle",
    "accept-rate-strip",
  ],
  surfaceLink: "/employer/vacancies/new",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Follow-up nudges are a per-vacancy opt-in. When enabled, the
        platform sends a single in-app + email reminder to a seeker if
        they haven&rsquo;t responded to your invitation by day 7. Off
        by default because today no seeker expects a follow-up, and
        forcing one across the platform would feel like spam to early
        adopters.
      </p>

      <h2>Turning it on</h2>
      <p>
        On the new-vacancy form or the edit-vacancy form, in the{" "}
        <strong>Invite expiry</strong> section, tick{" "}
        <em>Send a gentle nudge after 7 days</em>. The flag lives on the
        vacancy &mdash; every invitation sent from that vacancy
        inherits the setting at send-time.
      </p>
      <p>
        Existing in-flight invitations on the vacancy also pick up the
        new flag immediately &mdash; flipping it on at day 5 still
        triggers the day-7 nudge.
      </p>

      <h2>What the seeker sees</h2>
      <p>
        At day 7 past the original invite, the seeker receives one
        notification (in-app + email per their preferences):
      </p>
      <p>
        <em>
          &ldquo;Still open: {`{orgName}`} invited you to{" "}
          {`{vacancyTitle}`}. A week has passed and your invitation is
          still waiting. Open it to accept, decline, or decline with a
          reason &mdash; declining is free and never affects your
          visibility in search.&rdquo;
        </em>
      </p>
      <p>
        That&rsquo;s it. There is no second nudge, no escalation, no
        &ldquo;your spot is closing&rdquo; pressure.
      </p>

      <Callout type="warning" title="One nudge per invite ever">
        <p>
          The cron is capped at <strong>one nudge per invitation
          forever</strong>. If you change the flag, withdraw and re-
          invite, or re-open the vacancy, the same seeker won&rsquo;t
          be nudged again on that original invitation. The cap is
          enforced via a NOT EXISTS subquery on the notifications
          table; there&rsquo;s no &ldquo;reset the nudge&rdquo;
          surface.
        </p>
      </Callout>

      <h2>Reading the signal</h2>
      <p>
        The accept-rate strip on the vacancy detail page calls out when
        nudges are active &mdash; the &ldquo;Pending&rdquo; bucket
        carries a footnote line:{" "}
        <em>&ldquo;Follow-up nudges are on for this vacancy. Pending
        invitations past 7 days will receive one gentle
        reminder.&rdquo;</em>
      </p>

      <h2>When to enable it</h2>
      <ul>
        <li>
          <strong>Lower-funnel candidates</strong> &mdash; high-intent
          shortlist where you genuinely want to know one way or
          another.
        </li>
        <li>
          <strong>Time-sensitive roles</strong> &mdash; you need to know
          by a date and a non-response means you move on.
        </li>
      </ul>

      <h2>When NOT to enable it</h2>
      <ul>
        <li>
          <strong>Broad first-touch outreach</strong> &mdash; the
          equivalent of a job-board mass email. The nudge here feels
          like pressure.
        </li>
        <li>
          <strong>Roles where the seeker has perfectly reasonable cause
          to delay</strong> &mdash; e.g. they&rsquo;re on a current
          notice period and need time to think.
        </li>
      </ul>

      <Callout type="info" title="Re-nudging is harassment">
        <p>
          The platform&rsquo;s posture: a second reminder on the same
          invitation crosses into pestering territory. If the seeker
          didn&rsquo;t respond to the original invite + the day-7 nudge,
          treat the silence as a soft decline + move on. You can always
          re-invite later if their situation changes.
        </p>
      </Callout>
    </HelpProse>
  );
}
