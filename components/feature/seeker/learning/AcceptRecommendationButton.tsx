"use client";

/**
 * Phase 9.12  Accept-recommendation button on the Career Compass.
 *
 * Tiny client island that sits next to each `<RecommendationItem>`. On
 * click it calls `acceptRecommendation({ skillSlug })`, which either
 * creates a new `learning_items` row or returns the existing
 * accepted/in-progress one for the same skill (dedup baked in on the
 * server). The compass page revalidates, the My Learning section
 * re-renders with the new row.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { acceptRecommendation } from "@/lib/seeker/learning";
import { Check, Plus } from "lucide-react";

interface Props {
  skillSlug: string;
  skillLabel: string;
  /** True when the seeker already has an active learning item on this
   *  skill  the button renders as a quiet "Already on your list" pill
   *  instead of a primary CTA. */
  alreadyOnList: boolean;
}

export function AcceptRecommendationButton({
  skillSlug,
  skillLabel,
  alreadyOnList,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (alreadyOnList) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
        <Check className="size-3.5" aria-hidden="true" />
        On your learning list
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await acceptRecommendation({ skillSlug });
            if (!res.ok) {
              setError(res.message);
              return;
            }
            router.refresh();
          })
        }
      >
        <Plus className="mr-1 size-3.5" aria-hidden="true" />
        {pending ? "Adding" : `Learn ${skillLabel}`}
      </Button>
      {error && (
        <span className="text-[0.7rem] text-[color:var(--color-danger)]">
          {error}
        </span>
      )}
    </div>
  );
}
