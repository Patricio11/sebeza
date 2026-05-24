/**
 * Phase 9.7.8  Government policy brief (print-CSS page).
 *
 * `gov`/`admin` only. Composes the artefacts the policy team
 * actually consumes into one printable document:
 *
 *   1. Sebenza LMI headline + the three components + week-over-week
 *      delta (from 9.4).
 *   2. Top genuine local shortage cells (from 9.7.3).
 *   3. Top local supply available cells (from 9.7.4).
 *   4. National status mix split by SA-citizen / foreign-national,
 *      k-suppressed (from 9.7.2).
 *
 * Reuses the `/insights/print` print-CSS pattern. Browser File
 * Print  Save as PDF produces the artefact; no server-side PDF
 * library. The recurring artefact is the point  the data without
 * something a policy team can hand around in a meeting is invisible.
 *
 * Future extension (not in 9.7.8): cron + email distribution. The
 * existing LMI nightly cron infra would be the template. Out of
 * scope for this commit per the plan ("the cron-to-PDF + email
 * distribution is the optional extension").
 */

import { setRequestLocale } from "next-intl/server";
import { verifyGov } from "@/lib/auth/dal";
import { lmiWithTrend } from "@/lib/analytics/lmi";
import { justificationIndexQuery } from "@/db/queries/justification";
import { statusMixByNationalityQuery } from "@/db/queries/nationality";
import { PrintActions } from "@/components/feature/PrintActions";

export const revalidate = 300;

export const metadata = {
  title: "Sebenza · Gov policy brief",
  robots: { index: false, follow: false },
};

const TOP_N = 10;

const STATUS_LABEL: Record<string, string> = {
  employed: "Employed",
  open_to_work: "Open to work",
  self_employed: "Self-employed",
  unemployed: "Unemployed",
  studying: "Studying",
};

