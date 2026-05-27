"use client";

/**
 * Phase 9.17  client island for the invitation-decline page.
 *
 * Renders an optional 200-char reason textarea + a Decline button.
 * Calls `declineSeekerInvitation({ token, reason? })`, then swaps to a
 * thank-you panel on success. No auth required  the token is the
 * proof of identity.
 *
 * Trade-off note: we let the user submit a fully-empty reason. POPIA
 * §11 says we honour the objection regardless of whether they
 * explain themselves; demanding a reason would be a dark pattern.
 */

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { declineSeekerInvitation } from "@/lib/employer/seeker-invitations";

interface Props {
  token: string;
  orgName: string;
}

export function DeclineInvitationForm({ token, orgName }: Props) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await declineSeekerInvitation({
        token,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Decline recorded
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Thanks for telling us. We&rsquo;ll let {orgName} know, and we&rsquo;ll
          block any new invitations from them to this email for at least 90 days.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Reason (optional)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          rows={3}
          maxLength={200}
          placeholder="Anything you'd like to share with the inviter (optional)."
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2.5 text-sm text-[color:var(--color-ink)] outline-none transition-colors focus:border-[color:var(--color-ink)] focus:ring-2 focus:ring-[color:var(--color-brand)]/30"
          disabled={pending}
        />
        <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          {reason.length}/200. Your decline counts the same whether you
          explain it or not.
        </p>
      </label>
      {error && (
        <p role="alert" className="text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onSubmit}
        disabled={pending}
      >
        {pending ? "Recording…" : "Decline invitation"}
      </Button>
    </div>
  );
}
