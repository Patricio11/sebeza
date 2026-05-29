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
import { VacancyInvitationsPanel } from "@/components/feature/employer/vacancies/VacancyInvitationsPanel";
import { VacancyPlacementsPanel } from "@/components/feature/employer/vacancies/VacancyPlacementsPanel";
import { MarkAsFilledModal } from "@/components/feature/employer/vacancies/MarkAsFilledModal";
import {
  listInvitationsForVacancy,
  withdrawInvitation,
} from "@/lib/employer/invitations";
import { getPlacementsForVacancy } from "@/lib/employer/placements";
import { getProfessions } from "@/lib/taxonomy/query";
import { PROVINCES, PROFESSIONS, SKILLS } from "@/lib/mock/taxonomy";
import { ChevronLeft, Lock, MapPin, Users } from "lucide-react";
import type { WorkAvailabilityKind } from "@/lib/mock/types";

export const revalidate = 0;

// Phase 9.19  display labels for the work_availability_kind enum.
// Single source of truth for read-only renderings on the vacancy
// detail page (the editable form has its own list with values).
const WORK_AVAILABILITY_LABELS: Record<WorkAvailabilityKind, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  casual: "Casual",
  // Phase 9.21  recurring calendar-window work (lodge in Dec-Feb,
  // citrus harvest May-Oct). The associated date range is rendered
  // separately on the Match-requirements strip; this label is just
  // the chip name.
  seasonal: "Seasonal",
  remote: "Remote",
  hybrid: "Hybrid",
};

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
  const [invitations, placements] = await Promise.all([
    listInvitationsForVacancy(vacancy.id),
    getPlacementsForVacancy(vacancy.id),
  ]);

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
      workspaceLabel={session.orgName ?? "Your organisation"}
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

      {/* Phase 9.19  Match-requirements strip. Surfaces the three new
          vacancy-side axes (work availability, min years, min NQF) above
          the "Find matches" CTA so the organiser sees, at a glance, what
          the matcher will constrain on. Each field that's blank renders
          as "No requirement"  consistent with D0 (vacancy is source of
          truth; blank = matcher ignores axis). */}
      <MatchRequirementsStrip vacancy={vacancy} />

      {/* Phase 9.19 D9  per-vacancy accept-rate analytics. Vacancy-
          private, never cross-vacancy comparison, never per-seeker
          breakdown. Hidden when there's nothing to show. */}
      {invitations.length > 0 && (
        <AcceptRateStrip
          invitations={invitations}
          followUpNudgesEnabled={vacancy.followUpNudgesEnabled}
        />
      )}

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

      {/* Phase 9.8.4  Pipeline of invitations sent on this vacancy.
          Visible to all roles (Viewers can see who's in the pipeline);
          withdraw action is Owner/Recruiter-only and only available
          while an invite is still in the `invited` state. */}
      {invitations.length > 0 && (
        <VacancyInvitationsPanel
          invitations={invitations}
          canEdit={canEdit}
          locale={locale}
          withdrawAction={async (invitationId: string) => {
            "use server";
            const res = await withdrawInvitation({ invitationId });
            return res.ok ? { ok: true } : { ok: false, message: res.message };
          }}
        />
      )}

      {/* Phase 9.8.6  Vacancy → Placement linkage. Closes the loop:
          accepted invitees become one-tap "Log this hire" CTAs that
          deep-link to the existing dossier mark-as-hired flow with
          ?vacancyId=… so the placement row carries the linkage
          automatically. When status=filled and nothing's logged yet,
          the panel renders as a prominent prompt (the plan's "mark
          filled → prompt to log placement" requirement). */}
      <VacancyPlacementsPanel
        vacancyId={vacancy.id}
        vacancyStatus={vacancy.status}
        canEdit={canEdit}
        placements={placements}
        invitations={invitations}
        locale={locale}
      />

      {/* Status transition actions  Owner/Recruiter only */}
      {canEdit && NEXT_STATES[vacancy.status].length > 0 && (
        <section className="mb-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Lifecycle
          </span>
          {NEXT_STATES[vacancy.status].map((next) =>
            next === "filled" ? (
              <MarkAsFilledModal
                key={next}
                vacancyId={vacancy.id}
                vacancyTitle={vacancy.title}
                acceptedInvitees={invitations.filter(
                  (i) =>
                    i.state === "accepted" ||
                    i.state === "accepted_with_notice",
                )}
                triggerLabel={TRANSITION_LABEL[next]}
              />
            ) : (
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
                  variant="secondary"
                  size="sm"
                >
                  {TRANSITION_LABEL[next]}
                </Button>
              </form>
            ),
          )}
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
            draftId={vacancy.id}
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

function AcceptRateStrip({
  invitations,
  followUpNudgesEnabled,
}: {
  invitations: import("@/lib/employer/invitations").InvitationRow[];
  followUpNudgesEnabled: boolean;
}) {
  // Bucket every invitation into one of five lifecycle columns. We
  // deliberately fold `accepted_with_notice` into accepted (it IS an
  // acceptance), `reconsidering` into declined (it's a transient
  // sub-state of declined), and `withdrawn` into expired (both are
  // "no further action expected"). Sum across buckets equals total,
  // so the figures don't lie even when transient states exist.
  let accepted = 0;
  let declined = 0;
  let pending = 0;
  let expired = 0;
  for (const inv of invitations) {
    switch (inv.state) {
      case "accepted":
      case "accepted_with_notice":
        accepted++;
        break;
      case "declined":
      case "reconsidering":
        declined++;
        break;
      case "invited":
        pending++;
        break;
      case "expired":
      case "withdrawn":
        expired++;
        break;
    }
  }
  const total = invitations.length;
  // Acceptance rate as a fraction of CLOSED responses (acceptances
  // over accepted + declined). Pending + expired are not counted in
  // the denominator  including them would make the rate look worse
  // every time someone slow-walks a response. Surface NULL when no
  // closed responses exist yet.
  const closed = accepted + declined;
  const acceptRate = closed > 0 ? Math.round((accepted / closed) * 100) : null;
  return (
    <section
      aria-label="Vacancy invitation outcomes"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Invitation outcomes
        </span>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          {acceptRate !== null ? (
            <>
              <strong className="text-[color:var(--color-ink)]">
                {acceptRate}%
              </strong>{" "}
              acceptance on closed responses
            </>
          ) : (
            "No responses yet"
          )}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <StatCell label="Sent" value={total} />
        <StatCell label="Accepted" value={accepted} accent="brand" />
        <StatCell label="Declined" value={declined} />
        <StatCell label="Pending" value={pending} />
        <StatCell label="Expired" value={expired} />
      </dl>
      {followUpNudgesEnabled && pending > 0 && (
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          Follow-up nudges are on for this vacancy. Pending invitations
          past 7 days will receive one gentle reminder.
        </p>
      )}
    </section>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "brand";
}) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd
        className={
          "mt-0.5 font-display text-2xl leading-none " +
          (accent === "brand"
            ? "text-[color:var(--color-brand-strong)]"
            : "text-[color:var(--color-ink)]")
        }
      >
        {value}
      </dd>
    </div>
  );
}

