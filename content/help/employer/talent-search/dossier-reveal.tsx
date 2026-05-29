import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "dossier-reveal",
  title: "Opening a dossier (the contact reveal gate)",
  shortDescription:
    "What's redacted in public; what reveals; the 30-day gate that unlocks Mark-as-Hired.",
  category: "talent_search",
  keywords: [
    "dossier",
    "reveal",
    "contact",
    "redaction",
    "audit",
    "30 day",
    "30-day",
    "gate",
    "phone",
    "email",
    "national id",
    "documents",
  ],
  related: [
    "searching",
    "logging-a-placement",
    "what-we-hold",
    "audit-log",
  ],
  surfaceLink: "/search",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The public profile + search row never carry identifying contact
        data. The Redaction Rule is structural: the platform&rsquo;s{" "}
        <em>PublicProfile</em> type doesn&rsquo;t include national ID,
        documents, phone or email. To see those, you open the
        seeker&rsquo;s dossier &mdash; an explicit, audited action.
      </p>

      <h2>What&rsquo;s public + what reveals</h2>
      <ul>
        <li>
          <strong>Always public</strong> (on search row + /p/[handle]):
          handle, display name (surname redacted to &ldquo;Thandeka
          M.&rdquo;), profession, seniority, city + province,
          nationality + isCitizen flag, top skills, status +
          freshness, work availability chips, completeness score,
          verification badge, member-since, Phase 9.22 current employer
          when picker-visible, Phase 9.23 employer-verified badge when
          within 12 months.
        </li>
        <li>
          <strong>Reveal-gated</strong> (only visible inside an
          opened dossier): phone, email, full surname, uploaded
          documents (qualifications, ID document if present), national
          ID (encrypted on storage; never displayed back even after
          reveal).
        </li>
      </ul>

      <Callout type="warning" title="National ID never displays back">
        <p>
          Even after a reveal, the seeker&rsquo;s national ID number
          isn&rsquo;t shown on the dossier view. The platform holds it
          encrypted (AES-256-GCM); it&rsquo;s used for KYC matching,
          government LMI rollups, and audit trail integrity. There&rsquo;s
          no UI surface that ever decrypts + displays it &mdash; not for
          you, not for admins, not even for the seeker themselves.
        </p>
      </Callout>

      <h2>Opening a dossier</h2>
      <p>
        From any search row, the dossier card, or a match-page row:{" "}
        <strong>Open dossier</strong>. The page is{" "}
        <strong>/employer/dossier/[handle]</strong>; opening it writes
        one audit row of kind <em>profile.contact.reveal</em> with
        meta.orgId + the handle. From the seeker&rsquo;s side, they see
        the reveal in their /dashboard/activity feed.
      </p>
      <p>
        The audit row is also what the 30-day reveal gate for
        Mark-as-Hired checks. Open the dossier today; you can log a
        placement for that seeker any time in the next 30 days without
        re-opening. After day 30, the gate resets &mdash; re-open the
        dossier before logging the hire.
      </p>

      <h2>The 30-day window in practice</h2>
      <p>
        Why this gate exists: to prevent &ldquo;ghost
        placements&rdquo; &mdash; logging hires for seekers your team
        never engaged with. The reveal is the engagement signal; the
        30-day window is generous enough that a normal hiring cycle
        doesn&rsquo;t hit it, tight enough that you can&rsquo;t log
        someone you talked to in 2024.
      </p>
      <Callout type="info" title="Accepted invitees bypass the gate">
        <p>
          When you Mark as filled via the vacancy detail page + the
          person was an accepted invitee on that vacancy, the gate
          doesn&rsquo;t apply &mdash; the invitation itself is the
          documented engagement. The gate kicks in for outside-pipeline
          hires (the typeahead path on the Mark-as-filled modal).
        </p>
      </Callout>

      <h2>Dossier panels</h2>
      <ul>
        <li>
          <strong>Person header</strong> &mdash; avatar, full name
          (post-reveal), profession + seniority, city, contact strip
          with phone + email.
        </li>
        <li>
          <strong>Bio + headline</strong> &mdash; the seeker&rsquo;s
          self-written narrative.
        </li>
        <li>
          <strong>Skills</strong> &mdash; full skill list with
          proficiency levels + per-skill years of experience.
        </li>
        <li>
          <strong>Experience</strong> &mdash; role history with start
          + end dates, organisation, city.
        </li>
        <li>
          <strong>Qualifications</strong> &mdash; titles + institutions
          + verification states. Documents (when uploaded) are
          downloadable via signed URLs.
        </li>
        <li>
          <strong>Academic profile</strong> &mdash; for student seekers,
          enrolment + programme + NQF level + expected graduation +
          NSFAS flag.
        </li>
        <li>
          <strong>Placement / employment history</strong> &mdash; if
          they&rsquo;ve been placed at your org previously, the row
          surfaces.
        </li>
      </ul>
    </HelpProse>
  );
}
