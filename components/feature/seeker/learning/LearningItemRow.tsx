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
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import {
  startLearningItem,
  completeLearningItem,
  type MyLearningRow,
} from "@/lib/seeker/learning";
import { AbandonModal } from "./AbandonModal";
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
  Sparkles,
} from "lucide-react";

interface Props {
  item: MyLearningRow;
}

export function LearningItemRow({ item }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);

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
          {item.state === "abandoned" && item.abandonReason && (
            <p className="mt-2 text-[0.7rem] italic text-[color:var(--color-ink-soft)]">
              Reason: {ABANDON_REASON_LABEL[item.abandonReason]}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                onClick={onComplete}
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
    </li>
  );
}

function StateChip({ state }: { state: MyLearningRow["state"] }) {
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
