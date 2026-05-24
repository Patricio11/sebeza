"use client";

/**
 * Phase 9.8.5  Seeker response actions on a single invitation.
 *
 * Renders the action area for one invitation. State-aware:
 *
 *   - state === "invited":           Accept / Accept-with-notice / Decline
 *   - state === "declined":          Express interest again (reconsider)
 *   - state === "accepted":          static "You've accepted" card
 *   - state === "accepted_with_notice": static + notice months
 *   - state === "reconsidering":     static "Re-opened" card
 *   - state === "withdrawn":         static "Withdrawn by employer" card
 *   - state === "expired":           static "Expired" card
 *
 * Mobile-first:
 *   - Decline modal renders as a bottom-sheet on phones (anchored to
 *     the bottom, full-width), centred on `md+`. Esc closes; tap
 *     backdrop closes; one save action; the submit button sticks to
 *     the bottom edge so the on-screen keyboard never hides it.
 *   - Accept-with-notice asks for the notice-period months via a
 *     compact inline form (no separate modal  the input is right
 *     there once you click).
 *
 * Honest, never a quiz: the decline radio group is short, the note
 * is optional unless the user picks "Other," and the POPIA reminder
 * sits right under the input.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

import { Button } from "@/components/ui/Button";
import {
  acceptInvitation,
  acceptInvitationWithNotice,
  declineInvitation,
  reconsiderInvitation,
} from "@/lib/seeker/invitations";
import {
  DECLINE_REASON_LABEL,
  type DeclineReasonValue,
  type InvitationStateSeeker,
} from "@/lib/seeker/invitations-types";
import {
  CheckCircle2,
  Clock,
  MinusCircle,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from "lucide-react";

interface Props {
  invitationId: string;
  state: InvitationStateSeeker;
  orgName: string;
  vacancyTitle: string;
  noticePeriodMonths: number | null;
  declineReason: DeclineReasonValue | null;
  declineNote: string | null;
}

type Mode = "idle" | "notice" | "decline";

export function InvitationResponseIsland({
  invitationId,
  state,
  orgName,
  vacancyTitle,
  noticePeriodMonths,
  declineReason,
  declineNote,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvitation({ invitationId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onReconsider() {
    setError(null);
    startTransition(async () => {
      const res = await reconsiderInvitation({ invitationId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  // ── Terminal / static states ────────────────────────────────────────────────
  if (state === "accepted") {
    return (
      <StaticBanner
        tone="accent"
        icon={CheckCircle2}
        title={`You've accepted "${vacancyTitle}".`}
        body={`${orgName} has been notified. They'll move you through their hiring flow — interview details, contact, and next steps happen outside this page.`}
      />
    );
  }
  if (state === "accepted_with_notice") {
    const months = noticePeriodMonths ?? 0;
    return (
      <StaticBanner
        tone="accent"
        icon={CheckCircle2}
        title={`You've accepted with a ${months}-month notice.`}
        body={`${orgName} knows you need to serve out your notice before starting. They'll plan interviews accordingly.`}
      />
    );
  }
  if (state === "declined") {
    return (
      <div className="space-y-4">
        <StaticBanner
          tone="muted"
          icon={ThumbsDown}
          title={`You declined "${vacancyTitle}".`}
          body={
            declineReason
              ? `Reason recorded: ${DECLINE_REASON_LABEL[declineReason]}.`
              : "Declined without a stored reason."
          }
        />
        {declineNote && (
          <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-xs text-[color:var(--color-ink-soft)]">
            Note you added: <em>&ldquo;{declineNote}&rdquo;</em>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
          <div className="flex-1">
            <p className="font-display text-base text-[color:var(--color-ink)]">
              Changed your mind?
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              Re-open the conversation. {orgName} will see you&rsquo;d like
              to reconsider  if the role is still open, they can pick
              the thread back up.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onReconsider}
            disabled={pending}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {pending ? "Sending" : "Express interest again"}
          </Button>
        </div>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }
  if (state === "reconsidering") {
    return (
      <StaticBanner
        tone="brand"
        icon={RefreshCw}
        title="You've re-opened this invitation."
        body={`${orgName} has been notified. They'll decide whether to pick the conversation back up; you'll hear from them through the dossier flow.`}
      />
    );
  }
  if (state === "withdrawn") {
    return (
      <StaticBanner
        tone="muted"
        icon={MinusCircle}
        title={`${orgName} withdrew this invitation.`}
        body="No action required from you. The role may have been filled or paused; the invitation is no longer open."
      />
    );
  }
  if (state === "expired") {
    return (
      <StaticBanner
        tone="muted"
        icon={Clock}
        title="This invitation expired without a response."
        body={`${orgName}'s response window has passed. The role may have been filled; no action required.`}
      />
    );
  }

  // ── Active state (state === "invited") ─────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-brand-tint)] p-4">
        <div className="flex-1 min-w-0">
          <p className="font-display text-base text-[color:var(--color-ink)]">
            Respond to this invitation
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            Accept now if you&rsquo;re available. Accept with notice if you
            need time to wrap up your current role. Decline (with or
            without a reason)  declining is free and never affects your
            visibility in search.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onAccept}
          disabled={pending}
        >
          <ThumbsUp className="size-4" aria-hidden="true" />
          Accept
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => {
            setError(null);
            setMode("notice");
          }}
          disabled={pending}
        >
          <Clock className="size-4" aria-hidden="true" />
          Accept with notice
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => {
            setError(null);
            setMode("decline");
          }}
          disabled={pending}
        >
          <ThumbsDown className="size-4" aria-hidden="true" />
          Decline
        </Button>
      </div>

      {mode === "notice" && (
        <NoticeForm
          invitationId={invitationId}
          onDone={() => router.refresh()}
          onCancel={() => setMode("idle")}
        />
      )}

      {mode === "decline" && (
        <DeclineModal
          invitationId={invitationId}
          onDone={() => {
            setMode("idle");
            router.refresh();
          }}
          onCancel={() => setMode("idle")}
        />
      )}

      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Accept-with-notice  inline compact form (not a modal). One input,
// one submit. Stays inline because the choice has already been made
// (the user clicked "Accept with notice")  we just need the months.
// ─────────────────────────────────────────────────────────────────────────────

function NoticeForm({
  invitationId,
  onDone,
  onCancel,
}: {
  invitationId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [months, setMonths] = useState("1");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const num = Number(months);
    if (!Number.isInteger(num) || num < 1 || num > 12) {
      setError("Notice period must be between 1 and 12 months.");
      return;
    }
    startTransition(async () => {
      const res = await acceptInvitationWithNotice({
        invitationId,
        noticePeriodMonths: num,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <p className="font-display text-base text-[color:var(--color-ink)]">
        How much notice do you need to give?
      </p>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
        In months. The employer plans interviews + start date around this.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={12}
          value={months}
          onChange={(e) => setMonths(e.target.value)}
          disabled={pending}
          aria-label="Notice period in months"
          className="h-10 w-24 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 text-sm"
        />
        <span className="text-sm text-[color:var(--color-ink-soft)]">
          month{months === "1" ? "" : "s"}
        </span>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Saving" : "Accept with notice"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decline-reason modal  bottom-sheet on mobile, centred on md+.
// Radio group + conditional note input (renders after a reason is
// picked  not pre-displayed to keep the modal compact). POPIA
// reminder under the note input. 200-char cap displayed live.
// ─────────────────────────────────────────────────────────────────────────────

const REASONS: { value: DeclineReasonValue; label: string }[] = (
  Object.keys(DECLINE_REASON_LABEL) as DeclineReasonValue[]
).map((value) => ({
  value,
  label: DECLINE_REASON_LABEL[value],
}));

function DeclineModal({
  invitationId,
  onDone,
  onCancel,
}: {
  invitationId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<DeclineReasonValue | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const NOTE_CAP = 200;
  const noteRemaining = NOTE_CAP - note.length;
  const noteRequired = reason === "other";

  function submit() {
    setError(null);
    if (!reason) {
      setError("Pick a reason to send the decline.");
      return;
    }
    if (noteRequired && !note.trim()) {
      setError("A short note is required when choosing “Other.”");
      return;
    }
    startTransition(async () => {
      const res = await declineInvitation({
        invitationId,
        reason,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decline-h"
      className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onCancel();
      }}
    >
      <div className="flex w-full max-w-lg flex-col rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] shadow-xl md:rounded-[var(--radius-md)]">
        <div className="flex items-start justify-between gap-3 p-5 md:p-6">
          <div>
            <h3
              id="decline-h"
              className="font-display text-xl text-[color:var(--color-ink)]"
            >
              Decline this invitation?
            </h3>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              Declining is free and never affects your visibility in
              search. Picking a reason helps the platform understand
              why roles go unfilled.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Close"
            className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 md:px-6">
          <fieldset className="space-y-2">
            <legend className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
              Reason (optional, never shared with other seekers)
            </legend>
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 hover:border-[color:var(--color-ink)]"
              >
                <input
                  type="radio"
                  name="decline-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  disabled={pending}
                  className="mt-0.5 size-4"
                />
                <span className="text-sm text-[color:var(--color-ink)]">
                  {r.label}
                </span>
              </label>
            ))}
          </fieldset>

          {reason && (
            <div className="mt-4">
              <label
                htmlFor="decline-note"
                className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
              >
                Short note {noteRequired ? "(required for Other)" : "(optional)"}
              </label>
              <textarea
                id="decline-note"
                name="decline-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_CAP))}
                disabled={pending}
                maxLength={NOTE_CAP}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-2 text-sm"
                placeholder={
                  reason === "other"
                    ? "Tell the employer briefly why."
                    : "Add anything else (optional)."
                }
              />
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                Work-related reasons only  please don&rsquo;t include
                personal info like health, family status, or religion.
              </p>
              <p className="mt-1 text-right text-[0.65rem] text-[color:var(--color-ink-soft)]">
                {noteRemaining} character{noteRemaining === 1 ? "" : "s"} left
              </p>
            </div>
          )}

          {error && <ErrorBanner message={error} />}
        </div>

        {/* Submit bar sticks to bottom so the on-screen keyboard
            doesn't hide it on phones. */}
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4 md:p-5">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Sending" : "Send decline"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────────────────────────────────────

const TONE_CLASS: Record<"accent" | "brand" | "muted", string> = {
  accent:
    "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5",
  brand:
    "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]",
  muted:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]",
};

function StaticBanner({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "accent" | "brand" | "muted";
  icon: typeof CheckCircle2;
  title: string;
  body: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius-md)] border p-4 ${TONE_CLASS[tone]}`}
    >
      <Icon
        className="mt-0.5 size-5 shrink-0 text-[color:var(--color-ink)]"
        aria-hidden="true"
      />
      <div>
        <p className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </p>
        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
          {body}
        </p>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
    >
      <XCircle className="mr-1 inline size-4" aria-hidden="true" />
      {message}
    </div>
  );
}
