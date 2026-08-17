"use client";

import { useState, useTransition } from "react";
import { suspendUser, restoreUser, eraseUser } from "@/lib/admin/moderation";
import { reset2faForUser } from "@/lib/auth/two-factor";
import { adminEditUser } from "@/lib/admin/user-accounts";

interface Props {
  userId: string;
  status: "active" | "suspended" | "deleted";
  isAdmin: boolean;
  /** Current values, prefilled into the Edit stage. */
  name: string;
  email: string;
}

type Stage = "idle" | "edit" | "suspend" | "erase" | "reset2fa";

export function UserRowActions({ userId, status, isAdmin, name, email }: Props) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("idle");
  const [reason, setReason] = useState("");
  const [editName, setEditName] = useState(name);
  const [editEmail, setEditEmail] = useState(email);
  const [error, setError] = useState<string | null>(null);

  if (status === "deleted") {
    return (
      <span className="text-xs text-[color:var(--color-ink-soft)]">
        Erased · awaiting 30-day cron
      </span>
    );
  }

  if (stage === "edit") {
    return (
      <form
        className="flex flex-wrap items-center justify-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await adminEditUser({
              userId,
              fullName: editName,
              email: editEmail,
            });
            if (!res.ok) setError(res.message);
            else setStage("idle");
          });
        }}
      >
        <input
          autoFocus
          required
          minLength={2}
          maxLength={120}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          aria-label="Full name"
          placeholder="Full name"
          className="h-9 w-44 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <input
          required
          type="email"
          value={editEmail}
          onChange={(e) => setEditEmail(e.target.value)}
          aria-label="Email address"
          placeholder="Email address"
          className="h-9 w-56 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-paper)] disabled:opacity-60"
        >
          {pending ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("idle");
            setEditName(name);
            setEditEmail(email);
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

  if (isAdmin) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setStage("edit")}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          Edit
        </button>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          Admin · ops procedure required
        </span>
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
        )}
      </div>
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

  if (stage === "reset2fa") {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await reset2faForUser({ userId, reason });
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
          placeholder="Recovery reason (10+ chars)…"
          className="h-9 w-72 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-paper)] disabled:opacity-60"
        >
          {pending ? "…" : "Reset 2FA"}
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
      <button
        type="button"
        onClick={() => setStage("edit")}
        className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        Edit
      </button>
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
        onClick={() => setStage("reset2fa")}
        className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        Reset 2FA
      </button>
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
