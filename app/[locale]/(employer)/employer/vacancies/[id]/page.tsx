/**
 * Phase 9.8.1  Vacancy detail / edit page (`/employer/vacancies/[id]`).
 *
 * Owners + Recruiters see the editable form; Viewers see a read-only
 * detail panel. Status transitions (Open → Closed → Filled, etc.) are
 * surfaced as quick-action buttons; the underlying Server Action
 * validates the transition against the bounded state machine in
 * `lib/employer/vacancies.ts`.
 *
 * The placement-linkage flow (Phase 9.8.6) lands later: marking
 * `filled` here today is the lifecycle marker; the actual placement
 * row gets logged via the existing /employer/placements path.
 *
 * Mobile-first: detail panel + form share a single column; status
 * actions sit in a sticky footer-style action row that stays
 * thumb-reachable on phones.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { Button } from "@/components/ui/Button";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  getMyVacancy,
  getMyOrgRole,
  transitionVacancyStatus,
  updateVacancy,
} from "@/lib/employer/vacancies";
import {
  canEditVacancies,
  canSeeSalary,
  type VacancyStatus,
} from "@/lib/employer/vacancies-types";
import { VacancyForm } from "@/components/feature/employer/vacancies/VacancyForm";
import { VacancyStatusChip } from "@/components/feature/employer/vacancies/VacancyStatusChip";
import { getProfessions } from "@/lib/taxonomy/query";
import { PROVINCES, PROFESSIONS, SKILLS } from "@/lib/mock/taxonomy";
import { ChevronLeft, Lock, MapPin, Users } from "lucide-react";

export const revalidate = 0;

export default async function VacancyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const [role, vacancy] = await Promise.all([
    getMyOrgRole(),
    getMyVacancy(id),
  ]);
  if (!vacancy) notFound();
  const canEdit = canEditVacancies(role);
  const showSalary = canSeeSalary(role);

  const professions = await getProfessions();

  const professionLabel =
    PROFESSIONS.find((p) => p.slug === vacancy.professionSlug)?.label ??
    vacancy.professionSlug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === vacancy.provinceSlug)?.label ??
    vacancy.provinceSlug;

  const NEXT_STATES: Record<VacancyStatus, VacancyStatus[]> = {
    draft: ["open", "closed"],
    open: ["closed", "filled"],
    closed: ["open"],
    filled: ["closed"],
  };
  const TRANSITION_LABEL: Record<VacancyStatus, string> = {
    draft: "Move to draft",
    open: "Open vacancy",
    closed: "Close vacancy",
    filled: "Mark as filled",
  };

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="vacancies"
      pageEyebrow="Vacancy detail"
      pageTitle={vacancy.title}
      pageSubtitle={`${professionLabel}${vacancy.seniority ? ` · ${vacancy.seniority}` : ""} · ${provinceLabel}`}
    >
      {/* Back link + status chip strip  rendered inline below the
          page header (DashboardShell's pageEyebrow / pageSubtitle are
          plain strings; we keep the visual richness here). Mobile-first:
          wraps cleanly at 360px wide. */}
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/employer/vacancies"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to vacancies
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">·</span>
        <VacancyStatusChip status={vacancy.status} />
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-ink-soft)]">
          <MapPin className="size-3" aria-hidden="true" />
          {provinceLabel}
        </span>
      </div>

      {/* Find-matches CTA  visible to all roles. Reverse-matching is a
          read of the public talent pool through the existing redaction
          layer, so Viewers can browse matches even though they cannot
          edit the vacancy itself. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-brand-tint)] p-4">
        <div className="flex items-start gap-3">
          <Users
            className="mt-0.5 size-5 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-display text-base leading-tight text-[color:var(--color-ink)]">
              Find candidates for this vacancy
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              Reverse-matched against the live talent pool  ranked, redacted,
              SA citizens highlighted first.
            </p>
          </div>
        </div>
        <Link
          href={`/employer/vacancies/${vacancy.id}/match` as never}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
        >
          Find matches
        </Link>
      </div>

      {!canEdit && <ViewerNotice />}

      {/* Status transition actions  Owner/Recruiter only */}
      {canEdit && NEXT_STATES[vacancy.status].length > 0 && (
        <section className="mb-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Lifecycle
          </span>
          {NEXT_STATES[vacancy.status].map((next) => (
            <form
              key={next}
              action={async () => {
                "use server";
                await transitionVacancyStatus({
                  vacancyId: vacancy.id,
                  next,
                });
              }}
            >
              <Button
                type="submit"
                variant={next === "filled" ? "primary" : "secondary"}
                size="sm"
              >
                {TRANSITION_LABEL[next]}
              </Button>
            </form>
          ))}
        </section>
      )}

      {/* Salary band  Owner/Recruiter only */}
      {showSalary && vacancy.salaryBand && (
        <section className="mb-6 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 p-4">
          <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            <Lock className="size-3" aria-hidden="true" />
            Salary band · private
          </div>
          <p className="mt-1 font-display text-lg text-[color:var(--color-ink)]">
            {vacancy.salaryBand}
          </p>
        </section>
      )}

      {/* Edit form  Owner/Recruiter only; read-only summary for Viewer */}
      {canEdit ? (
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-8">
          <h2 className="mb-5 border-b border-[color:var(--color-hairline)] pb-3 font-display text-xl">
            Edit vacancy
          </h2>
          <VacancyForm
            initial={vacancy}
            professions={professions}
            provinces={PROVINCES}
            skills={SKILLS}
            onSubmit={async (value) => {
              "use server";
              const res = await updateVacancy(vacancy.id, value);
              return res.ok
                ? { ok: true }
                : { ok: false, message: res.message };
            }}
            redirectTo={`/employer/vacancies/${vacancy.id}`}
            submitLabel="Save changes"
            cancelHref={`/employer/vacancies/${vacancy.id}`}
          />
        </div>
      ) : (
        <ReadOnlyDetail vacancy={vacancy} skillLabels={SKILLS} />
      )}

      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        Phase 9.8.1 ships the vacancy lifecycle. <strong>Find matches</strong>
        {" "}(reverse-matching),{" "}
        <strong>invite flow</strong>, and the{" "}
        <strong>decline-with-reason</strong> response live on the same vacancy
        in 9.8.2 + 9.8.4 + 9.8.5. Coming next.
      </p>
    </DashboardShell>
  );
}

