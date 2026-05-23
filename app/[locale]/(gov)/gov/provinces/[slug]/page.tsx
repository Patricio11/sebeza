import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { skillsGapQuery, supplyHeatmapQuery } from "@/db/queries/analytics";

export const revalidate = 300;

export default async function GovProvinceDeepDive({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const me = await verifyGov();

  const province = PROVINCES.find((p) => p.slug === slug);
  if (!province) notFound();

  const [gap, heatmap] = await Promise.all([
    skillsGapQuery({ top: 12, province: province.slug }),
    supplyHeatmapQuery(),
  ]);
  const nfmt = new Intl.NumberFormat(locale);

  // Subset the heatmap to this province only.
  const localCells = heatmap
    .filter((r) => r.province.toLowerCase() === province.label.toLowerCase())
    .sort((a, b) => b.supply - a.supply)
    .slice(0, 12);

  return (
    <DashboardShell
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="provinces"
      pageEyebrow="Province deep dive"
      pageTitle={province.label}
      pageSubtitle="Top unfilled-demand skills + local supply by profession. Sourced from Sebenza's controlled-vocabulary search events."
    >
      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Top unfilled-demand skills
          </h2>
          {gap.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
              No search activity yet for {province.label}. As employers
              search the local pool, gaps surface here.
            </p>
          ) : (
            <ol className="divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
              {gap.map((g, i) => (
                <li
                  key={g.skill}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-display tabular text-[color:var(--color-ink-soft)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-base">{g.skill}</span>
                  <span className="text-[color:var(--color-danger)] font-mono tabular">
                    gap {nfmt.format(g.gap)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Supply by profession (top 12)
          </h2>
          {localCells.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
              No active profiles in {province.label} yet.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
              {localCells.map((c, i) => (
                <li
                  key={`${c.profession}-${i}`}
                  className="grid grid-cols-[1fr_auto] gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-display text-base">
                    {c.profession}
                  </span>
                  <span className="font-mono tabular text-[color:var(--color-ink)]">
                    {nfmt.format(c.supply)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
