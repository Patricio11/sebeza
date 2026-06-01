"use client";

/**
 * Phase 13.4  inline editor for self-declared milestones.
 *
 * Renders under the StudentProgressionTimeline. The student picks a
 * kind, a date, optionally a one-line note; on submit the action
 * inserts a row and the timeline refreshes via revalidatePath.
 *
 * One-shot kinds (dissertation, graduation, first job, paused) are
 * disabled in the picker once already declared  the database
 * partial unique index is the safety net but the UI surfaces the
 * state up-front. The 'other' kind can repeat.
 */

import { useState, useTransition } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import {
  addStudentMilestone,
  removeStudentMilestone,
} from "@/lib/profile/student-milestones";

type ExistingMilestone = {
  id: string;
  kind: string;
  title: string;
  occurredOn: string;
};

type Props = {
  existingMilestones: ExistingMilestone[];
};

type MilestoneKind =
  | "dissertation_submitted"
  | "graduation_confirmed"
  | "first_job_accepted"
  | "studies_paused"
  | "other";

const KIND_OPTIONS: { value: MilestoneKind; label: string }[] = [
  { value: "dissertation_submitted", label: "Dissertation submitted" },
  { value: "graduation_confirmed", label: "Graduation date confirmed" },
  { value: "first_job_accepted", label: "First job offer accepted" },
  { value: "studies_paused", label: "Studies paused" },
  { value: "other", label: "Other" },
];

const ONE_SHOT_KINDS = new Set<MilestoneKind>([
  "dissertation_submitted",
  "graduation_confirmed",
  "first_job_accepted",
  "studies_paused",
]);

export function StudentMilestoneEditor({ existingMilestones }: Props) {
  const [open, setOpen] = useState(false);

  const existingKindByEnum = new Set<MilestoneKind>(
    existingMilestones
      .map((m) => domainKindFor(m.kind))
      .filter((k): k is MilestoneKind => k !== null),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          Self-declared milestones
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
        >
          <Plus className="size-3" aria-hidden /> Add
        </button>
      </div>

      {open && (
        <AddForm
          existingKinds={existingKindByEnum}
          onDone={() => setOpen(false)}
        />
      )}

      {existingMilestones.length > 0 && (
        <ul className="mt-3 grid gap-2 text-xs">
          {existingMilestones.map((m) => (
            <ExistingRow key={m.id} milestone={m} />
          ))}
        </ul>
      )}

      {existingMilestones.length === 0 && !open && (
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          You haven&rsquo;t declared any milestones yet. Tap{" "}
          <em>Add</em> when one of the four moments (dissertation
          submitted, graduation confirmed, first job offer accepted,
          studies paused) happens for you.
        </p>
      )}
    </div>
  );
}

function AddForm({
  existingKinds,
  onDone,
}: {
  existingKinds: Set<MilestoneKind>;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<MilestoneKind>("dissertation_submitted");
  const [occurredOn, setOccurredOn] = useState<string>(todayIso());
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addStudentMilestone({
        kind,
        occurredOn,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        setNote("");
        onDone();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <fieldset
      className="mt-3 grid gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4 text-xs"
      disabled={pending}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Milestone
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MilestoneKind)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          >
            {KIND_OPTIONS.map((opt) => {
              const already =
                ONE_SHOT_KINDS.has(opt.value) && existingKinds.has(opt.value);
              return (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={already}
                >
                  {opt.label}
                  {already ? " · already on timeline" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Date
          </span>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
          One-line note (optional)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. internship offer at Yoco, starting Feb"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
        />
        <span className="text-[color:var(--color-ink-soft)]">
          {note.length} / 200 chars. Visible only on this private surface.
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !occurredOn}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
          Declare milestone
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-xs text-[color:var(--color-warning)]">{error}</p>
      )}
    </fieldset>
  );
}

function ExistingRow({ milestone }: { milestone: ExistingMilestone }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removeStudentMilestone({ rowId: milestone.id });
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <li className="flex items-baseline justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[color:var(--color-ink)]">{milestone.title}</p>
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
          {milestone.occurredOn}
          {error && (
            <span className="ml-2 text-[color:var(--color-warning)]">
              {error}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="Remove milestone"
        className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1 text-[color:var(--color-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <X className="size-3" aria-hidden />
        )}
        Remove
      </button>
    </li>
  );
}

function todayIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function domainKindFor(eventKind: string): MilestoneKind | null {
  switch (eventKind) {
    case "milestone_dissertation_submitted":
      return "dissertation_submitted";
    case "milestone_graduation_confirmed":
      return "graduation_confirmed";
    case "milestone_first_job_accepted":
      return "first_job_accepted";
    case "milestone_studies_paused":
      return "studies_paused";
    case "milestone_other":
      return "other";
    default:
      return null;
  }
}
