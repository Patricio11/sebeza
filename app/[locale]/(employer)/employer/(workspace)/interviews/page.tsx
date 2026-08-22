/**
 * /employer/interviews - the interview agenda (docs/INTERVIEWS_PLAN.md).
 *
 * One page answers three questions in order of urgency:
 *
 *   1. **Did they come?** - past scheduled/confirmed rows wait for an
 *      attendance answer; an attended row becomes the doorway to the
 *      existing "Log this hire" flow (Placement-Truth: no parallel
 *      placement logic here).
 *   2. **What's coming up?** - future rows grouped by SA day, with
 *      add-to-calendar links (Google template URL + .ics download) and
 *      cancel for Owner/Recruiter.
 *   3. **What happened lately?** - the recent tail (attended, no-show,
 *      declined, cancelled) so the log is honest, not curated.
 *
 * No client island: filters are links, attendance/cancel are plain
 * server-action forms. State lives in the URL (`?vacancy=`).
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { verifyOrgVerified } from "@/lib/auth/dal";
import { getMyOrgRole } from "@/lib/employer/vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import {
  listInterviewsForOrg,
  type InterviewRow,
} from "@/lib/interviews/query";
import {
  cancelInterview,
  markInterviewAttendance,
} from "@/lib/employer/interviews";
import { formatSaDateTime, googleCalendarUrl } from "@/lib/interviews/links";
import {
  Briefcase,
  CalendarClock,
  CalendarPlus,
  Check,
  Download,
  MapPin,
  Phone,
  UserCheck,
  UserX,
  Video,
  X,
} from "lucide-react";

export const revalidate = 0;

const KIND_ICON = {
  in_person: MapPin,
  video: Video,
  phone: Phone,
} as const;

/** yyyy-mm-dd in SA time: the day-grouping key. */
function saDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
  }).format(d);
}

function saDayHeading(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(d);
}

function saTime(d: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  }).format(d);
}

