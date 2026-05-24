/**
 * Phase 9.7.4  Local-Hiring Opportunity Map.
 *
 * The actionable flip side of the Justification Index. Same data
 * source (`justificationIndexQuery`); this view filters to cells
 * classified `supply_available` and groups them by province so a
 * policy user can see WHERE local SA-citizen supply can plausibly
 * meet employer demand  the cells where local-hiring incentive
 * policy can land cleanly without harming employers in genuine
 * shortage cells (see /gov/shortage for the complement).
 *
 * Layout: one province per section, cells sorted by sa_supply
 * descending. Each cell carries a visual SA-supply bar (normalised
 * against the loudest cell across the whole result so cross-
 * province comparison reads correctly), the demand_score it's
 * meeting, and a drill-down to /search filtered to that cell.
 *
 * No new map libraries  CSS Grid + brand colours, in keeping with
 * the No-Flash Rule. The heatmap idea is a *grid of bars*, not a
 * choropleth.
 */

import { Link } from "@/i18n/navigation";
import { ArrowUpRight } from "lucide-react";
import type {
  JustificationCell,
  JustificationResult,
} from "@/db/queries/justification";

export function OpportunityHeatmap({
  data,
}: {
  data: JustificationResult;
}) {
  const opportunities = data.cells.filter(
    (c) => c.label === "supply_available",
  );

  if (opportunities.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
        No cells currently classified <em>local supply available</em>.
        Either there isn&rsquo;t enough demand activity from verified
        employer accounts yet, or the supply / demand ratios across
        every cell sit below 1.0. Honest blank, not guessed  the
        opportunity map only shows what the data supports.
      </p>
    );
  }

  // Normalise bar width against the loudest sa_supply value so cells
  // are comparable across provinces, not just within one.
  const maxSupply = Math.max(...opportunities.map((c) => c.sa_supply));

  // Group by province.
  const byProvince = new Map<string, JustificationCell[]>();
  for (const c of opportunities) {
    const list = byProvince.get(c.province) ?? [];
    list.push(c);
    byProvince.set(c.province, list);
  }
  const orderedProvinces = Array.from(byProvince.entries())
    .map(([province, cells]) => ({
      province,
      cells: cells.sort((a, b) => b.sa_supply - a.sa_supply),
      totalSupply: cells.reduce((sum, c) => sum + c.sa_supply, 0),
    }))
    .sort((a, b) => b.totalSupply - a.totalSupply);

  const nfmt = new Intl.NumberFormat("en-ZA");

  return (
    <div className="space-y-6">
      {orderedProvinces.map(({ province, cells, totalSupply }) => (
        <section
          key={province}
          className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]"
        >
          <header className="flex items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-brand-tint)] px-5 py-3">
            <h3 className="font-display text-lg text-[color:var(--color-brand-strong)]">
              {province}
            </h3>
            <span className="text-xs text-[color:var(--color-brand-strong)]">
              {cells.length} opportunity cell{cells.length === 1 ? "" : "s"}
              {" · "}
              {nfmt.format(Math.round(totalSupply))} freshness-weighted SA-citizen supply
            </span>
          </header>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {cells.map((c) => {
              const pct = maxSupply > 0 ? (c.sa_supply / maxSupply) * 100 : 0;
              return (
                <li
                  key={`${province}-${c.profession}`}
                  className="px-5 py-3"
                  title={[
                    `demand_score = ${c.demand_score.toFixed(2)}`,
                    `local_supply_ratio = ${c.local_supply_ratio.toFixed(2)}`,
                    `sa_supply = ${c.sa_supply.toFixed(2)}`,
                    `total_placements = ${c.total_placements}`,
                  ].join("  ·  ")}
                >
                  <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
                    <span className="font-display text-base capitalize text-[color:var(--color-ink)]">
                      {c.profession}
                    </span>
                    <Link
                      href={
                        `/search?q=${encodeURIComponent(c.profession)}&province=${encodeURIComponent(c.province)}` as never
                      }
                      prefetch={false}
                      className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-strong)] hover:underline"
                    >
                      See {nfmt.format(Math.round(c.sa_supply))} SA candidates
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                  >
                    <div
                      className="h-full bg-[color:var(--color-brand)]"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    Demand{" "}
                    <span className="font-mono tabular text-[color:var(--color-ink)]">
                      {c.demand_score.toFixed(2)}
                    </span>{" "}
                    · supply ratio{" "}
                    <span className="font-mono tabular text-[color:var(--color-ink)]">
                      {c.local_supply_ratio.toFixed(2)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
