"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  approveQualification,
  rejectQualification,
  approveOrganisation,
  rejectOrganisation,
} from "@/lib/admin/verifications";

type Kind = "qualification" | "organisation";

interface Props {
  id: string;
  kind: Kind;
  approveLabel: string;
  rejectLabel: string;
  /** Phase 8  render a secondary "Force approve" affordance when the
   *  SAQA worker flag is on (qualification rows only). When false (or
   *  not a qualification), the secondary button is omitted. */
  showSaqaOverride?: boolean;
}

export function VerificationActions({
  id,
  kind,
  approveLabel,
  rejectLabel,
  showSaqaOverride = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "queued" | "rejected" | null>(null);

  if (done) {
    return (
      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {done === "approved"
          ? "Approved"
          : done === "queued"
            ? "Sent to SAQA"
            : "Rejected"}
      </span>
    );
  }

  if (mode === "rejecting") {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res =
              kind === "qualification"
                ? await rejectQualification({ qualificationId: id, reason })
                : await rejectOrganisation({ orgId: id, reason });
            if (!res.ok) setError(res.message);
            else setDone("rejected");
          });
        }}
      >
        <input
          autoFocus
          required
          minLength={10}
          maxLength={280}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (10+ chars)…"
          className="h-9 w-64 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Confirm reject"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode("idle");
            setReason("");
            setError(null);
          }}
        >
          Cancel
        </Button>
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            if (kind === "qualification") {
              const res = await approveQualification({ qualificationId: id });
              if (!res.ok) setError(res.message);
              else setDone(res.queued ? "queued" : "approved");
            } else {
              const res = await approveOrganisation({ orgId: id });
              if (!res.ok) setError(res.message);
              else setDone("approved");
            }
          });
        }}
      >
        {pending ? "Saving…" : approveLabel}
      </Button>
      {showSaqaOverride && kind === "qualification" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Force approve bypasses the SAQA worker and flips the qualification directly. Use only when SAQA returned an error or you have out-of-band evidence. The action is audit-logged distinctly.",
              )
            )
              return;
            setError(null);
            startTransition(async () => {
              const res = await approveQualification({
                qualificationId: id,
                forceApprove: true,
              });
              if (!res.ok) setError(res.message);
              else setDone("approved");
            });
          }}
        >
          Force approve
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setMode("rejecting")}
      >
        {rejectLabel}
      </Button>
      {error && (
        <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
      )}
    </div>
  );
}
