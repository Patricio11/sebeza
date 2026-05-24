"use client";

/**
 * Phase 9.8.4  Invitations panel on the vacancy detail page.
 *
 * Renders the per-vacancy pipeline grouped by state, with a withdraw
 * button on any invitation still in the `invited` state (Owner /
 * Recruiter only). Read-only for Viewers.
 *
 * Mobile-first: one row per invitee on phones, two-column meta on
 * `md+`. State pills use the same tone vocabulary as
 * `VacancyStatusChip`.
 */

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import type { InvitationRow, InvitationState } from "@/lib/employer/invitations";
import { CheckCircle2, Clock, MinusCircle, Send, X, XCircle } from "lucide-react";

interface Props {
  invitations: InvitationRow[];
  canEdit: boolean;
  locale: string;
  withdrawAction: (
    invitationId: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
}

const STATE_LABEL: Record<InvitationState, string> = {
  invited: "Invited",
  accepted: "Accepted",
  accepted_with_notice: "Accepted (with notice)",
  declined: "Declined",
  reconsidering: "Reconsidering",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const STATE_TONE: Record<
  InvitationState,
  "brand" | "accent" | "muted" | "neutral" | "danger"
> = {
  invited: "brand",
  accepted: "accent",
  accepted_with_notice: "accent",
  declined: "danger",
  reconsidering: "brand",
  withdrawn: "muted",
  expired: "muted",
};

const TONE_CLASS: Record<
  "brand" | "accent" | "muted" | "neutral" | "danger",
  string
> = {
  brand:
    "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
  accent:
    "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]",
  muted:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]",
  neutral:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)]",
  danger:
    "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
};

const STATE_ICON: Record<InvitationState, typeof CheckCircle2> = {
  invited: Send,
  accepted: CheckCircle2,
  accepted_with_notice: CheckCircle2,
  declined: XCircle,
  reconsidering: Clock,
  withdrawn: MinusCircle,
  expired: Clock,
};

export function VacancyInvitationsPanel({
  invitations,
  canEdit,
  locale,
  withdrawAction,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dfmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Group by state, preserving the natural order from STATE_LABEL keys
  // (invited first, then accepted-flavours, then terminal states).
  const grouped = new Map<InvitationState, InvitationRow[]>();
  for (const inv of invitations) {
    const arr = grouped.get(inv.state) ?? [];
    arr.push(inv);
    grouped.set(inv.state, arr);
  }

  function onWithdraw(invitationId: string) {
    setError(null);
    setPendingId(invitationId);
    startTransition(async () => {
      const res = await withdrawAction(invitationId);
      setPendingId(null);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="invitations-h"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <h2
          id="invitations-h"
          className="font-display text-xl text-[color:var(--color-ink)]"
        >
          Pipeline · {invitations.length} invitation{invitations.length === 1 ? "" : "s"}
        </h2>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          Counts the people you&rsquo;ve invited to this vacancy. The seeker
          accept / decline / decline-with-reason flow lands in Phase 9.8.5.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      )}

      <ul className="divide-y divide-[color:var(--color-hairline)]">
        {invitations.map((inv) => {
          const Icon = STATE_ICON[inv.state];
          const tone = TONE_CLASS[STATE_TONE[inv.state]];
          const canWithdraw = canEdit && inv.state === "invited";
          return (
            <li
              key={inv.id}
              className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/employer/dossier/${inv.handle}` as never}
                    className="font-display text-base text-[color:var(--color-ink)] hover:underline"
                  >
                    {inv.displayName}
                  </Link>
                  <span
                    className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] ${tone}`}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                    {STATE_LABEL[inv.state]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  Invited {dfmt.format(new Date(inv.invitedAt))}
                  {inv.expiresAt &&
                    inv.state === "invited" &&
                    `  responds-by ${dfmt.format(new Date(inv.expiresAt))}`}
                  {inv.respondedAt &&
                    inv.state !== "invited" &&
                    `  responded ${dfmt.format(new Date(inv.respondedAt))}`}
                  {inv.noticePeriodMonths != null && (
                    <>  notice: {inv.noticePeriodMonths} month{inv.noticePeriodMonths === 1 ? "" : "s"}</>
                  )}
                </p>
                {inv.declineNote && (
                  <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                    <em>
                      &ldquo;{inv.declineNote}&rdquo;
                    </em>{" "}
                    <span className="text-[0.65rem] uppercase tracking-[0.18em]">
                      seeker-authored · treat as PII
                    </span>
                  </p>
                )}
              </div>
              {canWithdraw && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onWithdraw(inv.id)}
                  disabled={pendingId === inv.id}
                >
                  <X className="size-4" aria-hidden="true" />
                  {pendingId === inv.id ? "Withdrawing" : "Withdraw"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
