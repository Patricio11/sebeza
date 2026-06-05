/**
 * Phase 9.8.1  Vacancies list page (`/employer/vacancies`).
 *
 * Lists every vacancy belonging to the caller's org. Owners + Recruiters
 * see a "New vacancy" CTA; Viewers see the list read-only.
 *
 * Mobile-first: vacancy cards stack on phones (single column, tap target
 * on the whole card); desktop renders the same card list in a wider
 * grid. No data tables  the card pattern reads cleanly at 360px wide
 * without horizontal scroll.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  listMyVacancies,
  getMyOrgRole,
  type VacancyRow,
} from "@/lib/employer/vacancies";
import {
  canEditVacancies,
  canSeeSalary,
} from "@/lib/employer/vacancies-types";
import { VacancyStatusChip } from "@/components/feature/employer/vacancies/VacancyStatusChip";
import { DeclineReasonsCard } from "@/components/feature/analytics/DeclineReasonsCard";
import { declineReasonAggregateQuery } from "@/db/queries/decline-reasons";
import { Plus, MapPin, Briefcase, Calendar, Copy } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";
import { PROFESSIONS } from "@/lib/mock/taxonomy";
import { formatVacancyLocation } from "@/lib/employer/vacancies-display";

export const revalidate = 0; // Always fresh  this is the employer's pipeline view.

export default async function VacanciesListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const [role, vacancies] = await Promise.all([
    getMyOrgRole(),
    listMyVacancies(),
  ]);
  const canEdit = canEditVacancies(role);
  const showSalary = canSeeSalary(role);

  // Phase 9.8.7  employer-private decline-reason breakdown across all
  // of this org's vacancies. Scoped by orgId so it's the recruiter's
  // own data (no suppression  they're allowed to see their full
  // picture). Hidden entirely when there's no data to show.
  const declineData = session.orgId
    ? await declineReasonAggregateQuery({ orgId: session.orgId })
    : null;

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="vacancies"
      pageEyebrow={session.name ?? "Employer workspace"}
      pageTitle="Vacancies"
      pageSubtitle="Private to your organisation. Vacancies are reverse-matching specifications  invite specific people, capture their accept / decline-with-reason, log the placement when filled. Never a public posting."
      pageActions={
        canEdit ? (
          <Link
            href="/employer/vacancies/new"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] shadow-press hover:-translate-y-0.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            New vacancy
          </Link>
        ) : null
      }
    >
      {/* Phase 10.1  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink slug="creating-a-vacancy" label="Create a vacancy" />
        <HelpLink slug="vacancy-lifecycle" label="Lifecycle states" />
        <HelpLink slug="duplicate-vacancy" label="Duplicate an existing" />
      </div>
      {!canEdit && (
        <p className="mb-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
          Your workspace role is <strong>Viewer</strong>  vacancy list is
          read-only. Ask an Owner or Recruiter to create or edit
          vacancies.
        </p>
      )}

      {vacancies.length === 0 ? (
        <EmptyState canEdit={canEdit} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {vacancies.map((v) => (
            <li key={v.id}>
              <VacancyCard
                vacancy={v}
                showSalary={showSalary}
                canEdit={canEdit}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Phase 9.8.7  decline-reason breakdown across all your
          vacancies. Loud signal: a (profession × province) cell where
          most declines cite "salary not competitive" tells you to
          re-think the band before you re-invite. Hidden when there's
          nothing to show. */}
      {declineData && declineData.cells.length > 0 && (
        <div className="mt-10">
          <DeclineReasonsCard data={declineData} locale={locale} />
        </div>
      )}
    </DashboardShell>
  );
}

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center md:p-12">
      <Briefcase
        className="mx-auto size-8 text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <h2 className="mt-4 font-display text-xl">No vacancies yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--color-ink-soft)]">
        A vacancy is a private hiring specification. Create one to
        reverse-match against the talent base and invite specific
        people. It is never a public posting.
      </p>
      {canEdit && (
        <Link
          href="/employer/vacancies/new"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] shadow-press hover:-translate-y-0.5"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create your first vacancy
        </Link>
      )}
    </div>
  );
}

function VacancyCard({
  vacancy,
  showSalary,
  canEdit,
}: {
  vacancy: VacancyRow;
  showSalary: boolean;
  canEdit: boolean;
}) {
  const professionLabel =
    PROFESSIONS.find((p) => p.slug === vacancy.professionSlug)?.label ??
    vacancy.professionSlug;
  // Phase 13.9  single source of truth for the location string.
  // Handles "Any province  Remote / Hybrid" for null-province
  // (remote / hybrid) vacancies + the conventional "Cape Town,
  // Western Cape" for province-scoped vacancies.
  const provinceLabel = formatVacancyLocation({
    provinceSlug: vacancy.provinceSlug,
    citySlug: vacancy.citySlug,
    workAvailability: vacancy.workAvailability,
  });
  const dfmt = new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Phase 9.19 D7  the card now hosts two actions (Open + Duplicate)
  // so it's a div, not a wrapping Link. The title carries the primary
  // navigation; Duplicate is a sibling link to /new?duplicateFrom=...
  // The create page reads that query param server-side and pre-fills
  // the form (see /employer/vacancies/new).
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 transition-colors hover:border-[color:var(--color-ink)]">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg leading-tight text-[color:var(--color-ink)]">
          <Link
            href={`/employer/vacancies/${vacancy.id}` as never}
            className="hover:underline focus:underline focus:outline-none"
          >
            {vacancy.title}
          </Link>
        </h3>
        <VacancyStatusChip status={vacancy.status} />
      </header>
      <dl className="mt-3 space-y-1.5 text-xs text-[color:var(--color-ink-soft)]">
        <div className="inline-flex items-center gap-1.5">
          <Briefcase className="size-3" aria-hidden="true" />
          <span className="capitalize">{professionLabel}</span>
          {vacancy.seniority && (
            <span className="text-[color:var(--color-ink)]">
              · {vacancy.seniority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3" aria-hidden="true" />
          {provinceLabel}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3" aria-hidden="true" />
          Created {dfmt.format(new Date(vacancy.createdAt))}
          {vacancy.inviteExpiryDays
            ? ` · invites expire in ${vacancy.inviteExpiryDays} day${vacancy.inviteExpiryDays === 1 ? "" : "s"}`
            : " · invites never expire"}
        </div>
        {showSalary && vacancy.salaryBand && (
          <div className="text-[color:var(--color-ink)]">
            <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em] text-[color:var(--color-accent)]">
              Private
            </span>{" "}
            {vacancy.salaryBand}
          </div>
        )}
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3">
        <Link
          href={`/employer/vacancies/${vacancy.id}` as never}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-3 text-xs font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
        >
          Open
        </Link>
        {canEdit && (
          <Link
            href={
              `/employer/vacancies/new?duplicateFrom=${vacancy.id}` as never
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
            title="Open the create form pre-filled with this vacancy's values"
          >
            <Copy className="size-3" aria-hidden="true" />
            Duplicate
          </Link>
        )}
      </div>
    </article>
  );
}
