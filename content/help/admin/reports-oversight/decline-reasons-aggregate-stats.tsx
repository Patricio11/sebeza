import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "decline-reasons-aggregate-stats",
  title: "Decline-reasons: aggregate platform stats",
  shortDescription:
    "The platform-level decline-reason distribution by province + profession. Used for product feedback and market-signal reports.",
  category: "reports_oversight",
  keywords: [
    "decline reasons",
    "aggregate",
    "stats",
    "report",
    "province",
    "profession",
    "salary",
  ],
  related: [
    "decline-reason-oversight-and-patterns",
    "cohort-retention-and-outcomes",
    "monitoring-gov-lookups-for-patterns",
  ],
  surfaceLink: "/admin/oversight",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Across all employers, what reasons do seekers cite when
        declining invitations? The aggregate decline-reason panel
        answers that, broken down by province + profession. This is
        a product-feedback + market-signal view, not a moderation
        view &mdash; the moderation lens is documented separately in{" "}
        <em>Decline-reason oversight + patterns</em>.
      </p>

      <h2>What the panel shows</h2>
      <ul>
        <li>
          Decline counts per reason category, summed across all
          employers, over the time window you select (30 / 90 / 365
          days).
        </li>
        <li>
          A heatmap broken down by (profession &times; province)
          &mdash; cells coloured by the dominant reason, suppressed
          when count is under 10 (k-anonymity).
        </li>
        <li>
          A diff view: this period vs the previous equivalent
          period. Movement on a category over time is more
          informative than the absolute distribution.
        </li>
      </ul>

      <h2>What the stats are used for</h2>
      <ul>
        <li>
          <strong>Product feedback.</strong> If
          &ldquo;wrong-type-of-role&rdquo; declines spike, the
          vacancy-creation form might be missing a filter or letting
          employers mis-tag work type.
        </li>
        <li>
          <strong>Government brief inputs.</strong> Gov users pull
          the same data through a different lens for labour-market
          intelligence reports. The admin aggregate panel + the gov
          surface read the same underlying counts.
        </li>
        <li>
          <strong>Internal benchmarks.</strong> &ldquo;What does a
          healthy decline distribution look like?&rdquo; The answer
          shifts over time; the panel is how we keep the baseline
          honest.
        </li>
      </ul>

      <Callout type="info" title="What the stats are NOT for">
        <p>
          They&rsquo;re not for naming-and-shaming specific
          employers; that&rsquo;s the moderation panel&rsquo;s job
          and it has different access controls. They&rsquo;re not
          for telling individual seekers what other seekers in their
          cohort declined &mdash; aggregate data flows up to the
          platform, not back down to individual users.
        </p>
      </Callout>

      <h2>Exporting the data</h2>
      <p>
        The panel has an Export to CSV button (Lead-tier). Use for
        the monthly compliance report or to share with the
        product team. Exports write an audit row capturing the
        time window + the dimensions you exported. CSV downloads
        always include the suppressed-cells indicator so a reader
        who doesn&rsquo;t know about k-anonymity doesn&rsquo;t
        misread an empty cell as &ldquo;zero declines.&rdquo;
      </p>
    </HelpProse>
  );
}
