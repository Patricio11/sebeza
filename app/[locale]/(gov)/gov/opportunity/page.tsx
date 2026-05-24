/**
 * Phase 9.7.4  Local-Hiring Opportunity Map.
 *
 * Same data source as `/gov/shortage` (the Justification Index); this
 * view filters to cells classified `supply_available` so policy users
 * see WHERE Employment Services Act §8 has practical force  the
 * (profession × province) cells where SA-citizen supply can plausibly
 * meet employer demand without harming employers who genuinely can't
 * find local talent.
 *
 * ESA §8 framing per D2 (PHASE_9_7_PLAN.md). Counsel sign-off tracked
 * as DPIA R9; the copy here is the engineering team's reading and
 * may need to soften before public-facing use.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { justificationIndexQuery } from "@/db/queries/justification";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { OpportunityHeatmap } from "@/components/feature/gov/OpportunityHeatmap";
import { Download, Scale } from "lucide-react";

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
  const me = await verifyGov();

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
    <DashboardShell
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="opportunity"
      pageEyebrow="Policy intelligence"
      pageTitle="Local-Hiring Opportunity Map"
      pageSubtitle="Where SA-citizen talent can plausibly meet employer demand. The cells highlighted here are the ones where Employment Services Act §8 (reasonable local-hiring efforts) has practical force  policy can credibly ask 'could this role have been filled locally?'."
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

      {/* ESA §8 framing strip. Honest about the legal context  the
          page's whole framing rests on this Act. */}
      <section
        aria-labelledby="esa-h"
        className="mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-5 md:p-6"
      >
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <Scale className="size-3.5" aria-hidden="true" />
          Employment Services Act 4 of 2014 · §8
        </div>
        <h2
          id="esa-h"
          className="mt-2 font-display text-lg text-[color:var(--color-ink)]"
        >
          Where §8 has practical force
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          ESA §8 requires employers to demonstrate reasonable efforts to
          recruit South African citizens or permanent residents before
          hiring a foreign national. The Department of Employment &amp;
          Labour can request that evidence. The cells below are where
          Sebenza data suggests local talent is genuinely available
          policy can credibly enquire about §8 compliance for the
          professions + provinces flagged here, without harming
          employers in cells classified as <em>genuine local shortage</em>
          on <Link href="/gov/shortage" className="underline">
            /gov/shortage
          </Link> where the local pool isn&rsquo;t there to fill.
        </p>
        <p className="mt-2 text-[0.7rem] italic text-[color:var(--color-ink-soft)]">
          Legal framing is engineering-team reading, pending counsel
          review (DPIA R9). Copy may soften before public-facing use.
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
    </DashboardShell>
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
