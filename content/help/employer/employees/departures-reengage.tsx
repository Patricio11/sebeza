import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "departures-reengage",
  title: "Marking someone departed + the re-engage modal",
  shortDescription:
    "Seven SA labour-relations categories, no reason recorded. The two-step modal that closes the loop with an optional new invite.",
  category: "employees",
  keywords: [
    "departed",
    "departure",
    "resigned",
    "dismissed",
    "retrenched",
    "contract ended",
    "moved internally",
    "mutual separation",
    "re-engage",
    "reengage",
    "fired",
    "left",
    "category",
    "labour law",
    "lra",
  ],
  related: [
    "lifecycle-view",
    "check-ins",
    "internal-notes",
  ],
  surfaceLink: "/employer/placements",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        On the placement detail page (Owner/Recruiter only), the
        Lifecycle panel has a <strong>Mark as departed</strong> button
        when the placement is currently active. It opens a two-step
        modal: capture the departure, then optionally re-engage the
        former employee on one of your other open vacancies.
      </p>

      <h2>Seven categories, no reason</h2>
      <p>
        The category is a structured enum &mdash; pick the one that
        fits. Order is deliberate: voluntary on top, involuntary lower,
        so the UI doesn&rsquo;t push you to &ldquo;just pick
        dismissed.&rdquo;
      </p>
      <ul>
        <li>
          <strong>Resigned</strong> &mdash; the seeker initiated;
          voluntary departure.
        </li>
        <li>
          <strong>Contract ended</strong> &mdash; fixed-term contract
          reached its natural end.
        </li>
        <li>
          <strong>Moved internally</strong> &mdash; same employer,
          different role. The platform&rsquo;s pipeline can still see
          them.
        </li>
        <li>
          <strong>Retrenched</strong> &mdash; operational requirements /
          restructuring.
        </li>
        <li>
          <strong>Mutual separation</strong> &mdash; both sides agreed
          to part ways.
        </li>
        <li>
          <strong>Dismissed</strong> &mdash; employer-initiated. The
          category is the fact; the <strong>reason</strong> is not
          recorded.
        </li>
        <li>
          <strong>Other</strong> &mdash; escape hatch; use sparingly.
        </li>
      </ul>

      <Callout type="warning" title="The platform does NOT capture the reason">
        <p>
          Sebenza never asks &ldquo;why was this person dismissed?&rdquo;
          That&rsquo;s SA labour-law (Schedule 8) territory; recording
          it would turn the platform into a record-of-truth for LRA /
          CCMA disputes, which is HRIS work we deliberately stay out
          of. If you want internal context for your team, the optional
          500-char note (appended to the durable internal note) is the
          place &mdash; never visible to the seeker.
        </p>
      </Callout>

      <h2>The departure date</h2>
      <p>
        Date picker with floor + ceiling validation:
      </p>
      <ul>
        <li>
          Floor: the hire date. You can&rsquo;t pre-date a departure
          before the placement started.
        </li>
        <li>
          Ceiling: today. You can&rsquo;t schedule a future departure
          (use the platform when it actually happens; the row is the
          historical record).
        </li>
      </ul>

      <h2>Step two: the re-engage modal</h2>
      <p>
        After Mark as departed lands successfully, the modal swaps to a
        Re-engage panel:
      </p>
      <p>
        <em>&ldquo;{`{name}`} is back on the market. Want to invite
        them to one of your other open vacancies?&rdquo;</em>
      </p>
      <p>
        It lists your organisation&rsquo;s currently-open vacancies
        (status = open). Pick one + hit <strong>Send invite</strong>
        and the platform fires the existing{" "}
        <em>bulkInviteToVacancy</em> with the former employee&rsquo;s
        profile ID. Same consent gate as any other bulk-invite &mdash;
        if the seeker revoked vacancy-invite consent post-departure,
        the send is silently skipped (audit only).
      </p>
      <p>
        Pressing <strong>Not now</strong> or closing the modal still
        leaves the departure logged. The re-engage step is optional;
        no pressure.
      </p>

      <Callout type="info" title="The 'Other' org is still there">
        <p>
          When you mark someone departed, their current_employer_org_id
          on their profile doesn&rsquo;t auto-clear. The seeker is the
          authority on their own employment status; the platform updates
          your view of their lifecycle on your placement record only.
          If the seeker eventually picks a new employer on{" "}
          /dashboard/profile, that&rsquo;s on the seeker&rsquo;s side.
        </p>
      </Callout>

      <h2>Phase 9.23 D7 supersedes any verification badge</h2>
      <p>
        If the seeker had an Employer-verified badge from a contact at
        your org, marking them departed doesn&rsquo;t automatically
        clear it &mdash; that only happens when they change their own
        current_employer_org_id on their dashboard. From your side,
        the placement record is what tells the truth about whether
        they currently work at you.
      </p>
    </HelpProse>
  );
}