export default async function EmployerInterviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vacancy?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyOrgVerified();
  const role = await getMyOrgRole();
  const canEdit = canEditVacancies(role);
  const t = await getTranslations("employerInterviews");

  const { vacancy: vacancyFilter } = await searchParams;
  const all = session.orgId ? await listInterviewsForOrg(session.orgId) : [];

  // The filter pills, built from what actually exists.
  const vacancies = new Map<string, string>();
  for (const r of all) vacancies.set(r.vacancyId, r.vacancyTitle);
  const rows = vacancyFilter
    ? all.filter((r) => r.vacancyId === vacancyFilter)
    : all;

  const now = Date.now();
  const active = rows.filter(
    (r) => r.state === "scheduled" || r.state === "confirmed",
  );
  // Urgency first: an unanswered past interview blocks the pipeline.
  const needsAttendance = active.filter((r) => r.startsAt.getTime() <= now);
  const upcoming = active.filter((r) => r.startsAt.getTime() > now);
  const history = rows
    .filter(
      (r) =>
        r.state === "attended" ||
        r.state === "no_show" ||
        r.state === "declined" ||
        r.state === "cancelled",
    )
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 20);

  // Group the upcoming rows by SA day.
  const byDay = new Map<string, InterviewRow[]>();
  for (const r of upcoming) {
    const key = saDayKey(r.startsAt);
    const arr = byDay.get(key) ?? [];
    arr.push(r);
    byDay.set(key, arr);
  }

  return (
    <DashboardMasthead
      role="employer"
      pageEyebrow={t("eyebrow")}
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Vacancy filter pills - links, so back/refresh/deep-link all
          work with zero client JS. */}
      {vacancies.size > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <FilterPill
            href="/employer/interviews"
            active={!vacancyFilter}
            label={t("filterAll")}
          />
          {[...vacancies.entries()].map(([id, title]) => (
            <FilterPill
              key={id}
              href={`/employer/interviews?vacancy=${id}`}
              active={vacancyFilter === id}
              label={title}
            />
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <EmptyState
          icon={<CalendarClock className="size-5" aria-hidden="true" />}
          title={t("empty.heading")}
          body={t("empty.body")}
          action={
            <Link
              href="/employer/vacancies"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
            >
              {t("empty.cta")}
            </Link>
          }
        />
      )}

      {/* 1 - Attendance owed. */}
      {needsAttendance.length > 0 && (
        <section
          aria-labelledby="attendance-h"
          className="mb-8 rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 p-5"
        >
          <h2
            id="attendance-h"
            className="font-display text-lg text-[color:var(--color-ink)]"
          >
            {t("attendance.heading", { count: needsAttendance.length })}
          </h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            {t("attendance.sub")}
          </p>
          <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
            {needsAttendance.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"
              >
                <RowSummary row={r} locale={locale} pastTense />
                {canEdit ? (
                  <div className="flex shrink-0 gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await markInterviewAttendance({
                          interviewId: r.id,
                          attended: true,
                        });
                      }}
                    >
                      <Button type="submit" variant="primary" size="sm">
                        <UserCheck className="size-4" aria-hidden="true" />
                        {t("attendance.attended")}
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await markInterviewAttendance({
                          interviewId: r.id,
                          attended: false,
                        });
                      }}
                    >
                      <Button type="submit" variant="secondary" size="sm">
                        <UserX className="size-4" aria-hidden="true" />
                        {t("attendance.noShow")}
                      </Button>
                    </form>
                  </div>
                ) : (
                  <span className="text-xs text-[color:var(--color-ink-soft)]">
                    {t("attendance.viewerNote")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2 - The agenda. */}
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-h" className="mb-8">
          <h2
            id="upcoming-h"
            className="mb-3 font-display text-lg text-[color:var(--color-ink)]"
          >
            {t("upcoming.heading", { count: upcoming.length })}
          </h2>
          <div className="space-y-5">
            {[...byDay.entries()].map(([key, dayRows]) => (
              <div
                key={key}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]"
              >
                <p className="border-b border-[color:var(--color-hairline)] px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  {saDayHeading(dayRows[0]!.startsAt, locale)}
                </p>
                <ul className="divide-y divide-[color:var(--color-hairline)]">
                  {dayRows.map((r) => {
                    const gcal = googleCalendarUrl({
                      startsAt: r.startsAt,
                      durationMinutes: r.durationMinutes,
                      title: `${t("calendarTitle", { name: r.displayName })} · ${r.vacancyTitle}`,
                      location: r.location,
                      description: r.instructions ?? "",
                      uid: `${r.id}@sebenzasa.com`,
                    });
                    return (
                      <li
                        key={r.id}
                        className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          {/* The agenda's spine: a big tabular time. */}
                          <div className="w-16 shrink-0 border-r-2 border-[color:var(--color-brand)] pr-3 text-right">
                            <span className="font-display text-xl leading-none text-[color:var(--color-ink)] tabular-nums">
                              {saTime(r.startsAt)}
                            </span>
                            <span className="mt-1 block text-[0.65rem] leading-tight text-[color:var(--color-ink-soft)]">
                              {t("durationLine", { minutes: r.durationMinutes })}
                            </span>
                          </div>
                          <RowSummary row={r} locale={locale} showWhen={false} />
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 md:pl-4">
                          <a
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                          >
                            <CalendarPlus className="size-3.5" aria-hidden="true" />
                            {t("googleCalendar")}
                          </a>
                          <a
                            href={`/api/interviews/${r.id}/ics`}
                            className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                          >
                            <Download className="size-3.5" aria-hidden="true" />
                            {t("icsFile")}
                          </a>
                          {canEdit && (
                            <form
                              action={async () => {
                                "use server";
                                await cancelInterview({ interviewId: r.id });
                              }}
                            >
                              <Button type="submit" variant="secondary" size="sm">
                                <X className="size-4" aria-hidden="true" />
                                {t("cancel")}
                              </Button>
                            </form>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3 - The recent tail. */}
      {history.length > 0 && (
        <section aria-labelledby="history-h" className="mb-8">
          <h2
            id="history-h"
            className="mb-3 font-display text-lg text-[color:var(--color-ink)]"
          >
            {t("history.heading")}
          </h2>
          <ul className="divide-y divide-[color:var(--color-hairline)] rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/employer/dossier/${r.handle}` as never}
                      className="font-display text-base text-[color:var(--color-ink)] hover:underline"
                    >
                      {r.displayName}
                    </Link>
                    <HistoryChip state={r.state} t={t} />
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                    {r.vacancyTitle} · {formatSaDateTime(r.startsAt, locale)}
                    {r.seekerNote && (
                      <>
                        {" "}
                        · <em>&ldquo;{r.seekerNote}&rdquo;</em>
                      </>
                    )}
                  </p>
                </div>
                {/* Attendance closes the loop into Placement-Truth:
                    the attended row's next step is the EXISTING
                    mark-as-hired flow, never a parallel one. */}
                {canEdit && r.state === "attended" && (
                  <Link
                    href={
                      `/employer/dossier/${r.handle}?vacancyId=${r.vacancyId}#mark-as-hired` as never
                    }
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 text-xs font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
                  >
                    <Briefcase className="size-3.5" aria-hidden="true" />
                    {t("history.logHire")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        {t("footer")}
      </p>
    </DashboardMasthead>
  );
}

function FilterPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href as never}
      className={
        "inline-flex h-8 items-center rounded-[var(--radius-pill)] border px-3 text-xs " +
        (active
          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] font-medium text-[color:var(--color-paper)]"
          : "border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]")
      }
    >
      {label}
    </Link>
  );
}

async function RowSummary({
  row,
  locale,
  pastTense = false,
  showWhen = true,
}: {
  row: InterviewRow;
  locale: string;
  pastTense?: boolean;
  /** False when the row already renders the agenda time column. */
  showWhen?: boolean;
}) {
  const t = await getTranslations("employerInterviews");
  const KindIcon = KIND_ICON[row.locationKind];
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/employer/dossier/${row.handle}` as never}
          className="font-display text-base text-[color:var(--color-ink)] hover:underline"
        >
          {row.displayName}
        </Link>
        {row.state === "confirmed" ? (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
            <Check className="size-3" aria-hidden="true" />
            {t("state.confirmed")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {t("state.awaitingReply")}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
        {row.vacancyTitle}
        {showWhen && (
          <>
            {" · "}
            {pastTense
              ? formatSaDateTime(row.startsAt, locale)
              : `${saTime(row.startsAt)} · ${t("durationLine", { minutes: row.durationMinutes })}`}
          </>
        )}
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-xs text-[color:var(--color-ink)]">
        <KindIcon
          className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
        <span className="min-w-0 break-words">{row.location}</span>
      </p>
      {row.instructions && (
        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
          {row.instructions}
        </p>
      )}
    </div>
  );
}

function HistoryChip({
  state,
  t,
}: {
  state: InterviewRow["state"];
  t: Awaited<ReturnType<typeof getTranslations<"employerInterviews">>>;
}) {
  const tone =
    state === "attended"
      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
      : state === "no_show"
        ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
        : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] ${tone}`}
    >
      {t(`state.${state as "attended" | "no_show" | "declined" | "cancelled"}`)}
    </span>
  );
}
