"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Phase 28  the floating mobile bottom bar + "More" sheet that make the
 * PWA feel native on Android/iOS. Replaces the old scrolling top tab strip
 * on every role dashboard (`md:hidden`  desktop keeps the sidebar).
 *
 * Civic Editorial, not glassmorphism-SaaS: a paper pill with a hairline
 * border and an ink capsule for the active tab (the same ink-on-paper
 * inversion the sidebar uses), plus the tri-colour flag band as the sheet's
 * drag handle. Animations are transform/opacity only with a gentle spring
 * (No-Flash: this is one small client island; the sheet is plain DOM, no
 * portal, no animation library).
 *
 * Icons arrive as ALREADY-RENDERED nodes (`icon: ReactNode`) because the
 * server `DashboardFrame` builds these props  component functions can't
 * cross the server→client boundary, rendered elements can.
 */

export interface BottomNavEntry {
  key: string;
  /** Full label (used in the More sheet + accessible name). */
  label: string;
  /** Short label for the bar tab; falls back to `label`. */
  tabLabel?: string;
  href: string;
  /** Root section (e.g. `/dashboard`) matches exactly; others by prefix. */
  exact?: boolean;
  icon: React.ReactNode;
}

interface Props {
  /** ≤4 promoted tabs shown on the bar itself. */
  tabs: BottomNavEntry[];
  /** Everything else, listed in the More sheet. */
  moreItems: BottomNavEntry[];
  workspaceLabel: string;
  /** Locale switcher + back-to-site + sign-out, rendered into the sheet footer. */
  footer?: React.ReactNode;
}

const SPRING = "cubic-bezier(.34,1.56,.64,1)";
const DRAG_DISMISS_PX = 90;

function isActive(entry: BottomNavEntry, pathname: string): boolean {
  return entry.exact
    ? pathname === entry.href
    : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}

export function MobileBottomNav({ tabs, moreItems, workspaceLabel, footer }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  // `dragging` mirrors dragStart in state because the panel's inline
  // transition style depends on it (refs must not be read during render).
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setDragY(0);
  }, []);

  // Route change (a sheet link was tapped) → the sheet is done.
  useEffect(close, [pathname, close]);

  // Esc closes; body scroll locks while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const moreActive = moreItems.some((i) => isActive(i, pathname));

  // Drag-to-dismiss on the sheet's handle region (native bottom-sheet feel).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setDragging(false);
    if (dragY > DRAG_DISMISS_PX) close();
    else setDragY(0);
  };

  const tabBase =
    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-pill)] px-1 py-1.5 transition-transform duration-150 active:scale-90 motion-reduce:transition-none";
  const labelBase =
    "max-w-full truncate text-[0.58rem] font-semibold uppercase tracking-[0.12em] transition-colors duration-200";
  const iconCapsule = (active: boolean) =>
    cn(
      "flex h-7 items-center justify-center rounded-[var(--radius-pill)] px-4 transition-all duration-300 motion-reduce:transition-none",
      active
        ? "scale-100 bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
        : "scale-95 bg-transparent text-[color:var(--color-ink-soft)]",
    );

  return (
    <>
      {/* ── Floating bar ─────────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 md:hidden print:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <nav
          aria-label={`${workspaceLabel} navigation`}
          className="pointer-events-auto w-full max-w-[420px] rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]/95 shadow-[0_10px_30px_rgba(20,17,13,0.18),0_2px_6px_rgba(20,17,13,0.08)] backdrop-blur-md"
        >
          <ul
            className="grid h-[62px] items-stretch px-1.5"
            style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => {
              const active = isActive(tab, pathname);
              return (
                <li key={tab.key} className="flex items-stretch">
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={tab.label}
                    className={cn(tabBase, "w-full")}
                    style={{ transitionTimingFunction: SPRING }}
                  >
                    <span aria-hidden="true" className={iconCapsule(active)} style={{ transitionTimingFunction: SPRING }}>
                      {tab.icon}
                    </span>
                    <span
                      className={cn(
                        labelBase,
                        active
                          ? "text-[color:var(--color-ink)]"
                          : "text-[color:var(--color-ink-soft)]",
                      )}
                    >
                      {tab.tabLabel ?? tab.label}
                    </span>
                  </Link>
                </li>
              );
            })}
            <li className="flex items-stretch">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className={cn(tabBase, "w-full cursor-pointer")}
                style={{ transitionTimingFunction: SPRING }}
              >
                <span aria-hidden="true" className={iconCapsule(open || moreActive)} style={{ transitionTimingFunction: SPRING }}>
                  <Ellipsis className="size-4" />
                </span>
                <span
                  className={cn(
                    labelBase,
                    open || moreActive
                      ? "text-[color:var(--color-ink)]"
                      : "text-[color:var(--color-ink-soft)]",
                  )}
                >
                  More
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* ── More sheet ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden print:hidden",
          open ? "" : "pointer-events-none",
        )}
        inert={!open}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          onClick={close}
          className={cn(
            "absolute inset-0 bg-[#14110d]/45 transition-opacity duration-300 motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Panel */}
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${workspaceLabel}  all sections`}
          tabIndex={-1}
          className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col overflow-hidden rounded-t-[20px] border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] shadow-[0_-16px_48px_rgba(20,17,13,0.24)] outline-none"
          style={{
            transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
            transition: dragging
              ? "none"
              : `transform 320ms ${open ? SPRING : "ease-in"}`,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Drag handle  the tri-colour flag band doubles as the grip */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="shrink-0 cursor-grab touch-none px-6 pb-2 pt-3 active:cursor-grabbing"
          >
            <div aria-hidden="true" className="mx-auto flex h-1.5 w-14 overflow-hidden rounded-[var(--radius-pill)]">
              <span className="flex-[3] bg-[color:var(--color-brand)]" />
              <span className="flex-[2] bg-[color:var(--color-accent)]" />
              <span className="flex-[1] bg-[color:var(--color-danger)]" />
            </div>
          </div>

          <div className="flex items-baseline justify-between px-6 pb-3">
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              All sections
            </span>
            <span className="font-display text-sm">{workspaceLabel}</span>
          </div>

          <nav
            aria-label={`${workspaceLabel}  more sections`}
            className="min-h-0 flex-1 overflow-y-auto border-t border-[color:var(--color-hairline)] px-3 py-3"
          >
            <ul className="grid grid-cols-2 gap-1">
              {moreItems.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none",
                        active
                          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                          : "text-[color:var(--color-ink)] active:bg-[color:var(--color-surface-sunk)]",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "shrink-0",
                          active
                            ? "text-[color:var(--color-paper)]"
                            : "text-[color:var(--color-ink-soft)]",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {footer ? (
            <div className="shrink-0 space-y-3 border-t border-[color:var(--color-hairline)] px-6 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
