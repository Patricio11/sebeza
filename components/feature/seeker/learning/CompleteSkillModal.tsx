"use client";

/**
 * Phase 17 ("The Climb")  completion modal.
 *
 * Replaces the old one-tap "Mark complete" (which hardcoded proficiency 3).
 * The seeker self-assesses how well they know the skill now (1..5) + an
 * optional years estimate, then we attach it to their profile as
 * self_attested_learning at THEIR chosen depth. Shows the rank payoff so the
 * "watch yourself rise" loop closes at the moment of completion.
 *
 * Honesty: this is the seeker's own claim  the skill never reads "verified"
 * (the cert-upload bridge on the completed row handles that path).
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { completeLearningItem } from "@/lib/seeker/learning";
import { AlertTriangle, Sparkles, TrendingUp, X } from "lucide-react";

interface Props {
  itemId: string;
  skillLabel: string;
  poolLabel?: string | null;
  currentRank?: number | null;
  projectedRank?: number | null;
  onClose: () => void;
  onDone: () => void;
}

const LEVELS: { value: number; label: string }[] = [
  { value: 1, label: "Just the basics" },
  { value: 2, label: "Getting there" },
  { value: 3, label: "Comfortable" },
  { value: 4, label: "Strong" },
  { value: 5, label: "Ready to lead" },
];

export function CompleteSkillModal({
  itemId,
  skillLabel,
  poolLabel,
  currentRank,
  projectedRank,
  onClose,
  onDone,
}: Props) {
  const [proficiency, setProficiency] = useState(3);
  const [years, setYears] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const climbs =
    typeof currentRank === "number" &&
    typeof projectedRank === "number" &&
    projectedRank < currentRank;

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await completeLearningItem(itemId, {
        proficiency,
        yearsOfExperience: years.trim() === "" ? null : Number(years),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-h"
      className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] md:rounded-[var(--radius-md)]">
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-hairline)] p-5">
          <div>
            <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Mark complete
            </div>
            <h2 id="complete-h" className="mt-1 font-display text-lg text-[color:var(--color-ink)]">
              You learned {skillLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto p-5">
          {/* Self-assessed proficiency */}
          <fieldset>
            <legend className="text-sm font-medium text-[color:var(--color-ink)]">
              How well do you know it now?
            </legend>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
              Your honest call. It lands on your profile as your own claim
              never marked &ldquo;verified&rdquo;.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-5">
              {LEVELS.map((l) => {
                const active = l.value === proficiency;
                return (
                  <button
                    key={l.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setProficiency(l.value)}
                    className={
                      "flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-[0.7rem] leading-tight transition-colors " +
                      (active
                        ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                        : "border-[color:var(--color-hairline)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                    }
                  >
                    <span className="font-display text-base">{l.value}</span>
                    <span>{l.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Optional years */}
          <div>
            <label
              htmlFor="complete-years"
              className="text-sm font-medium text-[color:var(--color-ink)]"
            >
              Years of practice{" "}
              <span className="font-normal text-[color:var(--color-ink-soft)]">(optional)</span>
            </label>
            <input
              id="complete-years"
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="Leave blank for under a year"
              className="mt-1.5 h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
            />
          </div>

          {/* Rank payoff */}
          <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-brand)]/30 bg-[color:var(--color-brand-tint)] p-3">
            <div className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
              <TrendingUp className="size-4 shrink-0 text-[color:var(--color-brand-strong)]" aria-hidden="true" />
              {climbs ? (
                <span>
                  Adding this climbs you toward{" "}
                  <strong className="font-display tabular">#{projectedRank}</strong>
                  {poolLabel ? ` in ${poolLabel}` : ""} (from #{currentRank}).
                </span>
              ) : (
                <span>
                  We&rsquo;ll add <strong>{skillLabel}</strong> to your profile
                  {poolLabel ? ` and refresh your place in ${poolLabel}` : ""}.
                </span>
              )}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-xs text-[color:var(--color-danger)]"
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] p-5">
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={pending} onClick={onConfirm}>
            {pending ? "Saving…" : "Add to my profile"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
