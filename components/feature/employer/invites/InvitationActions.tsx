"use client";

/**
 * Phase 9.17  inline Withdraw + Resend buttons on each Pending row.
 *
 * No modal  Withdraw shows a confirm() prompt (matches the pattern
 * used by the existing org KYC withdraw flow), Resend fires straight
 * through to the rate-limited server action and surfaces success /
 * error inline.
 */

import { useState, useTransition } from "react";
import { Send, X } from "lucide-react";
import {
  resendSeekerInvitation,
  withdrawSeekerInvitation,
} from "@/lib/employer/seeker-invitations";

interface Props {
  inviteId: string;
  email: string;
}

export function InvitationActions({ inviteId, email }: Props) {
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onResend() {
    setFlash(null);
    setError(null);
    startTransition(async () => {
      const res = await resendSeekerInvitation({ inviteId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setFlash("Invitation resent.");
    });
  }

  function onWithdraw() {
    if (!window.confirm(`Withdraw the invitation to ${email}?`)) return;
    setFlash(null);
    setError(null);
    startTransition(async () => {
      const res = await withdrawSeekerInvitation({ inviteId });
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onResend}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-1 text-xs text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="size-3.5" aria-hidden="true" />
        {pending ? "Working…" : "Resend"}
      </button>
      <button
        type="button"
        onClick={onWithdraw}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] bg-[color:var(--color-paper)] px-3 py-1 text-xs text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <X className="size-3.5" aria-hidden="true" />
        Withdraw
      </button>
      {flash && (
        <span className="text-xs text-[color:var(--color-brand-strong)]">
          {flash}
        </span>
      )}
      {error && (
        <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
      )}
    </div>
  );
}
