"use client";

import { Printer } from "lucide-react";

/**
 * Phase 15.2  one-tap print/save for the CV builder.
 *
 * The only client island on the CV route. `window.print()` opens the
 * browser's native print sheet  the seeker chooses "Save as PDF". No
 * server-side PDF dependency (D2 in PHASE_15_PLAN.md): lightest path for
 * a low-data audience, browser-native output. Carries the `no-print`
 * class so it never appears in the printed document.
 */
export function CvPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-5 py-2 text-sm font-medium text-[color:var(--color-paper)] transition-colors hover:bg-transparent hover:text-[color:var(--color-ink)]"
    >
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
