"use client";

/**
 * 2026-08-19  sticky header shell with auto-hide on mobile
 * (user report: "the top bar doesn't disappear when you scroll down").
 *
 * On small screens the bar slides away while scrolling DOWN and returns
 * the moment you scroll UP, which is what phone users expect and gives
 * a data-heavy page like /insights its vertical space back. Desktop is
 * untouched (`md:translate-y-0`).
 *
 * Two deliberate details:
 *  - the scroll handler is rAF-throttled and passive, with a small
 *    jitter threshold, so it costs nothing on a low-end Android
 *    (No-Flash rule);
 *  - it never hides while the body is scroll-locked (drawer/modal open).
 *
 * NOTE: the translate creates a containing block for `position: fixed`
 * descendants. That is safe ONLY because MobileNav portals its drawer to
 * <body>; do not render a fixed overlay as a child of this header.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const HIDE_AFTER_PX = 120;
const JITTER_PX = 6;

export function StickyHeaderShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) < JITTER_PX) return;
        // A locked body means a drawer or modal owns the screen.
        if (document.body.style.overflow === "hidden") {
          last = y;
          return;
        }
        setHidden(delta > 0 && y > HIDE_AFTER_PX);
        last = y;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-hidden={hidden ? "true" : "false"}
      className={cn(
        "sticky top-0 z-30 transition-transform duration-200 motion-reduce:transition-none",
        hidden ? "-translate-y-full md:translate-y-0" : "translate-y-0",
        className,
      )}
    >
      {children}
    </header>
  );
}
