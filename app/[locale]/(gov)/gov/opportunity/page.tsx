/**
 * Phase 9.7.4  Local-Hiring Opportunity Map.
 *
 * Same data source as `/gov/shortage` (the Justification Index); this
 * view filters to cells classified `supply_available` so policy users
 * see WHERE local SA-citizen supply can plausibly meet employer
 * demand. The complement view on /gov/shortage flags cells where the
 * local pool isn't there to fill  the two together inform local-
 * hiring incentive design without misfiring against employers who
 * genuinely can't find local talent.
 *
 * Reframed 2026-05-24: the original draft cited Employment Services
 * Act §8 explicitly. Per operator direction we don't make specific
 * regulatory-mandate claims; framing is now neutral policy-
 * intelligence. See DPIA R9 + PHASE_9_7_COMPLETE.md.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyGov } from "@/lib/auth/dal";
import { justificationIndexQuery } from "@/db/queries/justification";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { OpportunityHeatmap } from "@/components/feature/gov/OpportunityHeatmap";
import { Download, Sprout } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export const revalidate = 300;

export default async function GovOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ province?: string }>;
}) {
  const { locale } = await params;
  const { province: provinceParam } = await searchParams;
  setRequestLocale(locale);
  await verifyGov();

  const provinceFilter = PROVINCES.find(
    (p) => p.label === provinceParam || p.slug === provinceParam,
  );

  const result = await justificationIndexQuery({
    province: provinceFilter?.label,
  });

  const opportunities = result.cells.filter(
    (c) => c.label === "supply_available",
  );
  const shortages = result.cells.filter((c) => c.label === "shortage");
  const totalSupplyAvailable = opportunities.reduce(
    (sum, c) => sum + c.sa_supply,
    0,
  );
  const distinctProvinces = new Set(opportunities.map((c) => c.province)).size;

  return (
    <DashboardMasthead
      role="gov"
      pageEyebrow="Policy intelligence"
      pageTitle="Local-Hiring Opportunity Map"
      pageSubtitle="Where SA-citizen talent can plausibly meet employer demand. The cells highlighted here are the ones where local-hiring incentive policy lands without harming employers who genuinely can't find local talent."
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
          CSV (full index)
        </Link>
      }
    >
      {/* Phase 10.4  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="gov" slug="local-supply-available-incentives" label="Designing incentives" />
        <HelpLink role="gov" slug="shortage-justification-index-explained" label="Shortage index" />
      </div>

      {/* Headline tiles */}
      <section className="grid gap-3 md:grid-cols-3">
        <Tile
          label="Opportunity cells"
          value={String(opportunities.length)}
          hint={`across ${distinctProvinces} province${distinctProvinces === 1 ? "" : "s"}`}
          tone="brand"
        />
        <Tile
          label="SA-citizen supply available"
          value={new Intl.NumberFormat("en-ZA").format(
            Math.round(totalSupplyAvailable),
          )}
          hint="freshness-weighted across opportunities"
          tone="brand"
        />
        <Tile
          label="Shortage cells (cross-reference)"
          value={String(shortages.length)}
          hint="see /gov/shortage for the table"
          tone="muted"
        />
      </section>

      {/* Neutral policy-intelligence framing  no specific regulatory-
          mandate claims, just an honest read of demand vs supply. */}
      <section
        aria-labelledby="frame-h"
        className="mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-5 md:p-6"
      >
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <Sprout className="size-3.5" aria-hidden="true" />
          Local-hiring policy intelligence
        </div>
        <h2
          id="frame-h"
          className="mt-2 font-display text-lg text-[color:var(--color-ink)]"
        >
          Where local supply can meet demand
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          The cells below are where Sebenza data suggests SA-citizen
          talent is genuinely available  useful for designing local-
          hiring incentives, training programmes, and policy follow-up
          in (profession × province) cells where the supply is there
          to back the intervention. The complement view on{" "}
          <Link href="/gov/shortage" className="underline">
            /gov/shortage
          </Link>{" "}
          flags cells where the local pool isn&rsquo;t there to fill
          a training-investment signal, not an enforcement one.
        </p>
      </section>

      {/* Province filter */}
      <section className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Filter
        </span>
        <Link
          href="/gov/opportunity"
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
            href={`/gov/opportunity?province=${p.slug}`}
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
          <h2 className="font-display text-2xl">Opportunity cells</h2>
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            Floor k = {result.k} · {result.suppressed} cell
            {result.suppressed === 1 ? "" : "s"} suppressed
          </span>
        </header>
        <OpportunityHeatmap data={result} />
      </section>
    </DashboardMasthead>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "muted";
}) {
  const cls =
    tone === "brand"
      ? "border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)]"
      : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]";
  return (
    <div className={`rounded-[var(--radius-md)] border p-5 ${cls}`}>
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 font-display tabular text-3xl">{value}</div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{hint}</p>
    </div>
  );
}
