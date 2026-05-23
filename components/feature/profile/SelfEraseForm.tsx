"use client";

/**
 * Phase 8  Self-service POPIA §24 erase form.
 *
 * Confirmation gate: the seeker must type ERASE in capitals. We
 * intentionally don't use a single-click destructive button  this
 * action is irreversible after the 30-day cron sweep.
 */

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eraseMyAccount } from "@/lib/profile/erase";

export function SelfEraseForm() {
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // eraseMyAccount redirects to "/" on success  we don't get a
      // result back when it succeeds.
      const res = await eraseMyAccount({ confirm });
      if (!res.ok) {
        setError(res.message);
      }
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] px-4 py-2 text-sm font-medium text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-white"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Erase my account
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <p className="text-xs text-[color:var(--color-ink-soft)]">
        This will soft-delete your account immediately. The nightly cron
        hard-deletes after 30 days  within that window an administrator can
        restore you. After 30 days everything is gone. To confirm, type
        <strong className="ml-1">ERASE</strong> in capital letters below.
      </p>
      <input
        type="text"
        autoFocus
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="ERASE"
        className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 font-mono text-sm"
      />
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 py-2 text-xs text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {pending ? "Erasing…" : "Confirm erase"}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setConfirm("");
            setError(null);
          }}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
