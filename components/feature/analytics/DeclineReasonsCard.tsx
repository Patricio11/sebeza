/**
 * Phase 9.8.7  "Why roles go unfilled" analytics card.
 *
 * Renders the decline-reason breakdown as one (profession × province)
 * cell per row, each containing horizontal bars by reason. Two modes:
 *
 *   - **Employer-private**  no suppression footer, no k-floor note;
 *     the card subtitle says "Your org's vacancies" so the recruiter
 *     knows they're looking at their own data.
 *   - **Cross-market**  suppression footer with k-floor + suppressed
 *     count + the standard "freshness-weighted" line.
 *
 * Pure CSS bars (no charting library)  mirrors the 9.7 nationality-
 * card idiom verbatim per the plan. Mobile-first: cells stack on
 * phones; each bar row is a 3-column grid that wraps cleanly at 360px
 * wide. No tooltip / no chart  the value sits in the third column.
 *
 * Cross-references the 9.7.3 Justification Index in the empty-state
 * + footer copy so a (profession × province) salary-driven gap reads
 * differently from a supply-driven one.
 */

import { Link } from "@/i18n/navigation";
import { Info, TrendingDown } from "lucide-react";

import {
  DECLINE_REASON_LABEL,
  DECLINE_REASON_VALUES,
  type DeclineReasonCell,
  type DeclineReasonResult,
  type DeclineReasonValue,
} from "@/db/queries/decline-reasons";
import { PROFESSIONS, PROVINCES } from "@/lib/mock/taxonomy";

interface Props {
  data: DeclineReasonResult;
  locale: string;
  /** Title above the card. Defaults to the cross-market wording. */
  title?: string;
  /** Sub-line under the title. Defaults to cross-market. */
  subtitle?: string;
  /** Optional CSV-export href (rendered as a Download link in the
   *  footer when set). */
  exportHref?: string;
}

interface GroupedCell {
  profession_slug: string;
  province_slug: string;
  totals: Record<DeclineReasonValue, number>;
  total: number;
  freshness: number;
}

const REASON_TONE: Record<DeclineReasonValue, string> = {
  // Distinct tones so each reason reads at a glance, all within the
  // Civic-Editorial palette (no new colour tokens introduced).
  already_employed: "bg-[color:var(--color-accent)]",
  salary_not_competitive: "bg-[color:var(--color-danger)]",
  location_not_feasible: "bg-[color:var(--color-brand)]",
  skills_mismatch: "bg-[color:var(--color-brand-strong)]",
  role_not_what_im_looking_for: "bg-[color:var(--color-ink-soft)]",
  other: "bg-[color:var(--color-hairline)]",
  unspecified: "bg-[color:var(--color-hairline)]",
};

