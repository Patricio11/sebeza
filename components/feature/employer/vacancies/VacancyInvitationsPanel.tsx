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
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  DECLINE_REASON_VALUES,
  type DeclineReasonValue,
} from "@/lib/vacancy/decline-reasons";
import type { InvitationRow, InvitationState } from "@/lib/employer/invitations";
import { CheckCircle2, Clock, MinusCircle, Send, X, XCircle } from "lucide-react";

interface Props {
  /** G10  so a dead row can offer "invite someone else". */
  vacancyId: string;
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
  vacancyId,
  invitations,
  canEdit,
  locale,
  withdrawAction,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const t = useTranslations("employerVacancies");
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
          {t("pipeline.heading", { count: invitations.length })}
        </h2>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          {t("pipeline.sub")}
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
          // A seat that came back: nobody replied, they said no, or we
          // pulled it. Either way the useful next step is finding
          // somebody else, and until now the row offered nothing.
          const seatFreed =
            canEdit &&
            (inv.state === "expired" ||
              inv.state === "withdrawn" ||
              inv.state === "declined");
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
                    {t(`pipeline.state.${inv.state}`)}
                  </span>
                  {/* Phase 34  honest provenance: they walked in via
                      the public link, nobody on the team invited them. */}
                  {inv.origin === "self_apply" && (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)]/50 bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                      {t("pipeline.selfApplied")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {inv.origin === "self_apply" ? t("pipeline.applied") : t("pipeline.invited")}{" "}
                  {dfmt.format(new Date(inv.invitedAt))}
                  {inv.expiresAt &&
                    inv.state === "invited" &&
                    ` · ${t("pipeline.respondsBy", { date: dfmt.format(new Date(inv.expiresAt)) })}`}
                  {inv.respondedAt &&
                    inv.state !== "invited" &&
                    // The expiry cron stamps `respondedAt` when it closes
                    // a row, so this timestamp is only a RESPONSE for
                    // states somebody actually chose. Expired means the
                    // window shut; withdrawn was us, not them.
                    (inv.state === "expired"
                      ? ` · ${t("pipeline.expired", { date: dfmt.format(new Date(inv.respondedAt)) })}`
                      : inv.state === "withdrawn"
                        ? ` · ${t("pipeline.withdrawnAt", { date: dfmt.format(new Date(inv.respondedAt)) })}`
                        : ` · ${t("pipeline.responded", { date: dfmt.format(new Date(inv.respondedAt)) })}`)}
                  {inv.noticePeriodMonths != null && (
                    <> · {t("pipeline.notice", { months: inv.noticePeriodMonths })}</>
                  )}
                </p>
                {inv.declineReason && (
                  <p className="mt-1 text-xs text-[color:var(--color-ink)]">
                    <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      {t("pipeline.reason")}
                    </span>{" "}
                    {DECLINE_REASON_VALUES.includes(
                      inv.declineReason as DeclineReasonValue,
                    )
                      ? t(`declineReason.${inv.declineReason as DeclineReasonValue}`)
                      : inv.declineReason}
                  </p>
                )}
                {inv.declineNote && (
                  <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                    <em>
                      &ldquo;{inv.declineNote}&rdquo;
                    </em>{" "}
                    <span className="text-[0.65rem] uppercase tracking-[0.18em]">
                      {t("pipeline.noteWarning")}
                    </span>
                  </p>
                )}
              </div>
              {seatFreed && (
                <Link
                  href={`/employer/vacancies/${vacancyId}/match` as never}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                >
                  {t("pipeline.inviteSomeoneElse")}
                </Link>
              )}
              {canWithdraw && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onWithdraw(inv.id)}
                  disabled={pendingId === inv.id}
                >
                  <X className="size-4" aria-hidden="true" />
                  {pendingId === inv.id ? t("pipeline.withdrawing") : t("pipeline.withdraw")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
