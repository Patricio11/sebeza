import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StatCard } from "@/components/ui/StatCard";
import { SAChevron } from "@/components/ui/SAChevron";
import { dataProvider } from "@/lib/data/provider";
import { overallFreshnessConfidence } from "@/lib/mock/analytics";
import {
  skillsGapTrendQuery,
  skillDemandQuery,
  supplyHeatmapQuery,
  freshnessBreakdownQuery,
} from "@/db/queries/analytics";
import { getSetting } from "@/lib/admin/settings";
import { outcomesQuery } from "@/lib/analytics/outcomes";
import { getLatestRetentionSnapshot } from "@/lib/analytics/retention";
import { InsightsCharts } from "@/components/feature/InsightsCharts";
import { InsightsExportButton } from "@/components/feature/InsightsExportButton";
import { TrendingUp, AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";

/**
 * Re-prerender /insights every 5 min. Aggregates over the live DB; doesn't
 * need millisecond freshness but shouldn't be a build-time snapshot frozen
 * until next deploy. Next.js ISR + the dataProvider seam means each locale
 * gets a fresh static HTML every 300 s.
 */
export const revalidate = 300;

const STATUS_ORDER = [
  "open_to_work",
  "unemployed",
  "employed",
  "self_employed",
  "studying",
] as const;

const HEATMAP_TOP_PROFESSIONS = 8;
const HEATMAP_TOP_PROVINCES = 9; // all of them

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("insights");
  const tStatus = await getTranslations("status");

  // Phase 7 (A.6)  Freshness band thresholds come from platform_settings
  // so admins can tune the bands without a deploy. Read first so the
  // breakdown query honours the current values.
  const [freshDays, ageingDays] = await Promise.all([
    getSetting<number>("freshness_band_days_fresh"),
    getSetting<number>("freshness_band_days_ageing"),
  ]);

  // Parallel load  all six aggregates ship at once. `skillsGapTrendQuery`
  // is `skillsGapQuery` plus the week-over-week delta arrow column (falls
  // back to no-delta when there's no prior snapshot yet).
  const [analytics, skillsGap, skillDemand, heatmap, freshness, outcomes, retention] =
    await Promise.all([
      dataProvider.getAnalyticsSnapshot(),
      skillsGapTrendQuery({ top: 20, lookbackDays: 7 }),
      skillDemandQuery({ top: 12 }),
      supplyHeatmapQuery(),
      freshnessBreakdownQuery({ freshDays, ageingDays }),
      outcomesQuery(),
      getLatestRetentionSnapshot(),
    ]);

  const conf = overallFreshnessConfidence(analytics);
  const nfmt = new Intl.NumberFormat(locale);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMonth = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(now);

  // ── Heatmap matrix construction ─────────────────────────────────────────
  // Build the sparse data into a Map for O(1) lookup, then derive the
  // top N professions + provinces from the present data so the matrix is
  // never larger than what's actually populated.
  const cellByKey = new Map<string, { supply: number; freshness: number }>();
  const professionTotals = new Map<string, number>();
  const provinceTotals = new Map<string, number>();
  for (const c of heatmap) {
    cellByKey.set(`${c.province}__${c.profession}`, {
      supply: c.supply,
      freshness: c.freshness,
    });
    professionTotals.set(
      c.profession,
      (professionTotals.get(c.profession) ?? 0) + c.supply,
    );
    provinceTotals.set(
      c.province,
      (provinceTotals.get(c.province) ?? 0) + c.supply,
    );
  }
  const topProfessions = [...professionTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HEATMAP_TOP_PROFESSIONS)
    .map(([p]) => p);
  const topProvinces = [...provinceTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HEATMAP_TOP_PROVINCES)
    .map(([p]) => p);
  const maxSupply = Math.max(1, ...heatmap.map((c) => c.supply));

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* National bulletin masthead with chevron motif */}
        <header className="relative overflow-hidden border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
          <SAChevron
            variant="signature"
            className="pointer-events-none absolute -right-32 -top-16 size-[520px] opacity-[0.06]"
          />
          <div className="relative mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-20">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
              <span className="inline-flex items-center gap-2">
                <SAChevron variant="mark" className="size-3" />
                National employment insights · ZA · MMXXVI
              </span>
              <span className="text-[color:var(--color-ink-soft)]">
                Bulletin · updated {today}
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.025em]">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-[color:var(--color-ink-soft)]">
              {t("subtitle")}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)] shadow-press">
                <span
                  className="size-2 rounded-full bg-[color:var(--color-accent)]"
                  aria-hidden="true"
                />
                {t("confidence", { percent: Math.round(conf * 100) })}
              </div>
              <span className="max-w-md text-xs text-[color:var(--color-ink-soft)]">
                {t("confidenceHelp")}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-20">
          {/* Headline stats */}
          <section aria-label="Headline statistics" className="grid gap-4 md:grid-cols-3">
            <StatCard
              label={t("stat.totalActive")}
              value={nfmt.format(analytics.totalActive)}
              spark={analytics.trend.map((m) => m.registrations)}
              confidence={conf}
              hint="Live"
            />
            <StatCard
              label={t("stat.confirmedHires")}
              value={nfmt.format(analytics.confirmedHiresThisMonth)}
              spark={analytics.trend.map((m) => m.placements)}
              hint={currentMonth}
            />
            <StatCard
              label={t("stat.openToWork")}
              value={nfmt.format(analytics.byStatus.open_to_work.count)}
              confidence={analytics.byStatus.open_to_work.freshnessConfidence}
            />
          </section>

          {/* Freshness band breakdown  "data you can trust" honesty */}
          <section className="mt-14" aria-labelledby="freshness-h">
            <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
              <h2 id="freshness-h" className="font-display text-2xl">
                Data freshness
              </h2>
              <span className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                Of {nfmt.format(freshness.total)} active profiles
              </span>
            </header>
            <div className="grid gap-4 md:grid-cols-3">
              <FreshnessTile
                label="Fresh"
                hint={`Confirmed in the last ${freshDays} days`}
                count={freshness.fresh}
                total={freshness.total}
                tone="brand"
                nfmt={nfmt}
              />
              <FreshnessTile
                label="Ageing"
                hint={`${freshDays}–${ageingDays} days since confirmation`}
                count={freshness.ageing}
                total={freshness.total}
                tone="accent"
                nfmt={nfmt}
              />
              <FreshnessTile
                label="Stale"
                hint={`${ageingDays}+ days · down-ranked in search`}
                count={freshness.stale}
                total={freshness.total}
                tone="danger"
                nfmt={nfmt}
              />
            </div>
          </section>

          {/* By status table  editorial, dense, honest */}
          <section className="mt-14" aria-labelledby="by-status-h">
            <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
              <h2 id="by-status-h" className="font-display text-2xl">
                {t("byStatus")}
              </h2>
              <span className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                Freshness-weighted
              </span>
            </header>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  <th className="py-2 font-normal">Status</th>
                  <th className="py-2 font-normal tabular text-right">Count</th>
                  <th className="py-2 font-normal text-right">Freshness confidence</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDER.map((s) => {
                  const row = analytics.byStatus[s];
                  const pct = Math.round(row.freshnessConfidence * 100);
                  return (
                    <tr key={s} className="border-t border-[color:var(--color-hairline)]">
                      <td className="py-3">{tStatus(s)}</td>
                      <td className="py-3 tabular text-right font-display text-lg">
                        {nfmt.format(row.count)}
                      </td>
                      <td className="py-3">
                        <div className="ml-auto flex max-w-[260px] items-center justify-end gap-2">
                          <div className="h-1 w-40 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]">
                            <div
                              className="h-full bg-[color:var(--color-brand)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tabular text-xs text-[color:var(--color-ink-soft)]">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="space-y-3 md:hidden">
              {STATUS_ORDER.map((s) => {
                const row = analytics.byStatus[s];
                const pct = Math.round(row.freshnessConfidence * 100);
                return (
                  <li
                    key={s}
                    className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm">{tStatus(s)}</span>
                      <span className="font-display tabular text-2xl">
                        {nfmt.format(row.count)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]">
                        <div
                          className="h-full bg-[color:var(--color-brand)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="tabular text-xs text-[color:var(--color-ink-soft)]">
                        {pct}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ── Skills-gap engine  the government wedge ─────────────────── */}
          <section className="mt-16" aria-labelledby="gap-h">
            <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
              <h2 id="gap-h" className="font-display text-2xl">
                Skills gap · demand vs supply
              </h2>
              <span className="hidden text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)] md:inline">
                Ranked by unfilled demand
              </span>
            </header>
            <p className="mb-5 max-w-3xl text-sm text-[color:var(--color-ink-soft)]">
              Every employer search writes to <code>search_events</code>; every
              profile contributes freshness-weighted supply. Where demand
              outstrips supply is where Sebenza can direct training,
              learnership intake, and policy attention.
            </p>

            {skillsGap.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center text-[color:var(--color-ink-soft)]">
                Not enough search activity yet to surface skills-gap signal.
                Demand data accumulates as employers search.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        <th className="px-5 py-3 font-normal">Skill / profession</th>
                        <th className="px-5 py-3 font-normal tabular text-right">Searches</th>
                        <th className="px-5 py-3 font-normal tabular text-right">Matches</th>
                        <th className="px-5 py-3 font-normal tabular text-right">Fresh matches</th>
                        <th className="px-5 py-3 font-normal">Gap</th>
                        <th className="px-5 py-3 font-normal text-right" title="Change vs last week's snapshot">Δ 7d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillsGap.map((r) => {
                        const gapPositive = r.gap > 0;
                        const barWidth = Math.min(
                          100,
                          Math.round(
                            (Math.abs(r.gap) / Math.max(1, r.searches)) * 100,
                          ),
                        );
                        return (
                          <tr
                            key={r.skill}
                            className="border-t border-[color:var(--color-hairline)]"
                          >
                            <td className="px-5 py-3">{r.skill}</td>
                            <td className="px-5 py-3 tabular text-right">
                              {nfmt.format(r.searches)}
                            </td>
                            <td className="px-5 py-3 tabular text-right text-[color:var(--color-ink-soft)]">
                              {nfmt.format(r.matches)}
                            </td>
                            <td className="px-5 py-3 tabular text-right text-[color:var(--color-ink-soft)]">
                              {r.freshMatches.toFixed(1)}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-3">
                                <div
                                  className="h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                                  aria-hidden="true"
                                >
                                  <div
                                    className={`h-full ${gapPositive ? "bg-[color:var(--color-danger)]" : "bg-[color:var(--color-brand)]"}`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                                <span
                                  className={`font-display tabular text-base ${gapPositive ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-brand-strong)]"}`}
                                >
                                  {gapPositive ? "+" : ""}
                                  {nfmt.format(r.gap)}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <DeltaCell delta={r.gapDelta} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="space-y-3 md:hidden">
                  {skillsGap.map((r) => {
                    const gapPositive = r.gap > 0;
                    return (
                      <li
                        key={r.skill}
                        className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium">{r.skill}</span>
                          <span
                            className={`font-display tabular text-2xl ${gapPositive ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-brand-strong)]"}`}
                          >
                            {gapPositive ? "+" : ""}
                            {nfmt.format(r.gap)}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
                          <div>
                            <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                              Searches
                            </dt>
                            <dd className="tabular">{nfmt.format(r.searches)}</dd>
                          </div>
                          <div>
                            <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                              Matches
                            </dt>
                            <dd className="tabular text-[color:var(--color-ink-soft)]">
                              {nfmt.format(r.matches)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                              Fresh
                            </dt>
                            <dd className="tabular text-[color:var(--color-ink-soft)]">
                              {r.freshMatches.toFixed(1)}
                            </dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          {/* ── Supply heatmap (Province × Profession) ───────────────────── */}
          {topProvinces.length > 0 && topProfessions.length > 0 && (
            <section className="mt-16" aria-labelledby="heat-h">
              <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
                <h2 id="heat-h" className="font-display text-2xl">
                  Supply heatmap · province × profession
                </h2>
                <span className="hidden text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)] md:inline">
                  Top {topProvinces.length} provinces · top {topProfessions.length} professions
                </span>
              </header>
              <p className="mb-5 max-w-3xl text-sm text-[color:var(--color-ink-soft)]">
                Where the people are. Darker = more supply; cells with no data
                shown blank.
              </p>
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      <th className="px-3 py-3 font-normal">Province</th>
                      {topProfessions.map((p) => (
                        <th
                          key={p}
                          className="px-2 py-3 text-center font-normal"
                          scope="col"
                        >
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topProvinces.map((prov) => (
                      <tr
                        key={prov}
                        className="border-t border-[color:var(--color-hairline)]"
                      >
                        <th
                          className="px-3 py-2 text-left font-medium text-[color:var(--color-ink)]"
                          scope="row"
                        >
                          {prov}
                        </th>
                        {topProfessions.map((prof) => {
                          const cell = cellByKey.get(`${prov}__${prof}`);
                          if (!cell) {
                            return (
                              <td
                                key={prof}
                                className="px-2 py-2 text-center text-[color:var(--color-ink-soft)]/40"
                              >
                                ·
                              </td>
                            );
                          }
                          const intensity = cell.supply / maxSupply; // 0–1
                          const mixPercent = Math.round(
                            (0.15 + intensity * 0.55) * 100,
                          );
                          // Province slug for the search deep-link.
                          const provSlug = prov
                            .toLowerCase()
                            .replace(/\s+/g, "-");
                          return (
                            <td
                              key={prof}
                              className="p-0 text-center"
                              style={{
                                // CSS color-mix scales opacity off the
                                // design-system brand colour  no hardcoded
                                // RGB literals that drift on theme changes.
                                background: `color-mix(in srgb, var(--color-brand) ${mixPercent}%, transparent)`,
                                color:
                                  intensity > 0.55
                                    ? "var(--color-paper)"
                                    : "var(--color-ink)",
                              }}
                              title={`${cell.supply} profile${cell.supply === 1 ? "" : "s"} · ${Math.round(cell.freshness * 100)}% fresh · click to open in search`}
                            >
                              <a
                                href={`/search?profession=${encodeURIComponent(prof)}&province=${encodeURIComponent(provSlug)}`}
                                className="block px-2 py-2 hover:underline"
                                aria-label={`${cell.supply} ${prof} in ${prov}  open in search`}
                              >
                                {cell.supply}
                              </a>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Skill-level demand  finer than profession granularity ─── */}
          {skillDemand.length > 0 && (
            <section className="mt-16" aria-labelledby="skill-demand-h">
              <header className="mb-4 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
                <h2
                  id="skill-demand-h"
                  className="font-display text-2xl"
                >
                  Skill-level demand · top 12
                </h2>
                <span className="hidden text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)] md:inline">
                  Controlled-vocabulary skills
                </span>
              </header>
              <p className="mb-5 max-w-3xl text-sm text-[color:var(--color-ink-soft)]">
                Sister view to the profession-level table: which individual
                <em> skills</em> show up most in employer searches, and how
                many people on Sebenza carry them. The most unfilled rows
                are where bursary / SETA investment moves the needle fastest.
              </p>
              <ul className="grid gap-3 md:grid-cols-2">
                {skillDemand.map((s) => {
                  const gapPositive = s.gap > 0;
                  return (
                    <li
                      key={s.slug}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.skill}</div>
                        <div className="text-xs text-[color:var(--color-ink-soft)]">
                          {nfmt.format(s.searches)} searches ·{" "}
                          {nfmt.format(s.matches)}{" "}
                          {s.matches === 1 ? "person carries" : "people carry"}
                        </div>
                      </div>
                      <span
                        className={`font-display tabular text-xl ${gapPositive ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-brand-strong)]"}`}
                      >
                        {gapPositive ? "+" : ""}
                        {nfmt.format(s.gap)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Phase 7.5.4  Education-to-employment outcomes (consented + k-anonymised) */}
          <section className="mt-16" aria-labelledby="outcomes-h">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[color:var(--color-ink)] pb-2">
              <div>
                <h2 id="outcomes-h" className="font-display text-2xl">
                  Education-to-employment outcomes
                </h2>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  Cohort dimensions only. Suppression floor: ≥{" "}
                  {outcomes.minCohortSize} consented profiles per cell.
                  Employer-confirmed placements only.
                </p>
              </div>
              <a
                href="/api/insights/outcomes/export"
                className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-xs uppercase tracking-[0.18em] hover:border-[color:var(--color-ink)]"
              >
                Export CSV
              </a>
            </header>

            {outcomes.cohorts.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
                No cohort cleared the suppression floor of{" "}
                {outcomes.minCohortSize} consented profiles. The dataset
                grows as students opt in to outcomes research from{" "}
                <code>/dashboard/privacy</code> and as employers log
                confirmed placements. Source pool today:{" "}
                <span className="font-medium">
                  {outcomes.consentedProfileCount}
                </span>{" "}
                consented profile
                {outcomes.consentedProfileCount === 1 ? "" : "s"};{" "}
                {outcomes.suppressedCohorts} cohort
                {outcomes.suppressedCohorts === 1 ? " was" : "s were"}{" "}
                suppressed.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[color:var(--color-surface)]">
                    <tr className="text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      <th className="px-4 py-3 font-normal">Programme</th>
                      <th className="px-4 py-3 font-normal">Institution</th>
                      <th className="px-4 py-3 font-normal">Province</th>
                      <th className="px-4 py-3 font-normal">Grad year</th>
                      <th className="px-4 py-3 font-normal text-right">
                        Cohort
                      </th>
                      <th className="px-4 py-3 font-normal text-right">
                        Placed
                      </th>
                      <th className="px-4 py-3 font-normal text-right">
                        Rate
                      </th>
                      <th className="px-4 py-3 font-normal text-right">
                        Median days to hire
                      </th>
                      <th className="px-4 py-3 font-normal">Top destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcomes.cohorts.map((c) => (
                      <tr
                        key={`${c.programme}-${c.institution}-${c.province}-${c.graduationYear}`}
                        className="border-t border-[color:var(--color-hairline)]"
                      >
                        <td className="px-4 py-2">{c.programme}</td>
                        <td className="px-4 py-2 text-[color:var(--color-ink-soft)]">
                          {c.institution}
                        </td>
                        <td className="px-4 py-2 capitalize text-[color:var(--color-ink-soft)]">
                          {c.province}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {c.graduationYear}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular">
                          {nfmt.format(c.cohortSize)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular">
                          {nfmt.format(c.placed)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular">
                          {Math.round(c.placementRate * 100)}%
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular text-[color:var(--color-ink-soft)]">
                          {c.medianTimeToHireDays != null
                            ? c.medianTimeToHireDays
                            : ""}
                        </td>
                        <td className="px-4 py-2 text-[color:var(--color-ink-soft)]">
                          {c.topDestinationProfession ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-2 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  {outcomes.consentedProfileCount} consented profile
                  {outcomes.consentedProfileCount === 1 ? "" : "s"} in
                  source · {outcomes.suppressedCohorts} cohort
                  {outcomes.suppressedCohorts === 1 ? "" : "s"} suppressed
                  · primary + complementary k-anonymity floor
                </p>
              </div>
            )}
          </section>

          {/* Phase 9.20 D8  national placement-retention figure. The hard
              number nobody else surfaces: of the hires that made it to N
              months, how many were still active at that mark. Aggregate
              only, k = 10 floor applied at the cron, never per-employer. */}
          <section className="mt-16" aria-labelledby="retention-h">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                  Placement-Truth, the tail
                </div>
                <h2 id="retention-h" className="font-display text-2xl">
                  Did the hires stick?
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
                  Of the Sebenza-confirmed placements that made it to each
                  milestone, how many were still active at that mark. Per-
                  cell suppression at k = 10  employer privacy is held;
                  the national picture stays honest.
                </p>
              </div>
              {retention.capturedAt && (
                <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  Captured{" "}
                  {new Date(retention.capturedAt).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>

            {retention.nationalByMilestone.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
                Not enough confirmed placements have reached the first
                milestone yet to publish a retention figure  the dataset
                grows as employers log + check in on hires across the
                platform. The k = 10 floor is intentional, not a bug.
              </div>
            ) : (
              <>
                <dl className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                  {retention.nationalByMilestone.map((m) => (
                    <div
                      key={m.milestoneMonths}
                      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
                    >
                      <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        {formatMilestoneLabel(m.milestoneMonths)}
                      </dt>
                      <dd className="mt-1 font-display text-3xl leading-none text-[color:var(--color-ink)]">
                        {Math.round(m.retentionRate * 100)}%
                      </dd>
                      <dd className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                        {nfmt.format(m.stillActiveAtMilestone)} of{" "}
                        {nfmt.format(m.hiredInCohort)} hires
                      </dd>
                    </div>
                  ))}
                </dl>

                {retention.topCells.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-display text-lg text-[color:var(--color-ink)]">
                      Roles where hires stick
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                      12-month retention by (profession × province), best
                      first. Tie-breaker is cohort size  larger cohorts
                      surface above smaller ones at the same rate.
                    </p>
                    <ul className="mt-4 grid gap-2 md:grid-cols-2">
                      {retention.topCells.map((c) => (
                        <li
                          key={`${c.professionSlug}__${c.provinceSlug}`}
                          className="flex items-baseline justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3"
                        >
                          <div>
                            <p className="font-display text-base text-[color:var(--color-ink)]">
                              {c.professionLabel}
                            </p>
                            <p className="text-xs text-[color:var(--color-ink-soft)]">
                              {c.provinceLabel}  cohort of{" "}
                              {nfmt.format(c.hiredInCohort)}
                            </p>
                          </div>
                          <span className="font-display text-xl tabular text-[color:var(--color-brand-strong)]">
                            {Math.round(c.retentionRate * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
                  Snapshot covers {nfmt.format(retention.cellsPublished)}{" "}
                  published cell{retention.cellsPublished === 1 ? "" : "s"}
                   cells below the k = 10 floor are suppressed at the
                  cron so per-employer numbers never leak. Retention =
                  active at the milestone, NOT active today.
                </p>
              </>
            )}
          </section>

          {/* Charts (client island  trend + demand) */}
          <section className="mt-16">
            <InsightsCharts
              trend={analytics.trend}
              demand={analytics.demandBySkill}
            />
            <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
              {t("skillsGapHelp")}
            </p>
          </section>

          {/* Export */}
          <section className="mt-16 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-6">
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                Policy export
              </div>
              <h2 className="font-display text-xl">{t("export")}</h2>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
                {t("exportNote")} Every export writes an{" "}
                <code>analytics.export</code> audit row.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <InsightsExportButton label={t("export")} />
              <a
                href="/insights/print"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-sm font-medium hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
              >
                Print to PDF
              </a>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Δ arrow for the skills-gap table.
 * - `null` → "" muted (no prior snapshot to compare against)
 * - `> 0`  → ⬆ red (gap is widening; demand outpacing supply)
 * - `< 0`  → ⬇ green (gap is shrinking; supply catching up)
 * - `= 0`  → − muted (unchanged)
 */
function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span
        className="inline-flex items-center text-[color:var(--color-ink-soft)]"
        title="No prior snapshot to compare against yet"
      >
        
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[color:var(--color-ink-soft)]">
        <Minus className="size-3.5" aria-hidden="true" />0
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-[color:var(--color-danger)]">
        <ArrowUp className="size-3.5" aria-hidden="true" />+{delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-[color:var(--color-brand-strong)]">
      <ArrowDown className="size-3.5" aria-hidden="true" />
      {delta}
    </span>
  );
}

function FreshnessTile({
  label,
  hint,
  count,
  total,
  tone,
  nfmt,
}: {
  label: string;
  hint: string;
  count: number;
  total: number;
  tone: "brand" | "accent" | "danger";
  nfmt: Intl.NumberFormat;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const toneClass = {
    brand: "border-[color:var(--color-brand)] text-[color:var(--color-brand-strong)]",
    accent: "border-[color:var(--color-accent)] text-[color:var(--color-accent)]",
    danger: "border-[color:var(--color-danger)] text-[color:var(--color-danger)]",
  }[tone];
  const Icon = tone === "danger" ? AlertCircle : TrendingUp;
  return (
    <div className={`rounded-[var(--radius-md)] border-2 ${toneClass} bg-[color:var(--color-paper)] p-5`}>
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em]">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display tabular text-3xl text-[color:var(--color-ink)]">
          {nfmt.format(count)}
        </span>
        <span className="text-sm text-[color:var(--color-ink-soft)]">
          · {pct}%
        </span>
      </div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{hint}</p>
    </div>
  );
}

/**
 * Phase 9.20 D8  human label for a retention milestone in months.
 * 3 / 6 / 12 become "3-month" / "6-month" / "12-month"; integer-year
 * marks compress to "2-year" / "3-year"; the rare non-year mark falls
 * back to the months form.
 */
function formatMilestoneLabel(months: number): string {
  if (months < 12) return `${months}-month`;
  if (months === 12) return "12-month";
  const years = months / 12;
  if (Number.isInteger(years)) return `${years}-year`;
  return `${months}-month`;
}
