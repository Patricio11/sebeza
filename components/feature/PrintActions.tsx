"use client";

/**
 * The one control on the PDF briefing. Hidden when printing. With `auto`
 * (the live page links to /insights/print?auto=1) the print dialog opens
 * as soon as the fonts have loaded, so "Download PDF briefing" is one tap.
 */

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintActions({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const go = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // fonts API unavailable: print anyway
      }
      if (!cancelled) window.print();
    };
    const t = setTimeout(go, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [auto]);

  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-dashed border-[#14110d] bg-[#faf7f0] px-4 py-3 text-sm text-[#14110d]">
      <span>
        This is the PDF briefing. Choose <strong>Save as PDF</strong> as the
        destination in the print dialog.
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#14110d] px-4 text-sm font-medium text-[#fbf8f0]"
      >
        <Printer className="size-4" aria-hidden="true" />
        Save as PDF
      </button>
    </div>
  );
}
