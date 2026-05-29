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
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

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

  // Phase 9.15  pending-suggestion count for the queue link badge.
  const pendingRows = await getDb()
    .select({ n: count() })
    .from(schema.taxonomySuggestions)
    .where(eq(schema.taxonomySuggestions.state, "pending"));
  const pendingCount = pendingRows[0]?.n ?? 0;

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
      {/* Phase 10.3  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="admin" slug="managing-skills-and-professions" label="Managing skills" />
        <HelpLink role="admin" slug="suggestion-workflow-user-other-entries" label="Suggestion workflow" />
      </div>

      {/* Phase 9.15  suggestion-queue banner. Shows pending count + deep-link. */}
      <Link
        href="/admin/taxonomy/suggestions"
        className={
          "mb-6 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border-2 px-4 py-3 transition-colors " +
          (pendingCount > 0
            ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] hover:bg-[color:var(--color-accent)]/15"
            : "border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-ink)]")
        }
      >
        <span className="flex items-center gap-3">
          <Inbox
            className={
              "size-5 " +
              (pendingCount > 0
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--color-ink-soft)]")
            }
            aria-hidden="true"
          />
          <span>
            <span className="block font-medium text-[color:var(--color-ink)]">
              Taxonomy suggestions
            </span>
            <span className="block text-xs text-[color:var(--color-ink-soft)]">
              {pendingCount > 0
                ? `${pendingCount} pending  promote / merge / reject user-submitted "Other" entries`
                : 'No pending suggestions. User-submitted "Other" entries appear here.'}
            </span>
          </span>
        </span>
        {pendingCount > 0 && (
          <span className="rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-3 py-1 text-xs font-medium text-[color:var(--color-paper)]">
            {pendingCount}
          </span>
        )}
      </Link>

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
