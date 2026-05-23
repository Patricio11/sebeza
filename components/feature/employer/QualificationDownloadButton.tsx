"use client";

/**
 * Per-row download button for a qualification's underlying document.
 *
 * Calls `downloadQualification` which (a) re-checks document_sharing
 * consent, (b) mints a 60-second signed URL, (c) audit-logs the access.
 * The client then `window.open()`s the URL  the file streams directly
 * from Supabase Storage; we never proxy the bytes through Sebenza.
 */

import { useState, useTransition } from "react";
import { FileDown, Lock, Loader2 } from "lucide-react";
import { downloadQualification } from "@/lib/employer/reveal";

interface Props {
  qualificationId: string;
  hasDocument: boolean;
  documentSharingGranted: boolean;
}

export function QualificationDownloadButton({
  qualificationId,
  hasDocument,
  documentSharingGranted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!hasDocument) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        No file
      </span>
    );
  }

  if (!documentSharingGranted) {
    return (
      <span
        title="Seeker hasn't granted document-sharing consent."
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
      >
        <Lock className="size-3" aria-hidden="true" />
        Withheld
      </span>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const r = await downloadQualification({ qualificationId });
      if (r.ok) {
        window.open(r.url, "_blank", "noopener,noreferrer");
      } else {
        setError(r.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-brand-strong)] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <FileDown className="size-3.5" aria-hidden="true" />
        )}
        {pending ? "Preparing…" : "Download"}
      </button>
      {error && (
        <span className="text-[0.62rem] text-[color:var(--color-danger)]">
          {error}
        </span>
      )}
    </div>
  );
}
