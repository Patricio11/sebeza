import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { loadTaxonomy } from "@/lib/admin/taxonomy-query";
import {
  TaxonomyManager,
  type TaxonomyKind,
} from "@/components/feature/admin/TaxonomyManager";

export default async function TaxonomyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();
  const { tab } = await searchParams;
  const active: TaxonomyKind = (
    tab === "skills" || tab === "provinces" || tab === "cities" ? tab : "professions"
  ) as TaxonomyKind;

  const t = await getTranslations("adminDash.taxonomy");
  const data = await loadTaxonomy();

  const rows =
    active === "skills"
      ? data.skills
      : active === "provinces"
        ? data.provinces
        : active === "cities"
          ? data.cities
          : data.professions;

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="taxonomy"
      pageEyebrow="Reference data"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-[color:var(--color-hairline)]">
        {(
          [
            ["professions", t("tabs.professions"), data.professions.length],
            ["skills", t("tabs.skills"), data.skills.length],
            ["provinces", t("tabs.provinces"), data.provinces.length],
            ["cities", t("tabs.cities"), data.cities.length],
          ] as const
        ).map(([key, label, count]) => (
          <Link
            key={key}
            href={{ pathname: "/admin/taxonomy", query: { tab: key } }}
            className={
              "border-b-2 px-4 py-2.5 text-sm uppercase tracking-[0.18em] " +
              (active === key
                ? "border-[color:var(--color-ink)] text-[color:var(--color-ink)]"
                : "border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
            }
          >
            {label} · {count}
          </Link>
        ))}
      </nav>

      <TaxonomyManager
        kind={active}
        rows={rows}
        provinces={active === "cities" ? data.provinces : undefined}
      />

      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        Free-text in search is intentionally disabled. The controlled vocabulary
        here is what keeps national analytics meaningful  every search and
        profile must reduce to a slug.{" "}
        {active === "provinces" && (
          <span>
            Provinces are seeded from Stats SA and are not editable from this
            surface.
          </span>
        )}
      </p>
    </DashboardShell>
  );
}
