"use client";

/**
 * Seeker share-your-public-profile control.
 *
 * Renders the public profile URL + a "Copy" button + (on devices that
 * support the Web Share API) a native "Share" button so the seeker
 * can fire iOS / Android / Edge share sheets.
 *
 * Designed as a reusable client island  drops anywhere the seeker
 * might want a share affordance (profile editor header, dashboard
 * overview, /p/[handle] when the viewer is the owner).
 *
 * URL composition: server renders the relative path `/p/<handle>` so
 * the initial markup is stable; useEffect rewrites it to the absolute
 * `<origin>/p/<handle>` after hydration. This avoids hydration
 * mismatch and gives clipboard / share a fully-qualified URL.
 *
 * Privacy posture: this surface ONLY exposes a URL the platform
 * already publishes at /p/[handle]. The button doesn't reveal new
 * data + doesn't bypass the redaction layer on the destination page.
 * Searchability consent gating still controls whether the profile
 * appears in /search; the shared URL renders the same redacted
 * PublicProfile shape it always has.
 */

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";

interface Props {
  handle: string;
  /** Compact mode: smaller layout for tight spaces (dashboard overview).
   *  Default false  full layout with URL preview + button row. */
  compact?: boolean;
  /** Override card title. Default: "Share your profile". */
  title?: string;
  /** Override card subtitle. */
  subtitle?: string;
  className?: string;
}

export function ShareProfileLink({
  handle,
  compact,
  title = "Share your profile",
  subtitle = "Your public profile lives at this URL. Send it to anyone  it shows the same redacted view employers see.",
  className,
}: Props) {
  const relativeUrl = `/p/${handle}`;
  const [url, setUrl] = useState(relativeUrl);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the absolute URL + feature-detect Web Share after hydration.
  useEffect(() => {
    setUrl(`${window.location.origin}/p/${handle}`);
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, [handle]);

  async function onCopy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically  press Ctrl+C / ⌘C to copy.");
    }
  }

  async function onShare() {
    setError(null);
    try {
      await navigator.share({
        title: "My Sebenza profile",
        text: "Have a look at my Sebenza profile.",
        url,
      });
    } catch {
      // User cancelled the share sheet  swallow.
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Compact variant  one-line pill for dashboard headers
  // ────────────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={
          "flex flex-wrap items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 " +
          (className ?? "")
        }
      >
        <span
          className="truncate text-xs text-[color:var(--color-ink-soft)]"
          title={url}
        >
          {url.replace(/^https?:\/\//, "")}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy profile link"
          className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
        >
          {copied ? (
            <>
              <Check className="size-3" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" aria-hidden="true" />
              Copy
            </>
          )}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share profile via system share"
            className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
          >
            <Share2 className="size-3" aria-hidden="true" />
            Share
          </button>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Default full card
  // ────────────────────────────────────────────────────────────────────
  return (
    <section
      aria-label={title}
      className={
        "rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5 " +
        (className ?? "")
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
        >
          <Share2 className="size-4" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg text-[color:var(--color-ink)]">
            {title}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            {subtitle}
          </p>
        </div>
      </div>

      {/* URL row */}
      <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2">
        <ExternalLink
          className="size-4 shrink-0 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Your public profile URL"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 truncate bg-transparent text-sm text-[color:var(--color-ink)] outline-none"
        />
      </div>

      {/* Action row */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy profile link"
          className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand-strong)]"
        >
          {copied ? (
            <>
              <Check className="size-4" aria-hidden="true" />
              Copied to clipboard
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden="true" />
              Copy link
            </>
          )}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share profile via system share"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]"
          >
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-4 py-2 text-sm text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Open
        </a>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
    </section>
  );
}
