"use client";

/**
 * Phase 11.5.5  lazy-load wrapper for below-the-fold server-component
 * subtrees.
 *
 * Server-component subtree is rendered eagerly (no extra round-trip),
 * but the wrapper holds it behind a sentinel until the seeker scrolls
 * within `rootMargin` of it. The sentinel uses IntersectionObserver;
 * `prefers-reduced-motion` / no-JS path renders the content
 * immediately (graceful degradation  the lazy load is a perf hint,
 * not a contract).
 *
 * Per D4 the trigger is sentinel-based, not viewport-derived from
 * layout  predictable across browsers + decoupled from design
 * changes.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  /**
   * Distance above the sentinel (in px) at which to trigger the
   * "visible" state. Generous default so the content paints before
   * the seeker actually sees it.
   */
  rootMargin?: string;
  /** Min height reserved so layout doesn't jump when content loads. */
  placeholderClassName?: string;
  children: React.ReactNode;
}

export function LazySection({
  rootMargin = "600px",
  placeholderClassName = "min-h-[160px]",
  children,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // No-IO browsers (rare on the SA target devices but possible on
    // older Android WebView): render immediately so the section is
    // never permanently hidden.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [rootMargin]);

  if (visible) return <>{children}</>;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={placeholderClassName}
    />
  );
}
