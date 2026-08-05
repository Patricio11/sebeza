"use client";

/**
 * Phase 34 - BrandDialog: the house modal primitive
 * (docs/PHASE_34_SELF_APPLY_PLAN.md §34.4).
 *
 * Until now every dialog was hand-rolled (23 near-copies of the same
 * overlay). This extracts the best of them (InviteFromSearchButton +
 * SearchInviteSelection's focus handling) into ONE primitive so every
 * future modal inherits the Civic-Editorial look and the a11y wiring:
 *
 * - bottom-sheet on mobile → centred card on md+ (360px-first)
 * - paper/surface chrome, all-caps tracked eyebrow, Fraunces title,
 *     hairline rules - never a generic popup
 * - focus moves into the dialog on open and back to the previously
 *     focused element on close; Tab is trapped inside
 * - Escape + backdrop-click close, both guarded while `pending`
 * - gentle motion-safe rise animation; none under reduced motion
 *
 * Composition: header (eyebrow + title) is built in; body is
 * `children`; sticky footer actions go in `footer`. Use for every new
 * dialog - and migrate old ones opportunistically.
 */

import { useEffect, useId, useRef } from "react";

export function BrandDialog({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  pending = false,
  maxWidth = "lg",
}: {
  open: boolean;
  /** Called on Escape / backdrop click / your own close buttons. */
  onClose: () => void;
  /** All-caps tracked kicker above the title, e.g. "Apply · Sebenza". */
  eyebrow?: string;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Action row rendered below a hairline; usually pill buttons. */
  footer?: React.ReactNode;
  /** While true, Escape/backdrop-close are ignored (mid-submit). */
  pending?: boolean;
  maxWidth?: "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: capture the opener, move focus in, restore on
  // close/unmount. The rAF defers focus past the mount paint so the
  // rise animation doesn't fight the scroll-into-view.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const widthClass =
    maxWidth === "md" ? "max-w-md" : maxWidth === "xl" ? "max-w-xl" : "max-w-lg";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--color-ink)]/45 p-0 backdrop-blur-[2px] md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onClose();
        trapTab(e);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`w-full ${widthClass} max-h-[88vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] shadow-xl outline-none motion-safe:animate-[brand-dialog-rise_220ms_cubic-bezier(0.22,1,0.36,1)] md:rounded-[var(--radius-lg)]`}
      >
        {/* Signature top rule - the thick editorial line every Sebenza
            surface carries; quietly brands the sheet as ours. */}
        <div
          aria-hidden="true"
          className="h-[3px] w-full rounded-t-[var(--radius-lg)] bg-[color:var(--color-ink)]"
        />
        <div className="p-6">
          <header className="mb-4 border-b border-[color:var(--color-hairline)] pb-3">
            {eyebrow && (
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="mt-0.5 font-display text-2xl leading-snug text-[color:var(--color-ink)]"
            >
              {title}
            </h2>
          </header>

          {children}

          {footer && (
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-hairline)] pt-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
