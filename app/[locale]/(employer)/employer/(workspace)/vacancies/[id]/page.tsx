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
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
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
  makeOfferOnInvitation,
  withdrawInvitation,
} from "@/lib/employer/invitations";
import { getPlacementsForVacancy } from "@/lib/employer/placements";
import { fillState, fillLabelParts } from "@/lib/employer/vacancy-fill";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getProfessions, getSkills } from "@/lib/taxonomy/query";
import { PROVINCES } from "@/lib/mock/taxonomy";
import { formatVacancyLocation } from "@/lib/employer/vacancies-display";
import { SelfApplyLinkPanel } from "@/components/feature/employer/vacancies/SelfApplyLinkPanel";
import { getSetting } from "@/lib/admin/settings";
import { SITE_URL } from "@/lib/seo";
import { ChevronLeft, Lock, MapPin, Users } from "lucide-react";
import type { WorkAvailabilityKind } from "@/lib/mock/types";
import { HelpLink } from "@/components/feature/help/HelpLink";

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
  await verifyEmployer();

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

  // G1  the number the whole page was missing: how many people this
  // vacancy still needs. Acceptances count while nothing is hired yet;
  // placements take over the moment any exist. See lib/employer/vacancy-fill.ts.
  const t = await getTranslations("employerVacancies");
  const fillLine = (f: import("@/lib/employer/vacancy-fill").FillState) => {
    const parts = fillLabelParts(f);
    return parts ? t(`fill.${parts.id}`, parts.params) : null;
  };
  const fill = fillState({
    positions: vacancy.positions,
    acceptedCount: invitations.filter(
      (i) => i.state === "accepted" || i.state === "accepted_with_notice",
    ).length,
    placementCount: placements.length,
  });

  // Phase 23.4  live catalogues; the DB is the authority for both.
  const [professions, skills] = await Promise.all([
    getProfessions(),
    getSkills(),
  ]);

  // Phase 34  Self Apply (ship-dark master flag).
  const selfApplyFeatureOn = await getSetting<boolean>(
    "feature_flag_vacancy_self_apply",
  );

  const professionLabel =
    professions.find((p) => p.slug === vacancy.professionSlug)?.label ??
    vacancy.professionSlug;
  // Phase 13.9  single source of truth. Handles "Any province
  // Remote / Hybrid" for null-province vacancies.
  const provinceLabel = formatVacancyLocation({
    provinceSlug: vacancy.provinceSlug,
    citySlug: vacancy.citySlug,
    workAvailability: vacancy.workAvailability,
  });

  const NEXT_STATES: Record<VacancyStatus, VacancyStatus[]> = {
    draft: ["open", "closed"],
    open: ["closed", "filled"],
    closed: ["open"],
    filled: ["closed"],
  };
  const TRANSITION_LABEL: Record<VacancyStatus, string> = {
    draft: t("detail.transition.draft"),
    open: t("detail.transition.open"),
    closed: t("detail.transition.closed"),
    filled: t("detail.transition.filled"),
  };

  return (
    <DashboardMasthead
      role="employer"
      pageEyebrow={t("detail.eyebrow")}
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
          {t("detail.backToList")}
        </Link>
        {/* Phase 10.1  help deep-links (D6). */}
        <HelpLink slug="vacancy-lifecycle" label={t("detail.helpLifecycle")} />
        <HelpLink slug="accept-rate-strip" label={t("detail.helpAcceptRate")} />
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
          as "No requirement", consistent with D0 (vacancy is source of
          truth; blank = matcher ignores axis). */}
      <MatchRequirementsStrip vacancy={vacancy} />

      {/* Phase 34  Self Apply public link. Every org member sees it
          (Viewers share links too); the toggle itself lives in the
          edit form below. */}
      {selfApplyFeatureOn &&
        vacancy.selfApplyEnabled &&
        vacancy.selfApplyToken && (
          <SelfApplyLinkPanel
            applyUrl={`${SITE_URL}/apply/${vacancy.selfApplyToken}`}
            vacancyTitle={vacancy.title}
            vacancyOpen={vacancy.status === "open"}
          />
        )}

      {/* Phase 9.19 D9  per-vacancy accept-rate analytics. Vacancy-
          private, never cross-vacancy comparison, never per-seeker
          breakdown. Hidden when there's nothing to show.
          Phase 34: self-applied rows are EXCLUDED  they're born
          accepted, so counting them would fake the acceptance rate. */}
      {invitations.some((i) => i.origin === "employer_invite") && (
        <AcceptRateStrip
          invitations={invitations.filter(
            (i) => i.origin === "employer_invite",
          )}
          followUpNudgesEnabled={vacancy.followUpNudgesEnabled}
          fill={fill}
          fillLine={fillLine(fill)}
          t={t}
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
              {t("detail.findHeading")}
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              {t("detail.findSub")}
            </p>
          </div>
        </div>
        <Link
          href={`/employer/vacancies/${vacancy.id}/match` as never}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
        >
          {t("detail.findCta")}
        </Link>
      </div>

      {!canEdit && <ViewerNotice />}

      {/* Phase 9.8.4  Pipeline of invitations sent on this vacancy.
          Visible to all roles (Viewers can see who's in the pipeline);
          withdraw action is Owner/Recruiter-only and only available
          while an invite is still in the `invited` state. */}
      {invitations.length === 0 && (
        <section className="mb-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-ink-soft)]">
          <p className="font-display text-base text-[color:var(--color-ink)]">
            {t("empty.heading")}
          </p>
          <p className="mt-1">
            {(() => {
              const line = fillLine(fill);
              return line
                ? t("empty.withTarget", { fillLine: line })
                : t("empty.noTarget");
            })()}
          </p>
        </section>
      )}
      {invitations.length > 0 && (
        <VacancyInvitationsPanel
          vacancyId={vacancy.id}
          invitations={invitations}
          canEdit={canEdit}
          locale={locale}
          withdrawAction={async (invitationId: string) => {
            "use server";
            const res = await withdrawInvitation({ invitationId });
            return res.ok ? { ok: true } : { ok: false, message: res.message };
          }}
          offerAction={async (invitationId: string, note: string) => {
            "use server";
            const res = await makeOfferOnInvitation({ invitationId, note });
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
            {t("detail.lifecycle")}
          </span>
          {NEXT_STATES[vacancy.status].map((next) =>
            next === "filled" ? (
              <MarkAsFilledModal
                key={next}
                vacancyId={vacancy.id}
                vacancyTitle={vacancy.title}
                positions={vacancy.positions}
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
            {t("detail.salaryPrivate")}
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
            {t("detail.editHeading")}
          </h2>
          <VacancyForm
            initial={vacancy}
            professions={professions}
            provinces={PROVINCES}
            skills={skills}
            draftId={vacancy.id}
            selfApplyFeatureOn={selfApplyFeatureOn}
            onSubmit={async (value) => {
              "use server";
              const res = await updateVacancy(vacancy.id, value);
              return res.ok
                ? { ok: true }
                : { ok: false, message: res.message };
            }}
            redirectTo={`/employer/vacancies/${vacancy.id}`}
            submitLabel={t("form.saveChanges")}
            cancelHref={`/employer/vacancies/${vacancy.id}`}
          />
        </div>
      ) : (
        <ReadOnlyDetail vacancy={vacancy} skillLabels={skills} />
      )}

      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        {t("detail.footer")}
      </p>
    </DashboardMasthead>
  );
}

function ViewerNotice() {
  const t = useTranslations("employerVacancies.detail");
  return (
    <p className="mb-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
      {t("viewerNote")}
    </p>
  );
}

function AcceptRateStrip({
  invitations,
  followUpNudgesEnabled,
  fill,
  fillLine,
  t,
}: {
  invitations: import("@/lib/employer/invitations").InvitationRow[];
  followUpNudgesEnabled: boolean;
  fill: import("@/lib/employer/vacancy-fill").FillState;
  fillLine: string | null;
  t: Awaited<ReturnType<typeof getTranslations<"employerVacancies">>>;
}) {
  // Bucket every invitation into a lifecycle column. `accepted_with_notice`
  // folds into accepted (it IS an acceptance) and `reconsidering` into
  // declined (a transient sub-state of declined). Sum across buckets
  // equals total, so the figures don't lie even when transient states
  // exist.
  //
  // G4  withdrawn no longer hides inside expired. "They ignored me"
  // and "I pulled it back" are opposite facts about your own pipeline,
  // and one of them is not even about the candidate. The column only
  // appears when it has something in it, so the common case stays a
  // clean five.
  let accepted = 0;
  let declined = 0;
  let pending = 0;
  let expired = 0;
  let withdrawn = 0;
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
      // An outstanding counter-offer is awaiting the seeker's answer.
      case "offer_made":
        pending++;
        break;
      case "expired":
        expired++;
        break;
      case "withdrawn":
        withdrawn++;
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
          {t("strip.heading")}
          {fillLine && (
            <span className="ml-2 normal-case tracking-normal text-[color:var(--color-ink)]">
              {fillLine}
            </span>
          )}
        </span>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          {acceptRate !== null
            ? t("strip.acceptRate", { rate: acceptRate })
            : t("strip.noResponses")}
        </span>
      </div>
      <dl
        className={`grid grid-cols-2 gap-3 text-sm ${withdrawn > 0 ? "md:grid-cols-6" : "md:grid-cols-5"}`}
      >
        <StatCell label={t("strip.sent")} value={total} />
        <StatCell label={t("strip.accepted")} value={accepted} accent="brand" />
        <StatCell label={t("strip.declined")} value={declined} />
        <StatCell label={t("strip.pending")} value={pending} />
        <StatCell label={t("strip.noReply")} value={expired} />
        {withdrawn > 0 && <StatCell label={t("strip.withdrawn")} value={withdrawn} />}
      </dl>
      {fill.isShort && pending === 0 && (
        <p className="mt-2 text-xs text-[color:var(--color-ink)]">
          {t("strip.stalled", { remaining: fill.remaining ?? 0 })}{" "}
          <span className="text-[color:var(--color-ink-soft)]">
            {t("strip.stalledCta")}
          </span>
        </p>
      )}
      {followUpNudgesEnabled && pending > 0 && (
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          {t("strip.nudgeNote")}
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
  const t = useTranslations("employerVacancies");
  const workModes = vacancy.workAvailability
    .map((k) => t(`form.workAvailability.${k}`))
    .join(" · ");
  const yearsLabel =
    vacancy.minYearsExperience != null
      ? t("detail.yearsValue", { years: vacancy.minYearsExperience })
      : t("detail.yearsNone");
  const nqfLabel =
    vacancy.minNqfLevel != null
      ? t("detail.nqfValue", { level: vacancy.minNqfLevel })
      : t("detail.nqfNone");
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
        {t("detail.matchReqHeading")}
      </div>
      <dl
        className={
          "grid gap-3 text-sm " +
          (isSeasonal ? "md:grid-cols-4" : "md:grid-cols-3")
        }
      >
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {t("detail.workModeType")}
          </dt>
          <dd className="mt-0.5 text-[color:var(--color-ink)]">
            {workModes || t("detail.anyWorkMode")}
          </dd>
        </div>
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {t("detail.yearsExp")}
          </dt>
          <dd className="mt-0.5 text-[color:var(--color-ink)]">{yearsLabel}</dd>
        </div>
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {t("detail.nqfLevel")}
          </dt>
          <dd className="mt-0.5 text-[color:var(--color-ink)]">{nqfLabel}</dd>
        </div>
        {isSeasonal && (
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {t("detail.seasonWindow")}
            </dt>
            <dd className="mt-0.5 text-[color:var(--color-ink)]">
              {seasonLabel ?? t("detail.noWindow")}
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
  const startMonth = months[window.startMonth - 1] ?? "?";
  const endMonth = months[window.endMonth - 1] ?? "?";
  // Phase 9.21 follow-up  surface the year alongside the month when
  // the employer anchored the window. Year-less rows keep their
  // original month-only display.
  const start = window.startYear ? `${startMonth} ${window.startYear}` : startMonth;
  const end = window.endYear ? `${endMonth} ${window.endYear}` : endMonth;
  const sameMonthAndYear =
    window.startMonth === window.endMonth &&
    (window.startYear ?? null) === (window.endYear ?? null);
  const range = sameMonthAndYear ? start : `${start}${end}`;
  const tail = window.recurringAnnually ? ", annually" : ", one-off";
  return `${range}${tail}`;
}

function ReadOnlyDetail({
  vacancy,
  skillLabels,
}: {
  vacancy: import("@/lib/employer/vacancies").VacancyRow;
  skillLabels: Array<{ slug: string; label: string }>;
}) {
  const t = useTranslations("employerVacancies.detail");
  const skills = vacancy.skillSlugs
    .map((s) => skillLabels.find((sk) => sk.slug === s)?.label ?? s);
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-8">
      <h2 className="mb-4 border-b border-[color:var(--color-hairline)] pb-3 font-display text-xl">
        {t("readonlyHeading")}
      </h2>
      <dl className="space-y-4 text-sm">
        {vacancy.description && (
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              {t("description")}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-[color:var(--color-ink)]">
              {vacancy.description}
            </dd>
          </div>
        )}
        {skills.length > 0 && (
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              {t("requiredSkills")}
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
            {t("inviteExpiry")}
          </dt>
          <dd className="mt-1 text-[color:var(--color-ink)]">
            {vacancy.inviteExpiryDays
              ? t("expiryDays", { days: vacancy.inviteExpiryDays })
              : t("expiryNever")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
