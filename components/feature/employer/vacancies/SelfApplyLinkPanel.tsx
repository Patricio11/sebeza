"use client";

/**
 * Phase 34  the employer's public-link panel on the vacancy detail
 * page (docs/PHASE_34_SELF_APPLY_PLAN.md §34.7). Renders only when the
 * platform flag AND the per-vacancy toggle are both on.
 *
 * The link is the recruiting poster: copy it, or share straight to
 * WhatsApp (the channel SA hiring actually happens on  the wa.me
 * share pre-fills role + link; the Phase 34 OG card renders the
 * preview). Honest state note: the link pauses automatically when the
 * vacancy is closed or filled.
 */

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

export function SelfApplyLinkPanel({
  applyUrl,
  vacancyTitle,
  vacancyOpen,
}: {
  /** Absolute URL  built server-side from SITE_URL + the token. */
  applyUrl: string;
  vacancyTitle: string;
  vacancyOpen: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (older WebView)  select-on-focus on
      // the input below remains the fallback.
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(
    `We're hiring: ${vacancyTitle}. Apply free on Sebenza  ${applyUrl}`,
  )}`;

  return (
    <section
      aria-label="Self Apply public link"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-brand)]/40 bg-[color:var(--color-brand-tint)] p-4"
    >
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
        Self Apply · public link {vacancyOpen ? "live" : "paused"}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
        {vacancyOpen
          ? "Anyone with this link sees the role and can apply  applicants land in this pipeline with a “Self-applied” chip. Share it on WhatsApp, posters, anywhere."
          : "The vacancy isn't open, so the link currently shows “not accepting applications.” It resumes automatically when you re-open the vacancy."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={applyUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Public apply link"
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 font-mono text-xs text-[color:var(--color-ink)]"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-2 text-xs font-medium text-[color:var(--color-surface)] transition-transform hover:-translate-y-0.5"
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden="true" />
              Copy link
            </>
          )}
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-4 py-2 text-xs font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-surface)]"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
          Share on WhatsApp
        </a>
      </div>
    </section>
  );
}
