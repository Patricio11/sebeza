/**
 * Phase 9.12  "My Learning" section on the Career Compass.
 *
 * Server component. Reads `listMyLearningItems()` and splits the rows
 * into Active (accepted + in_progress) and Recent (completed + abandoned,
 * last 5). Empty state is editorial: the seeker hasn't accepted anything
 * yet, so the section explains the loop in one sentence rather than
 * showing an apologetic blank box.
 */

import type { MyLearningRow } from "@/lib/seeker/learning";
import { LearningItemRow } from "./LearningItemRow";
import { Sparkles } from "lucide-react";

interface Props {
  items: MyLearningRow[];
}

export function MyLearningSection({ items }: Props) {
  const active = items.filter(
    (i) => i.state === "accepted" || i.state === "in_progress",
  );
  const recent = items
    .filter((i) => i.state === "completed" || i.state === "abandoned")
    .slice(0, 5);

  return (
    <section aria-labelledby="my-learning-h" className="mt-12">
      <header className="mb-5 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
        <h2 id="my-learning-h" className="font-display text-2xl">
          My learning
        </h2>
        <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
          Self-paced  external providers
        </span>
      </header>

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
          <div className="flex items-start gap-3">
            <Sparkles
              className="mt-0.5 size-5 text-[color:var(--color-accent)]"
              aria-hidden="true"
            />
            <div>
              <p className="font-display text-base text-[color:var(--color-ink)]">
                Nothing on your learning list yet.
              </p>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
                Tap{" "}
                <span className="font-medium text-[color:var(--color-ink)]">
                  Learn [skill]
                </span>{" "}
                on any recommendation below to start tracking your progress. A
                completed skill lands on your profile as{" "}
                <em>self-attested  via learning</em>, and your projected rank
                in the local pool shifts when you do.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Active  {active.length}
              </h3>
              <ul className="flex flex-col gap-3">
                {active.map((it) => (
                  <LearningItemRow key={it.id} item={it} />
                ))}
              </ul>
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Recent  {recent.length}
              </h3>
              <ul className="flex flex-col gap-3">
                {recent.map((it) => (
                  <LearningItemRow key={it.id} item={it} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
