/**
 * Phase 7.5  Lever C banner.
 *
 * Server-rendered. The employer revealed the candidate's contact
 * ≥ 21 days ago, the 30-day window hasn't closed yet, and no
 * placement has been logged. One tap: "Did you hire?" → scrolls
 * the user to the MarkAsHiredCard. Honest framing, no penalty.
 */

import { Clock4 } from "lucide-react";

interface Props {
  daysSinceReveal: number;
  daysRemaining: number;
  candidateName: string;
}

export function PlacementNudgeBanner({
  daysSinceReveal,
  daysRemaining,
  candidateName,
}: Props) {
  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-5">
      <div className="flex items-start gap-3">
        <Clock4
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="font-display text-base leading-tight">
            Did you hire {candidateName}?
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            You opened their contact {daysSinceReveal} days ago. You have{" "}
            {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left to log
            this hire  after that the 30-day reveal window closes and
            you'll need to re-open the dossier. Logging confirmed hires
            keeps the national placement signal honest.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <a
              href="#mark-as-hired"
              className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-3 py-1.5 font-medium text-[color:var(--color-paper)]"
            >
              Log the hire →
            </a>
            <span className="text-[color:var(--color-ink-soft)]">
              Or dismiss  we'll ask again tomorrow if still open.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
