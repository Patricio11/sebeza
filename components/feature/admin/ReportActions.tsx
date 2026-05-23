"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { closeReport, suspendUser } from "@/lib/admin/moderation";

interface Props {
  reportId: string;
  subjectUserId: string | null;
  subjectHandle: string;
}

type Stage = "idle" | "close-form" | "suspend-form";

export function ReportActions({ reportId, subjectUserId, subjectHandle }: Props) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {done}
      </span>
    );
  }

  if (stage === "close-form") {
    return (
      <form
        className="flex w-full flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await closeReport({
              reportId,
              resolution: "closed_no_action",
              reason,
            });
            if (!res.ok) setError(res.message);
            else setDone("Closed");
          });
        }}
      >
        <input
          autoFocus
          required
          minLength={5}
          maxLength={280}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Resolution note…"
          className="h-9 flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Confirm close"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStage("idle")}>
          Cancel
        </Button>
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
        )}
      </form>
    );
  }

  if (stage === "suspend-form") {
    return (
      <form
        className="flex w-full flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!subjectUserId) {
            setError("This report's subject has no linked user (deleted profile?).");
            return;
          }
          startTransition(async () => {
            const suspendRes = await suspendUser({ userId: subjectUserId, reason });
            if (!suspendRes.ok) {
              setError(suspendRes.message);
              return;
            }
            const closeRes = await closeReport({
              reportId,
              resolution: "actioned",
              reason: `Suspended @${subjectHandle}: ${reason}`,
            });
            if (!closeRes.ok) {
              setError(closeRes.message);
              return;
            }
            setDone("Suspended + report closed");
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
          placeholder="Suspension reason (10+ chars)…"
          className="h-9 flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-[color:var(--color-danger)] text-white hover:opacity-90"
        >
          {pending ? "Working…" : "Confirm suspend"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStage("idle")}>
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
        variant="ghost"
        size="sm"
        onClick={() => setStage("close-form")}
      >
        Close · no action
      </Button>
      <Button
        type="button"
        size="sm"
        className="bg-[color:var(--color-danger)] text-white hover:opacity-90"
        onClick={() => setStage("suspend-form")}
      >
        Suspend user
      </Button>
    </div>
  );
}
