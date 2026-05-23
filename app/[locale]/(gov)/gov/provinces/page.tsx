import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { ArrowRight } from "lucide-react";

export const revalidate = 300;

export default async function GovProvincesIndexPage({
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
      activeKey="provinces"
      pageEyebrow="Geography"
      pageTitle="Provinces"
      pageSubtitle="Per-province deep dives  supply, top local gaps, freshness, monthly trend."
    >
      <ul className="grid gap-3 md:grid-cols-3">
        {PROVINCES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/gov/provinces/${p.slug}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 transition-colors hover:border-[color:var(--color-ink)]"
            >
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  Province
                </div>
                <div className="mt-1 font-display text-xl">{p.label}</div>
              </div>
              <ArrowRight className="size-4 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
