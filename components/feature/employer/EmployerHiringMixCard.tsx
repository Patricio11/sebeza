/**
 * Phase 9.7.5  "Your hiring on Sebenza" card.
 *
 * Renders the employer's own confirmed-placement nationality mix
 * (SA-citizen vs foreign-national) plus role/city breakdowns. Their
 * own data only  scoped to `session.org` by the query layer.
 *
 * Framing copy follows D2 (PHASE_9_7_PLAN.md, 2026-05-24): EEA §1
 * designated-group qualification + ESA §8 record-keeping. The
 * wording itself is currently engineering-team draft  counsel
 * review (DPIA R9) closes before this copy ships publicly. The
 * DRAFT banner at the top of the card is the visible reminder; it
 * comes off in a follow-up commit once sign-off is recorded.
 */

import type { EmployerOwnMix } from "@/db/queries/employerMix";
import { Scale, Info, AlertTriangle } from "lucide-react";

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
      {/* DRAFT banner  removed once counsel signs off (DPIA R9). */}
      <DraftBanner />

      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
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
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            EEA §1 designated-group qualification applies only to
            SA citizens
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-paper)] p-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            Foreign nationals
          </div>
          <div className="mt-1 font-display tabular text-3xl">
            {nfmt.format(data.foreign_national)}
            <span className="ml-2 text-base">({pctForeign.toFixed(0)}%)</span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            ESA §8 reasonable-efforts evidence trail
          </p>
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

      {/* EEA §1 + ESA §8 framing copy. Draft per D2. */}
      <section
        aria-labelledby="framing-h"
        className="mt-6 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4"
      >
        <h3
          id="framing-h"
          className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]"
        >
          <Scale className="size-3.5" aria-hidden="true" />
          What this is useful for
        </h3>
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          <strong className="text-[color:var(--color-ink)]">
            EEA §1 designated-group qualification.
          </strong>{" "}
          The Employment Equity Act &rsquo;s definition of
          &ldquo;Black people&rdquo; applies only to SA citizens (plus a
          narrow pre-1994 qualification). Your SA-citizen split above
          maps directly to who counts toward that designated group in
          your representation calculations.
        </p>
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          <strong className="text-[color:var(--color-ink)]">
            ESA §8 record-keeping.
          </strong>{" "}
          The Employment Services Act requires reasonable efforts to
          recruit South African citizens or permanent residents before
          hiring a foreign national, and the Department can request
          evidence. Sebenza-confirmed placements are part of that
          trail.
        </p>
        <p className="mt-3 inline-flex items-start gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-3 py-2 text-[0.7rem] italic text-[color:var(--color-ink-soft)]">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          Sebenza-confirmed placements only  not a substitute for
          your EEA-1 filing or your Department of Home Affairs
          documentation.
        </p>
      </section>
    </section>
  );
}

function DraftBanner() {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-3 py-2 text-[0.7rem] text-[color:var(--color-ink)]">
      <AlertTriangle
        className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-accent)]"
        aria-hidden="true"
      />
      <span>
        <strong className="uppercase tracking-[0.18em]">Draft framing.</strong>{" "}
        The EEA §1 + ESA §8 wording below is engineering-team reading,
        pending labour-law counsel review (DPIA R9). The card is shown
        for engineering testing; the legal-claim wording will be
        finalised before public-facing use.
      </span>
    </div>
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
