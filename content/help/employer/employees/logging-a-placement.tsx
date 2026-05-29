import {
  HelpProse,
  Callout,
  Steps,
  Step,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "logging-a-placement",
  title: "Logging a placement (Mark as filled)",
  shortDescription:
    "The 30-day reveal gate, the batch-hire modal, and the not-selected-acceptee notification fan-out.",
  category: "employees",
  keywords: [
    "placement",
    "hire",
    "hired",
    "mark as filled",
    "mark filled",
    "log",
    "reveal",
    "reveal gate",
    "30 days",
    "batch hire",
  ],
  related: [
    "vacancy-lifecycle",
    "lifecycle-view",
    "dossier-reveal",
    "internal-notes",
  ],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A placement is a Sebenza-confirmed hire. It&rsquo;s the
        platform&rsquo;s strongest data signal &mdash; the line that
        feeds /insights retention, the national LMI, and the difference
        between &ldquo;Sebenza is a directory&rdquo; and &ldquo;Sebenza
        is a national talent-intelligence system.&rdquo;
      </p>

      <h2>Where to start</h2>
      <p>
        From the open vacancy detail page, in the Lifecycle action row:
        <strong> Mark as filled</strong>. The modal opens with three
        sources of candidates:
      </p>
      <ol>
        <li>
          Accepted invitees on this vacancy &mdash; tick the box
          beside each you hired. No reveal-gate check needed; the
          invitation itself is the engagement.
        </li>
        <li>
          Outside-pipeline candidates &mdash; type the seeker&rsquo;s
          name in the typeahead. The reveal-gate check applies:
          there must be a <em>profile.contact.reveal</em> audit row
          for this profile by your org in the last 30 days.
        </li>
        <li>
          Or use the explicit skip path (Mark filled, no placement).
        </li>
      </ol>

      <Callout type="warning" title="The 30-day reveal gate">
        <p>
          You can&rsquo;t log a hire for someone whose contact details
          you never saw. This is structural &mdash; the action layer
          blocks it. The 30-day window applies to
          outside-pipeline hires only; accepted invitees bypass the
          gate (the invitation IS two-way engagement). To unblock an
          outside-pipeline hire, open that seeker&rsquo;s dossier first
          + reveal their contact; then retry Mark as filled.
        </p>
      </Callout>

      <h2>Batch-hire capture</h2>
      <p>
        The modal lets you log multiple hires per vacancy in one go (up
        to 20). For each hire:
      </p>
      <ul>
        <li>profile (from invitees or typeahead)</li>
        <li>hire date (defaults to today)</li>
        <li>salary band (optional, can be a per-batch shared value or per-hire override)</li>
      </ul>
      <p>
        Salary band stays private to your org &mdash; never on any
        seeker-facing surface. The placement row also carries the
        source (employer_confirmed for these), the vacancy linkage
        (so the placement traces back to the role + audit context),
        and the actor who logged the hire.
      </p>

      <h2>What happens after Submit</h2>
      <Steps>
        <Step number={1}>
          <p>
            All-or-nothing transaction: N placement rows inserted +
            vacancy state flipped to <em>filled</em> + N audit rows
            written.
          </p>
        </Step>
        <Step number={2}>
          <p>
            Each hired seeker gets a{" "}
            <em>placement.confirmed</em> notification:{" "}
            <em>&ldquo;{`{orgName}`} logged you as hired&rdquo;</em>.
            Their public profile flips to <em>employed</em> status
            once they confirm on their dashboard.
          </p>
        </Step>
        <Step number={3}>
          <p>
            The not-selected accepted invitees on this vacancy
            (those who said yes but you didn&rsquo;t pick) get a{" "}
            <em>vacancy.outcome.other-hired</em> notification with
            compassionate copy + (when the dominant decline-reason
            aggregate has a signal) a short development hint.
          </p>
        </Step>
        <Step number={4}>
          <p>
            /insights ISR cache invalidates so retention figures pick up
            the new placement on the next visit.
          </p>
        </Step>
      </Steps>

      <h2>The skip path (Mark filled, no placement)</h2>
      <p>
        Use this only when you genuinely hired someone before joining
        Sebenza, or have a workflow reason you can&rsquo;t log the
        person. The platform writes a distinct{" "}
        <em>org.vacancy.filled.no-placement</em> audit row so admin
        analytics can spot orgs that habitually skip
        Placement-Truth.
      </p>
      <p>
        Skipping doesn&rsquo;t damage your trust posture immediately,
        but the platform&rsquo;s data signal gets weaker if everyone
        uses this. The placement view + retention figures only count
        actual placement rows.
      </p>
    </HelpProse>
  );
}
