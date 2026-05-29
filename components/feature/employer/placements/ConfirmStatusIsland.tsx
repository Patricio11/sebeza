"use client";

/**
 * Phase 9.20 Tier 2  client island for the "Confirm still employed"
 * quick action. Renders a small button on the list row + the detail
 * page; clicking opens a one-question modal (Is X still employed in
 * this role? + optional 500-char note).
 *
 * Mobile-first: the modal is a bottom-sheet on phones, centred on md+
 *  same idiom as the BulkInviteIsland modal so the affordance feels
 * familiar across the employer surface.
 *
 * The server action is threaded as a closure (rather than imported
 * directly) so the action site can also enforce caller-specific
 * revalidation if needed in the future. Matches the Phase 9.19 Tier 2
 * vacancy-shortlist pattern.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, X } from "lucide-react";

const CHECK_NOTE_MAX = 500;

interface Props {
  placementId: string;
  employeeName: string;
  /**
   * When set, render the trigger as the "Check-in due" badge variant
   * (accent-toned, sits in the row's status column). Otherwise renders
   * as a plain secondary button (detail-page Lifecycle panel).
   */
  variant?: "due-badge" | "button";
  /** Server-action closure. Returns the action result. */
  action: (input: {
    placementId: string;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
}

export function ConfirmStatusIsland({
  placementId,
  employeeName,
  variant = "button",
  action,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    const trimmed = note.trim();
    startTransition(async () => {
      const res = await action({
        placementId,
        ...(trimmed.length > 0 ? { note: trimmed } : {}),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOpen(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <>
      {variant === "due-badge" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/15"
          aria-label={`Confirm status for ${employeeName}`}
        >
          <CheckCircle2 className="size-2.5" aria-hidden="true" />
          Confirm status
        </button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Confirm still employed
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-${placementId}-h`}
          className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5 shadow-xl md:rounded-[var(--radius-md)] md:p-7">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3
                id={`confirm-${placementId}-h`}
                className="font-display text-xl text-[color:var(--color-ink)]"
              >
                Is {employeeName} still in this role?
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                aria-label="Close"
                className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-[color:var(--color-ink-soft)]">
              A quick yes is all we need  this keeps the platform&rsquo;s
              retention figure honest. Use the field below if you want to
              jot down any context for your own records.
            </p>

            <div className="mt-4">
              <label
                htmlFor={`check-note-${placementId}`}
                className="flex items-baseline justify-between text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
              >
                <span>
                  Optional note
                  <span className="ml-1 text-[color:var(--color-ink-soft)]">
                    (org-private)
                  </span>
                </span>
                <span
                  className={
                    "text-[0.65rem] tracking-normal " +
                    (note.length > CHECK_NOTE_MAX
                      ? "text-[color:var(--color-danger)]"
                      : "text-[color:var(--color-ink-soft)]")
                  }
                  aria-live="polite"
                >
                  {note.length} / {CHECK_NOTE_MAX}
                </span>
              </label>
              <textarea
                id={`check-note-${placementId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={pending}
                maxLength={CHECK_NOTE_MAX}
                rows={3}
                placeholder="e.g. confirmed via Slack DM, all good. Or leave blank."
                className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-sm text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? "Confirming" : "Yes, still employed"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
