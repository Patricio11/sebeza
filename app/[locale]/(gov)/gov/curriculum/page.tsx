/**
 * Phase 9.13.3  Demand-vs-curriculum gov surface.
 *
 *   /gov/curriculum
 *
 * The supply-side companion to /gov/shortage: what curricula are
 * producing vs. what the labour market actually demands. Reuses the
 * suppression floor + freshness function + outcomes_research consent
 * gate from 9.7 / 9.8.7 (D1 in PHASE_9_13_PLAN.md).
 *
 * Province + programme filters bind to the query; below-floor cells
 * render an honest "limited data so far" empty state per D2.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { demandVsCurriculumQuery } from "@/db/queries/curriculum";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { ProgrammeVsMarketCard } from "@/components/feature/analytics/ProgrammeVsMarketCard";
import { Download } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export const revalidate = 300;

export default async function GovCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ province?: string; programme?: string }>;
}) {
  const { locale } = await params;
  const { province: provinceParam } = await searchParams;
  setRequestLocale(locale);
  const me = await verifyGov();

  const provinceFilter = PROVINCES.find(
    (p) => p.slug === provinceParam || p.label === provinceParam,
  );

  const result = await demandVsCurriculumQuery({
    provinceSlug: provinceFilter?.slug,
  });

  const exportHref = provinceFilter
    ? `/api/gov/curriculum/export?province=${encodeURIComponent(provinceFilter.slug)}`
    : "/api/gov/curriculum/export";

  return (
    <DashboardShell
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="curriculum"
      pageEyebrow="Policy intelligence"
      pageTitle="Curriculum vs demand"
      pageSubtitle="What are SA programmes producing vs what the labour market is actually searching for? Suppressed at k = 10. Reads alongside the Justification Index + the stall-reasons card."
      pageActions={
        <Link
          href={exportHref as never}
          prefetch={false}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm font-medium hover:border-[color:var(--color-ink)]"
        >
          <Download className="size-4" aria-hidden="true" />
          CSV
        </Link>
      }
    >
      {/* Phase 10.4  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="gov" slug="curriculum-vs-market-demand" label="Reading this surface" />
        <HelpLink role="gov" slug="programme-cohort-outcomes-and-retention" label="Cohort outcomes" />
        <HelpLink role="gov" slug="what-suppressed-cells-mean" label="Suppressed cells" />
      </div>

      {/* Methodology  honest framing: hand-curated mapping. */}
      <section
        aria-labelledby="method-h"
        className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5 md:p-7"
      >
        <h2 id="method-h" className="font-display text-lg">
          How this is built
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--color-ink-soft)]">
          <strong>Programme  skill</strong> rows come from a curated
          mapping of programme outcomes (D4 in the 9.13 plan)
          shipped as an approximation pending the dormant Phase 8
          SAQA feed.{" "}
          <strong>Demand</strong> comes from a freshness-weighted view of
          employer searches over the trailing 90 days (the same
          engine the Justification Index uses).{" "}
          <strong>Coverage</strong> is the intersection; the{" "}
          <em>gap</em> is the in-demand skills the programme&rsquo;s
          curriculum doesn&rsquo;t list. Cells with fewer than{" "}
          <span className="tabular">{result.k}</span> matching searches
          are suppressed (primary + complementary)  the floor is a
          privacy protection, never a hide-the-ugly-bits switch.
        </p>
      </section>

      {/* Province filter */}
      <section className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Filter
        </span>
        <Link
          href="/gov/curriculum"
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
            href={`/gov/curriculum?province=${p.slug}` as never}
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
          <h2 className="font-display text-2xl">Programme  market</h2>
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            {result.cells.length} cell{result.cells.length === 1 ? "" : "s"}
            {" · "}
            {result.suppressed} suppressed (k = {result.k})
          </span>
        </header>
        <ProgrammeVsMarketCard
          data={result}
          locale={locale}
          exportHref={exportHref}
        />
      </section>
    </DashboardShell>
  );
}