function ViewerNotice() {
  return (
    <p className="mb-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
      Your workspace role is <strong>Viewer</strong>  vacancy detail is
      read-only. Ask an Owner or Recruiter to make changes.
    </p>
  );
}

function ReadOnlyDetail({
  vacancy,
  skillLabels,
}: {
  vacancy: import("@/lib/employer/vacancies").VacancyRow;
  skillLabels: typeof SKILLS;
}) {
  const skills = vacancy.skillSlugs
    .map((s) => skillLabels.find((sk) => sk.slug === s)?.label ?? s);
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-8">
      <h2 className="mb-4 border-b border-[color:var(--color-hairline)] pb-3 font-display text-xl">
        Vacancy detail
      </h2>
      <dl className="space-y-4 text-sm">
        {vacancy.description && (
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Description
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-[color:var(--color-ink)]">
              {vacancy.description}
            </dd>
          </div>
        )}
        {skills.length > 0 && (
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Required skills
            </dt>
            <dd className="mt-1.5 flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s}
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2.5 py-0.5 text-xs text-[color:var(--color-ink)]"
                >
                  {s}
                </span>
              ))}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Invite expiry
          </dt>
          <dd className="mt-1 text-[color:var(--color-ink)]">
            {vacancy.inviteExpiryDays
              ? `${vacancy.inviteExpiryDays} day${vacancy.inviteExpiryDays === 1 ? "" : "s"} after each invite is sent`
              : "Invites never expire on this vacancy"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
