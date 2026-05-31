"use client";

/**
 * Phase 11.5.3  mobile jump-to-section nav on the profile editor.
 *
 * Hidden on `md+` where the sticky sidebar already serves the same
 * purpose. On phones, renders a small sticky picker at the top of the
 * editor; tap to expand into a bottom-sheet listing the seven (or
 * eight, when academic exists) sections. Tap a section → smooth scroll
 * to the anchor via CSS `scroll-margin-top` already declared on each
 * `<section>`.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

interface SectionRef {
  anchor: string;
  label: string;
}

const BASE_SECTIONS: SectionRef[] = [
  { anchor: "#avatar", label: "Photo" },
  { anchor: "#identity", label: "Identity basics" },
  { anchor: "#location", label: "Location" },
  { anchor: "#professional", label: "Professional summary" },
  { anchor: "#skills", label: "Skills" },
  { anchor: "#national-id", label: "National ID" },
];

const TRAILING_SECTIONS: SectionRef[] = [
  { anchor: "#open-to", label: "Open to" },
  { anchor: "#cv-backup", label: "CV backup" },
];

interface Props {
  hasAcademic: boolean;
}

export function MobileSectionJumpNav({ hasAcademic }: Props) {
  const [open, setOpen] = useState(false);

  const sections: SectionRef[] = [
    ...BASE_SECTIONS,
    ...(hasAcademic
      ? [{ anchor: "#academic", label: "Studies" } as SectionRef]
      : []),
    ...TRAILING_SECTIONS,
  ];

  return (
    <>
      <div className="sticky top-16 z-10 -mt-2 mb-2 flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2 text-sm shadow-sm md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center justify-between gap-2 text-left text-[color:var(--color-ink)]"
        >
          <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Jump to section
          </span>
          <ChevronDown
            className="size-4 text-[color:var(--color-ink-soft)]"
            aria-hidden="true"
          />
        </button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jump to section"
          className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
            <header className="flex items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] p-4">
              <h2 className="font-display text-lg text-[color:var(--color-ink)]">
                Jump to section
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <ul className="max-h-[60vh] divide-y divide-[color:var(--color-hairline)] overflow-y-auto">
              {sections.map((s) => (
                <li key={s.anchor}>
                  <a
                    href={s.anchor}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-[color:var(--color-ink)]"
                  >
                    {s.label}
                    <ChevronUp
                      className="size-3 -rotate-90 text-[color:var(--color-ink-soft)]"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
