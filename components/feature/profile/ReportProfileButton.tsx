"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { flagProfile } from "@/lib/admin/moderation";

const REASONS = [
  { value: "fake_identity", label: "Fake or stolen identity" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam or scam" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

interface Props {
  handle: string;
  label: string;
}

export function ReportProfileButton({ handle, label }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<Reason>("inappropriate");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
        <Flag className="size-4" aria-hidden="true" />
        Thanks — our trust &amp; integrity team will review.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
      >
        <Flag className="size-3.5" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <form
      className="grid w-full max-w-md gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await flagProfile({ handle, reason, note: note || undefined });
          if (!res.ok) setError(res.message);
          else setSubmitted(true);
        });
      }}
    >
      <div className="flex items-center gap-2">
        <Flag className="size-4 text-[color:var(--color-danger)]" aria-hidden="true" />
        <span className="font-display text-base">Report this profile</span>
      </div>
      <CustomSelect
        ariaLabel="Reason"
        variant="compact"
        name="reason"
        defaultValue={reason}
        onChange={(v) => setReason(v as Reason)}
        options={REASONS.map((r) => ({ value: r.value, label: r.label }))}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional context (max 500 chars)…"
        rows={3}
        maxLength={500}
        className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2 text-sm"
      />
      <p className="text-[0.68rem] text-[color:var(--color-ink-soft)]">
        Reports go to our trust &amp; integrity team. False reports may affect
        your account.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Submit report"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
        )}
      </div>
    </form>
  );
}
