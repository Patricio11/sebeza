"use client";

/**
 * Phase 11.2.8  Switch-profession confirmation modal.
 *
 * Surfaces the pivot pathway from an `<AdjacentProfessionCard>`: opens
 * with an explicit explanation of what changing primary profession will
 * do (rank moves to the new pool, search visibility under new
 * profession, learning paths recalibrate, work history + skills stay),
 * and a "I'll think about it" / "Switch my profession" pair. Calls the
 * single-field `switchPrimaryProfession` action.
 *
 * Mobile-first: bottom-sheet on phones, centred on `md+`. Mirrors the
 * 9.8.5 decline-modal / 11.2.2 abandon-modal pattern so the three
 * "deliberate state change" surfaces read consistently.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { switchPrimaryProfession } from "@/lib/profile/actions";
import { AlertTriangle, ArrowRight, X } from "lucide-react";

interface Props {
  currentProfession: string;
  nextProfession: string;
  onClose: () => void;
}

export function SwitchProfessionConfirmModal({
  currentProfession,
  nextProfession,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await switchPrimaryProfession({
        profession: nextProfession,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-h"
      className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] md:rounded-[var(--radius-md)]">
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-hairline)] p-5">
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Switch primary profession
            </div>
            <h2
              id="switch-h"
              className="mt-1 font-display text-lg text-[color:var(--color-ink)]"
            >
              <span className="text-[color:var(--color-ink-soft)]">
                {currentProfession}
              </span>{" "}
              <ArrowRight
                className="inline size-4 text-[color:var(--color-ink-soft)]"
                aria-hidden="true"
              />{" "}
              <span>{nextProfession}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-[color:var(--color-ink)]">
          <p>What changes when you switch primary profession:</p>
          <ul className="mt-3 space-y-2 text-[color:var(--color-ink-soft)]">
            <li>
              Your rank moves into the{" "}
              <strong>{nextProfession}</strong> pool for your province.
            </li>
            <li>
              Recruiters searching for{" "}
              <strong>{nextProfession}</strong> will surface you.
            </li>
            <li>
              Your skill recommendations recalibrate to the new pool&rsquo;s
              gaps.
            </li>
          </ul>
          <p className="mt-3">
            What does <em>not</em> change: your work history, your existing
            skills, your verification state, your status freshness. The switch
            is reversible  swap back any time from your profile editor.
          </p>

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
            onClick={onClose}
            disabled={pending}
          >
            I&rsquo;ll think about it
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Switching" : "Switch my profession"}
          </Button>
        </div>
      </div>
    </div>
  );
}
