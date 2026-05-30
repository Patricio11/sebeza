/**
 * Phase 11.2.9  student-lane discoverability callout.
 *
 * Surfaces a quiet "Are you a student? Add your programme  " link
 * for seekers without `me.academic` set. The student lane on
 * /dashboard/grow is the most sophisticated feature in the seeker
 * product (curriculum-vs-market, electives, internships, grad
 * programmes, destinations); many students sign up without filling in
 * the academic record and never discover it.
 *
 * Renders nothing once `me.academic` exists  silently disappears.
 * Re-shows if the seeker later clears the academic block (rare, but
 * the toggle is honest).
 */

import { Link } from "@/i18n/navigation";
import { GraduationCap, ArrowUpRight } from "lucide-react";

interface Props {
  hasAcademic: boolean;
  /** Optional terse variant for in-page placements (e.g. on
   *  /dashboard/grow itself, where the surrounding sections already
   *  carry context). */
  variant?: "full" | "compact";
}

export function StudentLaneDiscoveryCallout({
  hasAcademic,
  variant = "full",
}: Props) {
  if (hasAcademic) return null;

  if (variant === "compact") {
    return (
      <Link
        href="/dashboard/profile#academic"
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand)] hover:underline"
      >
        <GraduationCap className="size-3.5" aria-hidden="true" />
        Are you a student? Add your programme to unlock the academic lane
        <ArrowUpRight className="size-3" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/profile#academic"
      aria-label="Add your academic programme to unlock the student lane on Career Compass."
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-3 transition-colors hover:bg-[color:var(--color-brand-tint)]/80 md:p-4"
    >
      <div className="flex items-start gap-3">
        <GraduationCap
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <div>
          <p className="font-display text-base leading-tight text-[color:var(--color-ink)]">
            Are you a student? Add your programme.
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
            Unlocks curriculum-vs-market signal, electives, internships,
            graduate programmes, and the destinations panel on Career Compass.
          </p>
        </div>
      </div>
      <span className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-3 text-xs font-medium text-[color:var(--color-brand-strong)]">
        Add your programme
        <ArrowUpRight className="size-3" aria-hidden="true" />
      </span>
    </Link>
  );
}
