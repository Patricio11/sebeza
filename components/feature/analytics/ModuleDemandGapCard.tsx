/**
 * Phase 13.6  Gov-side module-grain demand-vs-curriculum card.
 *
 * Sibling to <ProgrammeVsMarketCard> at one level deeper. Where the
 * programme card asks "which programmes leave demand on the table",
 * this one points at MODULES  the unit of work curriculum committees
 * can actually rewrite.
 *
 * Suppression-aware: the query already applied k=10 + complementary
 * passes; the card surfaces the k floor + the suppressed count + the
 * "limited data so far" empty state honestly, never hides them.
 *
 * Civic-Editorial typography. CSS-only bars; no charting lib.
 */

import { TrendingDown, BookOpen } from "lucide-react";
import type { ModuleGapResult } from "@/db/queries/curriculum";

interface Props {
  data: ModuleGapResult;
  /** When true, render the top-N. Default 10. The full set ships
   *  in the CSV export for analysts who need everything. */
  limit?: number;
}

export function ModuleDemandGapCard({ data, limit = 10 }: Props) {
  const cells = data.cells.slice(0, limit);
  const totalReturned = data.cells.length;

  return (
    <section
      aria-labelledby="module-gap-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <div className="flex items-center gap-2">
          <BookOpen
            className="size-4 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Module-grain
            </p>
            <h3 id="module-gap-h" className="font-display text-xl">
              Module  market gap
            </h3>
          </div>
        </div>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          {totalReturned} module{totalReturned === 1 ? "" : "s"} above floor
          {" · "}
          {data.suppressed} suppressed (k = {data.k})
        </span>
      </header>

      <p className="mb-4 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
        Modules ranked by{" "}
        <strong>employer demand × (5  editorial confidence)</strong>.
        High rank = market wants the skill + the module only touches it
        briefly. Where curriculum committees can move the dial fastest.
      </p>

      {cells.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-6 text-center text-xs text-[color:var(--color-ink-soft)]">
          No module-grain cells cleared the k = {data.k} floor for the
          current filter. Either the catalogue covers the in-demand
          skills well at the listed modules, or the labour-market
          signal is too thin to publish honestly. Both are valid
          outcomes; neither is hidden.
        </p>
      ) : (
        <ol className="grid gap-3">
          {cells.map((c, idx) => {
            const maxGap = cells[0]?.gap_delta ?? 1;
            const widthPct = Math.max(
              4,
              Math.round((c.gap_delta / maxGap) * 100),
            );
            return (
              <li
                key={`${c.module_slug}_${c.skill_slug}_${c.institution_slug ?? "_canon"}`}
                className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3"
              >
                <span className="font-display text-lg tabular-nums text-[color:var(--color-ink-soft)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{c.module_label}</span>
                    <span className="text-[color:var(--color-ink-soft)]">
                      {" "}→ {c.skill_label}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
                    <span className="tabular-nums">
                      demand {c.demand_score}
                    </span>
                    <span>·</span>
                    <span className="tabular-nums">
                      confidence {c.confidence}/5
                    </span>
                    {c.institution_slug ? (
                      <>
                        <span>·</span>
                        <span>{c.institution_slug}</span>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <span>canonical</span>
                      </>
                    )}
                  </p>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                  >
                    <div
                      className="h-full bg-[color:var(--color-ink)]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 self-start text-[0.7rem] uppercase tracking-[0.14em] text-[color:var(--color-ink)] tabular-nums">
                  <TrendingDown className="size-3" aria-hidden="true" />
                  gap {c.gap_delta}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-5 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-[0.7rem] uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
        Catalogue source: editorial module_skills rows only. LLM-suggested
        rows are admin-only until promoted.
      </p>
    </section>
  );
}
