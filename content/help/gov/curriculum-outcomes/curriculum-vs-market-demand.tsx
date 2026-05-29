import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "curriculum-vs-market-demand",
  title: "Curriculum vs market demand",
  shortDescription:
    "DHET-focused: comparing what tertiary programmes are producing against what employers are hiring for, by province and by programme.",
  category: "curriculum_outcomes",
  keywords: [
    "curriculum",
    "demand",
    "dhet",
    "tertiary",
    "programme",
    "university",
    "tvet",
    "alignment",
  ],
  related: [
    "programme-cohort-outcomes-and-retention",
    "what-suppressed-cells-mean",
    "shortage-justification-index-explained",
  ],
  surfaceLink: "/gov/curriculum",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Curriculum vs Demand surface answers a single question
        per cell: <em>&ldquo;is this programme in this province
        producing graduates whose skill profile matches local
        market demand?&rdquo;</em> DHET uses this for curriculum
        review; provincial education departments use it for
        programme-funding decisions; tertiary institutions use it
        (via DHET intermediated reports) for self-assessment.
      </p>

      <h2>The two axes</h2>
      <ul>
        <li>
          <strong>Curriculum output.</strong> The skill profile of
          recent graduates from a programme &mdash; the typical
          skills graduates carry on their profiles when they
          register on Sebenza in the 2 years after graduation.
          Inferred from actual profile data, not from the
          programme&rsquo;s prospectus.
        </li>
        <li>
          <strong>Market demand.</strong> The skill profile employers
          ask for in vacancies in the same province, weighted by
          invitation volume over the last 13 weeks.
        </li>
      </ul>
      <p>
        The cell value is the cosine similarity between the two
        skill vectors. 1.0 = perfect alignment; 0 = no overlap.
        Real cells cluster in 0.350.75; below 0.35 is a
        misalignment worth investigating.
      </p>

      <h2>Reading a programme&rsquo;s row</h2>
      <p>
        Open a programme (e.g. &ldquo;BCom Accounting,
        Free State&rdquo;) and you see:
      </p>
      <ul>
        <li>
          <strong>Alignment score</strong> for that programme in
          that province.
        </li>
        <li>
          <strong>Skills graduates have that are in demand.</strong>{" "}
          The healthy overlap.
        </li>
        <li>
          <strong>Skills graduates have that are not in demand.</strong>{" "}
          Curriculum content that may be academically valuable but
          isn&rsquo;t driving placement in this province.
        </li>
        <li>
          <strong>Skills in demand that graduates don&rsquo;t
          have.</strong> The gap. The most actionable column for
          curriculum revision: what should the programme add or
          emphasise more?
        </li>
        <li>
          <strong>Cohort outcome chart.</strong> Placement rate at
          6, 12, 24 months for recent cohorts of this programme in
          this province. The retention signal complements the
          alignment signal &mdash; high alignment with low retention
          tells you the curriculum matches what employers ask for
          but the role+work-environment fit isn&rsquo;t holding.
        </li>
      </ul>

      <Callout type="info" title="Suppressed cells appear when cohorts are too small">
        <p>
          A programme that&rsquo;s produced fewer than 10 graduates
          who registered on Sebenza in the last 2 years shows as{" "}
          <em>limited data</em>. This is common for niche programmes
          + new programmes; it isn&rsquo;t a quality signal, just
          a data-volume one. Cross-reference with HEMIS for
          enrolment context.
        </p>
      </Callout>

      <h2>Province + programme filters</h2>
      <p>
        Both filters are at the top of the page. Use them in
        combination &mdash; a national view averages out important
        provincial variance, and a single-province view of all
        programmes is too noisy to read. The most useful queries
        are usually <em>&ldquo;this programme across all
        provinces&rdquo;</em> (for institutional comparisons) and{" "}
        <em>&ldquo;this province across all programmes in a
        sector&rdquo;</em> (for provincial planning).
      </p>

      <DashboardLink href="/gov/curriculum">Open Curriculum vs Demand</DashboardLink>
    </HelpProse>
  );
}
