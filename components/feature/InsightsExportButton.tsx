"use client";

/**
 * Insights CSV export button.
 *
 * Calls `exportInsightsCsv` (Server Action), receives the CSV payload,
 * and triggers a download via a Blob URL. The Server Action writes the
 * `analytics.export` audit row server-side regardless of whether the
 * client save succeeds.
 */

import { useState, useTransition } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { exportInsightsCsv } from "@/lib/analytics/export";

interface Props {
  label: string;
}

export function InsightsExportButton({ label }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await exportInsightsCsv();
        if (!r.ok) {
          setError(r.message);
          return;
        }
        // Trigger download.
        const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = r.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {pending ? "Preparing CSV…" : label}
      </button>
      {error && (
        <p className="inline-flex items-center gap-2 text-xs text-[color:var(--color-danger)]">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
