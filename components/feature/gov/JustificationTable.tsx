/**
 * Phase 9.7.3  Justification Index classification table.
 *
 * One row per (profession × province) cell. Three columns:
 *   1. The cell identity (profession + province + classification chip).
 *   2. The three component values that drove the classification, in
 *      a `title` tooltip so the row stays tidy. Government can hover
 *      to see exactly why a cell was labelled what it was.
 *   3. A drill-down link to /search filtered to that profession +
 *      province so the policy user can see the actual people behind
 *      the number.
 *
 * Sort order: shortages first (loudest signal), then supply-available
 * cells, then indeterminate cells last. Within each label group,
 * sort by demand_score descending so the heaviest demand leads.
 */

import { Link } from "@/i18n/navigation";
import { ArrowUpRight } from "lucide-react";
import type {
  JustificationCell,
  JustificationResult,
} from "@/db/queries/justification";

const LABEL_ORDER: Record<JustificationCell["label"], number> = {
  shortage: 0,
  supply_available: 1,
  indeterminate: 2,
};

const LABEL_COPY: Record<
  JustificationCell["label"],
  { name: string; tone: string }
> = {
  shortage: {
    name: "Local shortage",
    tone: "border-[color:var(--color-danger)] text-[color:var(--color-danger)]",
  },
  supply_available: {
    name: "Local supply available",
    tone: "border-[color:var(--color-brand)] text-[color:var(--color-brand-strong)]",
  },
  indeterminate: {
    name: "Indeterminate",
    tone: "border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]",
  },
};

export function JustificationTable({ data }: { data: JustificationResult }) {
  if (data.cells.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
        No (profession × province) cells cleared the k = {data.k} supply
        floor. This is expected at low data density  most cells will
        light up once the platform has more profiles per profession +
        province, more search activity from verified employer accounts,
        and more confirmed placements logged.
      </p>
    );
  }

  const ordered = [...data.cells].sort((a, b) => {
    const labelDelta = LABEL_ORDER[a.label] - LABEL_ORDER[b.label];
    if (labelDelta !== 0) return labelDelta;
    return b.demand_score - a.demand_score;
  });

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="text-left text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <tr className="border-b border-[color:var(--color-hairline)]">
            <th className="px-5 py-3">Cell</th>
            <th className="px-5 py-3">Classification</th>
            <th className="px-5 py-3 text-right">Demand</th>
            <th className="px-5 py-3 text-right">SA-supply ratio</th>
            <th className="px-5 py-3 text-right">Foreign fill</th>
            <th className="px-5 py-3 text-right">Placements</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-hairline)]">
          {ordered.map((c) => (
            <Row key={`${c.profession}-${c.province}`} cell={c} />
          ))}
        </tbody>
      </table>
      <footer className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-5 py-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        Demand window: trailing {data.demandWindowDays} days · Floor k =
        {" "}{data.k} · {data.suppressed} cell
        {data.suppressed === 1 ? "" : "s"} suppressed (primary + complementary)
      </footer>
    </div>
  );
}

function Row({ cell: c }: { cell: JustificationCell }) {
  const copy = LABEL_COPY[c.label];
  // Tooltip text: the raw component values so policy can audit any cell.
  const tip = [
    `demand_score = ${c.demand_score.toFixed(2)}`,
    `local_supply_ratio = ${c.local_supply_ratio.toFixed(2)}`,
    `foreign_fill_share = ${c.foreign_fill_share.toFixed(2)}`,
    `sa_supply (freshness-weighted) = ${c.sa_supply.toFixed(2)}`,
    `total_placements = ${c.total_placements}`,
    `foreign_placements = ${c.foreign_placements}`,
  ].join("  ·  ");

  return (
    <tr title={tip}>
      <td className="px-5 py-3">
        <div className="font-display text-base capitalize">{c.profession}</div>
        <div className="text-xs text-[color:var(--color-ink-soft)]">
          {c.province}
        </div>
      </td>
      <td className="px-5 py-3">
        <span
          className={
            "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] " +
            copy.tone
          }
        >
          {copy.name}
        </span>
      </td>
      <td className="px-5 py-3 text-right font-mono tabular text-sm">
        {c.demand_score.toFixed(2)}
      </td>
      <td className="px-5 py-3 text-right font-mono tabular text-sm">
        {c.local_supply_ratio.toFixed(2)}
      </td>
      <td className="px-5 py-3 text-right font-mono tabular text-sm">
        {c.total_placements > 0
          ? `${(c.foreign_fill_share * 100).toFixed(0)}%`
          : ""}
      </td>
      <td className="px-5 py-3 text-right font-mono tabular text-sm">
        {c.total_placements}
        {c.total_placements > 0 && c.foreign_placements > 0 && (
          <span className="ml-1 text-xs text-[color:var(--color-ink-soft)]">
            (-{c.foreign_placements} fn)
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <Link
          href={
            `/search?q=${encodeURIComponent(c.profession)}&province=${encodeURIComponent(c.province)}` as never
          }
          prefetch={false}
          className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-strong)] hover:underline"
        >
          See talent
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}
