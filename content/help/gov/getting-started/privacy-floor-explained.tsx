import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "privacy-floor-explained",
  title: "Privacy floor explained: k-anonymity + suppression",
  shortDescription:
    "Why cells with under 10 records are suppressed, why you never see individual seekers, and how to write reports that respect the floor.",
  category: "getting_started",
  keywords: [
    "privacy",
    "k-anonymity",
    "suppression",
    "popia",
    "aggregation",
    "floor",
    "10",
  ],
  related: [
    "what-sebenza-is-for-government",
    "what-suppressed-cells-mean",
    "your-first-hour-orientation",
  ],
  surfaceLink: "/gov",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The privacy floor is the rule that turns &ldquo;we collected
        data about millions of South Africans&rdquo; into &ldquo;we
        can publish labour-market statistics without re-identifying
        anyone.&rdquo; The rule is simple, the consequences are
        load-bearing.
      </p>

      <h2>The rule: k = 10</h2>
      <p>
        Any cell in any aggregate query that would represent fewer
        than 10 underlying records gets suppressed. The cell shows{" "}
        <em>limited data</em> instead of the count. This applies
        across every gov surface: provincial supply, shortage
        cells, curriculum-vs-demand cohorts, employment-status mix
        by nationality, every CSV export.
      </p>

      <h2>Why 10</h2>
      <p>
        Below 10, even &ldquo;aggregate&rdquo; data starts leaking
        individual identity. If a (profession &times; province ×
        nationality × graduation year) cell has 3 records, anyone
        with side information about that cohort can re-identify
        individuals. At 10, with the dimensions we slice on, the
        re-identification risk drops to a level that satisfies
        POPIA Section 19 and aligns with the international standard
        (Stats SA uses similar floors for IPUMS exports).
      </p>

      <h2>What suppression looks like in practice</h2>
      <ul>
        <li>
          <strong>Heatmap cells</strong> display as grey with a hatching
          pattern + the &ldquo;limited data&rdquo; chip on hover.
        </li>
        <li>
          <strong>CSV exports</strong> emit the literal token{" "}
          <code>SUPPRESSED</code> in the value column, not a zero
          or a blank, so downstream analysts know the difference
          between &ldquo;no data&rdquo; and &ldquo;data
          suppressed.&rdquo;
        </li>
        <li>
          <strong>The Policy Brief</strong> compresses suppressed
          regions into &ldquo;data thin in N municipalities, see
          full table&rdquo; rather than printing a sea of blanks.
        </li>
      </ul>

      <Callout type="warning" title="Don't try to defeat suppression by sub-querying">
        <p>
          A common temptation: if (profession A &times; province B)
          is suppressed, query (profession A &times; province B
          &times; nationality SA) hoping to slip under a different
          axis. The platform pre-aggregates with the suppression
          floor applied to <em>every</em> combination of dimensions,
          not just the one you queried. Sub-slicing doesn&rsquo;t
          reveal what the top-level slice suppressed; it just
          returns more suppressed cells. The floor is global.
        </p>
      </Callout>

      <h2>What you can never see, regardless of cell size</h2>
      <ul>
        <li>Individual seeker handles, names, IDs, contacts.</li>
        <li>Individual qualification certificates or work history rows.</li>
        <li>
          Decline-reason content tied to a specific seeker / vacancy
          pair (aggregate counts are surfaced; the individual
          decline event isn&rsquo;t).
        </li>
        <li>
          Individual audit-log rows about non-gov users (the platform
          shows gov users only their own audit trail).
        </li>
      </ul>

      <h2>Writing reports that respect the floor</h2>
      <p>
        Three habits to develop:
      </p>
      <ul>
        <li>
          Always quote the suppression chip in your tables when
          present (&ldquo;Data limited for n=N cells; see methodology
          note&rdquo;).
        </li>
        <li>
          Don&rsquo;t plot trends across a window where suppression
          appears in some weeks but not others &mdash; that creates
          a visual artifact. Use a longer window or annotate the
          break.
        </li>
        <li>
          For ministerial briefs, cite the LMI + headline cell counts;
          avoid sub-grouping below the level you&rsquo;d be
          comfortable publishing publicly. If a Treasury chart
          wouldn&rsquo;t survive press scrutiny, the underlying
          query probably shouldn&rsquo;t survive POPIA scrutiny.
        </li>
      </ul>
    </HelpProse>
  );
}
