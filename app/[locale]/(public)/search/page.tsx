import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchBar } from "@/components/feature/SearchBar";
import { SearchFilters } from "@/components/feature/SearchFilters";
import { TalentRosterItem } from "@/components/ui/TalentRosterItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { SAChevron } from "@/components/ui/SAChevron";
import { dataProvider } from "@/lib/data/provider";
import type {
  SearchFilters as F,
  EmploymentStatus,
  Seniority,
  VerificationStatus,
  WorkAvailabilityKind,
} from "@/lib/mock/types";
import { findProvinceBySlug, findCityBySlug, PROFESSIONS } from "@/lib/mock/taxonomy";
import { SearchX } from "lucide-react";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const WORK_AVAILABILITY_VALUES = new Set<WorkAvailabilityKind>([
  "casual",
  "part_time",
  "contract",
  "full_time",
]);

function parseAvailableFor(
  raw: string | undefined,
): WorkAvailabilityKind[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is WorkAvailabilityKind =>
      WORK_AVAILABILITY_VALUES.has(s as WorkAvailabilityKind),
    );
  return out.length > 0 ? out : undefined;
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
    openToInternships: sp.internships === "1",
    openToGraduateProgrammes: sp.graduates === "1",
    availableFor: parseAvailableFor(asString(sp.availableFor)),
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
        {/* Sticky editable search header  the query stays in front of you */}
        <div className="sticky top-[60px] z-20 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]/95 backdrop-blur">
          <div className="mx-auto max-w-[1320px] px-5 py-4 md:px-10">
            <SearchBar
              variant="compact"
              defaultQuery={query}
              defaultLocation={filters.province ?? ""}
            />
          </div>
        </div>

        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          {/* Masthead  Fraunces hero number with chevron motif bleed */}
          <header className="relative overflow-hidden border-b-2 border-[color:var(--color-ink)] py-10 md:py-14">
            <SAChevron
              variant="signature"
              className="pointer-events-none absolute -right-24 -top-12 size-[420px] opacity-[0.06]"
            />
            <div className="relative">
              <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
                <SAChevron variant="mark" className="size-3" />
                Talent register · live
              </div>
              <h1 className="mt-3 text-balance font-display text-[clamp(2rem,5.5vw,4.2rem)] leading-[1.05] tracking-[-0.02em]">
                <span className="tabular text-[color:var(--color-accent)]">
                  {nfmt.format(result.total)}
                </span>{" "}
                <span className="text-[color:var(--color-ink)]">
                  {inferredRole.toLowerCase()}
                </span>{" "}
                <span className="italic font-light text-[color:var(--color-ink-soft)]">
                  in
                </span>{" "}
                <span className="text-[color:var(--color-brand-strong)]">
                  {locationLabel}
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
                Ranked by skill match, status freshness and completeness. Stale
                statuses fall to the bottom  honestly.
              </p>
            </div>
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

                  {/* Honest end-state. Real pagination is queued for Phase 8
                      alongside the saved-search match cron  until then we
                      tell the truth: this is the page-one window, refine
                      filters to narrow. No dead button. */}
                  <div className="mt-8 border-t border-dashed border-[color:var(--color-hairline)] pt-4 text-sm text-[color:var(--color-ink-soft)]">
                    {result.profiles.length < result.total ? (
                      <p>
                        Showing the top {result.profiles.length} of{" "}
                        {nfmt.format(result.total)} matches. Refine the
                        filters above to narrow the result set.
                      </p>
                    ) : (
                      <p>
                        Showing all {result.profiles.length} match
                        {result.profiles.length === 1 ? "" : "es"}.
                      </p>
                    )}
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
