/**
 * Phase 13.4  Student progression timeline.
 *
 * Composes auto-derived events (qualifications, employer-confirmed
 * placements, completed learning items) with self-declared
 * milestones into a single chronological strip on the seeker's
 * /dashboard/grow surface.
 *
 * Civic-Editorial typography:
 *   - Ordinal year header ("Year 2 of 4") in Fraunces tabular.
 *   - Quiet eyebrow next-step hint, never pressure.
 *   - Provenance chips inline with the row (auto vs self-declared)
 *     so the student sees how the platform knows what it knows (D6).
 *   - Vertical timeline on every viewport  no horizontal flip on
 *     md+ because the natural reading direction stays vertical
 *     once row counts climb past ~5.
 *
 * Private surface only. This component reads from the timeline query
 * which excludes seeker_reported placements (Verification-Honesty),
 * and the underlying student_milestones table never surfaces on the
 * public /p/<handle> renderer.
 */

import {
  GraduationCap,
  Briefcase,
  CheckCircle2,
  Sparkles,
  PencilLine,
} from "lucide-react";
import type {
  ProgressionEvent,
  ProgressionEventKind,
  StudentProgressionTimeline as TimelineData,
} from "@/db/queries/student-progression";
import { StudentMilestoneEditor } from "./StudentMilestoneEditor";

interface Props {
  timeline: TimelineData;
  locale: string;
  /** When true, render the add-milestone editor inline. Set on the
   *  seeker's own /dashboard/grow surface; gated off for any
   *  hypothetical admin-side preview render. */
  allowEdit: boolean;
}

export function StudentProgressionTimeline({
  timeline,
  locale,
  allowEdit,
}: Props) {
  const { header, events } = timeline;

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const fmtMonthYear = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  });

  return (
    <section
      aria-labelledby="progression-h"
      className="mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
    >
      <header className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-3">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Your journey
        </p>
        <h3
          id="progression-h"
          className="font-display text-2xl tabular-nums"
        >
          {yearTitle(header.currentYear, header.expectedGraduation)}
        </h3>
        {header.monthsToGraduation !== null && (
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            {graduationLabel(
              header.monthsToGraduation,
              header.expectedGraduation,
              fmtMonthYear,
            )}
          </p>
        )}
        {header.nextStepHint && (
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            <span className="inline-block border-l-2 border-[color:var(--color-brand-strong)] pl-3 italic">
              {header.nextStepHint}
            </span>
          </p>
        )}
      </header>

      {events.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-6 text-center text-xs text-[color:var(--color-ink-soft)]">
          No events on your timeline yet. Add a qualification, complete
          a learning path, or declare a milestone below  the platform
          will surface it here.
        </p>
      ) : (
        <ol className="relative grid gap-0 border-l border-[color:var(--color-hairline)] pl-5">
          {events.map((ev) => (
            <li key={ev.id} className="relative py-3">
              <span
                aria-hidden="true"
                className="absolute -left-[1.625rem] top-4 inline-flex size-3 items-center justify-center rounded-full border border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
              />
              <EventRow event={ev} fmt={fmt} />
            </li>
          ))}
        </ol>
      )}

      {allowEdit && (
        <div className="mt-6 border-t border-dashed border-[color:var(--color-hairline)] pt-5">
          <StudentMilestoneEditor
            existingMilestones={events
              .filter((ev) => ev.provenance === "self_declared")
              .map((ev) => ({
                id: ev.id,
                kind: ev.kind,
                title: ev.title,
                occurredOn: ev.occurredOn,
              }))}
          />
        </div>
      )}
    </section>
  );
}

function EventRow({
  event,
  fmt,
}: {
  event: ProgressionEvent;
  fmt: Intl.DateTimeFormat;
}) {
  const Icon = iconFor(event.kind);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 text-sm">
      <Icon
        className="size-4 self-start text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-base text-[color:var(--color-ink)]">
            {event.title}
          </span>
          {event.statusChip && (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {event.statusChip}
            </span>
          )}
          <ProvenanceChip provenance={event.provenance} />
        </div>
        {event.subtitle && (
          <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
            {event.subtitle}
          </p>
        )}
        {event.note && (
          <p className="mt-1 max-w-prose text-xs italic text-[color:var(--color-ink-soft)]">
            &ldquo;{event.note}&rdquo;
          </p>
        )}
      </div>
      <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] tabular-nums">
        {fmt.format(new Date(event.occurredOn))}
      </span>
    </div>
  );
}

function ProvenanceChip({
  provenance,
}: {
  provenance: "auto" | "self_declared";
}) {
  if (provenance === "auto") return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
      title="You declared this milestone yourself. Visible only to you."
    >
      <PencilLine className="size-3" aria-hidden="true" />
      Self-declared
    </span>
  );
}

function iconFor(kind: ProgressionEventKind) {
  switch (kind) {
    case "qualification":
      return GraduationCap;
    case "placement_confirmed":
      return Briefcase;
    case "learning_completed":
      return CheckCircle2;
    default:
      return Sparkles;
  }
}

function yearTitle(
  currentYear: number | null,
  expectedGraduation: string | null,
): string {
  if (!currentYear) {
    return expectedGraduation
      ? `Postgraduate · graduating ${expectedGraduation}`
      : "Studying";
  }
  // Implicit total = currentYear if no expected graduation; otherwise
  // derive from the years gap (best-effort  some programmes have
  // mid-year intake which the gap doesn't capture).
  const total = totalYearsHint(currentYear, expectedGraduation);
  return total
    ? `Year ${currentYear} of ${total}`
    : `Year ${currentYear}`;
}

function totalYearsHint(
  currentYear: number,
  expectedGraduation: string | null,
): number | null {
  if (!expectedGraduation) return null;
  const m = expectedGraduation.match(/^(\d{4})/);
  if (!m) return null;
  const gradYear = Number(m[1]);
  const nowYear = new Date().getUTCFullYear();
  const remaining = Math.max(0, gradYear - nowYear);
  return currentYear + remaining;
}

function graduationLabel(
  months: number,
  expectedGraduation: string | null,
  fmt: Intl.DateTimeFormat,
): string {
  if (!expectedGraduation) return "";
  const date = new Date(`${expectedGraduation}-01`);
  const when = fmt.format(date);
  if (months > 1) return `~${months} months to graduation (${when})`;
  if (months === 1) return `One month to graduation (${when})`;
  if (months === 0) return `Graduating this month (${when})`;
  if (months >= -6) return `Recently graduated (${when})`;
  return `Expected graduation ${when}`;
}
