import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "document-sharing-and-employer-access",
  title: "Document sharing + employer access",
  shortDescription:
    "Employers see your certificates exist, but can't download the files without your per-document consent. How requests work + how downloads are audit-logged.",
  category: "privacy",
  keywords: [
    "document",
    "certificate",
    "download",
    "sharing",
    "consent",
    "per-document",
    "popia",
  ],
  related: [
    "what-consent-purposes-mean",
    "uploading-certificates-and-verification",
    "contact-reveal-how-it-works",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        On your public profile and dossier, employers see your
        certificates as <em>list entries</em>: institution, programme,
        NQF level, and verification chip. They cannot download the
        certificate file itself without your per-document consent. This
        is a stricter standard than the contact reveal &mdash; documents
        are higher-risk PII, so the gate is finer-grained.
      </p>

      <h2>The request flow</h2>
      <p>
        An employer opens your dossier and hits <em>&ldquo;Request
        certificate&rdquo;</em> beside a specific qualification. You
        get a notification. You choose:
      </p>
      <ul>
        <li>
          <strong>Allow this one.</strong> The employer can download
          this single document. The other certificates on your profile
          stay gated.
        </li>
        <li>
          <strong>Allow all certificates for this employer.</strong>{" "}
          The employer can download every certificate you have. Useful
          for late-stage interviews; not the default behaviour.
        </li>
        <li>
          <strong>Decline.</strong> The request closes. The employer
          knows you said no but doesn&rsquo;t see a reason. You can
          decline silently &mdash; there&rsquo;s no obligation to
          explain.
        </li>
      </ul>

      <h2>What happens when they download</h2>
      <p>
        The download is audit-logged. The platform writes a{" "}
        <em>document.download</em> row capturing the document, the
        organisation, the timestamp, and the IP family (for security
        monitoring; not the exact address). The row appears in your
        Activity ledger and is included in your POPIA Section 23 data
        export.
      </p>

      <Callout type="warning" title="What downloaded means once it's out">
        <p>
          A downloaded certificate lives on the employer&rsquo;s side
          until they delete it. Sebenza can&rsquo;t reach into their
          systems and pull it back. POPIA Section 14 obliges
          responsible parties (employers) to delete personal data when
          they no longer need it, and our platform&rsquo;s data-
          processing agreement requires the same &mdash; but enforcement
          is between them and the regulator, not us. Be deliberate
          about whose request you grant.
        </p>
      </Callout>

      <h2>Revoking access later</h2>
      <p>
        You can&rsquo;t un-download a document that&rsquo;s already
        downloaded. You <em>can</em> revoke future access: open the
        Activity ledger, find the past request, and hit{" "}
        <em>&ldquo;Revoke future access for this employer.&rdquo;</em>{" "}
        That blocks future requests from that organisation entirely.
      </p>
    </HelpProse>
  );
}
