"use client";

/**
 * Phase 8 — KYC panel on /dashboard/profile.
 *
 * Three states:
 *   - No ID on file → CTA to the National-ID section, no submit button.
 *   - ID on file, not verified → "Submit for verification" button.
 *     With the real KYC SaaS turned off (default), the mock returns
 *     "pending" and admin manual approval is the path.
 *   - Verified → green confirmation + revoke button.
 */

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldAlert, ShieldOff, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  revokeMyKyc,
  submitMyIdForVerification,
} from "@/lib/kyc/actions";

interface Props {
  hasNationalId: boolean;
  /** ISO when kycVerifiedAt was last set. null = not verified. */
  kycVerifiedAt: string | null;
  /** Master flag — when off, real SaaS not in use; mock returns "pending". */
  realProviderEnabled: boolean;
}

export function KycPanel({ hasNationalId, kycVerifiedAt, realProviderEnabled }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  function submit() {
    setError(null);
    setLastStatus(null);
    startTransition(async () => {
      const res = await submitMyIdForVerification();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setLastStatus(res.status);
    });
  }

  function revoke() {
    if (!window.confirm("Clear your KYC verification? You'll need to re-submit.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await revokeMyKyc();
      if (!res.ok) setError(res.message);
    });
  }

  if (kycVerifiedAt) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Identity verified
        </div>
        <div className="mt-1 font-display text-2xl">Verified</div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Verified {new Date(kycVerifiedAt).toLocaleDateString()}. Employer
          searches now treat your identity as confirmed.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={revoke}
          disabled={pending}
        >
          <RotateCw className="size-3.5" aria-hidden="true" /> Revoke verification
        </Button>
      </div>
    );
  }

  if (!hasNationalId) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <ShieldOff className="size-3.5" aria-hidden="true" />
          ID not on file
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Add your national ID first (the section below). Once captured + encrypted,
          you can submit it here for verification.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-5">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        Identity not verified
      </div>
      <div className="mt-1 font-display text-2xl">Submit for verification</div>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
        {realProviderEnabled
          ? "We'll send your ID details to our SA-registered KYC partner. Most checks complete in under a minute."
          : "The KYC partner integration is not yet live. We'll record your submission; a Sebenza administrator will verify it from out-of-band evidence."}
      </p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="mt-4"
        onClick={submit}
        disabled={pending}
      >
        {pending ? "Submitting…" : "Submit for verification"}
      </Button>
      {lastStatus && (
        <p className="mt-3 text-xs text-[color:var(--color-brand-strong)]">
          Submission returned: <code>{lastStatus}</code>
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs text-[color:var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
