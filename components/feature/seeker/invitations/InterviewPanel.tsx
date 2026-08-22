"use client";

/**
 * The seeker's interview card on the invitation detail page
 * (docs/INTERVIEWS_PLAN.md).
 *
 * Everything the person needs to show up, in one place: when (SA
 * time), how long, where, and the employer's instructions, plus
 * one-tap add-to-calendar (Google template URL, .ics for everything
 * else) and the two honest answers: Confirm, or Can't make it with an
 * optional note. A cancelled or past interview renders as a calm
 * record, not a call to action.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { respondToInterview } from "@/lib/seeker/interviews";
import { formatSaDateTime, googleCalendarUrl } from "@/lib/interviews/links";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Download,
  MapPin,
  Phone,
  Video,
  XCircle,
} from "lucide-react";

export interface InterviewPanelData {
  id: string;
  startsAtIso: string;
  durationMinutes: number;
  locationKind: "in_person" | "video" | "phone";
  location: string;
  instructions: string | null;
  state: "scheduled" | "confirmed" | "declined" | "cancelled" | "attended" | "no_show";
  orgName: string;
  vacancyTitle: string;
}

const KIND_ICON = {
  in_person: MapPin,
  video: Video,
  phone: Phone,
} as const;

export function InterviewPanel({ interview }: { interview: InterviewPanelData }) {
  const t = useTranslations("seekerDash.interview");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decliningOpen, setDecliningOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startsAt = new Date(interview.startsAtIso);
  const isPast = startsAt.getTime() <= Date.now();
  const isActive =
    (interview.state === "scheduled" || interview.state === "confirmed") && !isPast;
  const KindIcon = KIND_ICON[interview.locationKind];

  function respond(response: "confirmed" | "declined") {
    setError(null);
    startTransition(async () => {
      const res = await respondToInterview({
        interviewId: interview.id,
        response,
        note: response === "declined" && note.trim() ? note.trim() : undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDecliningOpen(false);
      setNote("");
      router.refresh();
    });
  }

  // A dead interview row: state the fact quietly and stop.
  if (!isActive) {
    if (interview.state === "cancelled" || interview.state === "declined") {
      return (
        <section className="mb-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4 text-sm text-[color:var(--color-ink-soft)]">
          <p className="inline-flex items-center gap-2">
            <XCircle className="size-4" aria-hidden="true" />
            {t(
              interview.state === "cancelled" ? "wasCancelled" : "youDeclined",
              { when: formatSaDateTime(startsAt) },
            )}
          </p>
        </section>
      );
    }
    // Past but not yet resolved, or already attended: a plain record.
    return (
      <section className="mb-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4 text-sm text-[color:var(--color-ink-soft)]">
        <p className="inline-flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden="true" />
          {t("tookPlace", { when: formatSaDateTime(startsAt) })}
        </p>
      </section>
    );
  }

  const gcal = googleCalendarUrl({
    startsAt,
    durationMinutes: interview.durationMinutes,
    title: `${t("calendarTitle", { vacancy: interview.vacancyTitle, org: interview.orgName })}`,
    location: interview.location,
    description: interview.instructions ?? "",
    uid: `${interview.id}@sebenzasa.com`,
  });

  return (
    <section
      aria-labelledby="interview-h"
      className="mb-6 rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5 md:p-6"
    >
      <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
        {t("eyebrow")}
      </p>
      <h2
        id="interview-h"
        className="mt-1 font-display text-2xl text-[color:var(--color-ink)]"
      >
        {formatSaDateTime(startsAt)}
      </h2>
      <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
        {t("timeLine", { minutes: interview.durationMinutes })}
      </p>

      <dl className="mt-4 space-y-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 text-sm">
        <div className="flex items-start gap-2">
          <KindIcon
            className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {t(`kinds.${interview.locationKind}`)}
            </dt>
            <dd className="mt-0.5 break-words text-[color:var(--color-ink)]">
              {interview.location}
            </dd>
          </div>
        </div>
        {interview.instructions && (
          <div className="border-t border-[color:var(--color-hairline)] pt-3">
            <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {t("instructions")}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[color:var(--color-ink)]">
              {interview.instructions}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={gcal}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-3.5 text-xs font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface)]"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          {t("googleCalendar")}
        </a>
        <a
          href={`/api/interviews/${interview.id}/ics`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3.5 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
        >
          <Download className="size-4" aria-hidden="true" />
          {t("icsFile")}
        </a>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      )}

      <div className="mt-4 border-t border-[color:var(--color-hairline)] pt-4">
        {interview.state === "confirmed" && !decliningOpen ? (
          <p className="inline-flex items-center gap-2 text-sm text-[color:var(--color-brand-strong)]">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t("youConfirmed")}
          </p>
        ) : null}

        {!decliningOpen ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {interview.state === "scheduled" && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => respond("confirmed")}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {pending ? t("working") : t("confirm")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setDecliningOpen(true)}
            >
              {t("cantMake")}
            </Button>
          </div>
        ) : (
          <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
            <p className="text-xs text-[color:var(--color-ink)]">{t("declineLead")}</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              disabled={pending}
              placeholder={t("declinePlaceholder")}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-2 text-sm"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[0.65rem] text-[color:var(--color-ink-soft)]">
                {note.length} / 200
              </span>
              <span className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => setDecliningOpen(false)}
                >
                  {t("declineBack")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={pending}
                  onClick={() => respond("declined")}
                >
                  {pending ? t("working") : t("declineSend")}
                </Button>
              </span>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          {t("footNote")}
        </p>
      </div>
    </section>
  );
}
