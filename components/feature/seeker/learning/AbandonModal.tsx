"use client";

/**
 * Phase 9.12.5  Abandon-learning modal.
 *
 * Bottom-sheet on phones, centred on `md+`. Radio + optional 200-char
 * note (live counter); `other` requires a note. Mirrors the 9.8.5
 * decline-with-reason UX so the two "what just stalled" surfaces read
 * consistently.
 *
 * POPIA reminder is inline + explicit  the note is flagged as
 * seeker-authored free text in the audit row (the note body itself
 * stays in the learning_items table, NOT in audit meta).
 */

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  abandonLearningItem,
  fetchFreeAlternativeForItem,
  swapToFreeAlternative,
} from "@/lib/seeker/learning";
import type { FreeAlternative } from "@/lib/seeker/free-alternatives";
import {
  ABANDON_REASON_LABEL,
  COST_ACCESS_ABANDON_REASONS,
  LEARNING_NOTE_MAX,
  type AbandonReasonValue,
} from "@/lib/seeker/learning-types";
import { AlertTriangle, Info, Sparkles, X } from "lucide-react";

interface Props {
  itemId: string;
  skillLabel: string;
  onClose: () => void;
  onDone: () => void;
}

const REASONS: AbandonReasonValue[] = [
  "too_expensive",
  "no_time",
  "course_quality",
  "access_transport",
  "changed_direction",
  "too_difficult",
  "other",
];

export function AbandonModal({ itemId, skillLabel, onClose, onDone }: Props) {
  const [reason, setReason] = useState<AbandonReasonValue | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Phase 11.2.2  free-alternative inline surfacing. Lazy-loaded the
  // first time the seeker picks a cost-driven reason; cached after.
  const [freeAlt, setFreeAlt] = useState<FreeAlternative | null>(null);
  const [freeAltLoaded, setFreeAltLoaded] = useState(false);
  const [freeAltLoading, setFreeAltLoading] = useState(false);

  const otherRequiresNote = reason === "other" && note.trim().length === 0;
  const willRecommendFreeAlt =
    reason != null && COST_ACCESS_ABANDON_REASONS.has(reason);

  useEffect(() => {
    if (!willRecommendFreeAlt || freeAltLoaded || freeAltLoading) return;
    setFreeAltLoading(true);
    void fetchFreeAlternativeForItem(itemId)
      .then((alt) => {
        setFreeAlt(alt);
        setFreeAltLoaded(true);
      })
      .catch(() => {
        setFreeAltLoaded(true);
      })
      .finally(() => setFreeAltLoading(false));
  }, [willRecommendFreeAlt, freeAltLoaded, freeAltLoading, itemId]);

  function onSubmit() {
    if (!reason) {
      setError("Pick a reason from the list.");
      return;
    }
    if (otherRequiresNote) {
      setError("Add a short note when picking 'Another reason'.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await abandonLearningItem({
        itemId,
        reason,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
    });
  }

  function onAcceptFreeAlt() {
    if (!reason || !freeAlt) return;
    setError(null);
    startTransition(async () => {
      const res = await swapToFreeAlternative({
        abandonItemId: itemId,
        reason,
        note: note.trim() || undefined,
        freePathTitle: freeAlt.title,
        freePathProvider: freeAlt.provider,
        freePathProviderKind: freeAlt.providerKind,
        freePathIsFree: freeAlt.cost === "free",
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
      aria-labelledby="abandon-h"
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
            <h2
              id="abandon-h"
              className="font-display text-lg text-[color:var(--color-ink)]"
            >
              Stop learning &ldquo;{skillLabel}&rdquo;?
            </h2>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              No judgement  picking a reason helps us point you somewhere
              better next time and (anonymously, with privacy floors)
              helps SA policy understand where learners get stuck.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <fieldset>
            <legend className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Why are you giving up?
            </legend>
            <ul className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <li key={r}>
                  <label
                    className={
                      "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border bg-[color:var(--color-surface)] p-3 hover:border-[color:var(--color-ink)] " +
                      (reason === r
                        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
                        : "border-[color:var(--color-hairline)]")
                    }
                  >
                    <input
                      type="radio"
                      name="abandon-reason"
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      disabled={pending}
                      className="mt-1 size-4 accent-[color:var(--color-ink)]"
                    />
                    <span className="text-sm text-[color:var(--color-ink)]">
                      {ABANDON_REASON_LABEL[r]}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="mt-4">
            <label
              htmlFor="abandon-note"
              className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
            >
              Optional note
              {reason === "other" && (
                <span className="ml-1 text-[color:var(--color-danger)]">
                   required for &ldquo;Another reason&rdquo;
                </span>
              )}
            </label>
            <textarea
              id="abandon-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, LEARNING_NOTE_MAX))}
              disabled={pending}
              maxLength={LEARNING_NOTE_MAX}
              rows={3}
              placeholder="Anything specific helps us point better next time."
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
            />
            <div className="mt-1 flex items-center justify-between text-[0.62rem] text-[color:var(--color-ink-soft)]">
              <span className="inline-flex items-center gap-1">
                <Info className="size-3" aria-hidden="true" />
                Please don&rsquo;t include sensitive personal info.
              </span>
              <span className="tabular">
                {note.length}/{LEARNING_NOTE_MAX}
              </span>
            </div>
          </div>

          {willRecommendFreeAlt && (
            <div
              className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-3"
              aria-live="polite"
            >
              {freeAltLoading && (
                <p className="text-xs italic text-[color:var(--color-brand-strong)]">
                  Looking for a free alternative
                </p>
              )}
              {freeAltLoaded && !freeAlt && (
                <p className="text-xs text-[color:var(--color-brand-strong)]">
                  No free alternative on file for this skill yet  the
                  abandonment is still useful signal for SA-policy.
                </p>
              )}
              {freeAlt && (
                <>
                  <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Free alternative for the same skill
                  </div>
                  <h3 className="mt-1 font-display text-base text-[color:var(--color-ink)]">
                    {freeAlt.title}
                  </h3>
                  <p className="text-xs text-[color:var(--color-ink-soft)]">
                    {freeAlt.provider} · {freeAlt.durationWeeks} weeks ·{" "}
                    {freeAlt.cost === "free" ? "Free" : "Subsidised"}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                    {freeAlt.outcome}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={pending}
                      onClick={onAcceptFreeAlt}
                    >
                      {pending ? "Saving" : "Accept this instead"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={onSubmit}
                    >
                      Just abandon for now
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pending || !reason || otherRequiresNote}
            onClick={onSubmit}
          >
            {pending ? "Saving" : "Mark as abandoned"}
          </Button>
        </div>
      </div>
    </div>
  );
}
