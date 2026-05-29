import {
  HelpProse,
  Callout,
  Steps,
  Step,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "bulk-invite",
  title: "Bulk inviting candidates",
  shortDescription:
    "Select multiple candidates, add an optional 200-char personal note, send. What the seeker sees + how skips are handled.",
  category: "invitations",
  keywords: [
    "bulk",
    "invite",
    "invitation",
    "send",
    "personal note",
    "note",
    "200 chars",
    "skipped",
    "consent",
  ],
  related: [
    "finding-matches",
    "invitation-lifecycle",
    "follow-up-nudges",
    "accept-rate-strip",
  ],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        From the match page, select candidates with the row checkboxes
        + hit <strong>Invite to opportunity</strong> in the sticky bar
        at the bottom. A confirmation modal opens with the count, a
        per-candidate skipped explanation, and an optional personal
        note field.
      </p>

      <h2>The select-all affordance</h2>
      <p>
        Above the candidate list, when there&rsquo;s at least one
        unselected, not-already-invited row:{" "}
        <strong>Select all</strong> ticks every eligible candidate.{" "}
        <strong>Clear</strong> unticks them all. The line beside the
        buttons tells you the count: <em>&ldquo;N selected of M
        eligible.&rdquo;</em>
      </p>
      <p>
        Selecting all on the Shortlist tab selects only your
        shortlisted picks. Selecting all on the All matches tab
        selects everyone on the page (up to 50 ranked candidates).
      </p>

      <h2>The personal note (optional, 200 chars)</h2>
      <p>
        In the confirmation modal, the <em>Add a note (optional)</em>{" "}
        textarea takes up to 200 characters. The same note attaches to
        every invitation in this batch &mdash; per-seeker
        personalisation isn&rsquo;t available here (that&rsquo;s a
        single-DM flow that lands later).
      </p>
      <p>
        The note appears appended to the invitation notification
        body the seeker receives:
      </p>
      <p>
        <em>
          &ldquo;Open the invite to accept, decline, or decline with a
          reason. Responds-by: {`{date}`}.<br />
          Note from {`{orgName}`}: {`{your note}`}&rdquo;
        </em>
      </p>
      <Callout type="info" title="The note is PII-flagged">
        <p>
          The personal note lands in your org&rsquo;s audit log alongside
          the invitation row, flagged as PII so any future export sweep
          treats it correctly. POPIA-§16 transparency: the seeker can
          request the note&rsquo;s contents from their own data export.
        </p>
      </Callout>

      <h2>What happens on submit</h2>
      <Steps>
        <Step number={1}>
          <p>
            The platform iterates each selected profile + checks four
            gates per candidate: profile exists, profile not deleted,
            not already invited on this vacancy, has vacancy-matching
            consent in <em>granted</em> state.
          </p>
        </Step>
        <Step number={2}>
          <p>
            For every candidate passing all four: writes the invitation
            row (lifecycle state = <em>invited</em>), fires the{" "}
            <em>vacancy.invite</em> notification, writes one audit row.
          </p>
        </Step>
        <Step number={3}>
          <p>
            For every candidate failing one: writes one{" "}
            <em>vacancy.invite.skip</em> audit row with the actual
            reason (consent_not_granted / already_invited /
            profile_deleted / profile_not_found). The reason{" "}
            <strong>does not</strong> appear in the UI.
          </p>
        </Step>
        <Step number={4}>
          <p>
            A success banner shows{" "}
            <em>&ldquo;N invites sent · M not eligible to receive an
            invite right now.&rdquo;</em> No per-person reasons in the
            UI &mdash; that would leak consent state.
          </p>
        </Step>
      </Steps>

      <Callout type="warning" title="Why we don't show per-person skip reasons">
        <p>
          If Sebenza told you &ldquo;Sarah was skipped because she
          revoked vacancy-invite consent,&rdquo; you&rsquo;d learn
          something about Sarah&rsquo;s privacy state she hasn&rsquo;t
          chosen to share with you. Per-person reasons stay in your
          org&rsquo;s audit log only, for admin oversight of bulk
          campaigns.
        </p>
      </Callout>

      <h2>50-invite cap per call</h2>
      <p>
        Each bulk-invite call is capped at 50 profile IDs to match the
        SEARCH_LIMIT on the match view. The platform doesn&rsquo;t let
        you paginate-and-bulk-invite-more in a single workflow &mdash;
        if you genuinely need to invite 200 people, that&rsquo;s a
        signal to narrow your vacancy spec first.
      </p>
    </HelpProse>
  );
}
