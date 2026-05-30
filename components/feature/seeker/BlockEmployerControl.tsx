"use client";

/**
 * Phase 11.3.2  Block-this-employer control + confirm modal.
 *
 * Rendered on the seeker-facing surfaces where the seeker wants to
 * silence a specific org: invitation cards, invitation detail. The
 * control is a small text button; clicking opens a confirm modal
 * with an optional 200-char reason field (private; never sent to the
 * employer).
 *
 * Mobile-first: bottom-sheet on phones, centred on `md+`. Same
 * pattern as the 11.2.8 SwitchProfessionConfirmModal.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { blockEmployer } from "@/lib/seeker/blocks";
import { AlertTriangle, Shield, X } from "lucide-react";

interface Props {
  orgId: string;
  orgName: string;
}

const REASON_MAX = 200;

export function BlockEmployerControl({ orgId, orgName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await blockEmployer({
        orgId,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
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
        <Shield className="size-3" aria-hidden="true" />
        Block this employer
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-h"
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
                  Block employer
                </div>
                <h2
                  id="block-h"
                  className="mt-1 font-display text-lg text-[color:var(--color-ink)]"
                >
                  Block {orgName}?
                </h2>
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

            <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-[color:var(--color-ink)]">
              <p>
                <strong>{orgName}</strong> won&rsquo;t be able to find you in
                employer search or send you new invites. They are{" "}
                <strong>not</strong> told.
              </p>
              <p className="mt-2 text-[color:var(--color-ink-soft)]">
                You can unblock any time from{" "}
                <strong>Privacy &rarr; Blocked employers</strong>. Reporting
                misconduct is a separate flow  use that if this is more than
                just &ldquo;not interested&rdquo;.
              </p>

              <label
                htmlFor="block-reason"
                className="mt-4 block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
              >
                Optional private note
              </label>
              <textarea
                id="block-reason"
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value.slice(0, REASON_MAX))
                }
                rows={2}
                disabled={pending}
                maxLength={REASON_MAX}
                placeholder="A reminder for future-you. Never sent to the employer."
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
                  className="mt-2 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
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
                disabled={pending}
                onClick={onConfirm}
              >
                {pending ? "Blocking" : "Block this employer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
