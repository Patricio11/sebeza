import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StatCard } from "@/components/ui/StatCard";
import { SAChevron } from "@/components/ui/SAChevron";
import { dataProvider } from "@/lib/data/provider";
import { overallFreshnessConfidence } from "@/lib/mock/analytics";
import { InsightsCharts } from "@/components/feature/InsightsCharts";
import { Download } from "lucide-react";

const STATUS_ORDER = [
  "open_to_work",
  "unemployed",
  "employed",
  "self_employed",
  "studying",
] as const;

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("insights");
  const tStatus = await getTranslations("status");
  const analytics = await dataProvider.getAnalyticsSnapshot();
  const conf = overallFreshnessConfidence(analytics);
  const nfmt = new Intl.NumberFormat(locale);
  const today = new Date().toISOString().slice(0, 10);

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
              hint="May 2026"
            />
            <StatCard
              label={t("stat.openToWork")}
              value={nfmt.format(analytics.byStatus.open_to_work.count)}
              confidence={analytics.byStatus.open_to_work.freshnessConfidence}
            />
          </section>

          {/* By status table — editorial, dense, honest */}
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

          {/* Charts (client island) */}
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
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                {t("exportNote")}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("export")}
            </button>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
