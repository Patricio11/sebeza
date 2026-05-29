import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-sebenza-is-for-admins",
  title: "What Sebenza is for admins",
  shortDescription:
    "A 60-second orientation: you operate a POPIA-grade public-trust platform. The four operating principles that shape every console action.",
  category: "getting_started",
  keywords: [
    "about",
    "overview",
    "intro",
    "operator",
    "trust",
    "popia",
    "principles",
  ],
  related: [
    "first-login-and-2fa-setup",
    "admin-dashboard-tour",
    "team-roles-and-permissions",
  ],
  surfaceLink: "/admin",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        As an admin, you operate Sebenza on behalf of every seeker,
        employer, and government user who trusts the platform with
        their data. The console you&rsquo;re looking at is the
        platform&rsquo;s back-of-house: KYC review, qualification
        verification, moderation, POPIA compliance, taxonomy
        curation, oversight. Four operating principles shape every
        action you take.
      </p>

      <h2>One: every console action is audit-logged</h2>
      <p>
        There is no &ldquo;silent&rdquo; admin work. Approving a KYC
        submission, rejecting a qualification, suspending an account,
        toggling a feature flag &mdash; each writes an audit row with
        your admin ID, the timestamp, and the before/after state. The
        Audit log surface is searchable by actor; your work is
        legible to your colleagues and to compliance review.
      </p>

      <h2>Two: defaults err on the side of the user</h2>
      <p>
        When a KYC submission is ambiguous, the default disposition is
        <em> request more information</em>, not <em>reject</em>. When a
        report is borderline, the default is <em>warn</em>, not{" "}
        <em>suspend</em>. The platform&rsquo;s Verification-Honesty
        rule means a badge has to mean something; the same rule means
        you don&rsquo;t cheapen verification by rubber-stamping unclear
        cases.
      </p>

      <h2>Three: you never see plaintext PII you don&rsquo;t need</h2>
      <p>
        National ID numbers stay encrypted at rest; you see a masked
        view (last 4 digits) unless explicit KYC review opens the
        full value, and that open is itself audit-logged. Contact
        details (email, phone) never appear on admin surfaces &mdash;
        they&rsquo;re only revealed inside the seeker&rarr;employer
        flow you facilitate. POPIA Section 19 requires this minimal-
        access posture; this console is built around it.
      </p>

      <h2>Four: you don&rsquo;t hire, you don&rsquo;t recommend</h2>
      <p>
        Admins are not in the matching loop. You don&rsquo;t suggest
        candidates to employers, you don&rsquo;t boost or down-rank
        anyone in search results outside the documented signals
        (completeness, freshness, citizen boost), and you don&rsquo;t
        broker introductions. The matcher is honest because no
        operator hand is on the scale. If you ever feel pressure to
        intervene, escalate to your team lead instead.
      </p>

      <Callout type="warning" title="Your access is logged. So is your team's">
        <p>
          A spike of profile views from a single admin, an after-hours
          burst of audit-log queries, an unusual pattern of suspensions
          &mdash; all are visible to compliance review by design. This
          is not surveillance of you; it is the same accountability
          posture the platform asks of every other actor.
        </p>
      </Callout>

      <DashboardLink href="/admin">Open admin overview</DashboardLink>
    </HelpProse>
  );
}
