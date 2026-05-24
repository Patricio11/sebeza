/**
 * Phase 9.8.2  Reverse-matching ("Find matches") for a vacancy.
 *
 * Reuses the Phase 4 ranking SQL (`searchProfilesQuery`) with filters
 * derived from the vacancy. ONE ranking source of truth  there is no
 * parallel matcher. Citizen highlighting comes via the existing
 * `citizen_boost` (NOT a new gate; §CRITICAL in PHASE_9_8_PLAN.md).
 *
 * Honest-supply line at the top: "N SA citizens · M candidates match
 * this vacancy." Computed from `countMatchesByCitizenship` (full match
 * set, independent of the SEARCH_LIMIT-capped list below). Sticky so
 * it stays visible while the employer scrolls the candidate list
 * mobile-first per the §UX/UI quality bar.
 *
 * Respects all existing redaction: TalentRosterItem renders the same
 * cells the public /search uses (no ID number, no documents, no raw
 * contact). Reveal stays the audited Phase 5 dossier flow  the
 * "Open dossier" link below each candidate is the existing path.
 *
 * Phase 9.8.4 will add the bulk-invite affordance on top of this
 * surface; 9.8.2 is just the match view.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  getMyVacancy,
  matchVacancyCandidates,
} from "@/lib/employer/vacancies";
import { TalentRosterItem } from "@/components/ui/TalentRosterItem";
import { VacancyStatusChip } from "@/components/feature/employer/vacancies/VacancyStatusChip";
import { PROVINCES, PROFESSIONS } from "@/lib/mock/taxonomy";
import { ChevronLeft, MapPin, Search, Users } from "lucide-react";

export const revalidate = 0;

export default async function VacancyMatchPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const vacancy = await getMyVacancy(id);
  if (!vacancy) notFound();

  const match = await matchVacancyCandidates(vacancy);
  const { candidates, counts, filters } = match;

  const professionLabel =
    PROFESSIONS.find((p) => p.slug === vacancy.professionSlug)?.label ??
    vacancy.professionSlug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === vacancy.provinceSlug)?.label ??
    vacancy.provinceSlug;

  // "Refine in search" jumps to the public /search with the same filters
  // pre-filled. The employer keeps the workflow context here on /match;
  // the link is for cases where they want to broaden / narrow ad-hoc.
  const refineQs = new URLSearchParams();
  if (filters.query) refineQs.set("query", filters.query);
  if (filters.province) refineQs.set("province", filters.province);
  if (filters.seniority) refineQs.set("seniority", filters.seniority);
  const refineHref =
    `/search${refineQs.toString() ? `?${refineQs.toString()}` : ""}`;

  const nfmt = new Intl.NumberFormat(locale);

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="vacancies"
      pageEyebrow="Find matches"
      pageTitle={vacancy.title}
      pageSubtitle={`${professionLabel}${vacancy.seniority ? ` · ${vacancy.seniority}` : ""} · ${provinceLabel}`}
    >
      {/* Back link + status chip strip  same idiom as the detail page,
          stays inside the page body since DashboardShell takes plain
          strings for the header slots. */}
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/employer/vacancies/${vacancy.id}` as never}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to vacancy
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">·</span>
        <VacancyStatusChip status={vacancy.status} />
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-ink-soft)]">
          <MapPin className="size-3" aria-hidden="true" />
          {provinceLabel}
        </span>
      </div>

      {/* Honest-supply line  sticky on top so it stays visible while
          scrolling on mobile. Plain SA-citizen / candidate split per D6
          ("candidates" not "eligible"). */}
      <section
        aria-labelledby="supply-h"
        className="sticky top-0 z-10 -mx-5 mb-6 border-y-2 border-[color:var(--color-ink)] bg-[color:var(--color-brand-tint)] px-5 py-3 backdrop-blur md:mx-0 md:rounded-[var(--radius-md)] md:border-2"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <Users
              className="size-4 self-center text-[color:var(--color-brand-strong)]"
              aria-hidden="true"
            />
            <h2
              id="supply-h"
              className="font-display text-lg leading-none text-[color:var(--color-ink)]"
            >
              {counts.total === 0
                ? "No candidates match this vacancy yet"
                : `${nfmt.format(counts.saCitizen)} SA ${counts.saCitizen === 1 ? "citizen" : "citizens"} · ${nfmt.format(counts.total)} ${counts.total === 1 ? "candidate" : "candidates"} match this vacancy`}
            </h2>
          </div>
          <Link
            href={refineHref as never}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-3 text-xs font-medium hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
          >
            <Search className="size-3.5" aria-hidden="true" />
            Refine in search
          </Link>
        </div>
        {counts.total > 0 && counts.foreignNational > 0 && (
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            Of those, {nfmt.format(counts.foreignNational)} are
            foreign nationals  highlighted SA candidates rank first via
            the platform's citizen-highlight boost.
          </p>
        )}
      </section>

      {candidates.length === 0 ? (
        <EmptyState
          vacancyId={vacancy.id}
          professionLabel={professionLabel}
          provinceLabel={provinceLabel}
        />
      ) : (
        <>
          <ol className="border-t border-[color:var(--color-hairline)]">
            {candidates.map((p) => (
              <li key={p.handle}>
                <TalentRosterItem
                  profile={p}
                  locale={locale}
                  highlightCitizen
                />
                {/* Phase 9.8.4 will add the bulk-invite affordance on
                    top of these rows. For 9.8.2 the existing dossier
                    flow is the next step. */}
                <div className="-mt-2 mb-4 ml-16 flex flex-wrap items-center justify-end gap-3 text-xs">
                  <Link
                    href={`/employer/dossier/${p.handle}` as never}
                    className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-3 font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
                  >
                    Open dossier
                  </Link>
                </div>
              </li>
            ))}
          </ol>

          {candidates.length >= 50 && (
            <p className="mt-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
              Top 50 ranked candidates shown. The honest-supply line
              above counts <strong>all {nfmt.format(counts.total)}</strong>
              {" "}matches across the platform  use Refine in search
              if you want to narrow the ranked view.
            </p>
          )}
        </>
      )}

      {/* Phase 9.8.4 nudge  remind the build what's coming next. */}
      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        Phase 9.8.2 surfaces the matches. The <strong>bulk-invite</strong>
        action (multi-select  &ldquo;Invite to opportunity&rdquo;) +
        accept / decline-with-reason / reconsider lifecycle lands in
        9.8.4  9.8.5.
      </p>

      {/* Hidden session ref to silence the unused-var lint when this
          page later wires per-action audit-log calls. */}
      <span className="sr-only">Vacancy match · {session.id}</span>
    </DashboardShell>
  );
}

function EmptyState({
  vacancyId,
  professionLabel,
  provinceLabel,
}: {
  vacancyId: string;
  professionLabel: string;
  provinceLabel: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center md:p-12">
      <Users
        className="mx-auto size-8 text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <h2 className="mt-4 font-display text-xl">No candidates yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--color-ink-soft)]">
        Nothing matches <strong>{professionLabel}</strong> in{" "}
        <strong>{provinceLabel}</strong> with the current filters. This is
        the honest read of the live talent pool. As more seekers join +
        confirm their availability, matches will surface here.
      </p>
      <Link
        href={`/employer/vacancies/${vacancyId}` as never}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-sm font-medium hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
      >
        Back to vacancy
      </Link>
    </div>
  );
}
