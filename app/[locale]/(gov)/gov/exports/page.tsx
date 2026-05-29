import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { Download } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function GovExportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await verifyGov();

  return (
    <DashboardShell
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="exports"
      pageEyebrow="Bulk downloads"
      pageTitle="Exports"
      pageSubtitle="Hardened CSV exports of the publishable aggregates. Every download is audit-logged as analytics.export."
    >
      {/* Phase 10.4  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="gov" slug="bulk-csv-downloads" label="Export schemas" />
        <HelpLink role="gov" slug="policy-brief-as-pdf" label="Policy brief PDF" />
        <HelpLink role="gov" slug="lmi-json-public-api" label="LMI public API" />
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        <ExportCard
          title="Longitudinal outcomes"
          href="/api/insights/outcomes/export"
          desc="Programme × institution × province × graduation year. Suppressed cells (cohort < 10) excluded. Same source query as /insights."
        />
        <ExportCard
          title="Sebenza LMI (latest)"
          href="/api/lmi"
          desc="Composite index + components + previous snapshot delta. JSON. Public  no auth required."
        />
        <ExportCard
          title="Audit log (admin only)"
          href="/api/admin/audit-log/export"
          desc="Per-kind + per-actor filter. Capped at 10 000 rows; bigger windows are a Phase 10 email-it job."
        />
        <ExportCard
          title="Nationality mix  status (national)"
          href="/api/gov/nationality-mix/export?dim=status"
          desc="Employment status × SA-citizen / foreign-national. 2-class only (no country-level data). Suppressed cells (count below floor) excluded."
        />
        <ExportCard
          title="Nationality mix  supply (national)"
          href="/api/gov/nationality-mix/export?dim=supply"
          desc="Province × profession × SA-citizen / foreign-national supply. 2-class only. Suppressed at k = floor. Add ?province=Gauteng for a single-province slice."
        />
        <ExportCard
          title="Skills-Shortage Justification Index"
          href="/api/gov/justification-index/export"
          desc="Per (profession × province) cell: classification + demand_score + local_supply_ratio + foreign_fill_share + placement counts. Same suppression + threshold rules as /gov/shortage AND /gov/opportunity. Filter to opportunities in your spreadsheet by classification = supply_available. Add ?province=Gauteng for a province slice."
        />
      </ul>
    </DashboardShell>
  );
}

function ExportCard({
  title,
  href,
  desc,
}: {
  title: string;
  href: string;
  desc: string;
}) {
  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg">{title}</h3>
        <Link
          href={href}
          prefetch={false}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 text-xs uppercase tracking-[0.18em] hover:border-[color:var(--color-ink)]"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Download
        </Link>
      </div>
      <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">{desc}</p>
    </li>
  );
}
