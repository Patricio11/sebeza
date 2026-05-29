import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "check-ins",
  title: "Check-ins: keeping placements honest",
  shortDescription:
    "The 3/6/12-month-then-annual cadence, the nightly cron, and why one click per milestone matters.",
  category: "employees",
  keywords: [
    "check in",
    "check-in",
    "checkin",
    "milestone",
    "3 month",
    "6 month",
    "12 month",
    "annual",
    "cadence",
    "still employed",
    "confirm",
    "ledger",
  ],
  related: [
    "lifecycle-view",
    "departures-reengage",
    "internal-notes",
  ],
  surfaceLink: "/employer/placements",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza tracks every active placement at 3 / 6 / 12 months,
        then annually. The cadence is mechanical &mdash; the platform
        knows when a milestone passes and surfaces a one-question
        prompt: <em>&ldquo;Is X still employed in this role?&rdquo;</em>
        Your team answers yes; the row updates; the retention figure on
        /insights stays honest.
      </p>

      <h2>Why the cadence matters</h2>
      <p>
        The platform&rsquo;s strongest data signal is{" "}
        <strong>Placement-Truth: a hire is counted only when
        confirmed via the platform</strong>. Phase 9.20 extended that
        from &ldquo;did you hire?&rdquo; to &ldquo;how did it work
        out?&rdquo; The check-ins are the mechanism. Without them,
        retention numbers drift &mdash; you logged the hire 18 months
        ago and we don&rsquo;t know whether they&rsquo;re still there.
      </p>

      <h2>The three ways to confirm</h2>
      <ul>
        <li>
          <strong>From the lifecycle list page</strong> &mdash; tap the
          amber <em>Check-in due</em> pill on the row&rsquo;s status
          column. Opens a one-question modal inline; you don&rsquo;t
          need to open the detail page.
        </li>
        <li>
          <strong>From the placement detail page</strong> &mdash; the
          Lifecycle panel header has a <strong>Confirm still
          employed</strong> button (Owner/Recruiter only). Same modal.
        </li>
        <li>
          <strong>From the nightly nudge notification</strong> &mdash;
          the cron fires <em>placement.status.check_due</em> to your
          org&rsquo;s members when a milestone passes. Click through to
          the placement; confirm.
        </li>
      </ul>

      <h2>The modal</h2>
      <p>
        Single question: <em>&ldquo;Is X still in this role?&rdquo;</em>{" "}
        plus an optional 500-character note for context (&ldquo;confirmed
        via Slack DM, all good&rdquo;). The note is PII-flagged in audit
        meta but stays private to your org.
      </p>
      <p>
        On Submit:
      </p>
      <ul>
        <li>
          A row lands in the <em>placement_status_checks</em> ledger
          (per-event history).
        </li>
        <li>
          The placement&rsquo;s denormalised{" "}
          <em>last_check_at + last_check_by_user_id</em> updates in
          the same transaction.
        </li>
        <li>
          The amber pill disappears until the next milestone fires.
        </li>
      </ul>

      <Callout type="info" title="A 'no' answer redirects to the departure flow">
        <p>
          If a check-in surfaces &ldquo;they&rsquo;re no longer
          here,&rdquo; the right action isn&rsquo;t to confirm-no
          &mdash; it&rsquo;s to mark them departed with the structured
          category + date. See{" "}
          <em>Marking someone departed + re-engage</em>. The departure
          flow handles the lifecycle transition + the optional re-engage
          modal.
        </p>
      </Callout>

      <h2>The nightly cron</h2>
      <p>
        Behind the scenes,{" "}
        <em>/api/cron/placement-status-check-due</em> runs nightly,
        protected by CRON_SECRET. It finds every active placement past
        its most recent milestone without a confirmation + fires{" "}
        <em>placement.status.check_due</em> to your org&rsquo;s members.
        Cap: one notification per (placement × milestone) ever &mdash;
        re-prompting on the same milestone is noise.
      </p>
      <p>
        The notification has{" "}
        <strong>defaultInApp = true, defaultEmail = false</strong> at
        v1. This is a periodic prompt, not a transactional event &mdash;
        we don&rsquo;t want to push it to email until the cadence has
        been observed in production. You can flip the email default
        per-user in /employer/notifications if you want it.
      </p>

      <h2>Reading the lifecycle timeline on a detail page</h2>
      <p>
        On <strong>/employer/placements/[placementId]</strong>, the
        Lifecycle section shows:
      </p>
      <ul>
        <li>
          <em>Hired</em> on (date) by (logging actor).
        </li>
        <li>
          Each <em>Last confirmed still employed</em> entry with date +
          actor. The history is full; you can scroll back through every
          check-in ever recorded.
        </li>
        <li>
          <em>Next status check</em> (date) &mdash; or, when overdue,{" "}
          <em>Status check due</em> in amber.
        </li>
      </ul>
    </HelpProse>
  );
}
