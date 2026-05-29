import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "kyc",
  title: "KYC: getting your organisation verified",
  shortDescription:
    "The four documents, the review timing, what unlocks on approval, and how to handle a rejection.",
  category: "organisation",
  keywords: [
    "kyc",
    "verification",
    "verify",
    "organisation",
    "documents",
    "cipc",
    "sars",
    "tax",
    "bank",
    "rejected",
    "resubmit",
    "approve",
  ],
  related: [
    "setting-up-organisation",
    "two-factor",
    "team-roles",
  ],
  surfaceLink: "/employer/organisation",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza requires every employer organisation to be verified
        before it can touch seekers (invite, reveal contact, log
        placements). The KYC process is document-based + admin-
        reviewed; typically one business day.
      </p>

      <h2>The four required documents</h2>
      <ul>
        <li>
          <strong>Company registration certificate</strong> &mdash;
          CIPC, CK1, or CK2 document. This proves the organisation
          legally exists in South Africa.
        </li>
        <li>
          <strong>Tax clearance</strong> &mdash; SARS pin letter or tax
          compliance status notice. Recent (within the last 12 months).
        </li>
        <li>
          <strong>Proof of address</strong> &mdash; utility bill, lease
          agreement, or bank statement. Must be less than 3 months old
          at the time of submission.
        </li>
        <li>
          <strong>Bank confirmation letter</strong> &mdash; the
          standard bank letter confirming the company&rsquo;s account
          details. Most SA banks provide these on request.
        </li>
      </ul>
      <p>
        The optional fifth slot accepts an industry-specific document
        (e.g. SARB licence for financial services). Skip it unless
        admin specifically asks &mdash; uploading unnecessary
        documents adds review surface without helping you.
      </p>

      <Callout type="warning" title="Documents are encrypted on storage">
        <p>
          Uploaded files are stored in encrypted form; admin reviewers
          access them via signed URLs that expire. They&rsquo;re never
          visible in /employer/organisation after submission, never
          exported via the data-export endpoint, never shared with
          seekers. The audit log records every admin view.
        </p>
      </Callout>

      <h2>The review timing</h2>
      <p>
        Submission flips your org&rsquo;s state from{" "}
        <em>unverified</em> to <em>pending</em>. Admin review
        typically takes one business day; complex submissions
        (e.g. trusts, non-profits with unusual document structures)
        can take 2&ndash;3 days. You receive an in-app + email
        notification when the state resolves either way.
      </p>

      <h2>If approved</h2>
      <p>
        Your org&rsquo;s state becomes <em>verified</em> + the gated
        surfaces unlock immediately:
      </p>
      <ul>
        <li>invitations on vacancies</li>
        <li>dossier contact reveal</li>
        <li>Mark-as-Hired (with the 30-day reveal-gate check)</li>
        <li>full notification surface (some kinds gate on verified state)</li>
      </ul>

      <h2>If rejected</h2>
      <p>
        Admin&rsquo;s note appears as a yellow banner on the
        onboarding page explaining what needs re-uploading. The state
        goes back to <em>unverified</em> + you can resubmit any time.
      </p>
      <p>
        Common rejection reasons:
      </p>
      <ul>
        <li>
          Tax clearance more than 12 months old &mdash; pull a fresh
          one from SARS.
        </li>
        <li>
          Proof of address more than 3 months old &mdash; use a
          recent utility bill / bank statement.
        </li>
        <li>
          Mismatched company name between CIPC + bank docs &mdash;
          this often signals a recent name change that hasn&rsquo;t
          propagated; supply both the old and new CIPC documents.
        </li>
        <li>
          Unclear scan / photo quality &mdash; PDFs are preferred over
          phone photos; if photo is the only option, take it in good
          light and check every line is readable before uploading.
        </li>
      </ul>

      <h2>Inviting team members</h2>
      <p>
        Once your org is verified, the Team surface unlocks at{" "}
        <strong>/employer/team</strong>. Invite colleagues by entering
        their email + picking a role (Owner / Recruiter / Viewer).
        They&rsquo;ll receive a signup link; if they&rsquo;re already
        a Sebenza user (e.g. they were a seeker), the invite reuses
        their existing account.
      </p>
      <p>
        The first Owner is the person who signed up the organisation.
        Owners can promote any Recruiter to Owner; demoting an Owner
        requires another Owner to do it (you can&rsquo;t demote
        yourself if you&rsquo;re the only Owner).
      </p>

      <Callout type="info" title="Suspended state">
        <p>
          If an admin suspends your organisation (rare; for compliance
          investigations or contractual breaches), the dashboard shows
          a red banner with the admin&rsquo;s suspension note. All
          write operations are blocked; reads stay available so you
          can pull historical audit data + your data export.
        </p>
      </Callout>
    </HelpProse>
  );
}
