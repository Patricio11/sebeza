/**
 * Phase 9.7.3  Skills-Shortage Justification Index page.
 *
 * The centerpiece. Per (profession × province) cell:
 *
 *   demand_score        distinct employers searching, last 30 days, /10
 *   local_supply_ratio  SA-citizen freshness-weighted supply ÷ demand
 *   foreign_fill_share  foreign placements ÷ total confirmed placements
 *
 * Classified per D1 (PHASE_9_7_PLAN.md):
 *
 *   Genuine local shortage  ESA §8 evidence is genuinely hard to
 *                            satisfy  policy response is training
 *                            investment, not blame.
 *   Local supply available  ESA §8 has practical force here  policy
 *                            can credibly ask "could this role have
 *                            been filled locally?"
 *   Indeterminate           below k OR below the placement floor OR
 *                            doesn't meet the demand floor. Honest
 *                            blank, never guessed.
 *
 * Formula published verbatim on this page. Per-cell tooltip carries
 * its own component values so no classification is mysterious.
 * Counsel sign-off on the EEA §1 / ESA §8 framing is tracked as
 * DPIA R9; copy may need to soften before public-facing use.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { justificationIndexQuery } from "@/db/queries/justification";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { JustificationTable } from "@/components/feature/gov/JustificationTable";
import { Download } from "lucide-react";

export const revalidate = 300;

export default async function GovShortagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ province?: string }>;
}) {
  const { locale } = await params;
  const { province: provinceFilterParam } = await searchParams;
  setRequestLocale(locale);
  const me = await verifyGov();

  // Validate the province param against the taxonomy  no free-text in.
  const provinceFilter = PROVINCES.find(
    (p) => p.label === provinceFilterParam || p.slug === provinceFilterParam,
  );

  const result = await justificationIndexQuery({
    province: provinceFilter?.label,
  });

  return (
    <DashboardShell
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="shortage"
      pageEyebrow="Policy intelligence"
      pageTitle="Skills-Shortage Justification Index"
      pageSubtitle="One row per profession × province cell. Honest classifier  shortages are training-investment signals; local-supply-available cells are where ESA §8 (reasonable local-hiring efforts) has practical force. Never a foreigners-vs-locals scoreboard."
      pageActions={
        <Link
          href={
            provinceFilter
              ? `/api/gov/justification-index/export?province=${encodeURIComponent(provinceFilter.label)}`
              : "/api/gov/justification-index/export"
          }
          prefetch={false}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm font-medium hover:border-[color:var(--color-ink)]"
        >
          <Download className="size-4" aria-hidden="true" />
          CSV
        </Link>
      }
    >
      {/* Formula  published verbatim per D1. Government must be able to
          read the rule from the page and argue with the thresholds. */}
      <section
        aria-labelledby="formula-h"
        className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5 md:p-7"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="formula-h"
            className="font-display text-lg"
          >
            How a cell is classified
          </h2>
          <Link
            href="/admin/settings"
            className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:underline"
          >
            Tune thresholds in /admin/settings →
          </Link>
        </div>

        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <FormulaRow
            label="Genuine local shortage"
            rule={[
              `demand_score          ≥ ${result.thresholds.demandFloor.toFixed(2)}  (lmi_demand_floor)`,
              `local_supply_ratio    < ${result.thresholds.localSupplyThreshold.toFixed(2)}  (lmi_local_supply_threshold)`,
              `foreign_fill_share    ≥ ${result.thresholds.foreignFillFloor.toFixed(2)}  (lmi_foreign_fill_floor)`,
              `total_placements      ≥ ${result.thresholds.minPlacements}     (employer_mix_min_placements)`,
            ]}
            tone="danger"
          />
          <FormulaRow
            label="Local supply available"
            rule={[
              `demand_score          ≥ ${result.thresholds.demandFloor.toFixed(2)}`,
              `local_supply_ratio    ≥ 1.00`,
            ]}
            tone="brand"
          />
        </dl>

        <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
          demand_score = COUNT(DISTINCT employer searches) / 10 in the
          trailing {result.demandWindowDays} days. local_supply_ratio =
          freshness-weighted SA-citizen supply ÷ (demand_score × 10).
          foreign_fill_share = foreign-national placements ÷ total
          employer-confirmed placements. Cells with sa_supply below k
          = {result.k} are suppressed (primary + complementary). Cells
          that don&rsquo;t meet either rule are shown as
          &ldquo;indeterminate&rdquo;  honest blank beats a confident
          wrong number.
        </p>
      </section>

      {/* Province filter */}
      <section className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Filter
        </span>
        <Link
          href="/gov/shortage"
          className={
            "rounded-[var(--radius-pill)] border px-3 py-1 text-xs " +
            (provinceFilter
              ? "border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]"
              : "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]")
          }
        >
          All provinces
        </Link>
        {PROVINCES.map((p) => (
          <Link
            key={p.slug}
            href={`/gov/shortage?province=${p.slug}`}
            className={
              "rounded-[var(--radius-pill)] border px-3 py-1 text-xs " +
              (provinceFilter?.slug === p.slug
                ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                : "border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]")
            }
          >
            {p.label}
          </Link>
        ))}
      </section>

      <section className="mt-8">
        <header className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-[color:var(--color-ink)] pb-2">
          <h2 className="font-display text-2xl">Classified cells</h2>
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            {result.cells.length} cell{result.cells.length === 1 ? "" : "s"}
            {" · "}
            {result.suppressed} suppressed (k = {result.k})
          </span>
        </header>
        <JustificationTable data={result} />
      </section>
    </DashboardShell>
  );
}

function FormulaRow({
  label,
  rule,
  tone,
}: {
  label: string;
  rule: string[];
  tone: "danger" | "brand";
}) {
  const dotClass =
    tone === "danger"
      ? "bg-[color:var(--color-danger)]"
      : "bg-[color:var(--color-brand)]";
  return (
    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3">
      <dt className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
        <span aria-hidden="true" className={`inline-block size-2 rounded-full ${dotClass}`} />
        {label}
      </dt>
      <dd className="mt-2 whitespace-pre font-mono text-[0.72rem] leading-relaxed text-[color:var(--color-ink-soft)]">
        {rule.join("\n")}
      </dd>
    </div>
  );
}
