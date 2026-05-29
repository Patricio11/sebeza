import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "your-activity-audit-trail",
  title: "Your activity audit trail + POPIA rights",
  shortDescription:
    "What's in your own audit trail, how to export it, and the POPIA Section 23 rights you have over the data the gov workspace holds about you.",
  category: "account_oversight",
  keywords: [
    "audit trail",
    "activity",
    "popia",
    "section 23",
    "export",
    "data subject rights",
    "gov account",
  ],
  related: [
    "two-factor-authentication",
    "the-oversight-log-your-lookups",
    "case-reference-documenting-your-query",
  ],
  surfaceLink: "/gov/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Your gov account has a personal audit trail on the Account
        page &mdash; every regulated action you&rsquo;ve taken on
        the platform, with the case references you supplied. The
        platform also holds personal data about you (name, work
        email, department, sign-in history) which is subject to
        the same POPIA Section 23 rights as any other user&rsquo;s.
      </p>

      <h2>What&rsquo;s in your audit trail</h2>
      <ul>
        <li>
          Every per-employer lookup you ran: timestamp, org
          queried, case reference, the result you got back.
        </li>
        <li>
          Every export you downloaded: timestamp, export type, the
          filters you applied.
        </li>
        <li>
          Every nationality-split toggle you flipped on the
          Overview page.
        </li>
        <li>
          Every sign-in event: timestamp, IP family (not exact
          address), device fingerprint.
        </li>
        <li>
          Every 2FA event: enrolment, reset, backup-code usage.
        </li>
      </ul>

      <h2>What&rsquo;s NOT in your audit trail</h2>
      <ul>
        <li>
          Routine browsing of the LMI, Provinces, Shortage,
          Curriculum pages &mdash; these are normal analytical
          surfaces, not regulated lookups, so they don&rsquo;t
          generate audit rows on you.
        </li>
        <li>
          Aggregate analytics about other users (gov colleagues,
          seekers, employers). Your audit trail is yours alone.
        </li>
      </ul>

      <h2>Exporting your audit trail</h2>
      <p>
        The Exports page has an &ldquo;Audit log&rdquo; card scoped
        to your own activity. Download as CSV; use for quarterly
        team-internal review, for compliance documentation, or to
        reconstruct which orgs you queried for a specific piece of
        policy work.
      </p>

      <h2>POPIA rights over your gov-workspace data</h2>
      <ul>
        <li>
          <strong>Right of access (s.23).</strong> Get a copy of
          all data we hold about your account. Self-served via
          the Exports page.
        </li>
        <li>
          <strong>Right to correction (s.24).</strong> Fix anything
          wrong about your account profile. The basics
          (name, contact email) are editable on the Account page;
          larger fixes go via your department&rsquo;s IT contact
          to Sebenza compliance.
        </li>
        <li>
          <strong>Right to deletion (s.24(1)(b)).</strong> Delete
          your account. Note: gov account deletion is more
          consequential than seeker account deletion because the
          audit trail persists for compliance reasons (your
          regulated lookups are kept even after your account is
          closed, with your identifying fields hashed). The
          deletion request goes via your department + Sebenza
          compliance jointly.
        </li>
        <li>
          <strong>Right to object to processing (s.11(3)).</strong>{" "}
          If you object to a specific processing the platform does
          on your gov-workspace data, the path is the same as
          deletion &mdash; departmental contact + Sebenza compliance.
        </li>
      </ul>

      <Callout type="info" title="The Oversight log retention exceeds normal audit retention">
        <p>
          Standard audit-log rows are kept 5 years per the
          platform&rsquo;s retention policy. Regulated-lookup rows
          (your per-employer queries + nationality-split exports)
          are kept for 7 years for compliance with public-records
          standards. The retention difference is documented in
          the methodology footer; it&rsquo;s the reason the right
          to deletion on a gov account leaves behind hashed audit
          rows rather than a full erasure.
        </p>
      </Callout>

      <DashboardLink href="/gov/account">Open your audit trail</DashboardLink>
    </HelpProse>
  );
}
