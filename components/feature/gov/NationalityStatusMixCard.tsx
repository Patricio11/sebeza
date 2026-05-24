/**
 * Phase 9.7.2  Status-mix card with optional SA-citizen / foreign-
 * national split.
 *
 * Renders paired bars per employment status. Cells suppressed by the
 * k-floor (lib/analytics/suppress.ts) simply don't appear  there's no
 * "too few" placeholder per bar, since revealing "we had data here but
 * didn't show it" undercuts the suppression. The card footer notes the
 * total suppressed count so policy users see the cost of the floor.
 */

import type { NationalityStatusResult } from "@/db/queries/nationality";

const STATUS_LABEL: Record<string, string> = {
  open_to_work: "Open to work",
  employed: "Employed",
  unemployed: "Unemployed",
  self_employed: "Self-employed",
  studying: "Studying",
};

export function NationalityStatusMixCard({
  data,
}: {
  data: NationalityStatusResult;
}) {
  // Group cells by status, splitting into the two classes.
  const byStatus = new Map<
    string,
    { sa_citizen?: number; foreign_national?: number; freshness: number }
  >();
  for (const c of data.cells) {
    const row = byStatus.get(c.status) ?? { freshness: 0 };
    row[c.nationality_class] = c.count;
    // We average freshness across the two classes for the row footer.
    row.freshness = (row.freshness + c.freshness) / 2;
    byStatus.set(c.status, row);
  }

  const ordered = [
    "employed",
    "open_to_work",
    "self_employed",
    "unemployed",
    "studying",
  ].filter((s) => byStatus.has(s));

  // Max value across all cells, for normalising the bar widths.
  const max = Math.max(
    1,
    ...data.cells.map((c) => c.count),
  );

  const nfmt = new Intl.NumberFormat("en-ZA");

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
      <ul className="divide-y divide-[color:var(--color-hairline)]">
        {ordered.length === 0 && (
          <li className="px-5 py-6 text-sm italic text-[color:var(--color-ink-soft)]">
            No status cells cleared the k = {data.k} floor. All cells
            suppressed (count below floor). Try again once the platform
            has more profiles in each status × nationality bucket.
          </li>
        )}
        {ordered.map((status) => {
          const row = byStatus.get(status)!;
          const sa = row.sa_citizen ?? 0;
          const fn = row.foreign_national ?? 0;
          return (
            <li key={status} className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-base">
                  {STATUS_LABEL[status] ?? status}
                </span>
                <span className="text-xs text-[color:var(--color-ink-soft)]">
                  freshness {(row.freshness * 100).toFixed(0)}%
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <Bar
                  label="SA citizens"
                  count={sa}
                  max={max}
                  toneClass="bg-[color:var(--color-brand)]"
                  suppressed={row.sa_citizen === undefined}
                  nfmt={nfmt}
                />
                <Bar
                  label="Foreign nationals"
                  count={fn}
                  max={max}
                  toneClass="bg-[color:var(--color-accent)]"
                  suppressed={row.foreign_national === undefined}
                  nfmt={nfmt}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-5 py-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        Floor k = {data.k} · {data.suppressed} cell
        {data.suppressed === 1 ? "" : "s"} suppressed (primary + complementary)
        · 2-class split only (no country-level data) · freshness-weighted
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
