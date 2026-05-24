/**
 * Phase 9.7.2  Province-scoped supply table, split by nationality_class.
 *
 * One row per profession. Each row shows the SA-citizen + foreign-
 * national counts as paired bars, or an em-dash if the cell was
 * suppressed (count below k OR dropped by complementary-suppression
 * because the visible cell could be derived from a row total).
 *
 * Sorted by total supply descending so the heaviest professions
 * lead. Top 12 to match the unsplit panel beside it on the page.
 */

import type { NationalitySupplyResult } from "@/db/queries/nationality";

export function NationalitySupplyTable({
  data,
}: {
  data: NationalitySupplyResult;
}) {
  // Group surviving cells by profession.
  const byProfession = new Map<
    string,
    {
      sa_citizen?: { supply: number; freshness: number };
      foreign_national?: { supply: number; freshness: number };
    }
  >();
  for (const c of data.cells) {
    const row = byProfession.get(c.profession) ?? {};
    row[c.nationality_class] = { supply: c.supply, freshness: c.freshness };
    byProfession.set(c.profession, row);
  }

  // Sort by visible total supply, descending. Cells with no visible
  // breakdown (both classes suppressed) won't appear in the loop body
  // since we filtered to surviving cells only.
  const ordered = Array.from(byProfession.entries())
    .map(([profession, row]) => ({
      profession,
      sa: row.sa_citizen?.supply ?? 0,
      fn: row.foreign_national?.supply ?? 0,
      saSuppressed: row.sa_citizen === undefined,
      fnSuppressed: row.foreign_national === undefined,
    }))
    .sort((a, b) => b.sa + b.fn - (a.sa + a.fn))
    .slice(0, 12);

  const max = Math.max(1, ...ordered.map((r) => Math.max(r.sa, r.fn)));
  const nfmt = new Intl.NumberFormat("en-ZA");

  if (ordered.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
        No (profession × nationality) cells cleared the k = {data.k} floor
        in this province. Either there are not enough profiles per cell
        yet, or the floor would re-identify individuals. Honest blank
        beats a confident wrong number.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
      <ul className="divide-y divide-[color:var(--color-hairline)]">
        {ordered.map((row) => (
          <li key={row.profession} className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-base">{row.profession}</span>
              <span className="text-xs text-[color:var(--color-ink-soft)]">
                total supply{" "}
                <span className="font-display tabular text-[color:var(--color-ink)]">
                  {nfmt.format(row.sa + row.fn)}
                </span>
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <Bar
                label="SA citizens"
                count={row.sa}
                max={max}
                toneClass="bg-[color:var(--color-brand)]"
                suppressed={row.saSuppressed}
                nfmt={nfmt}
              />
              <Bar
                label="Foreign nationals"
                count={row.fn}
                max={max}
                toneClass="bg-[color:var(--color-accent)]"
                suppressed={row.fnSuppressed}
                nfmt={nfmt}
              />
            </div>
          </li>
        ))}
      </ul>
      <footer className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-5 py-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        Floor k = {data.k} · {data.suppressed} cell
        {data.suppressed === 1 ? "" : "s"} suppressed · 2-class split only
        (no country-level data) · freshness-weighted
      </footer>
    </div>
  );
}

function Bar({
  label,
  count,
  max,
  toneClass,
  suppressed,
  nfmt,
}: {
  label: string;
  count: number;
  max: number;
  toneClass: string;
  suppressed: boolean;
  nfmt: Intl.NumberFormat;
}) {
  const pct = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 text-xs">
      <span className="text-[color:var(--color-ink-soft)]">{label}</span>
      <span
        aria-hidden="true"
        className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
      >
        {!suppressed && (
          <span
            className={`block h-full ${toneClass}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </span>
      <span className="text-right font-display tabular text-sm text-[color:var(--color-ink)]">
        {suppressed ? (
          <span className="text-[color:var(--color-ink-soft)]"></span>
        ) : (
          nfmt.format(count)
        )}
      </span>
    </div>
  );
}
