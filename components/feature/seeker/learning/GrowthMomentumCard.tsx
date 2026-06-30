/**
 * Phase 17 ("The Climb")  the seeker's growth momentum.
 *
 * The visible payoff half of the learning flywheel: how many skills they've
 * grown on Sebenza, what's in flight, and  the emotional core  their live
 * rank in the pool plus where finishing the active skills would take them.
 * Honest: no fabricated history; if there's no rank or nothing in flight, the
 * card degrades to a quiet "start a skill to begin climbing" prompt.
 *
 * Server component  pure display over numbers the page already computed.
 */

import { TrendingUp, Sparkles, Flame } from "lucide-react";

export interface GrowthMomentum {
  /** Skills completed via the learning loop (self_attested_learning). */
  skillsGrown: number;
  /** accepted + in_progress items right now. */
  inProgress: number;
  currentRank: number | null;
  poolTotal: number | null;
  /** Projected rank if the seeker finishes their active skills. */
  projectedRank: number | null;
  poolLabel: string | null;
}

export function GrowthMomentumCard({ momentum }: { momentum: GrowthMomentum }) {
  const { skillsGrown, inProgress, currentRank, poolTotal, projectedRank, poolLabel } =
    momentum;
  const climbs =
    typeof currentRank === "number" &&
    typeof projectedRank === "number" &&
    projectedRank < currentRank;

  return (
    <section
      aria-labelledby="growth-momentum-h"
      className="overflow-hidden rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
    >
      <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
            <Flame className="size-3.5" aria-hidden="true" />
            Your growth
          </div>
          <h2 id="growth-momentum-h" className="mt-1 font-display text-2xl leading-tight">
            {skillsGrown > 0
              ? `${skillsGrown} skill${skillsGrown === 1 ? "" : "s"} grown on Sebenza`
              : "Start a skill to begin your climb"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-[color:var(--color-paper)]/70">
            {inProgress > 0
              ? `${inProgress} in progress. Every checkpoint you log moves you up the pool.`
              : skillsGrown > 0
                ? "Pick another skill below to keep climbing."
                : "Accept a recommendation below, log your progress, and watch your rank rise."}
          </p>
        </div>

        {/* The climb  current → projected rank */}
        {typeof currentRank === "number" ? (
          <div className="flex shrink-0 items-end gap-4 rounded-[var(--radius-md)] bg-[color:var(--color-paper)]/[0.06] p-4">
            <div className="text-center">
              <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-paper)]/60">
                Now
              </div>
              <div className="font-display tabular text-3xl leading-none">#{currentRank}</div>
              {typeof poolTotal === "number" && (
                <div className="mt-0.5 text-[0.55rem] text-[color:var(--color-paper)]/50">
                  of {poolTotal}
                </div>
              )}
            </div>
            {climbs && (
              <>
                <TrendingUp
                  className="mb-2 size-5 text-[color:var(--color-accent)]"
                  aria-hidden="true"
                />
                <div className="text-center">
                  <div className="text-[0.55rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
                    Finish active
                  </div>
                  <div className="font-display tabular text-4xl leading-none text-[color:var(--color-accent)]">
                    #{projectedRank}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="shrink-0 rounded-[var(--radius-md)] bg-[color:var(--color-paper)]/[0.06] p-4 text-sm text-[color:var(--color-paper)]/70">
            <Sparkles className="mb-1 size-4 text-[color:var(--color-accent)]" aria-hidden="true" />
            Confirm your status to enter the pool, then climb it.
          </div>
        )}
      </div>
      {poolLabel && typeof currentRank === "number" && (
        <p className="border-t border-[color:var(--color-paper)]/10 px-6 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-[color:var(--color-paper)]/50 md:px-8">
          {poolLabel} pool
        </p>
      )}
    </section>
  );
}
