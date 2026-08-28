"use client";

/**
 * "Start this route": adds every missing skill on a next-level track to
 * My learning in one tap. Sequential accepts (dedup lives server-side), a
 * single refresh at the end. Renders as a quiet done-chip once nothing on
 * the track is left to add.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check, Route } from "lucide-react";
import { acceptRecommendation } from "@/lib/seeker/learning";

interface Props {
  trackName: string;
  missingSlugs: string[];
  labels: { start: string; starting: string; started: string };
}

export function StartTrackButton({ trackName, missingSlugs, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (missingSlugs.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
        <Check className="size-3" aria-hidden="true" />
        {labels.started}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`${labels.start}: ${trackName}`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            for (const slug of missingSlugs) {
              const r = await acceptRecommendation({ skillSlug: slug });
              if (!r.ok) {
                setError(r.message);
                return;
              }
            }
            router.refresh();
          })
        }
        className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        <Route className="size-4" aria-hidden="true" />
        {pending ? labels.starting : labels.start}
      </button>
      {error && (
        <span className="text-[0.7rem] text-[color:var(--color-danger)]">
          {error}
        </span>
      )}
    </div>
  );
}
