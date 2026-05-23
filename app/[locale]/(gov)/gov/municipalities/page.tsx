import { setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";

export default async function GovMunicipalitiesPage({
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
      activeKey="municipalities"
      pageEyebrow="Geography"
      pageTitle="Municipalities"
      pageSubtitle="City-level supply + demand breakdown. Unlocks once Sebenza has enough city-grained search activity to clear the same suppression floor we use for outcomes (k = 10 distinct profiles per cell)."
    >
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8">
        <h2 className="font-display text-xl">Coming soon</h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          We have the data shape (`supply_heatmap_by_city` query reuses the
          province pattern) and the suppression contract. The cell counts
          aren't there yet — most cities have under 10 active profiles per
          profession in the current dataset. Surface unlocks when the
          population threshold is met; we'll never publish a city × profession
          cell with fewer than 10 distinct profiles, by policy.
        </p>
      </div>
    </DashboardShell>
  );
}
