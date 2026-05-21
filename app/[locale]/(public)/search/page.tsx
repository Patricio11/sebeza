import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchBar } from "@/components/feature/SearchBar";
import { SearchFilters } from "@/components/feature/SearchFilters";
import { TalentRosterItem } from "@/components/ui/TalentRosterItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { dataProvider } from "@/lib/data/provider";
import type { SearchFilters as F, EmploymentStatus, Seniority, VerificationStatus } from "@/lib/mock/types";
import { findProvinceBySlug, findCityBySlug, PROFESSIONS } from "@/lib/mock/taxonomy";
import { SearchX } from "lucide-react";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params }: SearchPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("headingFallback") };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const query = asString(sp.q) ?? "";
  const filters: F = {
    query,
    province: asString(sp.province) ?? null,
    city: asString(sp.city) ?? null,
    status: (asString(sp.status) as EmploymentStatus) ?? null,
    seniority: (asString(sp.seniority) as Seniority) ?? null,
    verification: (asString(sp.verification) as VerificationStatus) ?? null,
    highlightCitizens: sp.highlight === "1",
  };

  const result = await dataProvider.searchProfiles(filters);
  const t = await getTranslations("search");

  const province = findProvinceBySlug(filters.province ?? undefined);
  const city = findCityBySlug(filters.city ?? undefined);
  const locationLabel = city?.label ?? province?.label ?? "South Africa";
  const nfmt = new Intl.NumberFormat(locale);

  const inferredRole =
    PROFESSIONS.find(
      (p) =>
        query &&
        (p.label.toLowerCase().includes(query.toLowerCase()) ||
          query.toLowerCase().includes(p.label.toLowerCase())),
    )?.label ??
    query ??
    "results";

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Sticky editable search header — the query stays in front of you */}
        <div className="sticky top-[57px] z-20 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]/95 backdrop-blur">
          <div className="mx-auto max-w-[1240px] px-5 py-4 md:px-8">
            <SearchBar
              variant="compact"
              defaultQuery={query}
              defaultLocation={filters.province ?? ""}
            />
          </div>
        </div>

        <div className="mx-auto max-w-[1240px] px-5 md:px-8">
          {/* Masthead — Fraunces hero number */}
          <header className="border-b-2 border-[color:var(--color-ink)] py-8 md:py-10">
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              Talent register · live
            </div>
            <h1 className="mt-2 font-display text-3xl leading-tight md:text-5xl">
              <span className="tabular text-[color:var(--color-accent)]">
                {nfmt.format(result.total)}
              </span>{" "}
              <span className="text-[color:var(--color-ink)]">
                {inferredRole.toLowerCase()}
              </span>{" "}
              <span className="italic font-light text-[color:var(--color-ink-soft)]">
                in
              </span>{" "}
              <span>{locationLabel}</span>
            </h1>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              Ranked by skill match, status freshness and completeness. Stale
              statuses fall to the bottom — honestly.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-10 py-6 md:grid-cols-[260px_1fr] md:gap-12 md:py-10">
            <SearchFilters defaultFilters={filters} query={query} />

            <section aria-label="Talent roster">
              {result.profiles.length === 0 ? (
                <EmptyState
                  title={t("states.empty")}
                  body={t("states.emptyBody")}
                  icon={<SearchX className="size-5" aria-hidden="true" />}
                />
              ) : (
                <>
                  <ol className="border-t border-[color:var(--color-hairline)]">
                    {result.profiles.map((p) => (
                      <li key={p.handle}>
                        <TalentRosterItem
                          profile={p}
                          locale={locale}
                          highlightCitizen={filters.highlightCitizens}
                        />
                      </li>
                    ))}
                  </ol>

                  {/* Honest pagination — data-light load-more, no infinite scroll */}
                  <div className="mt-8 flex items-center justify-between border-t border-dashed border-[color:var(--color-hairline)] pt-4 text-sm text-[color:var(--color-ink-soft)]">
                    <span>
                      Showing {result.profiles.length} of{" "}
                      {nfmt.format(result.total)}
                    </span>
                    <button
                      type="button"
                      disabled
                      className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 py-1.5 text-[color:var(--color-ink-soft)] disabled:opacity-50"
                    >
                      {t("loadMore")}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