export default async function GovBriefPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyGov();

  const [lmi, justification, statusMix] = await Promise.all([
    lmiWithTrend(),
    justificationIndexQuery(),
    statusMixByNationalityQuery(),
  ]);

  const shortages = justification.cells
    .filter((c) => c.label === "shortage")
    .sort((a, b) => b.demand_score - a.demand_score)
    .slice(0, TOP_N);
  const opportunities = justification.cells
    .filter((c) => c.label === "supply_available")
    .sort((a, b) => b.sa_supply - a.sa_supply)
    .slice(0, TOP_N);

  const nfmt = new Intl.NumberFormat(locale);
  const dfmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  });
  const printedAt = dfmt.format(new Date());

  const lmiDelta = lmi.previous
    ? lmi.current.value - lmi.previous.value
    : null;

  // Group status-mix cells for the table.
  const statusByBucket = new Map<
    string,
    { sa: number; fn: number }
  >();
  for (const c of statusMix.cells) {
    const row = statusByBucket.get(c.status) ?? { sa: 0, fn: 0 };
    if (c.nationality_class === "sa_citizen") row.sa = c.count;
    else row.fn = c.count;
    statusByBucket.set(c.status, row);
  }
  const orderedStatuses = [
    "employed",
    "open_to_work",
    "self_employed",
    "unemployed",
    "studying",
  ].filter((s) => statusByBucket.has(s));

  return (
    <main className="mx-auto max-w-[820px] bg-white p-10 text-black print:p-0">
      <PrintActions />

      <header className="mb-6 border-b-2 border-black pb-4">
        <div className="text-[0.7rem] uppercase tracking-[0.24em]">
          Sebenza · Government policy brief
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight">
          National labour-market briefing
        </h1>
        <p className="mt-1 text-xs">
          Printed {printedAt} · Reproducible at sebenza.co.za/gov/brief ·
          For policy use; not an official Stats SA publication
        </p>
      </header>

      {/* ── 1. LMI headline + components ───────────────────────────── */}
      <section className="page-break-inside-avoid mb-8">
        <h2 className="mb-3 border-b border-black pb-1 font-display text-2xl">
          Sebenza Labour Market Index
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 font-medium">LMI · this week</td>
              <td className="py-1 font-mono tabular">
                {lmi.current.value.toFixed(2)}
                {lmiDelta != null && (
                  <span className="ml-2 text-xs">
                    ({lmiDelta > 0 ? "+" : ""}
                    {lmiDelta.toFixed(2)} vs last snapshot)
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Freshness ratio (40% weight)</td>
              <td className="py-1 font-mono tabular">
                {lmi.current.components.freshnessRatio.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Met demand (40% weight)</td>
              <td className="py-1 font-mono tabular">
                {lmi.current.components.metDemand.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Placement velocity (20% weight)</td>
              <td className="py-1 font-mono tabular">
                {lmi.current.components.placementVelocity.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs italic">
          LMI = 0.4 × freshness_ratio + 0.4 × met_demand + 0.2 ×
          placement_velocity. Formula published at sebenza.co.za/privacy.
        </p>
      </section>

      {/* ── 2. Top local shortages ─────────────────────────────────── */}
      <section className="page-break-inside-avoid mb-8">
        <h2 className="mb-3 border-b border-black pb-1 font-display text-2xl">
          Top {TOP_N} genuine local shortages
        </h2>
        <p className="mb-2 text-xs italic">
          Profession × province cells where demand is high, SA-citizen
          supply is thin, AND most platform-confirmed placements went
          to foreign nationals. Training-investment signal  the
          local pool isn&rsquo;t there to fill, so ESA §8 enforcement
          would be cruel.
        </p>
        {shortages.length === 0 ? (
          <p className="text-sm italic">
            No cells classified as genuine local shortage in the
            current data window.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 font-medium">Profession · Province</th>
                <th className="py-1 text-right font-medium">Demand</th>
                <th className="py-1 text-right font-medium">Supply ratio</th>
                <th className="py-1 text-right font-medium">Foreign fill</th>
                <th className="py-1 text-right font-medium">Placements</th>
              </tr>
            </thead>
            <tbody>
              {shortages.map((c) => (
                <tr
                  key={`s-${c.profession}-${c.province}`}
                  className="border-b border-gray-200"
                >
                  <td className="py-1 capitalize">
                    {c.profession} · {c.province}
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {c.demand_score.toFixed(2)}
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {c.local_supply_ratio.toFixed(2)}
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {(c.foreign_fill_share * 100).toFixed(0)}%
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {nfmt.format(c.total_placements)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── 3. Top local-hiring opportunities ──────────────────────── */}
      <section className="page-break-inside-avoid mb-8">
        <h2 className="mb-3 border-b border-black pb-1 font-display text-2xl">
          Top {TOP_N} local-hiring opportunities
        </h2>
        <p className="mb-2 text-xs italic">
          Profession × province cells where demand is met or meetable
          by SA citizens (local_supply_ratio ≥ 1.0). Cells where
          Employment Services Act §8 (reasonable-efforts to hire
          locally) has practical force.
        </p>
        {opportunities.length === 0 ? (
          <p className="text-sm italic">
            No cells currently classified as local supply available.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 font-medium">Profession · Province</th>
                <th className="py-1 text-right font-medium">Demand</th>
                <th className="py-1 text-right font-medium">SA supply</th>
                <th className="py-1 text-right font-medium">Supply ratio</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((c) => (
                <tr
                  key={`o-${c.profession}-${c.province}`}
                  className="border-b border-gray-200"
                >
                  <td className="py-1 capitalize">
                    {c.profession} · {c.province}
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {c.demand_score.toFixed(2)}
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {nfmt.format(Math.round(c.sa_supply))}
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {c.local_supply_ratio.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── 4. Suppressed nationality dimension ────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 border-b border-black pb-1 font-display text-2xl">
          National status mix · SA-citizen vs foreign-national
        </h2>
        <p className="mb-2 text-xs italic">
          2-class split only (no country-level data). Cells with
          count below k = {statusMix.k} are suppressed.
          {statusMix.suppressed > 0 &&
            ` ${statusMix.suppressed} cell${statusMix.suppressed === 1 ? "" : "s"} suppressed in this snapshot.`}
        </p>
        {orderedStatuses.length === 0 ? (
          <p className="text-sm italic">
            No status × nationality cells cleared the k = {statusMix.k}{" "}
            floor in this snapshot.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 font-medium">Status</th>
                <th className="py-1 text-right font-medium">SA citizens</th>
                <th className="py-1 text-right font-medium">Foreign nationals</th>
                <th className="py-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderedStatuses.map((status) => {
                const row = statusByBucket.get(status)!;
                const total = row.sa + row.fn;
                return (
                  <tr
                    key={status}
                    className="border-b border-gray-200"
                  >
                    <td className="py-1">{STATUS_LABEL[status] ?? status}</td>
                    <td className="py-1 text-right font-mono tabular">
                      {row.sa > 0 ? nfmt.format(row.sa) : ""}
                    </td>
                    <td className="py-1 text-right font-mono tabular">
                      {row.fn > 0 ? nfmt.format(row.fn) : ""}
                    </td>
                    <td className="py-1 text-right font-mono tabular">
                      {nfmt.format(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-12 border-t-2 border-black pt-3 text-xs">
        <p>
          Generated by Sebenza · {printedAt}. Live equivalent of this
          briefing at <strong>sebenza.co.za/gov</strong>. Methodology +
          formula definitions at sebenza.co.za/privacy. ESA §1 / §8
          framing is engineering-team reading pending counsel review
          (DPIA R9); soften legal-claim copy before public-facing use.
        </p>
      </footer>

      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body { background: white; }
          .no-print, .no-print * { display: none !important; }
        }
        .page-break-inside-avoid { page-break-inside: avoid; }
      `}</style>
    </main>
  );
}
