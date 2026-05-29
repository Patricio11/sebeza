import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "qualification-review-and-saqa-workflow",
  title: "Qualification review + SAQA workflow",
  shortDescription:
    "How qualification verification splits between standard institutions (instant lookup) and non-standard (manual + SAQA partner check).",
  category: "kyc_verification",
  keywords: [
    "qualification",
    "saqa",
    "verification",
    "certificate",
    "institution",
    "nqf",
    "manual",
  ],
  related: [
    "reviewing-seeker-id-submissions",
    "manual-verification-path",
    "approval-rejection-and-appeals",
  ],
  surfaceLink: "/admin/verifications",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Qualification verification splits into two paths depending on
        whether the issuing institution is on the standard list
        (publicly funded universities, public TVET colleges, a small
        whitelist of major private providers). The path matters
        because the response-time SLAs differ.
      </p>

      <h2>Standard-institution path</h2>
      <p>
        Most submissions. The institution is on the list; the
        platform pre-fills the institution name + NQF level expected
        for the programme; you compare the certificate scan against
        the form.
      </p>
      <ul>
        <li>
          Check the certificate image is legible and looks like the
          institution&rsquo;s usual format (logo, signatures, stamp).
        </li>
        <li>
          Confirm the programme name on the certificate matches what
          the seeker typed.
        </li>
        <li>
          Confirm the NQF level the seeker selected matches the
          programme&rsquo;s registered NQF level (the form shows the
          expected level next to the picker).
        </li>
        <li>
          Confirm the name on the certificate matches the seeker&rsquo;s
          identity-basics name.
        </li>
      </ul>
      <p>
        Two-Reviewer minimum disposition target is 48h; you should
        aim faster on standard cases.
      </p>

      <h2>Non-standard institution path</h2>
      <p>
        Private colleges not on the whitelist, foreign qualifications,
        professional-body certificates (CFA, CA, etc.). Reviewers
        cannot approve these directly &mdash; the disposition options
        on the row are <em>Request more info</em>, <em>Refer to
        SAQA partner</em>, or <em>Refer to Operator</em>.
      </p>
      <ul>
        <li>
          <strong>Refer to SAQA partner.</strong> Sends the case to
          the SAQA-integration queue for partner-side verification
          (Phase 8+ integration). Acknowledgement back from SAQA
          updates the state automatically; the seeker sees{" "}
          <em>pending</em> throughout.
        </li>
        <li>
          <strong>Refer to Operator.</strong> Use when the SAQA route
          isn&rsquo;t applicable (professional-body certificate,
          obvious institution that just isn&rsquo;t on our whitelist
          yet). Operator reviews with documented reasoning.
        </li>
      </ul>

      <Callout type="info" title="If you don't recognise the institution">
        <p>
          That alone is not a rejection signal. South Africa&rsquo;s
          private education sector is wide; there are reputable
          institutions you&rsquo;ve never heard of. Default to{" "}
          <em>Refer to Operator</em> rather than rejecting. The
          Operator can add the institution to the whitelist if
          appropriate, which speeds up every future submission.
        </p>
      </Callout>

      <h2>Rejection reasons</h2>
      <p>
        Use the structured rejection-reason picker; free-text comes
        second. The reasons surface in your team&rsquo;s metrics + in
        the appeal workflow. Common ones:
      </p>
      <ul>
        <li>Image illegible; unable to verify content.</li>
        <li>Name on certificate doesn&rsquo;t match profile.</li>
        <li>NQF level claimed doesn&rsquo;t match programme.</li>
        <li>Institution not recognised + no SAQA route applies.</li>
        <li>Document appears altered.</li>
      </ul>

      <DashboardLink href="/admin/verifications">Open verification queue</DashboardLink>
    </HelpProse>
  );
}
