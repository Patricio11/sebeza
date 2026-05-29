import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "vacancy-lifecycle",
  title: "Vacancy status lifecycle",
  shortDescription:
    "Draft -> Open -> Closed -> Filled. What changes at each transition + when each state is the right one to use.",
  category: "vacancies",
  keywords: [
    "lifecycle",
    "status",
    "state",
    "draft",
    "open",
    "closed",
    "filled",
    "states",
    "workflow",
  ],
  related: [
    "creating-a-vacancy",
    "logging-a-placement",
    "accept-rate-strip",
  ],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Every vacancy has one of four states. The transitions are a
        bounded state machine; you can&rsquo;t skip steps. The chip on
        the vacancy detail page + list page always shows the current
        state.
      </p>

      <h2>Draft</h2>
      <p>
        The default state on save. Drafts are visible to your team only;
        they don&rsquo;t accept invitations and don&rsquo;t appear in
        match counts on /insights. Use draft to:
      </p>
      <ul>
        <li>start a vacancy you&rsquo;ll finish later</li>
        <li>review the spec with a stakeholder before opening</li>
        <li>park a future requirement (e.g. a role you know you&rsquo;ll need next quarter)</li>
      </ul>
      <p>
        Drafts can move to <strong>Open</strong> when ready, or
        <strong> Closed</strong> if you decided not to fill the role.
      </p>

      <h2>Open</h2>
      <p>
        The active state. Open vacancies:
      </p>
      <ul>
        <li>accept bulk invitations from Find Matches</li>
        <li>can receive accept / decline / accept-with-notice responses</li>
        <li>fire the optional 7-day follow-up nudge cron</li>
        <li>count in match-supply analytics</li>
      </ul>
      <p>
        From <em>Open</em> you can move to <strong>Closed</strong> (no new invites, pipeline preserved) or <strong>Filled</strong> (logged at least one hire).
      </p>

      <h2>Closed</h2>
      <p>
        No new invitations go out. Existing invitations still resolve
        normally (the seeker can still accept / decline if they
        haven&rsquo;t already). The invitation pipeline is preserved
        for audit + analytics. Use Closed when:
      </p>
      <ul>
        <li>The role was paused / withdrawn / re-scoped</li>
        <li>You filled it via a non-Sebenza path (rare; better to log it)</li>
        <li>The deadline passed without a hire</li>
      </ul>
      <p>
        Closed vacancies can re-open later (transition back to
        <strong> Open</strong>). The original draft + spec stays intact.
      </p>

      <h2>Filled</h2>
      <p>
        A vacancy moves to Filled when you successfully log at least
        one placement via the <strong>Mark as filled</strong> button.
        The flow there opens a modal that requires picking the hire(s)
        from the accepted-invitee list (or the typeahead for outside-
        pipeline hires with prior reveal), captures the hire date, and
        fires the <em>vacancy.outcome.other-hired</em> notification
        fan-out to not-selected accepted invitees with optional
        compassionate copy.
      </p>
      <Callout type="warning" title="Filled is the honest signal">
        <p>
          Filled means &ldquo;at least one Sebenza-confirmed placement
          exists.&rdquo; The state is irreversible at the placement
          level &mdash; you can&rsquo;t un-hire someone. You CAN close
          the vacancy from Filled later (e.g. once the placement period
          ends), but the placement row stays.
        </p>
      </Callout>

      <h2>What about &ldquo;Filled without a placement&rdquo;?</h2>
      <p>
        There&rsquo;s an explicit skip path: <em>Mark filled, no
        placement</em>. Use only when you genuinely hired someone before
        joining Sebenza or have a process reason you can&rsquo;t log the
        person. It writes a distinct audit row so admin can spot orgs
        that habitually skip the placement log (the platform&rsquo;s
        Placement-Truth signal weakens if everyone uses this).
      </p>
    </HelpProse>
  );
}
