/**
 * Phase 9.7.5  "Your hiring on Sebenza" card.
 *
 * Renders the employer's own confirmed-placement nationality mix
 * (SA-citizen vs foreign-national) plus role/city breakdowns. Their
 * own data only  scoped to `session.org` by the query layer.
 *
 * Framing reframed 2026-05-24: the original draft cited EEA §1
 * (designated-group qualification) and ESA §8 (reasonable-efforts).
 * Per operator direction we don't make racial-framing or specific
 * regulatory-mandate claims. The card now ships with neutral
 * "for your own records" copy. The platform stays a non-racial
 * national talent platform for everyone; if a regulator ever
 * formally asks for the specific legal framing, it lands as its
 * own intentional change. See DPIA R9 + PHASE_9_7_COMPLETE.md.
 */

import type { EmployerOwnMix } from "@/db/queries/employerMix";
import { Info } from "lucide-react";

export function EmployerHiringMixCard({ data }: { data: EmployerOwnMix }) {
  if (data.total === 0) {
    return (
      <section
        aria-labelledby="own-mix-h"
        className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
      >
        <h2
          id="own-mix-h"
          className="font-display text-xl text-[color:var(--color-ink)]"
        >
          Your hiring on Sebenza
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          No employer-confirmed placements logged yet. Once you mark
          your first hire as confirmed, this card will show the
          SA-citizen / foreign-national breakdown of your placements
          for your own records.
        </p>
      </section>
    );
  }

  const pctSa = (data.sa_citizen / data.total) * 100;
  const pctForeign = (data.foreign_national / data.total) * 100;
  const nfmt = new Intl.NumberFormat("en-ZA");
  const dfmt = new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
  });

  return (
    <section
      aria-labelledby="own-mix-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-7"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <h2
          id="own-mix-h"
          className="font-display text-xl text-[color:var(--color-ink)]"
        >
          Your hiring on Sebenza
        </h2>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          {data.firstHireAt && data.lastHireAt
            ? `${dfmt.format(new Date(data.firstHireAt))}  ${dfmt.format(new Date(data.lastHireAt))}`
            : null}
        </span>
      </header>

      {/* Headline split */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Confirmed placements
          </div>
          <div className="mt-1 font-display tabular text-3xl">
            {nfmt.format(data.total)}
          </div>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            employer-confirmed only
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
            SA citizens
          </div>
          <div className="mt-1 font-display tabular text-3xl text-[color:var(--color-brand-strong)]">
            {nfmt.format(data.sa_citizen)}
            <span className="ml-2 text-base">({pctSa.toFixed(0)}%)</span>
          </div>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-paper)] p-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            Foreign nationals
          </div>
          <div className="mt-1 font-display tabular text-3xl">
            {nfmt.format(data.foreign_national)}
            <span className="ml-2 text-base">({pctForeign.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {/* Single-bar split  the at-a-glance shape. */}
      <div
        aria-hidden="true"
        className="mt-4 flex h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
      >
        <span
          className="block h-full bg-[color:var(--color-brand)]"
          style={{ width: `${pctSa}%` }}
        />
        <span
          className="block h-full bg-[color:var(--color-accent)]"
          style={{ width: `${pctForeign}%` }}
        />
      </div>

      {/* Per-role + per-city breakdown */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Breakdown title="By role" rows={data.byRole} nfmt={nfmt} />
        <Breakdown title="By city" rows={data.byCity} nfmt={nfmt} />
      </div>

      {/* Neutral framing  for the employer's own records, no
          specific regulatory-mandate claims. */}
      <p className="mt-6 inline-flex items-start gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-3 py-2 text-[0.7rem] italic text-[color:var(--color-ink-soft)]">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        Your hiring mix on Sebenza, for your own records  useful
        when HR or compliance needs a quick split of confirmed
        placements. Sebenza-confirmed placements only; not a
        substitute for any official filing.
      </p>
    </section>
  );
}

function Breakdown({
  title,
  rows,
  nfmt,
}: {
  title: string;
  rows: { key: string; total: number; sa_citizen: number; foreign_national: number }[];
  nfmt: Intl.NumberFormat;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="border-b border-[color:var(--color-hairline)] pb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          {title}
        </h3>
        <p className="mt-2 text-xs italic text-[color:var(--color-ink-soft)]">
          No data.
        </p>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div>
      <h3 className="border-b border-[color:var(--color-hairline)] pb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {title}
      </h3>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => {
          const saPct = r.total > 0 ? (r.sa_citizen / max) * 100 : 0;
          const fnPct = r.total > 0 ? (r.foreign_national / max) * 100 : 0;
          return (
            <li key={r.key} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="capitalize text-[color:var(--color-ink)]">
                  {r.key}
                </span>
                <span className="font-mono tabular text-[color:var(--color-ink-soft)]">
                  {nfmt.format(r.total)}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
              >
                <span
                  className="block h-full bg-[color:var(--color-brand)]"
                  style={{ width: `${saPct}%` }}
                />
                <span
                  className="block h-full bg-[color:var(--color-accent)]"
                  style={{ width: `${fnPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
