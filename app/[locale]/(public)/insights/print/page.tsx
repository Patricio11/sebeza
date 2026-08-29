import { institutionLabel } from "@/lib/mock/taxonomy";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { dataProvider } from "@/lib/data/provider";
import {
  freshnessBreakdownQuery,
  skillsGapTrendQuery,
  skillDemandQuery,
  supplyHeatmapQuery,
} from "@/db/queries/analytics";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { getLatestRetentionSnapshot } from "@/lib/analytics/retention";
import { lmiWithTrend } from "@/lib/analytics/lmi";
import { overallFreshnessConfidence } from "@/lib/mock/analytics";
import { getSetting } from "@/lib/admin/settings";
import { PrintActions } from "@/components/feature/PrintActions";

/**
 * The PDF briefing (docs: Phase 7 insights, re-set 2026-08-29). One A4
 * document in the house style: chevron mark + wordmark, national eyebrow,
 * the 3:2:1 flag stripe, numbered Fraunces sections, tabular numerals, and
 * every dataset the live page shows, with the same suppression floors and
 * the same honest empty states. Aggregate only; no personal data.
 */

export const revalidate = 300;

export const metadata = {
  title: "Sebenza Insights briefing",
  robots: { index: false, follow: false },
};

const HEATMAP_PROVINCES = 5;
const HEATMAP_PROFESSIONS = 6;

