import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "manual-verification-path",
  title: "The manual verification path",
  shortDescription:
    "When the standard + SAQA paths don't apply: how to verify a credential by contacting the issuing body directly, with the audit trail it requires.",
  category: "kyc_verification",
  keywords: [
    "manual",
    "verification",
    "contact",
    "phone",
    "email",
    "issuing body",
    "professional body",
    "evidence",
  ],
  related: [
    "qualification-review-and-saqa-workflow",
    "approval-rejection-and-appeals",
    "understanding-the-audit-log-structure",
  ],
  surfaceLink: "/admin/verifications",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Some credentials don&rsquo;t fit either the standard-institution
        lookup or the SAQA-partner route: professional-body
        certifications (CFA, ACCA, SAICA), niche provider courses,
        foreign credentials without SAQA equivalence on file. For
        these, you contact the issuing body directly and record the
        verification as a manual case. The audit requirements are
        stricter precisely because the path is more discretionary.
      </p>

      <h2>When manual verification is the right call</h2>
      <ul>
        <li>
          The certificate is from a recognised professional body with
          a public registry the platform doesn&rsquo;t integrate with.
        </li>
        <li>
          The certificate is from a credible institution that we
          haven&rsquo;t whitelisted yet but want to support.
        </li>
        <li>
          The seeker is a recent immigrant with credentials that
          haven&rsquo;t cleared SAQA yet but the issuing institution
          is verifiable.
        </li>
      </ul>

      <h2>The procedure</h2>
      <ol>
        <li>
          Open the case from the verification queue. Hit{" "}
          <em>Switch to manual path</em>. The case state moves to{" "}
          <em>manual-in-progress</em>; the seeker sees this and knows
          you&rsquo;re working it.
        </li>
        <li>
          Open the case&rsquo;s <em>Evidence panel</em>. This is
          where every contact attempt + reply goes.
        </li>
        <li>
          Contact the issuing body via their published verification
          channel (most professional bodies have an
          &ldquo;Is this person a member?&rdquo; lookup or a
          verification email). Use Sebenza&rsquo;s admin email, not
          your personal one.
        </li>
        <li>
          Paste their reply into the Evidence panel verbatim
          (redacting any of their internal staff names &mdash;
          you&rsquo;re documenting our verification, not exposing
          their staff). Include the date + the channel used.
        </li>
        <li>
          Disposition the case: approve, reject, or refer to Lead.
          The Evidence panel content is permanent + visible to
          compliance review.
        </li>
      </ol>

      <Callout type="warning" title="Don't take verification by Slack DM">
        <p>
          A &ldquo;yes, she works here&rdquo; from a friend at the
          issuing body via Slack is not a Sebenza verification record.
          The Evidence panel needs a reproducible source: an email
          from a verification address, a screenshot of a public
          registry, a recorded call (with notice). If your only
          source is informal, the right disposition is{" "}
          <em>refer to Lead</em>, not <em>approve</em>.
        </p>
      </Callout>

      <h2>Costs of getting it wrong</h2>
      <p>
        A wrongly-approved manual verification creates a verified
        badge on the seeker&rsquo;s profile that employers trust.
        If that badge is wrong, the platform&rsquo;s
        Verification-Honesty rule is broken from the inside. The
        platform&rsquo;s entire trust posture depends on us being
        slow + careful on the manual path; speed here costs more than
        it saves.
      </p>
    </HelpProse>
  );
}
