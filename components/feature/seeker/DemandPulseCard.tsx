/**
 * Phase 17 ("Demand Pulse")  the seeker-facing card. Renders only when
 * `getDemandPulse` found a genuine spike (the page gates on both the flag AND
 * a non-null pulse), so there's no empty/quiet state to apologise for. Links
 * into the Career Compass, where the seeker can act on the heat.
 *
 * Server component  pure display over the pulse the page computed.
 */

import { Link } from "@/i18n/navigation";
import { Flame, ArrowUpRight } from "lucide-react";
import type { DemandPulse } from "@/lib/seeker/demand-pulse";

export function DemandPulseCard({ pulse }: { pulse: DemandPulse }) {
  const baseline =
    pulse.priorWeekly <= 0
      ? "a quiet few weeks"
      : `~${pulse.priorWeekly}/week before`;

  return (
    <Link
      href="/dashboard/grow"
      aria-label={`${pulse.label} demand is rising in ${pulse.province}: ${pulse.thisWeek} employer searches this week. Open Career Compass.`}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] p-3 transition-colors hover:bg-[color:var(--color-accent)]/[0.12] md:p-4"
    >
      <div className="flex items-start gap-3">
        <Flame
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            Demand pulse
          </div>
          <p className="text-sm text-[color:var(--color-ink)]">
            <strong>{pulse.label}</strong> is heating up in {pulse.province}
            <span className="text-[color:var(--color-ink-soft)]">
              {" "}
              {pulse.thisWeek} employer search{pulse.thisWeek === 1 ? "" : "es"}{" "}
              this week ({baseline}).
            </span>
          </p>
        </div>
      </div>
      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] px-3 text-xs font-medium text-[color:var(--color-accent)]">
        See where you stand
        <ArrowUpRight className="size-3" aria-hidden="true" />
      </span>
    </Link>
  );
}
