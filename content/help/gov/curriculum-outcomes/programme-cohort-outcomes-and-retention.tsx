import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "programme-cohort-outcomes-and-retention",
  title: "Programme cohort outcomes + retention",
  shortDescription:
    "Placement rates at 6 / 12 / 24 months by programme + province. How retention complements alignment. What 'cohort' means here.",
  category: "curriculum_outcomes",
  keywords: [
    "cohort",
    "outcomes",
    "retention",
    "programme",
    "placement rate",
    "graduate",
    "dhet",
  ],
  related: [
    "curriculum-vs-market-demand",
    "what-suppressed-cells-mean",
  ],
  surfaceLink: "/gov/curriculum",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        For each programme × province cell, the platform tracks
        graduate placement rates over time: 6, 12, 24, and 36 months
        from the platform-confirmed first placement. These rates are
        the <em>retention signal</em> &mdash; what fraction of
        Sebenza-confirmed placements from that programme&rsquo;s
        cohort were still active at each check-in window.
      </p>

      <h2>What &ldquo;cohort&rdquo; means here</h2>
      <p>
        A programme&rsquo;s cohort, in Sebenza terms, is the set of
        seekers who graduated from that programme in a given year +
        province + had at least one confirmed platform placement.
        It is <em>not</em> the institution&rsquo;s registered
        cohort; many graduates never register on Sebenza, and many
        who register never log a placement here. The retention
        signal is informative about <strong>the platform-visible
        subset</strong>, which is most useful when that subset is
        large + reasonably representative.
      </p>

      <h2>How placement rate is computed at each window</h2>
      <ul>
        <li>
          <strong>6 months.</strong> Of placements confirmed from
          this cohort, what share were still active at the 6-month
          check-in (employer responded <em>active</em> or{" "}
          <em>moved internally</em>).
        </li>
        <li>
          <strong>12 / 24 / 36 months.</strong> Same calculation at
          each annual window. Each placement counts once at each
          window; non-respondent check-ins are excluded from the
          denominator at that window (rather than treated as
          departures).
        </li>
      </ul>

      <h2>Reading retention + alignment together</h2>
      <ul>
        <li>
          <strong>High alignment, high retention</strong> &mdash;
          the programme is producing graduates whose skills match
          demand and whose placements are sticking. The signal you
          look for when evaluating a programme for funding
          continuation.
        </li>
        <li>
          <strong>High alignment, low retention</strong> &mdash;
          the curriculum is matched but placements aren&rsquo;t
          sticking. Investigate whether the misalignment is on
          work-environment / wage expectations or on a structural
          mismatch the alignment score doesn&rsquo;t capture
          (industry that has high churn).
        </li>
        <li>
          <strong>Low alignment, high retention</strong> &mdash;
          rare but interesting. The curriculum doesn&rsquo;t match
          what employers ask for, but the small share of graduates
          placing through Sebenza are sticking. Often signals a
          niche where the programme produces an unusual but
          valuable combination.
        </li>
        <li>
          <strong>Low alignment, low retention</strong> &mdash;
          the strongest negative signal in the data. Curriculum
          review priority.
        </li>
      </ul>

      <Callout type="warning" title="Retention is not employability">
        <p>
          A programme can have low platform-visible retention not
          because its graduates are bad employees but because they
          consistently get hired into sectors / employers that
          don&rsquo;t use Sebenza to confirm placement, so their
          continued employment isn&rsquo;t recorded here. The
          retention number is honest about what it measures (Sebenza-
          tracked placements) and not about what it doesn&rsquo;t
          (employment outside the platform&rsquo;s observability).
        </p>
      </Callout>
    </HelpProse>
  );
}
