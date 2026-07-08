"use client";

import { useEffect } from "react";

/**
 * Phase 28  registers the offline-fallback service worker (public/sw.js).
 * Production-only: dev + vitest never register, so hot reload and the test
 * DB harness are untouched. Renders nothing; the effect runs once after
 * hydration so it costs zero paint-blocking work (No-Flash).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure (private mode, unsupported) is non-fatal:
      // the app simply behaves like a normal website.
    });
  }, []);
  return null;
}
