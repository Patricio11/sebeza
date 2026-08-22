"use client";

/**
 * Interview scheduling dialog (docs/INTERVIEWS_PLAN.md).
 *
 * One BrandDialog serves both shapes: schedule ONE accepted invitee, or
 * every accepted invitee on the vacancy at once (a group session). The
 * inputs are the house primitives only: DatePicker for the day,
 * CustomSelect for the time slot / duration / format. Never a native
 * select, never `<input type="date">`.
 *
 * Times: the organiser thinks in South African wall-clock, the database
 * stores UTC. South Africa has no daylight saving, so the offset is a
 * constant +02:00 and the composition below is exact year-round.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { BrandDialog } from "@/components/ui/BrandDialog";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { FieldShell, TextField, TextareaField } from "@/components/ui/FormField";
import { formatSaDateTime } from "@/lib/interviews/links";
import { CalendarPlus } from "lucide-react";

export interface InterviewDetailsInput {
  startsAtIso: string;
  durationMinutes: 30 | 45 | 60 | 90;
  locationKind: "in_person" | "video" | "phone";
  location: string;
  instructions?: string;
}

export type ScheduleTarget =
  | { kind: "single"; invitationId: string; name: string }
  | { kind: "bulk"; count: number };

interface Props {
  open: boolean;
  target: ScheduleTarget | null;
  onClose: () => void;
  /** Bound by the panel: routes to the single or bulk server action. */
  onSubmit: (
    details: InterviewDetailsInput,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/** Half-hour slots across a working day, 06:00 through 20:00. */
const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

const DURATIONS = [30, 45, 60, 90] as const;

/** Today's date in SA, as the DatePicker's yyyy-mm-dd floor. */
function todayInSa(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}

export function InterviewScheduleDialog({ open, target, onClose, onSubmit }: Props) {
  const t = useTranslations("employerVacancies.interviews");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("45");
  const [locationKind, setLocationKind] = useState("in_person");
  const [location, setLocation] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  // SA is UTC+2 with no DST, so wall-clock + fixed offset IS the instant.
  const startsAtIso = useMemo(() => {
    if (!date || !time) return null;
    const d = new Date(`${date}T${time}:00+02:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [date, time]);

  const preview = startsAtIso ? formatSaDateTime(new Date(startsAtIso)) : null;
  const inPast = startsAtIso ? new Date(startsAtIso).getTime() <= Date.now() : false;
  const canSend =
    !pending && !!startsAtIso && !inPast && location.trim().length >= 3;

  function reset() {
    setDate("");
    setTime("");
    setDuration("45");
    setLocationKind("in_person");
    setLocation("");
    setInstructions("");
    setError(null);
  }

  function close() {
    if (pending) return;
    reset();
    onClose();
  }

  function submit() {
    if (!startsAtIso || !canSend) return;
    setError(null);
    startTransition(async () => {
      const res = await onSubmit({
        startsAtIso,
        durationMinutes: Number(duration) as InterviewDetailsInput["durationMinutes"],
        locationKind: locationKind as InterviewDetailsInput["locationKind"],
        location: location.trim(),
        instructions: instructions.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      reset();
      onClose();
      router.refresh();
    });
  }

  if (!target) return null;

  return (
    <BrandDialog
      open={open}
      onClose={close}
      pending={pending}
      eyebrow={t("dialogEyebrow")}
      title={
        target.kind === "single"
          ? t("dialogTitleSingle", { name: target.name })
          : t("dialogTitleBulk", { count: target.count })
      }
      maxWidth="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            {preview
              ? inPast
                ? t("errors.past")
                : t("preview", { when: preview })
              : t("previewEmpty")}
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={close} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={submit} disabled={!canSend}>
              <CalendarPlus className="size-4" aria-hidden="true" />
              {pending
                ? t("sending")
                : target.kind === "bulk"
                  ? t("sendBulk", { count: target.count })
                  : t("send")}
            </Button>
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        {target.kind === "bulk" && (
          <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2 text-xs text-[color:var(--color-ink-soft)]">
            {t("bulkLead", { count: target.count })}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <DatePicker
            id="interview-date"
            label={t("date")}
            value={date}
            onChange={setDate}
            minDate={todayInSa()}
            placeholder={t("datePlaceholder")}
            disabled={pending}
          />
          <FieldShell id="interview-time" label={t("time")} hint={t("timeHint")}>
            <CustomSelect
              id="interview-time"
              value={time}
              onChange={setTime}
              options={TIME_SLOTS.map((s) => ({ value: s, label: s }))}
              placeholder={t("timePlaceholder")}
              disabled={pending}
              ariaLabel={t("time")}
            />
          </FieldShell>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell id="interview-duration" label={t("duration")}>
            <CustomSelect
              id="interview-duration"
              value={duration}
              onChange={setDuration}
              options={DURATIONS.map((d) => ({
                value: String(d),
                label: t("durationMinutes", { minutes: d }),
              }))}
              disabled={pending}
              ariaLabel={t("duration")}
            />
          </FieldShell>
          <FieldShell id="interview-kind" label={t("kind")}>
            <CustomSelect
              id="interview-kind"
              value={locationKind}
              onChange={setLocationKind}
              options={[
                { value: "in_person", label: t("kinds.in_person") },
                { value: "video", label: t("kinds.video") },
                { value: "phone", label: t("kinds.phone") },
              ]}
              disabled={pending}
              ariaLabel={t("kind")}
            />
          </FieldShell>
        </div>

        <TextField
          id="interview-location"
          label={t(`locationLabel.${locationKind as "in_person" | "video" | "phone"}`)}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={300}
          placeholder={t(`locationPlaceholder.${locationKind as "in_person" | "video" | "phone"}`)}
          disabled={pending}
        />

        <TextareaField
          id="interview-instructions"
          label={t("instructions")}
          optional
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={500}
          rows={3}
          className="min-h-[80px]"
          placeholder={t("instructionsPlaceholder")}
          hint={t("instructionsHint", { count: instructions.length })}
          disabled={pending}
        />
      </div>
    </BrandDialog>
  );
}
