"use client";

/**
 * Phase 9.17  client island for /report-invite/[token].
 *
 * Token-gated; no auth. Submitting fires the
 * `reportSeekerInvitation` Server Action which:
 *   - audits `org.seeker_invite.reported`
 *   - notifies every admin (`org.seeker_invite.reported` kind)
 *   - does NOT auto-withdraw the invitation (admins decide)
 *
 * Reason is optional (POPIA §16: the recipient shouldn't have to
 * explain themselves to flag concern). Hard-capped at 500 chars to
 * keep the admin notification body readable.
 */

import { useState, useTransition } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { reportSeekerInvitation } from "@/lib/employer/seeker-invitations";

interface Props {
  token: string;
  orgName: string;
}

export function ReportInviteForm({ token, orgName }: Props) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await reportSeekerInvitation({
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
          Report received
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Thanks for telling us. A Sebenza administrator will review
          {" "}
          {orgName}
          &rsquo;s invitation activity. If it looks like email harvesting or
          unsolicited outreach, we&rsquo;ll suspend their account and notify
          you at the email this invitation was sent to.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert
          className="size-5 shrink-0 text-[color:var(--color-danger)]"
          aria-hidden="true"
        />
        <div className="text-sm text-[color:var(--color-ink-soft)]">
          You&rsquo;re about to report an invitation from{" "}
          <strong className="text-[color:var(--color-ink)]">{orgName}</strong>.
        </div>
      </div>

      <label className="block">
        <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          What&rsquo;s wrong? (optional)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={4}
          maxLength={500}
          placeholder="e.g. I don't know this organisation, this isn't my email address, or I receive too many invitations from them."
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2.5 text-sm text-[color:var(--color-ink)] outline-none transition-colors focus:border-[color:var(--color-ink)] focus:ring-2 focus:ring-[color:var(--color-brand)]/30"
          disabled={pending}
        />
        <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
          {reason.length}/500. You don&rsquo;t have to give a reason.
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
        {pending ? "Sending…" : "Report this invitation"}
      </Button>
    </div>
  );
}
