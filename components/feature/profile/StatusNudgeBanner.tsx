"use client";

/**
 * Banner that surfaces above the dashboard when a profile's status is ageing
 * or stale. Tied to the same `lib/status.ts` engine that powers ranking +
 * analytics  single source of truth.
 *
 * Two emphasis levels:
 *   - ageing (30–90d): soft yellow strip, "still accurate?" tone
 *   - stale  (>= 90d): danger strip, "search down-ranks stale profiles"
 *
 * The "Yes, re-confirm" button calls reconfirmStatus directly so the seeker
 * never has to leave the dashboard. The "Update" button scrolls to the
 * Talent Pulse card.
 */

import { useTransition } from "react";
import { AlertTriangle, BellRing, CheckCircle2 } from "lucide-react";
import { reconfirmStatus } from "@/lib/profile/actions";
import type { FreshnessBand } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface Props {
  band: FreshnessBand;
  days: number;
}

export function StatusNudgeBanner({ band, days }: Props) {
  const [pending, startTransition] = useTransition();

  // Don't render at all when fresh  keeps the page calm by default.
  if (band === "fresh") return null;

  const urgent = band === "stale";

  return (
    <section
      role="status"
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-[var(--radius-md)] border-2 p-5 md:flex-row md:items-center md:justify-between",
        urgent
          ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger-tint,#fff1ee)]"
          : "border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint,#fff7e3)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
            urgent
              ? "bg-[color:var(--color-danger)] text-white"
              : "bg-[color:var(--color-accent)] text-[color:var(--color-ink)]",
          )}
        >
          {urgent ? (
            <AlertTriangle className="size-4" />
          ) : (
            <BellRing className="size-4" />
          )}
        </span>
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            {urgent ? "Profile is stale" : "Quick check-in"}
          </div>
          <h2 className="font-display text-lg leading-tight">
            {urgent
              ? `It's been ${days} days since you last confirmed your status.`
              : `It's been ${days} days  is your status still accurate?`}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {urgent
              ? "Stale profiles are down-ranked in search until they're re-confirmed."
              : "Confirming keeps you visible to employers and keeps the national figures honest."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href="#pulse-h"
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper)]"
        >
          Update status
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void reconfirmStatus();
            })
          }
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)] disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {pending ? "Saving…" : "Yes, still accurate"}
        </button>
      </div>
    </section>
  );
}
