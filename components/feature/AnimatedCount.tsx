"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  /** Total animation duration in ms. */
  durationMs?: number;
  /** Locale for Intl.NumberFormat. */
  locale?: string;
  /** Optional prefix/suffix (e.g. "%", "+"). */
  suffix?: string;
  /** Trigger the count-up only when the element scrolls into view. */
  triggerOnView?: boolean;
  className?: string;
}

/**
 * Count-up number that animates only once, when it enters the viewport.
 * Single client island  cheap, no library. Honours prefers-reduced-motion:
 * users who don't want motion see the final number immediately.
 */
export function AnimatedCount({
  value,
  durationMs = 1400,
  locale = "en",
  suffix = "",
  triggerOnView = true,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(triggerOnView ? 0 : value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    let rafId = 0;
    let started = false;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / durationMs);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(eased * value));
        if (t < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    if (!triggerOnView) {
      run();
      return () => cancelAnimationFrame(rafId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true;
            run();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [value, durationMs, triggerOnView]);

  const fmt = new Intl.NumberFormat(locale);

  return (
    <span ref={ref} className={className}>
      {fmt.format(display)}
      {suffix}
    </span>
  );
}
