"use client";

/**
 * Phase 7.5  Editable checkbox group for /dashboard/profile.
 *
 * Optimistic toggle: clicking flips local state immediately, then
 * fires the Server Action. Roll back on error. Plain checkboxes (not
 * a custom widget) for max accessibility  keyboard + screen reader
 * support comes free.
 */

import { useState, useTransition } from "react";
import { updateWorkAvailability } from "@/lib/profile/actions";
import type { WorkAvailabilityKind } from "@/lib/mock/types";
import { WORK_AVAILABILITY_KINDS } from "@/lib/mock/types";

const LABEL: Record<WorkAvailabilityKind, string> = {
  casual: "Casual / shift work",
  part_time: "Part-time",
  contract: "Contract",
  full_time: "Full-time",
};

const HINT: Record<WorkAvailabilityKind, string> = {
  casual: "Hourly / per-shift. Waitressing, retail, event work.",
  part_time: "Regular but < 35 hours a week. Compatible with study.",
  contract: "Fixed-term or project work.",
  full_time: "Permanent, full-time roles.",
};

interface Props {
  initialValues: WorkAvailabilityKind[];
}

export function WorkAvailabilityEditor({ initialValues }: Props) {
  const [values, setValues] = useState<WorkAvailabilityKind[]>(initialValues);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(kind: WorkAvailabilityKind) {
    setError(null);
    setSaved(false);
    const previous = values;
    const next = values.includes(kind)
      ? values.filter((v) => v !== kind)
      : [...values, kind];
    setValues(next);

    startTransition(async () => {
      const res = await updateWorkAvailability({ values: next });
      if (!res.ok) {
        setValues(previous);
        setError(res.message);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <legend className="px-1 font-display text-base">
        What work are you open to?
      </legend>
      <p className="mb-4 text-xs text-[color:var(--color-ink-soft)]">
        Independent of your employment status. Pick everything that fits  a
        full-time employee can still be open to contract work, a student can
        signal casual shifts.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {WORK_AVAILABILITY_KINDS.map((kind) => {
          const checked = values.includes(kind);
          return (
            <li key={kind}>
              <label
                className={
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-3 transition-colors " +
                  (checked
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
                    : "border-[color:var(--color-hairline)] hover:border-[color:var(--color-ink)]")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={pending}
                  onChange={() => toggle(kind)}
                  className="mt-0.5 size-4 accent-[color:var(--color-brand)]"
                />
                <span className="min-w-0">
                  <span className="block font-display text-sm">{LABEL[kind]}</span>
                  <span className="block text-xs text-[color:var(--color-ink-soft)]">
                    {HINT[kind]}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 min-h-[1rem] text-xs">
        {pending && (
          <span className="text-[color:var(--color-ink-soft)]">Saving…</span>
        )}
        {!pending && saved && (
          <span className="text-[color:var(--color-employed)]">
            Saved. Visible on your public profile + search filters.
          </span>
        )}
        {error && (
          <span className="text-[color:var(--color-danger)]">{error}</span>
        )}
      </div>
    </fieldset>
  );
}