export function DeclineReasonsCard({
  data,
  locale,
  title,
  subtitle,
  exportHref,
}: Props) {
  const nfmt = new Intl.NumberFormat(locale);
  const grouped = groupByCell(data.cells);

  const isEmpty = grouped.length === 0;
  const cardTitle =
    title ??
    (data.orgScoped
      ? "Why your invitations are being declined"
      : "Why roles go unfilled");
  const cardSubtitle =
    subtitle ??
    (data.orgScoped
      ? "Your org's vacancies. Aggregated across every declined invitation, weighted toward recent declines."
      : "Cross-market. One row per (profession × province) cell that meets the k-anonymity floor.");

  return (
    <section
      aria-labelledby="decline-reasons-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]"
    >
      <header className="border-b border-[color:var(--color-hairline)] px-5 py-4">
        <div className="flex items-start gap-3">
          <TrendingDown
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
              Demand signal · decline reasons
            </p>
            <h3
              id="decline-reasons-h"
              className="mt-1 font-display text-xl text-[color:var(--color-ink)]"
            >
              {cardTitle}
            </h3>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              {cardSubtitle}
            </p>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState orgScoped={data.orgScoped} k={data.k} />
      ) : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {grouped.map((cell) => (
            <li
              key={`${cell.profession_slug}::${cell.province_slug}`}
              className="px-5 py-4"
            >
              <CellHeader cell={cell} nfmt={nfmt} />
              <div className="mt-3 space-y-2">
                {DECLINE_REASON_VALUES.map((reason) => {
                  const count = cell.totals[reason] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Bar
                      key={reason}
                      label={DECLINE_REASON_LABEL[reason]}
                      count={count}
                      max={cell.total}
                      toneClass={REASON_TONE[reason]}
                      nfmt={nfmt}
                    />
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-5 py-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {data.orgScoped ? (
          <span>
            Your org · {grouped.length} cell{grouped.length === 1 ? "" : "s"} ·
            freshness-weighted (recent declines dominate)
          </span>
        ) : (
          <span>
            Floor k = {data.k} · {data.suppressed} cell
            {data.suppressed === 1 ? "" : "s"} suppressed (primary +
            complementary) · freshness-weighted
          </span>
        )}
        {exportHref && (
          <Link
            href={exportHref as never}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
          >
            Download CSV
          </Link>
        )}
      </footer>

      {!data.orgScoped && (
        <div className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-brand-tint)] px-5 py-3 text-xs text-[color:var(--color-ink)]">
          <Info
            className="mr-1 inline size-3.5 align-text-bottom text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <strong>Read together with the Justification Index.</strong> A
          (profession × province) cell where most declines cite{" "}
          <em>Salary not competitive</em> reinforces a local shortage
          the gap is real, it&rsquo;s just <em>salary-driven</em> rather than{" "}
          <em>supply-driven</em>. Open the{" "}
          <Link
            href={"/gov/shortage" as never}
            className="underline hover:text-[color:var(--color-brand-strong)]"
          >
            Skills-Shortage Justification Index
          </Link>{" "}
          alongside this card.
        </div>
      )}
    </section>
  );
}

function CellHeader({
  cell,
  nfmt,
}: {
  cell: GroupedCell;
  nfmt: Intl.NumberFormat;
}) {
  const professionLabel =
    PROFESSIONS.find((p) => p.slug === cell.profession_slug)?.label ??
    cell.profession_slug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === cell.province_slug)?.label ??
    cell.province_slug;

  // The headline reason for this cell  the largest bar gets called
  // out in the cell header so the reader has the punchline at a
  // glance ("Welders · EC: 60% declined  salary not competitive").
  const topReason = DECLINE_REASON_VALUES.reduce<{
    reason: DeclineReasonValue;
    count: number;
  } | null>((acc, r) => {
    const c = cell.totals[r] ?? 0;
    if (!acc || c > acc.count) return { reason: r, count: c };
    return acc;
  }, null);
  const topPct =
    topReason && cell.total > 0
      ? Math.round((topReason.count / cell.total) * 100)
      : 0;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="font-display text-base text-[color:var(--color-ink)]">
        {professionLabel} · {provinceLabel}
      </h4>
      <p className="text-xs text-[color:var(--color-ink-soft)]">
        {nfmt.format(cell.total)} decline{cell.total === 1 ? "" : "s"}
        {topReason && topReason.count > 0 && (
          <>
            {" "}· <strong>{topPct}%</strong>{" "}
            {DECLINE_REASON_LABEL[topReason.reason].toLowerCase()}
          </>
        )}
      </p>
    </div>
  );
}

function Bar({
  label,
  count,
  max,
  toneClass,
  nfmt,
}: {
  label: string;
  count: number;
  max: number;
  toneClass: string;
  nfmt: Intl.NumberFormat;
}) {
  const pct = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-xs md:grid-cols-[10rem_1fr_4rem]">
      <span className="truncate text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
      >
        <span
          className={`block h-full ${toneClass}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-right font-display tabular text-sm text-[color:var(--color-ink)]">
        {nfmt.format(count)}
      </span>
    </div>
  );
}

function EmptyState({ orgScoped, k }: { orgScoped: boolean; k: number }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-display text-base text-[color:var(--color-ink)]">
        Not enough decline data to show yet.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[color:var(--color-ink-soft)]">
        {orgScoped
          ? "Once your vacancy invitations start receiving declines (with reasons), the breakdown lands here. Decline-with-reason is optional for the seeker."
          : `Each (profession × province) cell needs at least ${k} declines before it can be shown publicly (k-anonymity floor). Cells below the floor are suppressed, never guessed.`}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function groupByCell(cells: DeclineReasonCell[]): GroupedCell[] {
  const map = new Map<string, GroupedCell>();
  for (const c of cells) {
    const key = `${c.profession_slug}::${c.province_slug}`;
    const existing = map.get(key);
    if (existing) {
      existing.totals[c.reason] = (existing.totals[c.reason] ?? 0) + c.count;
      existing.total += c.count;
      // Average the freshness across reasons (weighted by count would
      // be marginally more accurate; this is good enough for a footer
      // signal, not a primary statistic).
      existing.freshness = (existing.freshness + c.freshness) / 2;
    } else {
      const totals = {} as Record<DeclineReasonValue, number>;
      for (const r of DECLINE_REASON_VALUES) totals[r] = 0;
      totals[c.reason] = c.count;
      map.set(key, {
        profession_slug: c.profession_slug,
        province_slug: c.province_slug,
        totals,
        total: c.count,
        freshness: c.freshness,
      });
    }
  }
  // Sort by total declines descending  loudest signals first.
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