function MatchRequirementsStrip({
  vacancy,
}: {
  vacancy: import("@/lib/employer/vacancies").VacancyRow;
}) {
  const workModes = vacancy.workAvailability
    .map((k) => WORK_AVAILABILITY_LABELS[k])
    .join(" · ");
  const yearsLabel =
    vacancy.minYearsExperience != null
      ? `${vacancy.minYearsExperience}+ yr${vacancy.minYearsExperience === 1 ? "" : "s"}`
      : "No minimum";
  const nqfLabel =
    vacancy.minNqfLevel != null
      ? `NQF ${vacancy.minNqfLevel}+`
      : "Not required";
  // Phase 9.21  surface the season window when the vacancy picked
  // 'seasonal' from work_availability. The fourth dl row only renders
  // for seasonal vacancies; non-seasonal vacancies keep the original
  // 3-column layout untouched.
  const isSeasonal = vacancy.workAvailability.includes("seasonal");
  const seasonLabel = formatSeasonalWindowLabel(vacancy.seasonalWindow);
  return (
    <section
      aria-label="Match requirements"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4"
    >
      <div className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        Match requirements
      </div>
      <dl
        className={
          "grid gap-3 text-sm " +
          (isSeasonal ? "md:grid-cols-4" : "md:grid-cols-3")
        }
      >
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Work mode &amp; type
          </dt>
          <dd className="mt-0.5 text-[color:var(--color-ink)]">
            {workModes || "Any work mode / employment type"}
          </dd>
        </div>
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Years of experience
          </dt>
          <dd className="mt-0.5 text-[color:var(--color-ink)]">{yearsLabel}</dd>
        </div>
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            NQF level
          </dt>
          <dd className="mt-0.5 text-[color:var(--color-ink)]">{nqfLabel}</dd>
        </div>
        {isSeasonal && (
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Season window
            </dt>
            <dd className="mt-0.5 text-[color:var(--color-ink)]">
              {seasonLabel ?? "No window declared"}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/**
 * Phase 9.21  render a vacancy's season window as a short human
 * string. Returns null when the window is unset; the caller decides
 * how to display the absence ("No window declared" on the detail
 * strip, hidden entirely from the seeker notification line). Handles
 * D4's year-wrap (start > end) and the single-month case (start ===
 * end).
 */
function formatSeasonalWindowLabel(
  window: import("@/lib/mock/types").SeasonalWindow | null,
): string | null {
  if (!window) return null;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const startLabel = months[window.startMonth - 1] ?? "?";
  const endLabel = months[window.endMonth - 1] ?? "?";
  const range =
    window.startMonth === window.endMonth
      ? startLabel
      : `${startLabel}${endLabel}`;
  const tail = window.recurringAnnually ? ", annually" : ", one-off";
  return `${range}${tail}`;
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
