"use client";

/**
 * Phase 11.3.3  Report-this-invite control + modal.
 *
 * One-click reporter on an invitation card or detail page. Opens a
 * modal with the structured reason radio set + optional 280-char free
 * text. Reports do NOT auto-decline the invitation (D3)  the seeker
 * can still accept the role on its merits.
 *
 * Mobile-first: bottom-sheet on phones, centred on `md+`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import {
  reportInvitation,
  REPORT_INVITE_REASON_LABEL,
  type ReportInviteReason,
} from "@/lib/seeker/report-invite";
import { AlertTriangle, Flag, Info, X } from "lucide-react";

interface Props {
  invitationId: string;
}

const REASONS: ReportInviteReason[] = [
  "harassment",
  "spam",
  "inappropriate",
  "irrelevant_role",
  "bad_faith_company",
  "off_platform_contact_request",
  "other",
];

const NOTE_MAX = 280;

export function ReportInvitationControl({ invitationId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportInviteReason | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  if (reported) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-strong)]">
        <Flag className="size-3" aria-hidden="true" />
        Reported  thanks
      </span>
    );
  }

  function onSubmit() {
    if (!reason) {
      setError("Pick a reason from the list.");
      return;
    }
    if (reason === "other" && note.trim().length === 0) {
      setError("Add a short note when picking 'Another reason'.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await reportInvitation({
        invitationId,
        reason,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setReported(true);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
      >
        <Flag className="size-3" aria-hidden="true" />
        Report this invite
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-h"
          className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !pending) setOpen(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] md:rounded-[var(--radius-md)]">
            <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-hairline)] p-5">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  Report this invite
                </div>
                <h2
                  id="report-h"
                  className="mt-1 font-display text-lg text-[color:var(--color-ink)]"
                >
                  Something off about this?
                </h2>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  Reporting doesn&rsquo;t decline the invite  if the role
                  is genuinely interesting, you can still accept on its merits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                aria-label="Close"
                className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  What&rsquo;s the issue?
                </legend>
                <ul className="flex flex-col gap-2">
                  {REASONS.map((r) => (
                    <li key={r}>
                      <label
                        className={
                          "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border bg-[color:var(--color-surface)] p-3 hover:border-[color:var(--color-ink)] " +
                          (reason === r
                            ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
                            : "border-[color:var(--color-hairline)]")
                        }
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          disabled={pending}
                          className="mt-1 size-4 accent-[color:var(--color-ink)]"
                        />
                        <span className="text-sm text-[color:var(--color-ink)]">
                          {REPORT_INVITE_REASON_LABEL[r]}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <label
                htmlFor="report-note"
                className="mt-4 block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
              >
                Optional note
                {reason === "other" && (
                  <span className="ml-1 text-[color:var(--color-danger)]">
                     required for &ldquo;Another reason&rdquo;
                  </span>
                )}
              </label>
              <textarea
                id="report-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                rows={3}
                disabled={pending}
                maxLength={NOTE_MAX}
                placeholder="Anything specific helps the admin review."
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
              />
              <div className="mt-1 flex items-center justify-between text-[0.62rem] text-[color:var(--color-ink-soft)]">
                <span className="inline-flex items-center gap-1">
                  <Info className="size-3" aria-hidden="true" />
                  Please don&rsquo;t include sensitive personal info.
                </span>
                <span className="tabular">
                  {note.length}/{NOTE_MAX}
                </span>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending || !reason}
                onClick={onSubmit}
              >
                {pending ? "Sending" : "Send report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
