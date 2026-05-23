"use client";

/**
 * Phase 9  Cookie consent banner.
 *
 * Shown only when no consent cookie is on file. Two paths:
 *   - Accept all → essential + analytics
 *   - Essential only → essential only (analytics stays off  the
 *     default, no penalty)
 *
 * Plus a deep-link to the Privacy Policy. No dark patterns: the
 * Essential-only button is visually equivalent to Accept-all.
 */

import { useState, useTransition } from "react";
import { setCookieConsent } from "@/lib/cookies/consent";

interface Props {
  /** Server-resolved: whether the cookie is already set. When true, render nothing. */
  alreadyDecided: boolean;
}

export function CookieConsentBanner({ alreadyDecided }: Props) {
  const [dismissed, setDismissed] = useState(alreadyDecided);
  const [pending, startTransition] = useTransition();

  function choose(analytics: boolean) {
    setDismissed(true);
    startTransition(async () => {
      await setCookieConsent({ analytics });
    });
  }

  if (dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] shadow-lg"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[640px] text-sm text-[color:var(--color-ink)]">
          <p className="font-medium">Cookies</p>
          <p className="mt-1 text-[color:var(--color-ink-soft)]">
            We use essential cookies (sign-in session, locale, this consent
            choice). Optional analytics cookies help us count anonymous page
            views  no profile is built from your browsing. Read the{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose(false)}
            disabled={pending}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)] disabled:opacity-60"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            disabled={pending}
            className="rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)] disabled:opacity-60"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
