/**
 * Phase 11.2.5  the seeker's skill journey, chronologically.
 *
 * Read-only timeline of completed learning items, newest first. Each
 * row carries the skill label, the completion date, the provenance
 * chip (today: always `self_attested_learning`  the upload bridge in
 * 11.2.3 can flip individual rows to `verified_provider` after admin
 * review). Empty journeys render nothing  the page's other sections
 * fill the space; an apologetic empty state would be the wrong tone.
 *
 * Composes over the rows already loaded by `listMyLearningItems()`
 * (the dashboard/grow page calls this). No new query.
 */

import type { MyLearningRow } from "@/lib/seeker/learning";
import { CheckCircle2, ShieldCheck } from "lucide-react";

interface Props {
  items: MyLearningRow[];
  locale: string;
}

export function SkillJourneyTimeline({ items, locale }: Props) {
  const completed = items
    .filter((i) => i.state === "completed" && i.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  if (completed.length === 0) return null;

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section
      aria-labelledby="journey-h"
      className="mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-6"
    >
      <header className="mb-4 flex items-center gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <CheckCircle2
          className="size-4 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <h3 id="journey-h" className="font-display text-lg">
          Your skill journey
        </h3>
      </header>
      <ol className="divide-y divide-[color:var(--color-hairline)]">
        {completed.map((it) => {
          const when = it.completedAt ? fmt.format(new Date(it.completedAt)) : "";
          return (
            <li
              key={it.id}
              className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base text-[color:var(--color-ink)]">
                    {it.skillLabel}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
                    title="Skill added to your profile from this completion. Upload the certificate to upgrade to Verified."
                  >
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    Self-attested · via learning
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                  {it.title}  {it.provider}
                </div>
              </div>
              <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                {when}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
