import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { Button } from "@/components/ui/Button";
import { verifyAdmin } from "@/lib/auth/dal";
import { PROFESSIONS, SKILLS, PROVINCES } from "@/lib/mock/taxonomy";
import { Plus, Pencil } from "lucide-react";

type Tab = "professions" | "skills" | "provinces" | "cities";

const CITIES_FLAT = PROVINCES.flatMap((p) =>
  p.cities.map((c) => ({ ...c, province: p.label })),
);

export default async function TaxonomyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const { tab } = await searchParams;
  const active: Tab = (
    tab === "skills" || tab === "provinces" || tab === "cities" ? tab : "professions"
  ) as Tab;

  const t = await getTranslations("adminDash.taxonomy");

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="taxonomy"
      pageEyebrow="Reference data"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="primary" size="md">
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      }
    >
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-[color:var(--color-hairline)]">
        {(
          [
            ["professions", t("tabs.professions"), PROFESSIONS.length],
            ["skills", t("tabs.skills"), SKILLS.length],
            ["provinces", t("tabs.provinces"), PROVINCES.length],
            ["cities", t("tabs.cities"), CITIES_FLAT.length],
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

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              <th className="px-5 py-3 font-normal">Label</th>
              <th className="px-5 py-3 font-normal">Slug</th>
              {active === "cities" && (
                <th className="px-5 py-3 font-normal">Province</th>
              )}
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {(active === "professions"
              ? PROFESSIONS.map((p) => ({ ...p, province: undefined }))
              : active === "skills"
                ? SKILLS.map((s) => ({ ...s, province: undefined }))
                : active === "provinces"
                  ? PROVINCES.map((p) => ({ slug: p.slug, label: p.label, province: undefined }))
                  : CITIES_FLAT.map((c) => ({ slug: c.slug, label: c.label, province: c.province }))
            ).map((row) => (
              <tr key={row.slug} className="border-t border-[color:var(--color-hairline)]">
                <td className="px-5 py-2.5 font-display text-base">{row.label}</td>
                <td className="px-5 py-2.5 font-mono text-xs text-[color:var(--color-ink-soft)]">
                  {row.slug}
                </td>
                {active === "cities" && (
                  <td className="px-5 py-2.5 text-[color:var(--color-ink-soft)]">
                    {row.province}
                  </td>
                )}
                <td className="px-5 py-2.5 text-right">
                  <button
                    type="button"
                    aria-label="Edit"
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {(active === "professions"
          ? PROFESSIONS.map((p) => ({ ...p, province: undefined as string | undefined }))
          : active === "skills"
            ? SKILLS.map((s) => ({ ...s, province: undefined as string | undefined }))
            : active === "provinces"
              ? PROVINCES.map((p) => ({
                  slug: p.slug,
                  label: p.label,
                  province: undefined as string | undefined,
                }))
              : CITIES_FLAT.map((c) => ({
                  slug: c.slug,
                  label: c.label,
                  province: c.province as string | undefined,
                }))
        ).map((row) => (
          <li
            key={row.slug}
            className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3"
          >
            <div className="min-w-0">
              <div className="font-display text-base leading-tight">
                {row.label}
              </div>
              <div className="truncate text-xs">
                <code className="font-mono text-[color:var(--color-ink-soft)]">
                  {row.slug}
                </code>
                {row.province && (
                  <span className="ml-2 text-[color:var(--color-ink-soft)]">
                    · {row.province}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Edit"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        Free-text in search is intentionally disabled. The controlled vocabulary
        here is what keeps national analytics meaningful — every search and
        profile must reduce to a slug.
      </p>
    </DashboardShell>
  );
}
