"use client";

import { useState, useTransition } from "react";
import { suspendUser, restoreUser, eraseUser } from "@/lib/admin/moderation";

interface Props {
  userId: string;
  status: "active" | "suspended" | "deleted";
  isAdmin: boolean;
}

type Stage = "idle" | "suspend" | "erase";

export function UserRowActions({ userId, status, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "deleted") {
    return (
      <span className="text-xs text-[color:var(--color-ink-soft)]">
        Erased · awaiting 30-day cron
      </span>
    );
  }
  if (isAdmin) {
    return (
      <span className="text-xs text-[color:var(--color-ink-soft)]">
        Admin · ops procedure required
      </span>
    );
  }

  if (stage === "suspend") {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await suspendUser({ userId, reason });
            if (!res.ok) setError(res.message);
            else setStage("idle");
          });
        }}
      >
        <input
          autoFocus
          required
          minLength={10}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (10+ chars)…"
          className="h-9 w-56 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[var(--radius-pill)] bg-[color:var(--color-danger)] px-3 text-xs uppercase tracking-[0.18em] text-white disabled:opacity-60"
        >
          {pending ? "…" : "Suspend"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("idle");
            setReason("");
            setError(null);
          }}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          Cancel
        </button>
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
        )}
      </form>
    );
  }

  if (stage === "erase") {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await eraseUser({ userId, reason });
            if (!res.ok) setError(res.message);
            else setStage("idle");
          });
        }}
      >
        <input
          autoFocus
          required
          minLength={10}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="POPIA erase reason (10+ chars)…"
          className="h-9 w-72 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[var(--radius-pill)] bg-[color:var(--color-danger)] px-3 text-xs uppercase tracking-[0.18em] text-white disabled:opacity-60"
        >
          {pending ? "…" : "Confirm erase"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("idle");
            setReason("");
            setError(null);
          }}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          Cancel
        </button>
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "suspended" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await restoreUser({ userId });
              if (!res.ok) setError(res.message);
            });
          }}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)] hover:underline disabled:opacity-60"
        >
          {pending ? "Restoring…" : "Restore"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setStage("suspend")}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-danger)] hover:underline"
        >
          Suspend
        </button>
      )}
      <button
        type="button"
        onClick={() => setStage("erase")}
        className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
      >
        Erase
      </button>
      {error && (
        <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
      )}
    </div>
  );
}
