/**
 * Phase 9.13.4  "Why learners stall" analytics card.
 *
 * Renders the stall-reason breakdown as one (skill × province) cell
 * per row, each containing horizontal bars by abandon reason. Mirrors
 * the 9.8.7 `<DeclineReasonsCard>` idiom verbatim (same visual
 * language, same suppression footer, same Civic-Editorial palette).
 *
 * Cross-references the 9.8.7 decline-reasons card + 9.7.3
 * Justification Index in the footer so a (skill × province) gap reads
 * differently when it's *cost-driven* vs *quality-driven* vs
 * *time-driven*. Different interventions land on each.
 */

import { Link } from "@/i18n/navigation";
import { Info, TrendingDown } from "lucide-react";

import {
  ABANDON_REASON_LABEL,
  type AbandonReasonValue,
} from "@/lib/seeker/learning-types";
import type {
  StallReasonCell,
  StallReasonResult,
} from "@/db/queries/stall-reasons";
import { PROVINCES, SKILLS } from "@/lib/mock/taxonomy";

interface Props {
  data: StallReasonResult;
  locale: string;
  title?: string;
  subtitle?: string;
  exportHref?: string;
}

interface GroupedCell {
  skill_slug: string;
  province_slug: string;
  totals: Record<AbandonReasonValue, number>;
  total: number;
  freshness: number;
}

const REASON_TONE: Record<AbandonReasonValue, string> = {
  too_expensive: "bg-[color:var(--color-danger)]",
  no_time: "bg-[color:var(--color-accent)]",
  course_quality: "bg-[color:var(--color-brand-strong)]",
  access_transport: "bg-[color:var(--color-brand)]",
  changed_direction: "bg-[color:var(--color-ink-soft)]",
  too_difficult: "bg-[color:var(--color-hairline)]",
  other: "bg-[color:var(--color-hairline)]",
};

const ABANDON_REASON_VALUES: AbandonReasonValue[] = [
  "too_expensive",
  "no_time",
  "course_quality",
  "access_transport",
  "changed_direction",
  "too_difficult",
  "other",
];

export function StallReasonsCard({
  data,
  locale,
  title,
  subtitle,
  exportHref,
}: Props) {
  const nfmt = new Intl.NumberFormat(locale);
  const grouped = groupByCell(data.cells);
  const isEmpty = grouped.length === 0;

  const cardTitle = title ?? "Why learners stall";
  const cardSubtitle =
    subtitle ??
    "Cross-market. One row per (skill × province) cell that meets the k-anonymity floor + the outcomes_research consent gate.";

  return (
    <section
      aria-labelledby="stall-reasons-h"
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
              Supply signal · learning stalls
            </p>
            <h3
              id="stall-reasons-h"
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
        <EmptyState k={data.k} />
      ) : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {grouped.map((cell) => (
            <li
              key={`${cell.skill_slug}::${cell.province_slug}`}
              className="px-5 py-4"
            >
              <CellHeader cell={cell} nfmt={nfmt} />
              <div className="mt-3 space-y-2">
                {ABANDON_REASON_VALUES.map((reason) => {
                  const count = cell.totals[reason] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Bar
                      key={reason}
                      label={ABANDON_REASON_LABEL[reason]}
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
        <span>
          Floor k = {data.k} · {data.suppressed} cell
          {data.suppressed === 1 ? "" : "s"} suppressed (primary +
          complementary) · freshness-weighted · outcomes_research consent gate
        </span>
        {exportHref && (
          <Link
            href={exportHref as never}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
          >
            Download CSV
          </Link>
        )}
      </footer>

      <div className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-brand-tint)] px-5 py-3 text-xs text-[color:var(--color-ink)]">
        <Info
          className="mr-1 inline size-3.5 align-text-bottom text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <strong>
          Compare with employer decline reasons above + curriculum coverage.
        </strong>{" "}
        A salary-driven employer gap reads differently than a learning-cost-
        driven stall  three different interventions land on each. Open{" "}
        <Link
          href={"/gov/curriculum" as never}
          className="underline hover:text-[color:var(--color-brand-strong)]"
        >
          Curriculum vs demand
        </Link>{" "}
        to see whether the affected skills are even being taught.
      </div>
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
  const skillLabel =
    SKILLS.find((s) => s.slug === cell.skill_slug)?.label ?? cell.skill_slug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === cell.province_slug)?.label ??
    cell.province_slug;

  const topReason = ABANDON_REASON_VALUES.reduce<{
    reason: AbandonReasonValue;
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
        {skillLabel} · {provinceLabel}
      </h4>
      <p className="text-xs text-[color:var(--color-ink-soft)]">
        {nfmt.format(cell.total)} stall{cell.total === 1 ? "" : "s"}
        {topReason && topReason.count > 0 && (
          <>
            {" "}· <strong>{topPct}%</strong>{" "}
            {ABANDON_REASON_LABEL[topReason.reason].toLowerCase()}
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
    <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-xs md:grid-cols-[12rem_1fr_4rem]">
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

function EmptyState({ k }: { k: number }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-display text-base text-[color:var(--color-ink)]">
        Limited data so far.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[color:var(--color-ink-soft)]">
        Each (skill × province) cell needs at least {k} matching abandoned
        learning items from learners with <em>outcomes_research</em> consent
        granted before it can be shown publicly (k-anonymity floor +
        complementary suppression). The floor is a privacy protection, not
        a bug  cells unsuppress as more learners use the platform.
      </p>
    </div>
  );
}

function groupByCell(cells: StallReasonCell[]): GroupedCell[] {
  const map = new Map<string, GroupedCell>();
  for (const c of cells) {
    const key = `${c.skill_slug}::${c.province_slug}`;
    const existing = map.get(key);
    if (existing) {
      existing.totals[c.reason] = (existing.totals[c.reason] ?? 0) + c.count;
      existing.total += c.count;
      existing.freshness = (existing.freshness + c.freshness) / 2;
    } else {
      const totals = {} as Record<AbandonReasonValue, number>;
      for (const r of ABANDON_REASON_VALUES) totals[r] = 0;
      totals[c.reason] = c.count;
      map.set(key, {
        skill_slug: c.skill_slug,
        province_slug: c.province_slug,
        totals,
        total: c.count,
        freshness: c.freshness,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
