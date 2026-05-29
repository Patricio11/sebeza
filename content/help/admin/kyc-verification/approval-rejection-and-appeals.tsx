import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "approval-rejection-and-appeals",
  title: "Writing approvals, rejections, and handling appeals",
  shortDescription:
    "How to write a rejection note the user can act on. The appeal flow + who reviews appeals. When to reverse your own decision.",
  category: "kyc_verification",
  keywords: [
    "approval",
    "rejection",
    "reject",
    "appeal",
    "note",
    "reason",
    "reverse",
  ],
  related: [
    "reviewing-seeker-id-submissions",
    "qualification-review-and-saqa-workflow",
    "organisation-kyc-verification",
  ],
  surfaceLink: "/admin/verifications",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A rejection that says &ldquo;document unclear&rdquo; tells
        the user nothing they can act on. A good rejection note tells
        them exactly what to fix on the next upload. This is the
        difference between a queue that converges and one that loops
        forever.
      </p>

      <h2>What a good rejection looks like</h2>
      <p>
        <strong>Bad:</strong> &ldquo;Document unclear.&rdquo;
        <br />
        <strong>Bad:</strong> &ldquo;Rejected.&rdquo;
        <br />
        <strong>Bad:</strong> &ldquo;Need a better photo.&rdquo;
      </p>
      <p>
        <strong>Good:</strong> &ldquo;The certificate image is too
        dark to read the NQF level &mdash; please re-upload a photo
        taken under natural light, or a scanned PDF if available.
        Everything else looks fine.&rdquo;
      </p>
      <p>
        <strong>Good:</strong> &ldquo;The name on the ID document
        reads &lsquo;Boitumelo&rsquo; but the profile reads
        &lsquo;Tumi.&rsquo; Please update the identity-basics name on
        your profile to your legal name, or upload an ID document
        that matches the profile name.&rdquo;
      </p>

      <h2>Three principles for writing notes</h2>
      <ul>
        <li>
          <strong>Specific.</strong> Name the field, the document,
          the page, the thing that failed.
        </li>
        <li>
          <strong>Actionable.</strong> Say what to do next, not just
          what was wrong.
        </li>
        <li>
          <strong>Neutral in tone.</strong> The user will read this
          when they&rsquo;re already frustrated their submission was
          rejected. Don&rsquo;t add &ldquo;please re-read the
          instructions&rdquo; or other passive-aggressive phrasing;
          it makes them less likely to re-engage.
        </li>
      </ul>

      <h2>The appeal flow</h2>
      <p>
        Users can appeal any rejection via a button in the
        notification they receive. Appeals land in a separate queue
        visible to Operators + Leads (Reviewers can read but not
        action). Each appeal carries:
      </p>
      <ul>
        <li>The original rejection note + the rejecting admin&rsquo;s ID.</li>
        <li>
          The user&rsquo;s appeal text (free-form, up to 1000 chars).
        </li>
        <li>
          The original submission documents + the user&rsquo;s
          re-uploaded documents (if any).
        </li>
        <li>An <em>Approve</em>, <em>Reject appeal</em>, or <em>Refer for review</em> action.</li>
      </ul>

      <Callout type="info" title="Reversing your own decision is fine">
        <p>
          If a user appeals and the appeal makes you realise you
          rejected wrongly, approve it without ego. The audit log
          captures the reversal cleanly; no admin is penalised for
          honest course-correction. The platform rewards good
          dispositions, not consistent ones.
        </p>
      </Callout>

      <h2>When to escalate an appeal instead of actioning it</h2>
      <ul>
        <li>
          The appeal raises a claim of bias or unfair treatment.
        </li>
        <li>
          The user attached additional documents that suggest the
          original submission was deliberately misleading.
        </li>
        <li>
          The case is at the boundary of policy and you genuinely
          don&rsquo;t know.
        </li>
      </ul>
      <p>
        <em>Refer for review</em> sends the case to your team
        Lead&rsquo;s queue with a context note. Use this freely;
        nobody wants you to guess on hard cases.
      </p>
    </HelpProse>
  );
}
