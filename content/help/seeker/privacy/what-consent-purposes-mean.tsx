import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-consent-purposes-mean",
  title: "What each consent toggle controls",
  shortDescription:
    "The six POPIA consent purposes, what each one allows, what the default is, and what flipping it off changes for you.",
  category: "privacy",
  keywords: [
    "consent",
    "popia",
    "purpose",
    "searchability",
    "contact",
    "documents",
    "analytics",
    "vacancy matching",
    "opt-in",
  ],
  related: [
    "contact-reveal-how-it-works",
    "document-sharing-and-employer-access",
    "exporting-your-data-popia-section-23",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza is a POPIA-compliant platform, which means every
        personal-data use has to be tied to a specific consent purpose
        you&rsquo;ve granted. There are six purposes in total. Each is
        a toggle on the Privacy &amp; consent page. Flipping a toggle
        is logged with the date and the consent text version &mdash;
        that&rsquo;s the audit trail POPIA Section 11 requires.
      </p>

      <h2>The six purposes</h2>
      <ul>
        <li>
          <strong>Searchability.</strong> Default: <em>on</em>. Lets
          employers find you in /search results. Off = invisible to
          search, public profile URL returns 404 for everyone.
        </li>
        <li>
          <strong>Contact reveal.</strong> Default: <em>on</em>. Lets
          employers request your contact details after a successful
          invite or dossier reveal. Off = employers can&rsquo;t request
          contact at all; the &ldquo;request contact&rdquo; button is
          greyed out on your dossier.
        </li>
        <li>
          <strong>Document sharing.</strong> Default: <em>on</em>. Lets
          employers request to download your uploaded certificates
          (per-document, with a separate per-document confirmation).
          Off = certificate downloads aren&rsquo;t requestable.
        </li>
        <li>
          <strong>Aggregate analytics.</strong> Default: <em>on</em>.
          Lets the platform count you in cohort-level statistics
          (e.g. &ldquo;X graduates from this programme are employed in
          this province&rdquo;). Off = you&rsquo;re excluded from
          all aggregate analytics. Cohorts never include identifying
          data; this consent is about whether your row is counted.
        </li>
        <li>
          <strong>Outcomes research</strong> (optional). Default:{" "}
          <em>off</em>. Lets the platform link your data into long-form
          outcomes research (programme × institution × province ×
          graduation year, never cells under 10). Off (default) =
          you&rsquo;re not in the research dataset.
        </li>
        <li>
          <strong>Vacancy matching</strong> (optional). Default:{" "}
          <em>off</em>. Lets employers send you vacancy invitations.
          Off (default) = you&rsquo;re findable in search but
          can&rsquo;t be invited. Most active job seekers turn this on
          first.
        </li>
      </ul>

      <Callout type="warning" title="The two optionals are off by default for a reason">
        <p>
          Vacancy matching and outcomes research are <em>opt-in</em>:
          off until you turn them on. We don&rsquo;t want to make
          someone receivable for invitations they didn&rsquo;t agree to
          receive, and we don&rsquo;t want to count someone&rsquo;s
          career in research they didn&rsquo;t agree to be in. Active
          job-seeking usually requires turning vacancy matching on; if
          you&rsquo;re happily employed and just keeping your profile
          fresh, it&rsquo;s reasonable to leave it off.
        </p>
      </Callout>

      <h2>What gets logged when you flip a toggle</h2>
      <p>
        Each consent change writes one audit row: the purpose, the new
        state (granted / withdrawn), the timestamp, the version of the
        consent text you saw when you flipped it. If POPIA consent text
        for that purpose updates later, the platform asks you to
        re-confirm.
      </p>

      <DashboardLink href="/dashboard/privacy">Open Privacy &amp; consent</DashboardLink>
    </HelpProse>
  );
}
