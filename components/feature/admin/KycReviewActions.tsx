"use client";

/**
 * Phase 9.16  inline review actions for the "Seeker IDs" admin tab.
 *
 * Each pending row gets three buttons:
 *   - Approve         → stamps appUser.kycVerifiedAt + clears any prior
 *                       rejection reason; no prompt.
 *   - Request changes → prompts for a 10-500 char note; clears the
 *                       storage key so the seeker re-uploads.
 *   - Reject          → prompts for a 10-500 char reason; keeps the
 *                       storage key so the admin can re-review without
 *                       forcing the seeker to re-upload first.
 *
 * No modal  the org-vetting one is overkill here because there's a
 * single document, the signed-URL is already on the row, and the
 * actions are short. We use the native `prompt()` for reason capture
 * (yes, dated, but lightweight; Phase 12 swaps for a proper sheet
 * if/when admin teams scale).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareWarning, XCircle } from "lucide-react";
import {
  approveSeekerId,
  rejectSeekerId,
  requestChangesOnSeekerId,
} from "@/lib/admin/kyc-review";

interface Props {
  profileId: string;
  /** Whether the queue card is in the "rejected / verified" history list.
   *  Hides the destructive actions there (no point re-rejecting a
   *  rejected submission; the seeker has to re-upload first). */
  readOnly?: boolean;
}

export function KycReviewActions({ profileId, readOnly }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (readOnly) return null;

  // `revalidatePath` in the action refreshes the queue; `router.refresh()`
  // also redraws whatever surface invoked it (e.g. the user-detail page),
  // so the new verification state shows immediately everywhere.
  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveSeekerId({ profileId });
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  function requestChanges() {
    const note = window.prompt(
      "What does the seeker need to fix? (10500 chars). Will be sent to them as a notification.",
    );
    if (!note) return;
    setError(null);
    startTransition(async () => {
      const res = await requestChangesOnSeekerId({ profileId, note });
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  function reject() {
    const reason = window.prompt(
      "Why are you rejecting this document? (10500 chars). Will be sent to the seeker.",
    );
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await rejectSeekerId({ profileId, reason });
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand)] px-3 py-1 text-xs font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Approve
      </button>
      <button
        type="button"
        onClick={requestChanges}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-paper)] px-3 py-1 text-xs text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-tint)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MessageSquareWarning className="size-3.5" aria-hidden="true" />
        Request changes
      </button>
      <button
        type="button"
        onClick={reject}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] bg-[color:var(--color-paper)] px-3 py-1 text-xs text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <XCircle className="size-3.5" aria-hidden="true" />
        Reject
      </button>
      {error && (
        <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
      )}
    </div>
  );
}
