"use client";

/**
 * Phase 11.3.1  pause-searchability control.
 *
 * Renders directly under the existing `searchability` toggle on
 * `/dashboard/privacy`. Three visual states:
 *
 *   Active (consent granted, no pause)
 *     -> compact "Pause for a while" expander -> duration picker
 *
 *   Paused (consent granted + pausedUntil > now)
 *     -> chip "Paused until DATE" + "Unpause" link
 *
 *   Off (consent not granted)
 *     -> hidden  the user would revoke, not pause.
 *
 * Mobile-first: the duration picker uses native radio buttons stacked
 * vertically on phones, inline on `md+`. No bottom-sheet  this is a
 * non-modal expander; we keep the user on the privacy page.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import {
  pauseSearchability,
  unpauseSearchability,
} from "@/lib/consent/pause";
import { AlertTriangle, Pause, Play } from "lucide-react";

interface Props {
  /** True iff `searchability` consent is currently granted. */
  searchabilityOn: boolean;
  /** ISO string when the pause expires, or null. */
  pausedUntil: string | null;
  /** ISO string the seeker started the pause, or null. */
  pausedAt: string | null;
  /** Optional seeker-authored reason (display only, never sent to
   *  employers). */
  pausedReason: string | null;
  /** Locale for the date format on the chip. */
  locale: string;
}

const DURATION_OPTIONS: { label: string; days: number }[] = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "12 months", days: 365 },
];

const REASON_MAX = 200;

export function SearchabilityPauseControl({
  searchabilityOn,
  pausedUntil,
  pausedAt,
  pausedReason,
  locale,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [duration, setDuration] = useState<number>(90);
  const [reason, setReason] = useState<string>(pausedReason ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!searchabilityOn) return null;

  const isPaused =
    pausedUntil != null && new Date(pausedUntil).getTime() > Date.now();

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (isPaused && pausedUntil) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-[color:var(--color-accent)]">
          <Pause className="size-3.5" aria-hidden="true" />
          Paused until <strong>{fmt.format(new Date(pausedUntil))}</strong>
        </span>
        {pausedAt && (
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            since {fmt.format(new Date(pausedAt))}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await unpauseSearchability();
              if (!res.ok) {
                setError(res.message);
                return;
              }
              router.refresh();
            });
          }}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-accent)] hover:underline"
        >
          <Play className="size-3" aria-hidden="true" />
          Unpause now
        </button>
        {error && (
          <p className="basis-full text-xs text-[color:var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!expanded) {
    return (
      <p className="mt-2 text-sm">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 text-[color:var(--color-brand)] hover:underline"
        >
          <Pause className="size-3.5" aria-hidden="true" />
          Pause for a while
        </button>
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-4">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        Pause searchability
      </div>
      <p className="mt-1 max-w-prose text-sm text-[color:var(--color-ink-soft)]">
        You stay in the system + keep your freshness streak. Employers
        can&rsquo;t send you new invites; your existing relationships
        carry on. Auto-resumes on the date you pick.
      </p>

      <fieldset className="mt-3">
        <legend className="sr-only">Pause duration</legend>
        <ul className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <li key={opt.days}>
              <label
                className={
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border bg-[color:var(--color-surface)] px-3 py-1 text-sm " +
                  (duration === opt.days
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                    : "border-[color:var(--color-hairline)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                }
              >
                <input
                  type="radio"
                  name="pause-duration"
                  value={opt.days}
                  checked={duration === opt.days}
                  onChange={() => setDuration(opt.days)}
                  disabled={pending}
                  className="sr-only"
                />
                {opt.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <label
        htmlFor="pause-reason"
        className="mt-3 block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
      >
        Optional reason (private  never sent to employers)
      </label>
      <textarea
        id="pause-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
        rows={2}
        disabled={pending}
        maxLength={REASON_MAX}
        placeholder="Eg. just took a new role · I'm overwhelmed · travelling"
        className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
      />
      <div className="mt-1 flex items-center justify-end text-[0.62rem] text-[color:var(--color-ink-soft)]">
        <span className="tabular">
          {reason.length}/{REASON_MAX}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await pauseSearchability({
                durationDays: duration,
                reason: reason.trim() || undefined,
              });
              if (!res.ok) {
                setError(res.message);
                return;
              }
              setExpanded(false);
              router.refresh();
            });
          }}
        >
          {pending ? "Pausing" : "Confirm pause"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setExpanded(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
