import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "setting-up-organisation",
  title: "Setting up your organisation",
  shortDescription:
    "The KYC submission flow, the four documents we ask for, and what verification gates downstream.",
  category: "getting_started",
  keywords: [
    "setup",
    "onboarding",
    "kyc",
    "verification",
    "verify",
    "documents",
    "cipc",
    "first time",
  ],
  related: ["kyc", "team-roles", "inviting-team"],
  surfaceLink: "/employer/onboarding",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you first sign up as an employer, you land on a lean
        version of the dashboard. To unlock the surfaces that touch
        seekers &mdash; inviting candidates, opening dossiers, logging
        placements &mdash; your organisation has to be verified. That
        gate exists for two reasons: protecting seekers from spoofed
        recruiters, and meeting POPIA &sect;11&rsquo;s lawful-basis
        requirement that the platform knows who&rsquo;s processing
        seeker data.
      </p>

      <h2>The four documents</h2>
      <p>
        On <strong>/employer/onboarding</strong>, you upload:
      </p>
      <ul>
        <li>
          <strong>Company registration certificate</strong> &mdash; CIPC,
          CK1, or CK2 document.
        </li>
        <li>
          <strong>Tax clearance</strong> &mdash; SARS pin letter or tax
          compliance status notice.
        </li>
        <li>
          <strong>Proof of address</strong> &mdash; utility bill, lease
          agreement, or bank statement less than 3 months old.
        </li>
        <li>
          <strong>Bank confirmation letter</strong> &mdash; the standard
          bank letter confirming the company&rsquo;s account details.
        </li>
      </ul>
      <p>
        There&rsquo;s an optional fifth slot for a supporting document
        you might need to attach for your industry (e.g. an SARB licence
        for a financial-services org). Skip it unless the admin asks.
      </p>

      <Callout type="warning" title="The documents are confidential">
        <p>
          Uploaded files are stored encrypted; only Sebenza admin
          reviewers can read them, and the review is audited. They are
          never shared with seekers, never visible on the
          /employer/organisation page after review, and never exported
          via the data-export endpoint.
        </p>
      </Callout>

      <h2>Submission walkthrough</h2>
      <Steps>
        <Step number={1}>
          <p>
            Fill in the basic company details &mdash; trading name,
            registration number, address, VAT number if applicable, your
            industry + size band.
          </p>
        </Step>
        <Step number={2}>
          <p>
            Upload all four required documents. The form blocks submit
            until every required slot has a file (PDF or image).
          </p>
        </Step>
        <Step number={3}>
          <p>
            Submit. Your org&rsquo;s state moves from{" "}
            <em>unverified</em> to <em>pending</em>. Admin review
            typically takes one business day; you&rsquo;ll receive an
            in-app + email notification when it resolves.
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>If approved</strong>, your state becomes{" "}
            <em>verified</em> and the gated surfaces unlock immediately.
          </p>
          <p>
            <strong>If rejected</strong>, the admin&rsquo;s note appears
            as a yellow banner on the onboarding page with what needs
            re-uploading. The state goes back to <em>unverified</em>;
            you can resubmit any time.
          </p>
        </Step>
      </Steps>

      <h2>What stays available before verification</h2>
      <p>
        While you&rsquo;re unverified or pending, you can still: browse
        the talent pool (no contact reveal), draft vacancies (saving but
        not opening them), set up your team + roles. You can&rsquo;t
        invite seekers, open dossiers, or log placements until
        verification clears.
      </p>

      <DashboardLink href="/employer/onboarding">
        Continue onboarding
      </DashboardLink>
    </HelpProse>
  );
}
