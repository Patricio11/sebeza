import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "the-oversight-log-your-lookups",
  title: "The Oversight log: your lookups, under review",
  shortDescription:
    "Watch the watchers: every gov lookup is logged and reviewable by Sebenza admins. How that protects the platform's trust posture + you.",
  category: "employer_lookup",
  keywords: [
    "oversight",
    "watch the watchers",
    "audit",
    "lookups",
    "review",
    "transparency",
    "trust",
  ],
  related: [
    "case-reference-documenting-your-query",
    "per-employer-lookup-what-you-can-query",
    "your-activity-audit-trail",
  ],
  surfaceLink: "/gov/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza&rsquo;s admin staff have a dedicated surface called
        the Oversight log &mdash; a curated slice of the audit log
        focused on every government per-employer lookup and every
        nationality-split export. The principle is symmetric: just
        as gov users hold the platform&rsquo;s data accountable,
        the platform holds gov users accountable for how they query.
        This article explains the posture so you understand what&rsquo;s
        being reviewed + why it protects you.
      </p>

      <h2>What admins see about your lookups</h2>
      <ul>
        <li>
          Every lookup row: timestamp, your account, the org
          queried, the case reference you supplied.
        </li>
        <li>
          Aggregate patterns: who queried what, how often, what
          time of day, with what case-reference quality.
        </li>
        <li>
          Pre-computed pattern callouts: same-org repeats,
          municipality clusters, lookup-then-export sequences.
        </li>
      </ul>

      <h2>What admins do NOT see</h2>
      <ul>
        <li>
          Your reasoning beyond the case reference field. Internal
          reasoning notes in your own systems aren&rsquo;t accessible
          to admins; they only see what you submitted.
        </li>
        <li>
          Your team&rsquo;s case load or task assignments. Each
          row stands on its own.
        </li>
        <li>
          Other gov-workspace activity outside the regulated
          surfaces. Browsing the LMI or the Shortage page is not
          on the Oversight log; only the per-employer + nationality-
          export surfaces are.
        </li>
      </ul>

      <h2>How review works in practice</h2>
      <p>
        Admins read the Oversight log periodically (not in real-
        time). When a pattern surfaces, the conversation starts
        with your team lead, not with you. Most patterns resolve
        in five minutes when the team lead explains the case work
        driving them; a small minority become formal queries that
        get escalated to Sebenza&rsquo;s compliance lead and your
        director-level contact.
      </p>

      <Callout type="info" title="Why this protects you">
        <p>
          The Oversight log is the structural defense for gov
          users doing legitimate work. When a journalist or
          opposition MP asks &ldquo;is the government using this
          platform to surveil individuals?&rdquo;, the answer is
          &ldquo;every named-org query is logged, every lookup
          requires case-reference documentation, and the operating
          platform reviews patterns regularly.&rdquo; Without the
          log, every gov user&rsquo;s legitimate work would be
          under suspicion. With it, the suspicion is contained to
          the actual outlier patterns.
        </p>
      </Callout>

      <h2>Reading your own lookups</h2>
      <p>
        The same log, scoped to your account, appears on{" "}
        <code>/gov/account</code> under <em>Activity audit
        trail</em>. Use it to verify your team&rsquo;s lookup
        record before a quarterly review, or to reconstruct which
        orgs you queried for a specific piece of policy work.
      </p>

      <DashboardLink href="/gov/account">Open your activity audit trail</DashboardLink>
    </HelpProse>
  );
}
