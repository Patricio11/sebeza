import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "uploading-certificates-and-verification",
  title: "Uploading certificates + verification",
  shortDescription:
    "The three verification states (unverified  pending  verified), what each one signals to employers, and what to do when an upload is rejected.",
  category: "profile",
  keywords: [
    "certificate",
    "qualification",
    "upload",
    "verification",
    "verified",
    "pending",
    "saqa",
    "nqf",
  ],
  related: [
    "understanding-profile-completeness",
    "deleting-your-account-right-to-erasure",
  ],
  surfaceLink: "/dashboard/qualifications",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Qualifications live on a dedicated page. Each certificate is
        one upload: a PDF, JPG, or PNG, up to 10 MB. The platform reads
        the institution, programme, and NQF level from a small form
        you fill in after upload &mdash; not from the file itself. The
        file is the evidence; the form is the metadata.
      </p>

      <h2>The three verification states</h2>
      <p>
        Every certificate carries one of three states. The state shows
        as a chip on the qualifications list + on your dossier when an
        employer opens it:
      </p>
      <ul>
        <li>
          <strong>Unverified</strong> &mdash; the default for every
          newly uploaded certificate. The platform shows the qualification
          on your profile but with an explicit{" "}
          <em>&ldquo;not yet verified&rdquo;</em> chip. This is
          honest: employers know you self-asserted it.
        </li>
        <li>
          <strong>Pending</strong> &mdash; you&rsquo;ve asked an admin
          (or SAQA when that partner integration is live) to verify it.
          Pending shows on your profile too; employers know the request
          is open.
        </li>
        <li>
          <strong>Verified</strong> &mdash; the verifier confirmed the
          certificate against the issuing institution. The chip turns
          solid; this is the strongest credential signal you can carry.
        </li>
      </ul>

      <Callout type="info" title="Default is unverified  on purpose">
        <p>
          Sebenza has a Verification-Honesty rule: badges reflect reality
          and never lie. We don&rsquo;t auto-verify uploads &mdash; that
          would mean an unverified document looks the same as a real
          one. The unverified chip is uncomfortable on purpose; it&rsquo;s
          what keeps verified meaningful.
        </p>
      </Callout>

      <h2>How to request verification</h2>
      <Steps>
        <Step number={1}>
          <p>
            On the Qualifications page, find the certificate row and hit{" "}
            <strong>Request verification</strong>. The chip moves from{" "}
            <em>unverified</em> to <em>pending</em>.
          </p>
        </Step>
        <Step number={2}>
          <p>
            An admin (or SAQA partner, once that integration ships in
            Phase 8+) reviews the upload against the issuing institution.
            Turnaround is usually under 5 working days; you&rsquo;ll see
            a notification when it&rsquo;s resolved.
          </p>
        </Step>
        <Step number={3}>
          <p>
            On success, the chip flips to <em>verified</em>. On
            rejection, you get a notification with the reason &mdash; the
            certificate stays on your profile but with the rejection
            reason visible to you only (not to employers).
          </p>
        </Step>
      </Steps>

      <h2>When uploads get rejected</h2>
      <p>
        Common reasons: blurry photo of the certificate, missing
        institution name in the form, name on the certificate
        doesn&rsquo;t match the name on your profile, or the
        certificate is for someone else (yes, this happens &mdash; usually
        a wrong-file upload). Fix the issue, replace the file, and
        re-submit. Your previous rejection rows stay in your activity
        log for transparency; they don&rsquo;t persist on your public
        profile.
      </p>

      <DashboardLink href="/dashboard/qualifications">Open qualifications</DashboardLink>
    </HelpProse>
  );
}
