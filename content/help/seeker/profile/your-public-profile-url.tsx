import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "your-public-profile-url",
  title: "Your public profile URL",
  shortDescription:
    "What employers see at /p/your-handle when they're not signed in, what's gated behind dossier-reveal, and what's never public.",
  category: "profile",
  keywords: [
    "public",
    "url",
    "handle",
    "share",
    "link",
    "redaction",
    "dossier",
  ],
  related: [
    "contact-reveal-how-it-works",
    "document-sharing-and-employer-access",
    "what-consent-purposes-mean",
  ],
  surfaceLink: "/dashboard/profile",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Every seeker has a public profile URL: <code>/p/your-handle</code>.
        This is the page an employer sees when they click on you from
        search results, or when you share the link directly. The
        platform applies POPIA-grade redaction to it &mdash; you control
        what shows up.
      </p>

      <h2>What&rsquo;s on the public page</h2>
      <ul>
        <li>Your name (display name; not your national ID name unless they&rsquo;re identical).</li>
        <li>Your profession + seniority.</li>
        <li>Your province and (optionally) city.</li>
        <li>Your skills list, with proficiency + years.</li>
        <li>Work-history entries: role, organisation, city, date range, short description.</li>
        <li>Your qualifications list with verification chips (verified / pending / unverified).</li>
        <li>Your profile photo, if uploaded.</li>
        <li>Your bio, if written.</li>
        <li>The verification badges your organisation earned (if applicable).</li>
      </ul>

      <h2>What stays private &mdash; even on the public page</h2>
      <ul>
        <li>
          <strong>Your email address and phone number.</strong>{" "}
          Employers see a <em>&ldquo;request contact&rdquo;</em> button;
          they cannot read your contact details until you accept the
          request. See <em>Contact reveal: how it works</em>.
        </li>
        <li>
          <strong>Your national ID number.</strong> Encrypted at rest,
          never displayed back anywhere, including to you. The platform
          uses it for KYC and the citizen-boost path but doesn&rsquo;t
          show it.
        </li>
        <li>
          <strong>Date of birth.</strong> Stored if you provided it;
          never on the public page; only used for KYC where required.
        </li>
        <li>
          <strong>The certificate files themselves.</strong> Employers
          see that the certificate exists and what state it&rsquo;s in,
          but they can&rsquo;t download the file without your per-
          certificate consent.
        </li>
      </ul>

      <Callout type="warning" title="If your searchability consent is off">
        <p>
          The public profile URL returns a 404 (not found) when
          searchability consent is off. The page literally doesn&rsquo;t
          exist for non-signed-in viewers, and employers searching
          /search don&rsquo;t see you in results. This is the strongest
          form of &ldquo;invisible&rdquo; the platform offers without
          deleting your account.
        </p>
      </Callout>

      <h2>The dossier view</h2>
      <p>
        When an employer signs in and opens you from search, they see
        the <em>dossier view</em> &mdash; the public profile plus a few
        extra metadata fields like &ldquo;Open to work?&rdquo; pill,
        salary-band-when-set, and the date you last confirmed status.
        The dossier still doesn&rsquo;t reveal contact details or
        certificate files; those need the request-and-consent flow.
      </p>
    </HelpProse>
  );
}
