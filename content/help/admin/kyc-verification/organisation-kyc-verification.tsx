import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "organisation-kyc-verification",
  title: "Organisation KYC verification",
  shortDescription:
    "Employer KYC submissions: four documents, CIPC + tax-clearance checks, the three-tier badge outcome.",
  category: "kyc_verification",
  keywords: [
    "organisation",
    "employer",
    "kyc",
    "cipc",
    "tax clearance",
    "verification",
    "verified employer",
    "badge",
  ],
  related: [
    "reviewing-seeker-id-submissions",
    "approval-rejection-and-appeals",
    "flagging-suspicious-activity",
  ],
  surfaceLink: "/admin/verifications",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Organisation KYC verifies that an employer account represents
        a real registered South African business. The submission has
        four required documents; the disposition is Operator-tier
        (Reviewers can read but not approve). Three badge tiers exist:{" "}
        <em>Sebenza employer</em>, <em>Verified employer</em>, and{" "}
        <em>Employer-verified</em>.
      </p>

      <h2>The four documents</h2>
      <ul>
        <li>
          <strong>CIPC company registration.</strong> The
          CoR14.3/CoR15.1 or equivalent. Check the company name
          matches the org-account display name, the registration
          number is current, and the CIPC stamp / digital signature is
          present.
        </li>
        <li>
          <strong>Tax clearance certificate.</strong> SARS-issued,
          dated within the last 12 months. We verify validity via
          SARS&rsquo;s public TCS PIN check &mdash; the platform shows
          the PIN result inline; you confirm it.
        </li>
        <li>
          <strong>Proof of address.</strong> A utility bill or formal
          letter showing the registered business address, dated
          within the last 3 months.
        </li>
        <li>
          <strong>Authorised representative ID.</strong> Copy of the
          national ID for the person who submitted the KYC. Must
          appear on the CIPC document as director / authorised
          signatory.
        </li>
      </ul>

      <h2>The three badge tiers</h2>
      <ul>
        <li>
          <strong>Sebenza employer</strong> &mdash; account exists,
          KYC submitted, not yet reviewed. The lowest trust tier;
          seekers can decline invitations on this signal alone.
        </li>
        <li>
          <strong>Verified employer</strong> &mdash; all four
          documents check out + reviewer disposition is{" "}
          <em>approved</em>. Mid-tier; this is where most active orgs
          land.
        </li>
        <li>
          <strong>Employer-verified</strong> &mdash; the platform
          itself has independently corroborated the org via at least
          one of: known placements on the platform with seeker
          confirmation, formal partnership with us, or sector
          accreditation we trust. Top tier; assigned by Operator with
          Lead sign-off, not by reviewer disposition alone.
        </li>
      </ul>

      <Callout type="warning" title="Watch for one-document substitutions">
        <p>
          A common pattern is an org that submits an old CIPC document
          for a different entity at the same address as the
          authorised representative&rsquo;s home. Cross-check the
          director name on the CIPC against the ID; flag if the org
          name on the proof-of-address is different from the CIPC
          name. Escalate any case where the documents tell two
          different stories.
        </p>
      </Callout>

      <h2>Disposition options</h2>
      <ul>
        <li>
          <strong>Approve as Verified employer.</strong> All four
          documents present + valid.
        </li>
        <li>
          <strong>Request more information.</strong> One or two
          documents are unclear or out of date.
        </li>
        <li>
          <strong>Reject.</strong> Documents tell different stories
          or look fraudulent. Mandatory reason note. Escalate cases
          where the rejection signals attempted fraud (not just
          paperwork sloppiness).
        </li>
      </ul>

      <DashboardLink href="/admin/verifications">Open verification queue</DashboardLink>
    </HelpProse>
  );
}
