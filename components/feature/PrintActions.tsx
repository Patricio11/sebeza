"use client";

import { Printer } from "lucide-react";

export function PrintActions() {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-gray-400 bg-gray-50 px-4 py-3 text-sm">
      <span className="text-gray-700">
        Print-friendly briefing  File → Print → Save as PDF, or one tap:
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
      >
        <Printer className="size-4" aria-hidden="true" />
        Print / save as PDF
      </button>
    </div>
  );
}
