"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, ShieldCheck, KeyRound, Trash2, AlertTriangle } from "lucide-react";
import { suspendUser, restoreUser, eraseUser } from "@/lib/admin/moderation";
import { reset2faForUser } from "@/lib/auth/two-factor";
import type { UserRole } from "@/lib/mock/types";

interface Props {
  userId: string;
  status: "active" | "suspended" | "deleted";
  targetRole: UserRole;
  /** True when the admin is looking at their own account. */
  isSelf: boolean;
}

type Stage = "idle" | "suspend" | "reset2fa" | "erase";

/**
 * Full account-management controls for the admin user-detail page. Reuses the
 * existing server actions (moderation + two-factor) but presents them as a
 * prominent, role-aware panel with confirm-with-reason flows and a separated
 * danger zone — replacing the compact list-row `<UserRowActions>` on this page.
 *
 * Guards mirror the server: an admin can't suspend/erase themselves or another
 * admin (those need an ops procedure), and can't reset their own 2FA. Rather
 * than show buttons the server will refuse, we explain why.
 */
export function AccountAdminActions({ userId, status, targetRole, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canModerate = !isSelf && targetRole !== "admin";
  const canReset2fa = !isSelf;

  const reset = () => {
    setStage("idle");
    setReason("");
    setError(null);
  };

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.message ?? "Action failed.");
      else {
        reset();
        router.refresh();
      }
    });

  if (status === "deleted") {
    return (
      <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] p-3 text-sm text-[color:var(--color-ink-soft)]">
        This account is erased and awaiting the 30-day hard-delete cron. No further account actions
        apply.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Access controls ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Suspend / Restore */}
        {status === "suspended" ? (
          <ActionButton
            disabled={pending}
            onClick={() => run(() => restoreUser({ userId }))}
            icon={ShieldCheck}
            tone="brand"
          >
            {pending ? "Restoring…" : "Restore access"}
          </ActionButton>
        ) : canModerate ? (
          stage === "suspend" ? (
            <ReasonForm
              label="Suspend"
              tone="danger"
              placeholder="Reason (10+ chars) — shown in the audit log…"
              minLength={10}
              reason={reason}
              setReason={setReason}
              pending={pending}
              onCancel={reset}
              onSubmit={() => run(() => suspendUser({ userId, reason }))}
            />
          ) : (
            <ActionButton
              disabled={pending}
              onClick={() => {
                setStage("suspend");
                setError(null);
              }}
              icon={ShieldOff}
              tone="danger-soft"
            >
              Suspend account
            </ActionButton>
          )
        ) : (
          <GuardNote>
            {isSelf
              ? "You can’t suspend your own account."
              : "Admin accounts can’t be suspended here — use the ops procedure."}
          </GuardNote>
        )}

        {/* Reset 2FA */}
        {canReset2fa ? (
          stage === "reset2fa" ? (
            <ReasonForm
              label="Reset 2FA"
              tone="ink"
              placeholder="Recovery reason (10+ chars)…"
              minLength={10}
              reason={reason}
              setReason={setReason}
              pending={pending}
              onCancel={reset}
              onSubmit={() => run(() => reset2faForUser({ userId, reason }))}
            />
          ) : (
            <ActionButton
              disabled={pending}
              onClick={() => {
                setStage("reset2fa");
                setError(null);
              }}
              icon={KeyRound}
              tone="ink-soft"
            >
              Reset two-factor auth
            </ActionButton>
          )
        ) : (
          <GuardNote>Reset your own 2FA from your account panel, not here.</GuardNote>
        )}
      </div>

      {/* ── Danger zone ──────────────────────────────────────────────── */}
      {canModerate && (
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/[0.04] p-4">
          <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-danger)]">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Danger zone
          </div>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            POPIA erasure soft-deletes the account; a nightly cron hard-deletes after 30 days.
          </p>
          <div className="mt-3">
            {stage === "erase" ? (
              <ReasonForm
                label="Confirm erase"
                tone="danger"
                placeholder="POPIA erase reason (10+ chars)…"
                minLength={10}
                reason={reason}
                setReason={setReason}
                pending={pending}
                onCancel={reset}
                onSubmit={() => run(() => eraseUser({ userId, reason }))}
              />
            ) : (
              <ActionButton
                disabled={pending}
                onClick={() => {
                  setStage("erase");
                  setError(null);
                }}
                icon={Trash2}
                tone="danger-soft"
              >
                Erase account (POPIA)
              </ActionButton>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-[color:var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  children,
  icon: Icon,
  tone,
  ...rest
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "danger" | "danger-soft" | "ink" | "ink-soft";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const toneClass = {
    brand:
      "bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-strong)]",
    danger: "bg-[color:var(--color-danger)] text-white hover:opacity-90",
    "danger-soft":
      "border border-[color:var(--color-danger)]/40 text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/[0.06]",
    ink: "bg-[color:var(--color-ink)] text-[color:var(--color-paper)] hover:opacity-90",
    "ink-soft":
      "border border-[color:var(--color-hairline)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]",
  }[tone];

  return (
    <button
      type="button"
      className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] px-4 text-sm font-medium transition-colors disabled:opacity-60 sm:w-auto ${toneClass}`}
      {...rest}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function ReasonForm({
  label,
  tone,
  placeholder,
  minLength,
  reason,
  setReason,
  pending,
  onCancel,
  onSubmit,
}: {
  label: string;
  tone: "danger" | "ink";
  placeholder: string;
  minLength: number;
  reason: string;
  setReason: (v: string) => void;
  pending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        autoFocus
        required
        minLength={minLength}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        className="h-11 flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={
            "inline-flex min-h-11 items-center rounded-[var(--radius-pill)] px-4 text-sm font-medium text-white disabled:opacity-60 " +
            (tone === "danger"
              ? "bg-[color:var(--color-danger)]"
              : "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]")
          }
        >
          {pending ? "…" : label}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-2 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function GuardNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] px-3 py-2 text-xs text-[color:var(--color-ink-soft)]">
      {children}
    </p>
  );
}
