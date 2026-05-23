/**
 * Phase 7.5 — Read-only display of a profile's work-availability set.
 *
 * Plain inline chips. Honest copy: self-declared preference, not a
 * verified credential. Renders nothing when the array is empty so the
 * absence of a signal stays silent.
 */

import { Clock } from "lucide-react";
import type { WorkAvailabilityKind } from "@/lib/mock/types";

const LABEL: Record<WorkAvailabilityKind, string> = {
  casual: "Casual / shift work",
  part_time: "Part-time",
  contract: "Contract",
  full_time: "Full-time",
};

interface Props {
  values: WorkAvailabilityKind[] | undefined;
  variant?: "default" | "compact";
  /** Optional prefix label, e.g. "Available for:" */
  label?: string;
}

export function WorkAvailabilityChips({
  values,
  variant = "default",
  label,
}: Props) {
  if (!values || values.length === 0) return null;
  const sizeCls =
    variant === "compact"
      ? "text-[0.6rem] px-1.5 py-0.5"
      : "text-[0.7rem] px-2 py-0.5";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && (
        <span className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          <Clock className="size-3" aria-hidden="true" />
          {label}
        </span>
      )}
      {values.map((v) => (
        <span
          key={v}
          className={`rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] uppercase tracking-[0.14em] text-[color:var(--color-ink)] ${sizeCls}`}
        >
          {LABEL[v]}
        </span>
      ))}
    </div>
  );
}

export const WORK_AVAILABILITY_LABEL = LABEL;