function Stripe({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex h-[4px] w-full ${className}`}>
      <div className="flex-[3] bg-[#006b3c]" />
      <div className="flex-[2] bg-[#c98214]" />
      <div className="flex-[1] bg-[#de3831]" />
    </div>
  );
}

function SectionHeading({
  n,
  title,
  note,
}: {
  n: string;
  title: string;
  note?: string;
}) {
  return (
    <header className="mb-3 flex items-baseline justify-between gap-4 border-b-2 border-[#14110d] pb-1.5">
      <h2 className="font-display text-[22px] leading-tight">
        <span className="mr-2 font-display italic text-[#c98214]">{n}</span>
        {title}
      </h2>
      {note && (
        <span className="text-[9.5px] uppercase tracking-[0.2em] text-[#5a5249]">
          {note}
        </span>
      )}
    </header>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-[#c9c2b6] bg-[#faf7f0] px-3 py-2 text-[11.5px] text-[#5a5249]">
      {children}
    </p>
  );
}

const th =
  "py-1.5 text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#5a5249]";
const td = "py-1.5 text-[12px] text-[#14110d]";
const num = `${td} tabular text-right`;

export default async function InsightsPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { locale } = await params;
  const { auto } = await searchParams;
  setRequestLocale(locale);
  const tStatus = await getTranslations("status");

  const [freshDays, ageingDays] = await Promise.all([
    getSetting<number>("freshness_band_days_fresh"),
    getSetting<number>("freshness_band_days_ageing"),
  ]);
  const [
    analytics,
    freshness,
    gap,
    skillDemand,
    heatmap,
    outcomes,
    retention,
    lmi,
  ] = await Promise.all([
    dataProvider.getAnalyticsSnapshot(),
    freshnessBreakdownQuery({ freshDays, ageingDays }),
    skillsGapTrendQuery({ top: 20, lookbackDays: 7 }),
    skillDemandQuery({ top: 12 }),
    supplyHeatmapQuery(),
    outcomesQuery(),
    getLatestRetentionSnapshot(),
    lmiWithTrend(),
  ]);

  const nfmt = new Intl.NumberFormat(locale);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const now = new Date();
  const printedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(now);
  const confidence = overallFreshnessConfidence(analytics);
  const openToWork = analytics.byStatus.open_to_work?.count ?? 0;

  // Heatmap: top provinces × top professions by supply.
  const cell = new Map<string, number>();
  const profTotals = new Map<string, number>();
  const provTotals = new Map<string, number>();
  for (const c of heatmap) {
    cell.set(`${c.province}__${c.profession}`, c.supply);
    profTotals.set(
      c.profession,
      (profTotals.get(c.profession) ?? 0) + c.supply,
    );
    provTotals.set(c.province, (provTotals.get(c.province) ?? 0) + c.supply);
  }
  const topProfessions = [...profTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HEATMAP_PROFESSIONS)
    .map(([p]) => p);
  const topProvinces = [...provTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HEATMAP_PROVINCES)
    .map(([p]) => p);
  const maxSupply = Math.max(1, ...heatmap.map((c) => c.supply));

  const statuses = Object.entries(analytics.byStatus).sort(
    (a, b) => b[1].count - a[1].count,
  );

  return (
    <main className="mx-auto max-w-[820px] bg-white px-10 py-8 text-[#14110d] print:p-0">
      <PrintActions auto={auto === "1"} />

      {/* Masthead */}
      <header className="page-break-inside-avoid">
        <div className="flex items-end justify-between gap-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sebenza-logo.svg"
              alt="Sebenza"
              className="h-[34px] w-auto"
            />
            <div className="mt-3 text-[9.5px] uppercase tracking-[0.28em] text-[#006b3c]">
              National employment insights · South Africa
            </div>
            <h1 className="mt-1 font-display text-[40px] leading-[1.02] tracking-[-0.01em]">
              Insights briefing
            </h1>
          </div>
          <div className="text-right text-[10.5px] leading-relaxed text-[#5a5249]">
            <div className="uppercase tracking-[0.2em]">Printed</div>
            <div className="text-[#14110d]">{printedAt} SAST</div>
            <div className="mt-1 uppercase tracking-[0.2em]">Live copy</div>
            <div className="text-[#14110d]">sebenzasa.com/insights</div>
          </div>
        </div>
        <Stripe className="mt-4" />
        <p className="mt-3 text-[11.5px] leading-relaxed text-[#5a5249]">
          Freshness-weighted, aggregate only, reproducible. Every figure below
          is computed from the live register at the moment of printing; cohorts
          smaller than the anonymity floor are suppressed, never estimated. No
          personal data appears in this document.
        </p>
      </header>

      {/* 01 Headline */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading n="01" title="Headline" note="live register" />
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Active profiles",
              value: nfmt.format(analytics.totalActive),
            },
            { label: "Open to work", value: nfmt.format(openToWork) },
            {
              label: "Confirmed hires this month",
              value: nfmt.format(analytics.confirmedHiresThisMonth),
            },
            { label: "Freshness confidence", value: pct(confidence) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-md border border-[#e4ded2] bg-[#faf7f0] px-3 py-2.5"
            >
              <div className="text-[9px] uppercase tracking-[0.2em] text-[#5a5249]">
                {s.label}
              </div>
              <div className="mt-1 font-display text-[26px] leading-none tabular">
                {s.value}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-[#5a5249]">
          Sebenza LMI {lmi.current.value.toFixed(2)}
          {lmi.previous ? ` (previous ${lmi.previous.value.toFixed(2)})` : ""}.
          Freshness bands: fresh within {freshDays} days, ageing to {ageingDays}{" "}
          days, stale beyond.
        </p>
      </section>

      {/* 02 Freshness + 03 Status side by side */}
      <div className="mt-8 grid grid-cols-2 gap-8">
        <section className="page-break-inside-avoid">
          <SectionHeading
            n="02"
            title="Data freshness"
            note={`of ${nfmt.format(freshness.total)}`}
          />
          <table className="w-full">
            <tbody>
              {[
                ["Fresh", freshness.fresh, "#006b3c"],
                ["Ageing", freshness.ageing, "#c98214"],
                ["Stale", freshness.stale, "#de3831"],
              ].map(([label, value, colour]) => (
                <tr key={String(label)} className="border-b border-[#eee9df]">
                  <td className={td}>
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block size-2 rounded-full align-middle"
                      style={{ background: String(colour) }}
                    />
                    {label}
                  </td>
                  <td className={num}>{nfmt.format(Number(value))}</td>
                  <td className={`${num} text-[#5a5249]`}>
                    {freshness.total > 0
                      ? pct(Number(value) / freshness.total)
                      : "0%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="page-break-inside-avoid">
          <SectionHeading
            n="03"
            title="By employment status"
            note="freshness-weighted"
          />
          <table className="w-full">
            <tbody>
              {statuses.map(([status, b]) => (
                <tr key={status} className="border-b border-[#eee9df]">
                  <td className={td}>{tStatus(status as never)}</td>
                  <td className={num}>{nfmt.format(b.count)}</td>
                  <td className={`${num} text-[#5a5249]`}>
                    {pct(b.freshnessConfidence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* 04 Skills gap */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading
          n="04"
          title="Skills gap · demand vs supply"
          note="top 20 · ranked by unfilled demand"
        />
        {gap.length === 0 ? (
          <Empty>
            No employer searches recorded yet; the gap table fills as employers
            search.
          </Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#14110d]">
                <th className={`${th} text-left`}>Skill / profession</th>
                <th className={`${th} text-right`}>Searches</th>
                <th className={`${th} text-right`}>Supply</th>
                <th className={`${th} text-right`}>Gap</th>
                <th className={`${th} text-right`}>7-day Δ</th>
              </tr>
            </thead>
            <tbody>
              {gap.map((g) => (
                <tr key={g.skill} className="border-b border-[#eee9df]">
                  <td className={td}>{g.skill}</td>
                  <td className={num}>{nfmt.format(g.searches)}</td>
                  <td className={num}>{nfmt.format(g.matches)}</td>
                  <td
                    className={`${num} font-display text-[14px]`}
                    style={{ color: g.gap > 0 ? "#de3831" : "#006b3c" }}
                  >
                    {g.gap > 0 ? "+" : ""}
                    {nfmt.format(g.gap)}
                  </td>
                  <td className={`${num} text-[#5a5249]`}>
                    {g.gapDelta === null
                      ? "–"
                      : g.gapDelta > 0
                        ? `+${g.gapDelta}`
                        : String(g.gapDelta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 05 Heatmap */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading
          n="05"
          title="Supply heatmap · province × profession"
          note={`top ${HEATMAP_PROVINCES} provinces · top ${HEATMAP_PROFESSIONS} professions`}
        />
        {topProvinces.length === 0 ? (
          <Empty>
            No consented, non-stale profiles to place on the map yet.
          </Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#14110d]">
                <th className={`${th} text-left`}>Province</th>
                {topProfessions.map((p) => (
                  <th key={p} className={`${th} text-right`}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topProvinces.map((prov) => (
                <tr key={prov} className="border-b border-[#eee9df]">
                  <td className={td}>{prov}</td>
                  {topProfessions.map((p) => {
                    const v = cell.get(`${prov}__${p}`) ?? 0;
                    const tint = v === 0 ? 0 : 0.12 + 0.55 * (v / maxSupply);
                    return (
                      <td
                        key={p}
                        className={num}
                        style={{
                          background: v
                            ? `rgba(0,107,60,${tint.toFixed(2)})`
                            : undefined,
                          color: tint > 0.45 ? "#fff" : undefined,
                        }}
                      >
                        {v ? nfmt.format(v) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 06 Skill-level demand */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading
          n="06"
          title="Skill-level demand"
          note="top 12 · controlled vocabulary"
        />
        {skillDemand.length === 0 ? (
          <Empty>No skill-level searches yet.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-x-8">
            {[skillDemand.slice(0, 6), skillDemand.slice(6, 12)].map(
              (half, i) => (
                <table key={i} className="w-full">
                  <tbody>
                    {half.map((s) => (
                      <tr key={s.skill} className="border-b border-[#eee9df]">
                        <td className={td}>{s.skill}</td>
                        <td className={`${num} text-[#5a5249]`}>
                          {nfmt.format(s.searches)} / {nfmt.format(s.matches)}
                        </td>
                        <td
                          className={`${num} font-display text-[14px]`}
                          style={{ color: s.gap > 0 ? "#de3831" : "#006b3c" }}
                        >
                          {s.gap > 0 ? "+" : ""}
                          {nfmt.format(s.gap)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            )}
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-[#5a5249]">
          Searches / people carrying the skill · gap = unfilled demand.
        </p>
      </section>

      {/* 07 Outcomes */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading
          n="07"
          title="Education-to-employment outcomes"
          note={`anonymity floor k = ${outcomes.minCohortSize}`}
        />
        {outcomes.cohorts.length === 0 ? (
          <Empty>
            No cohort has reached the anonymity floor of{" "}
            {outcomes.minCohortSize} consented profiles yet
            {outcomes.suppressedCohorts > 0
              ? ` (${outcomes.suppressedCohorts} suppressed)`
              : ""}
            .
          </Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#14110d]">
                <th className={`${th} text-left`}>
                  Programme · institution · province · year
                </th>
                <th className={`${th} text-right`}>Cohort</th>
                <th className={`${th} text-right`}>Placed</th>
                <th className={`${th} text-right`}>Rate</th>
                <th className={`${th} text-right`}>Median days</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.cohorts.map((c) => (
                <tr
                  key={`${c.programme}-${c.institution}-${c.province}-${c.graduationYear}`}
                  className="border-b border-[#eee9df]"
                >
                  <td className={td}>
                    {c.programme} · {institutionLabel(c.institution)} ·{" "}
                    {c.province} · {c.graduationYear}
                  </td>
                  <td className={num}>{nfmt.format(c.cohortSize)}</td>
                  <td className={num}>{nfmt.format(c.placed)}</td>
                  <td className={`${num} font-display text-[14px]`}>
                    {pct(c.placementRate)}
                  </td>
                  <td className={num}>{c.medianTimeToHireDays ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-1.5 text-[10px] text-[#5a5249]">
          {nfmt.format(outcomes.consentedProfileCount)} consented profiles in
          source
          {outcomes.suppressedCohorts > 0
            ? ` · ${outcomes.suppressedCohorts} cohort(s) suppressed under the floor`
            : ""}
          . Employer-confirmed placements only.
        </p>
      </section>

      {/* 08 Retention */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading
          n="08"
          title="Did the hires stick?"
          note="placement truth · the tail"
        />
        {retention.nationalByMilestone.length === 0 ? (
          <Empty>
            Not enough confirmed placements have reached the first milestone yet
            to publish a retention figure. The dataset grows as employers log
            and check in on hires.
          </Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#14110d]">
                <th className={`${th} text-left`}>Milestone</th>
                <th className={`${th} text-right`}>Hired in cohort</th>
                <th className={`${th} text-right`}>Still active</th>
                <th className={`${th} text-right`}>Retention</th>
              </tr>
            </thead>
            <tbody>
              {retention.nationalByMilestone.map((m) => (
                <tr
                  key={m.milestoneMonths}
                  className="border-b border-[#eee9df]"
                >
                  <td className={td}>{m.milestoneMonths} months</td>
                  <td className={num}>{nfmt.format(m.hiredInCohort)}</td>
                  <td className={num}>
                    {nfmt.format(m.stillActiveAtMilestone)}
                  </td>
                  <td className={`${num} font-display text-[14px]`}>
                    {pct(m.retentionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 09 Trend */}
      <section className="page-break-inside-avoid mt-8">
        <SectionHeading
          n="09"
          title="Registrations and confirmed placements"
          note="by month"
        />
        {analytics.trend.length === 0 ? (
          <Empty>No monthly trend yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#14110d]">
                <th className={`${th} text-left`}>Month</th>
                <th className={`${th} text-right`}>Registrations</th>
                <th className={`${th} text-right`}>Placements</th>
              </tr>
            </thead>
            <tbody>
              {analytics.trend.map((t) => (
                <tr key={t.month} className="border-b border-[#eee9df]">
                  <td className={td}>{t.month}</td>
                  <td className={num}>{nfmt.format(t.registrations)}</td>
                  <td className={num}>{nfmt.format(t.placements)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10">
        <Stripe />
        <div className="mt-3 flex items-start justify-between gap-6 text-[10px] leading-relaxed text-[#5a5249]">
          <p>
            Generated by Sebenza, South Africa&rsquo;s national talent platform
            · {printedAt} SAST. Aggregate only; no personal data. Methodology
            and formula definitions at sebenzasa.com/privacy. Every export is
            audit-logged.
          </p>
          <p className="shrink-0 text-right">
            <span className="font-display text-[13px] text-[#14110d]">
              sebenzasa.com/insights
            </span>
            <br />
            Free for job-seekers. Always.
          </p>
        </div>
      </footer>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 16mm; }
          body { background: white; }
          .no-print, .no-print * { display: none !important; }
          /* The site cookie dialog is chrome, not content. */
          [role="dialog"][aria-label="Cookie preferences"] { display: none !important; }
        }
        .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
      `}</style>
    </main>
  );
}
