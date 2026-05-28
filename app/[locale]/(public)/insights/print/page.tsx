import { setRequestLocale } from "next-intl/server";
import { dataProvider } from "@/lib/data/provider";
import {
  freshnessBreakdownQuery,
  skillsGapTrendQuery,
} from "@/db/queries/analytics";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { lmiWithTrend } from "@/lib/analytics/lmi";
import { getSetting } from "@/lib/admin/settings";
import { PrintActions } from "@/components/feature/PrintActions";

export const revalidate = 300;

export const metadata = {
  title: "Sebenza Insights  print briefing",
  robots: { index: false, follow: false },
};

/**
 * Phase 9  Print-friendly briefing of `/insights`.
 *
 * Single column, A4-paged layout. Browser's File → Print → Save as PDF
 * produces a real PDF  no server-side library required. The dynamic
 * <PrintActions /> button calls window.print() for one-tap convenience.
 *
 * No header / nav / chrome  `@media print` already trims those, but
 * we ship them out unconditionally here too so the print preview is
 * accurate even when someone hits "Print preview".
 */
export default async function InsightsPrintPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [freshDays, ageingDays] = await Promise.all([
    getSetting<number>("freshness_band_days_fresh"),
    getSetting<number>("freshness_band_days_ageing"),
  ]);
  const [analytics, freshness, gap, outcomes, lmi] = await Promise.all([
    dataProvider.getAnalyticsSnapshot(),
    freshnessBreakdownQuery({ freshDays, ageingDays }),
    skillsGapTrendQuery({ top: 20, lookbackDays: 7 }),
    outcomesQuery(),
    lmiWithTrend(),
  ]);
  const nfmt = new Intl.NumberFormat(locale);
  const printedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <main className="bg-white text-black p-10 print:p-0 max-w-[820px] mx-auto">
      <PrintActions />

      <header className="border-b-2 border-black pb-4 mb-6">
        <div className="text-[0.7rem] uppercase tracking-[0.24em]">
          Sebenza · National briefing
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight">
          Insights briefing
        </h1>
        <p className="mt-1 text-xs">
          Printed {printedAt} · Reproducible at sebenzasa.com/insights
        </p>
      </header>

      <section className="mb-8 page-break-inside-avoid">
        <h2 className="font-display text-2xl border-b border-black pb-1 mb-3">
          Headline
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 font-medium">Active profiles</td>
              <td className="py-1 font-mono tabular">
                {nfmt.format(analytics.totalActive)}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-medium">
                Confirmed hires this month
              </td>
              <td className="py-1 font-mono tabular">
                {nfmt.format(analytics.confirmedHiresThisMonth)}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-medium">Sebenza LMI</td>
              <td className="py-1 font-mono tabular">
                {lmi.current.value.toFixed(2)}
                {lmi.previous && (
                  <span className="ml-2 text-xs">
                    (prev {lmi.previous.value.toFixed(2)})
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8 page-break-inside-avoid">
        <h2 className="font-display text-2xl border-b border-black pb-1 mb-3">
          Freshness ({freshDays}-day fresh / {ageingDays}-day ageing)
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4">Fresh</td>
              <td className="py-1 font-mono tabular">{nfmt.format(freshness.fresh)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Ageing</td>
              <td className="py-1 font-mono tabular">{nfmt.format(freshness.ageing)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Stale</td>
              <td className="py-1 font-mono tabular">{nfmt.format(freshness.stale)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8 page-break-inside-avoid">
        <h2 className="font-display text-2xl border-b border-black pb-1 mb-3">
          Top 20 skills · demand vs supply
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 text-left font-medium">Skill</th>
              <th className="py-1 text-right font-medium">Searches</th>
              <th className="py-1 text-right font-medium">Supply</th>
              <th className="py-1 text-right font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {gap.map((g) => (
              <tr key={g.skill} className="border-b border-gray-200">
                <td className="py-1">{g.skill}</td>
                <td className="py-1 text-right font-mono tabular">{nfmt.format(g.searches)}</td>
                <td className="py-1 text-right font-mono tabular">{nfmt.format(g.matches)}</td>
                <td className="py-1 text-right font-mono tabular">{nfmt.format(g.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {outcomes.cohorts.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-2xl border-b border-black pb-1 mb-3">
            Education-to-employment outcomes (k = {outcomes.minCohortSize})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 text-left font-medium">Programme · Institution · Province · Year</th>
                <th className="py-1 text-right font-medium">Cohort</th>
                <th className="py-1 text-right font-medium">Placed</th>
                <th className="py-1 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.cohorts.map((c) => (
                <tr
                  key={`${c.programme}-${c.institution}-${c.province}-${c.graduationYear}`}
                  className="border-b border-gray-200"
                >
                  <td className="py-1">
                    {c.programme} · {c.institution} · {c.province} · {c.graduationYear}
                  </td>
                  <td className="py-1 text-right font-mono tabular">{nfmt.format(c.cohortSize)}</td>
                  <td className="py-1 text-right font-mono tabular">{nfmt.format(c.placed)}</td>
                  <td className="py-1 text-right font-mono tabular">{Math.round(c.placementRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-12 border-t-2 border-black pt-3 text-xs">
        <p>
          Generated by Sebenza · {printedAt} · Open the live briefing at{" "}
          <strong>sebenzasa.com/insights</strong>. Methodology + formula
          definitions at sebenzasa.com/privacy.
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
