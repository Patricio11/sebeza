import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-sebenza-is-for-government",
  title: "What Sebenza is for government users",
  shortDescription:
    "A 60-second orientation: a labour-market intelligence platform built from confirmed placement data. Four operating principles for the gov lens.",
  category: "getting_started",
  keywords: [
    "about",
    "overview",
    "government",
    "lmi",
    "labour market",
    "intelligence",
    "policy",
  ],
  related: [
    "your-first-hour-orientation",
    "privacy-floor-explained",
    "reading-the-lmi",
  ],
  surfaceLink: "/gov",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza is South Africa&rsquo;s national talent-intelligence
        platform. The gov workspace gives labour-market analysts,
        treasury staff, DHET officials, provincial governments and
        municipalities a privacy-grade view of the underlying signal
        &mdash; <strong>aggregated</strong>, never individual. Four
        operating principles shape what you see + how to read it.
      </p>

      <h2>One: the data is confirmed, not self-reported</h2>
      <p>
        The retention numbers, the supply counts, the placement
        figures &mdash; all of them are derived from the
        Placement-Truth rule: a hire counts only when an employer
        logged it on the platform with the audited contact-reveal
        step. Self-report doesn&rsquo;t enter the cohort. Whatever
        weakness our data has (early-stage adoption, sectoral
        skew), the line is honest.
      </p>

      <h2>Two: you see aggregates, never individuals</h2>
      <p>
        No surface in the gov workspace ever shows you a named
        seeker, an exact ID, contact details, or anything that
        could identify a single person. Cell-level counts under 10
        are suppressed; you see &ldquo;limited data&rdquo;
        instead. This is a feature: it&rsquo;s what makes the
        platform usable as policy evidence + what makes seekers
        willing to participate.
      </p>

      <h2>Three: the per-employer lookup is regulated</h2>
      <p>
        Some compliance work requires looking up a named employer
        (CIPC number, registered name) to read their employment-
        status mix. The per-employer-lookup surface allows that
        with mandatory friction: case-reference field, exact-match
        only (no autocomplete), every lookup audit-logged + reviewed
        by Sebenza admins via the Oversight log. You see the lookup
        in your own audit trail too.
      </p>

      <h2>Four: your access is logged, transparently</h2>
      <p>
        The audit posture is symmetric. Just as admins watch
        gov-user lookup patterns (the &ldquo;watch the watchers&rdquo;
        principle), gov users can see their own activity history in
        the Account page. The platform is built on mutual
        observability; that&rsquo;s the trust posture.
      </p>

      <Callout type="info" title="What we deliberately don't do">
        <p>
          We don&rsquo;t generate &ldquo;personalised&rdquo; lists of
          candidates for gov users to evaluate; we don&rsquo;t
          forward names; we don&rsquo;t broker introductions; we
          don&rsquo;t expose seeker IDs in any export. The gov
          workspace is an aggregate-analytics tool, not a back-door
          recruiting surface. If you find a feature missing that
          would change that posture, the answer is almost always
          &ldquo;we deliberately don&rsquo;t.&rdquo;
        </p>
      </Callout>

      <DashboardLink href="/gov">Open the overview</DashboardLink>
    </HelpProse>
  );
}
