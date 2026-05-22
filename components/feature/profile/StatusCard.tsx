"use client";

/**
 * Talent Pulse status card — replaces the static seeker-dashboard card.
 * Reads the live `status` + `statusConfirmedAt` from the DB; lets the seeker
 * change status (which auto-reconfirms) or re-confirm the existing status.
 *
 * Drives the freshness band shown on the dashboard. When a profile drifts to
 * `ageing` or `stale`, the StatusNudgeBanner picks it up too — single source
 * of truth lives in `lib/status.ts`.
 */

import { useState, useTransition } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import { reconfirmStatus, setStatus } from "@/lib/profile/actions";
import type { EmploymentStatus, FreshnessBand } from "@/lib/mock/types";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "open_to_work", label: "Open to work" },
  { value: "unemployed", label: "Unemployed" },
  { value: "studying", label: "Studying" },
];

interface Props {
  status: EmploymentStatus;
  statusConfirmedAt: string;
  band: FreshnessBand;
  locale: string;
  lastConfirmedLabel: string;
}

export function StatusCard({
  status,
  statusConfirmedAt,
  band,
  locale,
  lastConfirmedLabel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(next: EmploymentStatus) {
    if (next === status) {
      // No status change — just re-confirm the existing one.
      handleReconfirm();
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await setStatus({ status: next });
      if (!r.ok) setError(r.message);
      setPickerOpen(false);
    });
  }

  function handleReconfirm() {
    setError(null);
    startTransition(async () => {
      const r = await reconfirmStatus();
      if (!r.ok) setError(r.message);
      setPickerOpen(false);
    });
  }

  const bandColor =
    band === "fresh"
      ? "text-[color:var(--color-employed)]"
      : band === "ageing"
        ? "text-[color:var(--color-accent)]"
        : "text-[color:var(--color-stale)]";

  return (
    <section
      aria-labelledby="pulse-h"
      className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-6 md:p-8"
    >
      <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
        Talent Pulse
      </div>
      <h2 id="pulse-h" className="mt-1 font-display text-xl">
        Are you still {humanise(status)}?
      </h2>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
        Last confirmed {lastConfirmedLabel} · <span className={bandColor}>{band}</span>
      </p>
      <div className="mt-4">
        <StatusChip status={status} confirmedAt={statusConfirmedAt} locale={locale} />
      </div>

      {pickerOpen ? (
        <fieldset className="mt-5 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
          <legend className="px-1 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            What's your status today?
          </legend>
          <ul className="mt-2 grid gap-1.5">
            {STATUS_OPTIONS.map((o) => {
              const active = o.value === status;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(o.value)}
                    disabled={pending}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                        : "hover:bg-[color:var(--color-surface-sunk)]",
                    )}
                  >
                    <span>{o.label}</span>
                    {active && <Check className="size-4" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <div className="mt-5 flex flex-col gap-2 md:flex-row">
          <button
            type="button"
            onClick={handleReconfirm}
            disabled={pending}
            className="flex-1 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] py-3 text-sm font-medium text-[color:var(--color-paper)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Yes, still " + humanise(status)}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={pending}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)] disabled:opacity-60"
          >
            Update
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-[color:var(--color-danger)]">{error}</p>
      )}
    </section>
  );
}

function humanise(status: EmploymentStatus): string {
  switch (status) {
    case "employed":
      return "employed";
    case "self_employed":
      return "self-employed";
    case "open_to_work":
      return "open to work";
    case "unemployed":
      return "unemployed";
    case "studying":
      return "studying";
  }
}
