/**
 * Phase 20.2 ("Unlocks next")  a quiet, flag-gated nudge: skills the seeker
 * can now sensibly tackle because they already hold the prerequisite. Each
 * reuses the learning-loop accept button, so one tap adds it to their plan.
 * Server component  pure display over the `getUnlockedNextSkills` result.
 */

import { KeyRound } from "lucide-react";
import { AcceptRecommendationButton } from "./AcceptRecommendationButton";
import type { UnlockedNext } from "@/db/queries/skill-prereqs";

export function UnlockedNextCard({ items }: { items: UnlockedNext[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Unlocks next"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
        <KeyRound className="size-4" aria-hidden="true" />
        Unlocks next
      </div>
      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.dependentSlug}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-[color:var(--color-ink)]">
              You have <strong>{it.prereqLabel}</strong>  a stepping stone to{" "}
              <strong>{it.dependentLabel}</strong>.
            </p>
            <AcceptRecommendationButton
              skillSlug={it.dependentSlug}
              skillLabel={it.dependentLabel}
              alreadyOnList={false}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
