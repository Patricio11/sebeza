"use client";

/**
 * Phase 18.1 ("Living Learning Catalog")  the per-card path-review control.
 *
 * Calm + No-Flash: a quiet recommend roll-up (only above a k-anonymity floor)
 * + a one-tap "Took this path?" recommend / not-for-me, with an optional note.
 * Opt-in self-attestation (the seeker says they took it)  same honesty model
 * as the rest of the platform. Rendered only when the flag is on (the card
 * gates on it) and the path has a DB id.
 */

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check, PencilLine } from "lucide-react";
import { submitPathReview } from "@/lib/seeker/path-reviews";

/** Below this many reviews we show no roll-up (k-anonymity for the rating). */
const ROLLUP_FLOOR = 5;
const NOTE_MAX = 280;

export function PathReviewControl({
  pathId,
  reviewCount = 0,
  recommendCount = 0,
}: {
  pathId: string;
  reviewCount?: number;
  recommendCount?: number;
}) {
  const [counts, setCounts] = useState({ reviewCount, recommendCount });
  const [done, setDone] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  async function submit(recommend: boolean) {
    if (pending) return;
    setPending(true);
    try {
      const r = await submitPathReview(
        pathId,
        recommend,
        note.trim() || undefined,
      );
      if (r.ok) {
        setCounts({ reviewCount: r.reviewCount, recommendCount: r.recommendCount });
        setDone(recommend);
      }
    } finally {
      setPending(false);
    }
  }

  const showRollup = counts.reviewCount >= ROLLUP_FLOOR;

  return (
    <div className="mt-1 border-t border-dashed border-[color:var(--color-hairline)] pt-3">
      {showRollup && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-[color:var(--color-ink-soft)]">
          <ThumbsUp className="size-3.5 text-[color:var(--color-brand)]" aria-hidden="true" />
          Recommended by{" "}
          <strong className="font-display tabular text-[color:var(--color-ink)]">
            {counts.recommendCount}
          </strong>{" "}
          of{" "}
          <strong className="font-display tabular text-[color:var(--color-ink)]">
            {counts.reviewCount}
          </strong>{" "}
          seekers who took it
        </p>
      )}

      {done === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            Took this path?
          </span>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-2.5 text-xs text-[color:var(--color-brand-strong)] hover:bg-[color:var(--color-brand-tint)] disabled:opacity-50"
          >
            <ThumbsUp className="size-3.5" aria-hidden="true" />
            Recommend
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] disabled:opacity-50"
          >
            <ThumbsDown className="size-3.5" aria-hidden="true" />
            Not for me
          </button>
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="inline-flex h-7 items-center gap-1 px-1 text-xs text-[color:var(--color-ink-soft)] underline-offset-2 hover:underline"
            aria-expanded={noteOpen}
          >
            <PencilLine className="size-3.5" aria-hidden="true" />
            Add a note
          </button>
          {noteOpen && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder="What got in the way? (optional, never shown with your name)"
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-2 text-xs text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-brand)]"
            />
          )}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-[color:var(--color-ink-soft)]">
          <Check className="size-4 text-[color:var(--color-brand)]" aria-hidden="true" />
          Thanks  your feedback helps other seekers choose.
        </p>
      )}
    </div>
  );
}
