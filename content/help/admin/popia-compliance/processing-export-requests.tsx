import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "processing-export-requests",
  title: "Processing export requests",
  shortDescription:
    "What to do when a user can't self-export. The two extension paths (extended history, third-party reference) and what stays redacted.",
  category: "popia_compliance",
  keywords: [
    "export",
    "section 23",
    "json",
    "extended",
    "third party",
    "redaction",
  ],
  related: [
    "handling-data-subject-requests",
    "deletion-requests-right-to-erasure",
    "incident-response-via-audit-log",
  ],
  surfaceLink: "/admin/users",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Most s.23 (access) requests are served by the user&rsquo;s
        own dashboard export button. Admin involvement starts when
        one of three conditions applies: the user can&rsquo;t sign in
        to self-serve, the user asks for data outside the standard
        export, or a third party (lawyer, regulator) is making the
        request on the user&rsquo;s behalf with proof of authority.
      </p>

      <h2>The standard self-serve export</h2>
      <p>
        Already documented in the seeker / employer help articles.
        Your involvement here is zero unless the user reports a
        broken download link or an empty export, in which case
        engineering takes the case (not compliance).
      </p>

      <h2>The two extension paths</h2>
      <ul>
        <li>
          <strong>Extended history export.</strong> The standard
          export covers everything currently in the database +
          everything in the audit log for the user&rsquo;s account.
          If a user asks for historical data we already aggregated
          + dropped from the primary table, that&rsquo;s an extended
          export &mdash; usually returned as &ldquo;we no longer
          hold this; the s.23 right is to data we currently process,
          not data we lawfully purged.&rdquo; Sometimes (POPIA
          incident review) a partial recovery from backup is
          warranted; that&rsquo;s a Lead disposition.
        </li>
        <li>
          <strong>Third-party export.</strong> A lawyer requests the
          user&rsquo;s data on their behalf. Verify the authority
          document (power of attorney, court order, etc.) before
          dispositioning. The export goes to the third party at
          their stated address, but a notification also goes to the
          user (&ldquo;your data was exported to X under Y
          authority&rdquo;) so the user knows. Authority documents
          attached to the case stay encrypted; they are not part of
          the audit log&rsquo;s user-visible view.
        </li>
      </ul>

      <Callout type="info" title="What stays redacted even in admin exports">
        <p>
          National ID full plaintext, AES-encryption key IDs, internal
          system identifiers, and admin internal notes are redacted
          from every export &mdash; user-self-serve and
          admin-disposition both. The data subject has the right to
          the personal data we hold; they do not have the right to
          the cryptographic material protecting it nor to our
          internal reasoning about their case.
        </p>
      </Callout>

      <h2>What the user receives</h2>
      <p>
        A signed download link to a JSON file (the same format as
        the self-serve export). For third-party exports, the file is
        encrypted with a passphrase the third party can verify against
        their authority document. The download link expires after 24
        hours; the user / third party can request a fresh link via a
        single-use endpoint within the case.
      </p>
    </HelpProse>
  );
}
