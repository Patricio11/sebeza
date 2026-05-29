import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "deleting-your-account-right-to-erasure",
  title: "Deleting your account (right to erasure)",
  shortDescription:
    "30-day grace window where the account is hidden but recoverable; after that, hard-delete with cryptographic shredding. What survives + why.",
  category: "privacy",
  keywords: [
    "delete",
    "erasure",
    "right to be forgotten",
    "popia",
    "30 days",
    "soft delete",
    "hard delete",
    "recover",
  ],
  related: [
    "what-consent-purposes-mean",
    "exporting-your-data-popia-section-23",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        POPIA recognises a right to deletion of personal information
        when the purposes for which it was collected no longer apply.
        On Sebenza, that&rsquo;s the <strong>Delete my account</strong>{" "}
        button on the Privacy &amp; consent page. It runs a two-stage
        process &mdash; soft-delete first, hard-delete second &mdash;
        so accidental deletions are recoverable.
      </p>

      <h2>The two stages</h2>
      <Steps>
        <Step number={1}>
          <p>
            <strong>Soft-delete (the 30-day grace window).</strong>{" "}
            Immediately on hitting delete, your profile becomes
            invisible to /search and your public profile URL returns
            404. Employers can&rsquo;t invite you. The data still
            exists in our database, flagged as soft-deleted, for 30
            days. Sign back in within that window and you can{" "}
            <em>restore</em> the account fully &mdash; consent toggles,
            invitations, skills, everything.
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>Hard-delete (after 30 days).</strong> A nightly job
            sweeps soft-deleted accounts older than 30 days. Your
            profile, work history, qualifications, encrypted PII
            (cryptographically shredded by deleting the key-id), and
            consent rows are removed permanently. The platform writes
            one final <em>account.hard_deleted</em> audit row capturing
            the date.
          </p>
        </Step>
      </Steps>

      <h2>What survives the hard-delete (and why)</h2>
      <p>
        Three categories of data persist past hard-delete:
      </p>
      <ul>
        <li>
          <strong>Aggregate statistics.</strong> If you were counted in
          a cohort statistic before deletion, the cohort count
          doesn&rsquo;t lose a row when you leave &mdash; cohorts are
          immutable historical snapshots. You can&rsquo;t be
          re-identified from a cohort count.
        </li>
        <li>
          <strong>Confirmed placements.</strong> If an employer logged
          a placement of you on this platform, the placement record
          stays (with your identifying fields removed) because
          retention figures depend on it. The platform&rsquo;s
          insights numbers can&rsquo;t silently lose hires.
        </li>
        <li>
          <strong>POPIA-required audit retention.</strong> A small set
          of audit rows the law requires us to keep for compliance
          (consent-grant rows, deletion-confirmation rows) persist
          with all identifying fields hashed.
        </li>
      </ul>

      <Callout type="warning" title="The 30-day window is generous; the deletion after that is final">
        <p>
          Once the hard-delete runs, we can&rsquo;t bring your account
          back. The encryption keys for your PII are gone; the
          decrypted plaintext never existed in long-term storage. If
          you change your mind on day 31, you can create a fresh
          account with your email, but it starts from zero.
        </p>
      </Callout>

      <h2>What if you just want a break</h2>
      <p>
        Deleting is the strongest option. If you want a softer break,
        consider: flipping <em>searchability</em> off (you become
        invisible to employers without losing any data), or flipping{" "}
        <em>vacancy matching</em> off (you stay findable but
        can&rsquo;t be invited). Both are reversible from the same
        Privacy page in one click. Delete the account only when
        you&rsquo;re genuinely done.
      </p>

      <DashboardLink href="/dashboard/privacy">Open Privacy &amp; consent</DashboardLink>
    </HelpProse>
  );
}
