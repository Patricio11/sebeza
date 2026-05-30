"use client";

/**
 * Phase 11.3.2  "Blocked employers" section on `/dashboard/privacy`.
 *
 * Read-only list with a per-row Unblock action. The seeker manages
 * their existing blocks here; new blocks land via the in-context
 * "Block this employer" menu on invitation cards / employer surfaces.
 *
 * D2 invariant: the listed orgs do NOT see this page; the employer
 * has no surface that exposes a per-org block count. Blocks are silent
 * by design.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { unblockEmployer, type BlockedEmployer } from "@/lib/seeker/blocks";
import { Shield, AlertTriangle } from "lucide-react";

interface Props {
  initial: BlockedEmployer[];
  locale: string;
}

export function BlockedEmployersList({ initial, locale }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<BlockedEmployer[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <p className="flex items-start gap-2 text-sm text-[color:var(--color-ink-soft)]">
          <Shield
            className="mt-0.5 size-4 text-[color:var(--color-ink-soft)]"
            aria-hidden="true"
          />
          <span>
            No employers blocked. Block an employer from an invitation card or
            their public profile when you don&rsquo;t want them to find you or
            send you new invites. They are <strong>never</strong> told.
          </span>
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((b) => (
        <li
          key={b.blockId}
          className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-display text-base text-[color:var(--color-ink)]">
                {b.orgName}
              </div>
              <div className="mt-0.5 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Blocked {fmt.format(new Date(b.blockedAt))}
              </div>
              {b.reason && (
                <p className="mt-1 text-xs italic text-[color:var(--color-ink-soft)]">
                  Your note: {b.reason}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await unblockEmployer(b.orgId);
                  if (!res.ok) {
                    setError(res.message);
                    return;
                  }
                  setItems((prev) =>
                    prev.filter((x) => x.blockId !== b.blockId),
                  );
                  router.refresh();
                });
              }}
            >
              Unblock
            </Button>
          </div>
        </li>
      ))}
      {error && (
        <li
          role="alert"
          className="flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </li>
      )}
    </ul>
  );
}
