"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePlacement } from "@/lib/employer/placements";

interface Props {
  placementId: string;
  candidateName: string;
}

export function PlacementDeleteButton({ placementId, candidateName }: Props) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete placement for ${candidateName}`}
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Remove ${candidateName}'s placement record? This bumps the national hire count back down  only do this if logged in error.`,
          )
        )
          return;
        startTransition(async () => {
          await deletePlacement({ placementId });
        });
      }}
      className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-60"
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}
