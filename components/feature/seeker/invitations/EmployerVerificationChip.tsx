/**
 * Phase 11.3.5  Employer verification chip on the seeker's invitation
 * card + detail page.
 *
 * Surfaces the existing `organizations.verification` enum so the
 * seeker can tell at a glance whether the inviting org is
 * Sebenza-verified. No new badge tier (D5)  the three-tier enum
 * from Phase 9.10 / 9.22 is sufficient.
 *
 * Edge case: when the org is `unverified`, the chip carries an honest
 * one-line signal ("This employer hasn't completed our verification.
 * Consider the request carefully."). No moralising; just an honest
 * signal.
 */

import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";

interface Props {
  state: "unverified" | "pending" | "verified" | "rejected";
  /** When true, render the honest-signal helper line below the chip
   *  (used on the detail page; the card-level chip stays compact). */
  withDetail?: boolean;
}

export function EmployerVerificationChip({ state, withDetail }: Props) {
  if (state === "verified") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]"
        title="This employer completed Sebenza's verification process."
      >
        <CheckCircle2 className="size-3" aria-hidden="true" />
        Sebenza-verified
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]"
        title="Sebenza is currently reviewing this employer's verification."
      >
        <Clock className="size-3" aria-hidden="true" />
        Pending verification
      </span>
    );
  }
  // unverified / rejected  treat identically: the badge is the same
  // honest-signal posture either way. rejected is rare (admins normally
  // request changes before the row reaches that terminal state).
  return (
    <>
      <span
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-ink-soft)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
        title="This employer has not completed Sebenza's verification."
      >
        <ShieldAlert className="size-3" aria-hidden="true" />
        Self-registered
      </span>
      {withDetail && (
        <p className="mt-2 text-xs italic text-[color:var(--color-ink-soft)]">
          This employer hasn&rsquo;t completed our verification process.
          Consider the request carefully.
        </p>
      )}
    </>
  );
}
