"use client";

/**
 * KYC panel on /dashboard/profile.
 *
 * Phase 8 launched this with two paths  one button submitMyIdForVerification()
 * for the dormant KYC-SaaS partnership; one revoke button for self-clearing.
 *
 * Phase 9.16 broadens it into a 4-state lifecycle because the partnership
 * never landed and the seeker still needs to be KYC-verifiable. The new
 * path is admin-mediated: the seeker uploads a document, an admin reviews
 * it from /admin/verifications, and stamps appUser.kycVerifiedAt on
 * approval.
 *
 * States (precedence top → bottom):
 *   1. Verified              kycVerifiedAt is set
 *   2. No ID on file         hasNationalId === false  upstream
 *   3. Rejected              idDocumentRejectionReason is set
 *   4. Pending review        hasIdDocument === true, no kyc stamp, no reason
 *   5. Needs upload          hasIdDocument === false (the new default)
 */

import { useRef, useState, useTransition } from "react";
import {
  Clock,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  revokeMyKyc,
  uploadIdDocument,
} from "@/lib/kyc/actions";

interface Props {
  hasNationalId: boolean;
  /** ISO when kycVerifiedAt was last set. null = not verified. */
  kycVerifiedAt: string | null;
  /** Master flag  when off, real SaaS not in use; admin-mediated path. */
  realProviderEnabled: boolean;
  /** Phase 9.16  whether the seeker has attached an ID document. */
  hasIdDocument: boolean;
  /** Phase 9.16  ISO when the latest document was uploaded. */
  idDocumentUploadedAt: string | null;
  /** Phase 9.16  admin's rejection note (if any). */
  idDocumentRejectionReason: string | null;
  /** Phase 9.16  "sa_id" or "passport". Used in copy. */
  idDocumentKind: "sa_id" | "passport";
}

export function KycPanel({
  hasNationalId,
  kycVerifiedAt,
  realProviderEnabled,
  hasIdDocument,
  idDocumentUploadedAt,
  idDocumentRejectionReason,
  idDocumentKind,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const docLabel = idDocumentKind === "passport" ? "passport bio page" : "SA ID document";

  function onPickFile() {
    setError(null);
    setJustUploaded(false);
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      const res = await uploadIdDocument(form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setJustUploaded(true);
      if (fileRef.current) fileRef.current.value = "";
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

  // ── 1. Verified ─────────────────────────────────────────────────────
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

  // ── 2. No ID on file ────────────────────────────────────────────────
  if (!hasNationalId) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <ShieldOff className="size-3.5" aria-hidden="true" />
          ID not on file
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Add your national ID first (the section below). Once captured + encrypted,
          you can upload a copy of your {docLabel} here for verification.
        </p>
      </div>
    );
  }

  // ── 3. Rejected ─────────────────────────────────────────────────────
  if (idDocumentRejectionReason) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-danger)]">
          <ShieldAlert className="size-3.5" aria-hidden="true" />
          Document rejected
        </div>
        <div className="mt-1 font-display text-2xl">Please re-upload</div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Our reviewer left this note:
        </p>
        <blockquote className="mt-2 border-l-2 border-[color:var(--color-danger)] bg-[color:var(--color-paper)] px-3 py-2 text-sm italic text-[color:var(--color-ink)]">
          {idDocumentRejectionReason}
        </blockquote>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={onPickFile}
          disabled={pending}
        >
          <Upload className="size-3.5" aria-hidden="true" />
          {pending ? "Uploading…" : "Upload new copy"}
        </Button>
        {error && (
          <p className="mt-3 text-xs text-[color:var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }

  // ── 4. Pending review ───────────────────────────────────────────────
  if (hasIdDocument) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-5">
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
          <Clock className="size-3.5" aria-hidden="true" />
          Pending review
        </div>
        <div className="mt-1 font-display text-2xl">Submitted</div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          {idDocumentUploadedAt
            ? `Uploaded ${new Date(idDocumentUploadedAt).toLocaleDateString()}. `
            : ""}
          A Sebenza administrator will review your {docLabel} and notify you
          here once it's approved. You'll usually hear back within a working day.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onPickFile}
          disabled={pending}
        >
          <Upload className="size-3.5" aria-hidden="true" />
          {pending ? "Uploading…" : "Replace the document"}
        </Button>
        {justUploaded && (
          <p className="mt-3 text-xs text-[color:var(--color-brand-strong)]">
            New copy received. Reviewer notified.
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs text-[color:var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }

  // ── 5. Needs upload (default) ───────────────────────────────────────
  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-5">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        Identity not verified
      </div>
      <div className="mt-1 font-display text-2xl">Upload your {docLabel}</div>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
        {realProviderEnabled
          ? "We'll send your ID details to our SA-registered KYC partner. Most checks complete in under a minute."
          : `Attach a clear scan or photo of your ${docLabel}. A Sebenza administrator will review it (usually within one working day) and stamp your account as KYC-verified. PDF, JPG, or PNG  up to 10MB.`}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="mt-4"
        onClick={onPickFile}
        disabled={pending}
      >
        <Upload className="size-3.5" aria-hidden="true" />
        {pending ? "Uploading…" : "Choose file"}
      </Button>
      {error && (
        <p className="mt-3 text-xs text-[color:var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
