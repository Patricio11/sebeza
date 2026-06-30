"use client";

/**
 * Phase 9.12  Single My Learning row + its state-transition controls.
 *
 * Renders one `learning_items` row, with the action set determined by
 * `state`:
 *
 *   accepted    → Start · Give up
 *   in_progress → Mark complete · Give up
 *   completed   → (read-only badge + the rank-delta toast lives in the
 *                  celebration notification, not here)
 *   abandoned   → (read-only badge + reason chip)
 *
 * The Give-up control opens `<AbandonModal>` (shipped in 9.12.5). For
 * the 9.12.3 ship we render a temporary inline confirm so the loop is
 * functional end-to-end  the modal swap in 9.12.5 is purely a UX
 * upgrade, not a behaviour change.
 *
 * Mobile-first: actions stack on phones; rank-delta + state chip stay
 * inline on `md+`.
 */

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import {
  startLearningItem,
  completeLearningItem,
  setLearningProgress,
  promoteInterestedToPlanned,
  type MyLearningRow,
} from "@/lib/seeker/learning";
import { AbandonModal } from "./AbandonModal";
import { CompleteSkillModal } from "./CompleteSkillModal";
import {
  ABANDON_REASON_LABEL,
  type AbandonReasonValue,
} from "@/lib/seeker/learning-types";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface Props {
  item: MyLearningRow;
  /** Phase 17 ("The Climb"): when on, render progress checkpoints + the
   *  self-assessment completion modal + rank payoff. Off = today's behaviour. */
  skillJourney?: boolean;
  /** Rank-payoff context for the completion modal (only used when skillJourney). */
  poolLabel?: string | null;
  currentRank?: number | null;
  projectedRank?: number | null;
}

const CHECKPOINTS = [25, 50, 75] as const;

export function LearningItemRow({
  item,
  skillJourney,
  poolLabel,
  currentRank,
  projectedRank,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  function onStart() {
    startTransition(async () => {
      setError(null);
      const res = await startLearningItem(item.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onProgress(pct: number) {
    startTransition(async () => {
      setError(null);
      const res = await setLearningProgress(item.id, pct);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  // Direct completion (flag OFF). With the flag ON, "Mark complete" opens the
  // self-assessment modal instead, which calls completeLearningItem itself.
  function onComplete() {
    startTransition(async () => {
      setError(null);
      const res = await completeLearningItem(item.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onPromote() {
    startTransition(async () => {
      setError(null);
      const res = await promoteInterestedToPlanned(item.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StateChip state={item.state} />
            <h4 className="font-display text-base text-[color:var(--color-ink)]">
              {item.skillLabel}
            </h4>
            {item.isFree && (
              <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                Free
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {item.title}{" "}
            <span className="text-[color:var(--color-ink-soft)]">  {item.provider}</span>
          </p>
          {item.resourceUrl && (
            <a
              href={item.resourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Open course
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}

          {/* Phase 17 — self-paced progress checkpoints (the climb). */}
          {skillJourney && item.state === "in_progress" && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                <span>Your progress</span>
                <span className="font-display tabular text-[color:var(--color-ink)]">
                  {item.progressPercent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={item.progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.skillLabel} progress`}
                className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
              >
                <div
                  className="h-full rounded-full bg-[color:var(--color-brand)] transition-[width]"
                  style={{ width: `${item.progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  Log:
                </span>
                {CHECKPOINTS.map((pct) => {
                  const reached = item.progressPercent >= pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      disabled={pending}
                      aria-pressed={reached}
                      onClick={() => onProgress(pct)}
                      className={
                        "min-h-8 rounded-[var(--radius-pill)] border px-3 text-xs transition-colors disabled:opacity-60 " +
                        (reached
                          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                          : "border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]")
                      }
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {item.state === "abandoned" && item.abandonReason && (
            <p className="mt-2 text-[0.7rem] italic text-[color:var(--color-ink-soft)]">
              Reason: {ABANDON_REASON_LABEL[item.abandonReason]}
            </p>
          )}
          {/* Phase 11.2.3  completion -> verified-cert upload bridge.
              Per D3 the cert verification stands on its own; we don't
              link the resulting qualification row back to this
              learning_item. */}
          {item.state === "completed" && (
            <p className="mt-2 text-[0.7rem]">
              <Link
                href={
                  `/dashboard/qualifications?prefillTitle=${encodeURIComponent(item.skillLabel)}&prefillInstitution=${encodeURIComponent(item.provider)}` as never
                }
                className="inline-flex items-center gap-1 text-[color:var(--color-brand-strong)] hover:underline"
              >
                <ShieldCheck className="size-3" aria-hidden="true" />
                Got a certificate? Upload it for the verified badge
              </Link>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {item.state === "interested" && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={onPromote}
              >
                <Play className="mr-1 size-3.5" aria-hidden="true" />
                {pending ? "Saving" : "Move to active"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setAbandonOpen(true)}
              >
                Remove
              </Button>
            </>
          )}
          {item.state === "accepted" && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={onStart}
              >
                <Play className="mr-1 size-3.5" aria-hidden="true" />
                {pending ? "Saving" : "Start"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setAbandonOpen(true)}
              >
                Give up
              </Button>
            </>
          )}
          {item.state === "in_progress" && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  skillJourney ? setCompleteOpen(true) : onComplete()
                }
              >
                <Sparkles className="mr-1 size-3.5" aria-hidden="true" />
                {pending ? "Saving" : "Mark complete"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setAbandonOpen(true)}
              >
                Give up
              </Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
      {abandonOpen && (
        <AbandonModal
          itemId={item.id}
          skillLabel={item.skillLabel}
          onClose={() => setAbandonOpen(false)}
          onDone={() => {
            setAbandonOpen(false);
            router.refresh();
          }}
        />
      )}
      {completeOpen && (
        <CompleteSkillModal
          itemId={item.id}
          skillLabel={item.skillLabel}
          poolLabel={poolLabel}
          currentRank={currentRank}
          projectedRank={projectedRank}
          onClose={() => setCompleteOpen(false)}
          onDone={() => {
            setCompleteOpen(false);
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

function StateChip({ state }: { state: MyLearningRow["state"] }) {
  if (state === "interested") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        <CircleDashed className="size-3" aria-hidden="true" />
        Saved for later
      </span>
    );
  }
  if (state === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        <CircleDashed className="size-3" aria-hidden="true" />
        Accepted
      </span>
    );
  }
  if (state === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
        <Play className="size-3" aria-hidden="true" />
        In progress
      </span>
    );
  }
  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
        <CheckCircle2 className="size-3" aria-hidden="true" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
      Abandoned
    </span>
  );
}
