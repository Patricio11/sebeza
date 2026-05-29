import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-we-hold",
  title: "What data Sebenza holds about your organisation",
  shortDescription:
    "POPIA-§16 transparency: the complete list of what we store, why, who can see it, and how to export it.",
  category: "privacy",
  keywords: [
    "popia",
    "privacy",
    "data",
    "transparency",
    "what we hold",
    "export",
    "delete",
    "right to be forgotten",
    "encryption",
  ],
  related: [
    "audit-log",
    "kyc",
    "dossier-reveal",
  ],
  surfaceLink: "/employer/organisation",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        POPIA §16 requires us to tell you exactly what data we hold
        about your organisation, why, and what your rights are. This
        article is the canonical answer. If you ever need a written
        version for compliance, you can also export it from{" "}
        <strong>/employer/organisation</strong>.
      </p>

      <h2>What we store about your organisation</h2>
      <ul>
        <li>
          <strong>Identity</strong>: trading name, CIPC registration
          number, industry, size band, registered address, VAT
          number if provided.
        </li>
        <li>
          <strong>KYC documents</strong>: the four required documents
          (company registration, tax clearance, proof of address, bank
          confirmation), encrypted on storage. Cleared on admin reject
          (you re-upload); kept while verified.
        </li>
        <li>
          <strong>Verification state + history</strong>: current state
          (unverified / pending / verified / rejected), verifiedAt,
          verifiedByUserId (which admin), rejectionReason / adminNote
          when applicable.
        </li>
        <li>
          <strong>Team members</strong>: user IDs, roles, joinedAt,
          suspendedAt timestamps. Member email addresses live on the
          users table (not the org).
        </li>
        <li>
          <strong>Vacancies</strong>: every vacancy you&rsquo;ve ever
          created, with full lifecycle history.
        </li>
        <li>
          <strong>Invitations</strong>: every vacancy invitation, with
          state transitions + responses + decline reasons + the
          PII-flagged personal notes.
        </li>
        <li>
          <strong>Placements</strong>: every Sebenza-confirmed hire,
          with the full Phase 9.20 lifecycle history (check-ins,
          departures, internal notes).
        </li>
        <li>
          <strong>Shortlist pools</strong>: the named pools + their
          membership history (add / remove audit).
        </li>
        <li>
          <strong>Saved searches</strong>: the filter definitions +
          last-run-at timestamps + the hashed result-set fingerprint.
        </li>
        <li>
          <strong>Audit log</strong>: every action your team took on
          the platform, indefinitely.
        </li>
      </ul>

      <h2>What we DO NOT store</h2>
      <ul>
        <li>
          Performance reviews, warnings, disciplinary records on your
          employees (HRIS, Phase 9.20 D0).
        </li>
        <li>
          Salary or payroll runs beyond the optional placement
          salary_band (a single field, never historical pay).
        </li>
        <li>
          Leave balances, sick leave reasons.
        </li>
        <li>
          Employment contracts or contract documents.
        </li>
        <li>
          The reason behind a dismissal (Phase 9.20 D4 &mdash; category
          only).
        </li>
        <li>
          Contact emails of third parties you asked us to email for
          employment verification (Phase 9.23 D4 &mdash; deleted within
          14 days regardless of outcome).
        </li>
      </ul>

      <h2>Who can see your data</h2>
      <ul>
        <li>
          <strong>Your team</strong>: Owners see everything; Recruiters
          see everything except billing; Viewers see read-only versions
          of every editor surface (vacancies, placements, invitations,
          dossiers).
        </li>
        <li>
          <strong>Seekers</strong>: see attribution of who invited
          them + the role + your org name. They never see the
          vacancy&rsquo;s salary band, your description, your
          internal placement notes.
        </li>
        <li>
          <strong>Sebenza admins</strong>: KYC reviewers see your
          uploaded documents during review (audited). Otherwise admins
          access org data only on the basis of a specific compliance
          incident; every access writes an audit row.
        </li>
        <li>
          <strong>National LMI / Government rollups</strong>: receive
          aggregate-only data with k=10 floor for any cell that maps
          back to a single org (k-anonymity).
        </li>
      </ul>

      <Callout type="info" title="Encryption posture">
        <p>
          KYC documents + seeker national-ID numbers are encrypted at
          rest with AES-256-GCM, key rotated per platform-settings
          policy. The platform deliberately doesn&rsquo;t decrypt + show
          national-ID values anywhere; they exist for KYC matching +
          government LMI integrity only.
        </p>
      </Callout>

      <h2>Your rights under POPIA</h2>
      <ul>
        <li>
          <strong>Access</strong>: export everything via the data
          export endpoint at <strong>/api/admin/oversight/export</strong>
          (admin-gated; contact support).
        </li>
        <li>
          <strong>Correction</strong>: edit any of your organisation&rsquo;s
          details directly on the dashboard. Audit trail captures the
          change.
        </li>
        <li>
          <strong>Deletion</strong>: org deletion is admin-mediated
          (we don&rsquo;t expose a self-serve delete; the data is
          structurally entangled with the seekers you interacted with).
          Contact support to initiate.
        </li>
        <li>
          <strong>Objection</strong>: you can object to specific
          processing by contacting support; the platform reviews
          objections individually.
        </li>
      </ul>
    </HelpProse>
  );
}
