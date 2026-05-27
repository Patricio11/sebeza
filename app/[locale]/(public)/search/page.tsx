import { Fragment } from "react";
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
import { getSetting } from "@/lib/admin/settings";
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
  "remote",
  "hybrid",
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
  const verificationVisible = await getSetting<boolean>(
    "feature_flag_verification_badges_visible",
  );
  const query = asString(sp.q) ?? "";
  const filters: F = {
    query,
    profession: asString(sp.profession) ?? null,
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

  // Phase 9.14.x  citizen split breakdown on the displayed slice.
  // Only meaningful when the "Highlight SA citizens" toggle is ON AND
  // both groups are present  otherwise the split is either vacuous
  // (all citizens) or a non-grouping (no citizens to highlight).
  // Wording follows the Citizen-Visibility Rule: "from other
  // nationalities" instead of clinical "non-citizens" / "foreign
  // nationals". Counts are over the displayed window (result.profiles),
  // not the full match  hence "shown first" framing.
  const citizenCount = result.profiles.filter((p) => p.isCitizen).length;
  const otherCount = result.profiles.length - citizenCount;
  const showCitizenSplit =
    (filters.highlightCitizens ?? false) &&
    citizenCount > 0 &&
    otherCount > 0;

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

              {/* Phase 9.14.x  citizen split when the highlight toggle is on. */}
              {showCitizenSplit && (
                <p
                  className="mt-3 inline-flex flex-wrap items-baseline gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs text-[color:var(--color-ink-soft)]"
                  aria-label="South African citizen split"
                >
                  <span className="font-medium text-[color:var(--color-ink)]">
                    {nfmt.format(citizenCount)} SA citizens shown first
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    then {nfmt.format(otherCount)} from other nationalities
                  </span>
                </p>
              )}
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
                    {result.profiles.map((p, i) => {
                      const prev = result.profiles[i - 1];
                      const isTransition =
                        showCitizenSplit && !!prev?.isCitizen && !p.isCitizen;
                      return (
                        <Fragment key={p.handle}>
                          {isTransition && (
                            <li
                              role="presentation"
                              className="my-2 flex items-center gap-3 px-1"
                            >
                              <span
                                aria-hidden="true"
                                className="h-px flex-1 bg-[color:var(--color-hairline)]"
                              />
                              <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                                {nfmt.format(otherCount)} from other nationalities below
                              </span>
                              <span
                                aria-hidden="true"
                                className="h-px flex-1 bg-[color:var(--color-hairline)]"
                              />
                            </li>
                          )}
                          <li>
                            <TalentRosterItem
                              profile={p}
                              locale={locale}
                              highlightCitizen={filters.highlightCitizens}
                              verificationVisible={verificationVisible}
                            />
                          </li>
                        </Fragment>
                      );
                    })}
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
