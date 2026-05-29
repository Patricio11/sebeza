import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "what-suppressed-cells-mean",
  title: "What 'suppressed' cells actually mean",
  shortDescription:
    "Three reasons a cell can be suppressed and how to read it in each case. Why suppression is not the same as 'no data' or 'zero.'",
  category: "curriculum_outcomes",
  keywords: [
    "suppressed",
    "limited data",
    "k-anonymity",
    "small cohort",
    "missing",
    "zero",
  ],
  related: [
    "privacy-floor-explained",
    "curriculum-vs-market-demand",
    "programme-cohort-outcomes-and-retention",
  ],
  surfaceLink: "/gov/curriculum",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        &ldquo;Suppressed&rdquo; is the most-misread chip on the
        gov surfaces. It is not zero, it is not no-data, it is not
        broken &mdash; it&rsquo;s a deliberate withhold to protect
        identifiability. Three distinct reasons trigger
        suppression; reading them correctly changes the policy
        story.
      </p>

      <h2>Reason 1: count below k = 10</h2>
      <p>
        The most common. The cell&rsquo;s underlying record count
        is below the privacy floor. The aggregate isn&rsquo;t
        zero; it&rsquo;s small enough that publishing it would
        risk re-identification of individuals in the cell. In
        curriculum context this often means a small programme, or
        a programme in its early years, or a niche
        province-profession combination.
      </p>

      <h2>Reason 2: low confidence after composition</h2>
      <p>
        Some signals (alignment scores, cohort outcomes) are
        composites of multiple underlying queries. If any one of
        the components is below threshold, the composite is
        suppressed even when the headline count looks fine. This
        catches cases where a graduate count is healthy but the
        Sebenza-confirmed-placement subset is tiny.
      </p>

      <h2>Reason 3: high-sensitivity dimension</h2>
      <p>
        A small handful of queries slice on dimensions deemed
        high-sensitivity by Sebenza&rsquo;s POPIA policy
        (nationality cross-tabbed with very granular geography is
        the main one). These have a higher effective floor; even at
        counts that would normally pass, the suppression chip can
        trigger.
      </p>

      <h2>How to read each in a brief</h2>
      <ul>
        <li>
          <strong>Reason 1 cells</strong> often resolve as the
          platform&rsquo;s footprint grows. Don&rsquo;t cite the
          cell; cite the trend in surrounding cells + the
          methodology note.
        </li>
        <li>
          <strong>Reason 2 cells</strong> sometimes resolve when one
          component matures. Track them; they&rsquo;re a forward-
          indicator of when fuller data will become available.
        </li>
        <li>
          <strong>Reason 3 cells</strong> are deliberate; they
          won&rsquo;t resolve. If your brief needs that specific
          breakdown, the answer is &ldquo;the platform&rsquo;s
          policy is to not publish that.&rdquo; Cite the policy,
          not the missing number.
        </li>
      </ul>

      <Callout type="warning" title="Suppressed is not the same as zero">
        <p>
          A common mistake: plotting suppressed cells as zero on a
          chart. The chart then shows a hole that looks like an
          absence. In practice the data exists; we&rsquo;re just
          not publishing it. Use the hatched-pattern overlay (every
          gov chart supports it) so the visual indicates &ldquo;data
          withheld&rdquo; rather than &ldquo;data absent.&rdquo;
        </p>
      </Callout>
    </HelpProse>
  );
}
