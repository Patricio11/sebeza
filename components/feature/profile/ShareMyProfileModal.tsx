"use client";

/**
 * Phase 11.4.1  share-profile modal.
 *
 * Opens from the "Share my profile" button on the profile editor.
 * Three options: WhatsApp deep-link, LinkedIn deep-link, copy link.
 *
 * The link points at /p/{handle} (the regular public profile);
 * link-unfurl engines automatically fetch /p/{handle}/card for the
 * OG preview image. We do NOT pre-link to /card from the seeker's
 * share UI  the shareable artefact is the profile, not the card.
 *
 * Mobile-first: bottom-sheet on phones, centred on `md+`. No
 * external assets; all icons are inline lucide.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Copy, Check, MessageCircle, Linkedin, Share2, X } from "lucide-react";

interface Props {
  handle: string;
  displayName: string;
  profession: string;
}

function buildShareUrl(handle: string): string {
  // Use a runtime-aware base. SSR side this is set; client side we
  // mirror the seeker's current origin so they share a link that works
  // for THEIR audience (dev / staging / prod).
  if (typeof window !== "undefined") {
    return `${window.location.origin}/p/${handle}`;
  }
  return `/p/${handle}`;
}

export function ShareMyProfileModal({
  handle,
  displayName,
  profession,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(handle);
  const waText = `Check out my Sebenza profile  ${displayName}, ${profession}: ${shareUrl}`;
  const liText = `${displayName}  ${profession}. My profile on Sebenza, South Africa's talent platform: ${shareUrl}`;

  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    shareUrl,
  )}&summary=${encodeURIComponent(liText)}`;

  function onCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Share2 className="mr-1.5 size-3.5" aria-hidden="true" />
        Share my profile
      </Button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-h"
          className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] md:rounded-[var(--radius-md)]">
            <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-hairline)] p-5">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  Share
                </div>
                <h2
                  id="share-h"
                  className="mt-1 font-display text-lg text-[color:var(--color-ink)]"
                >
                  Share your Sebenza profile
                </h2>
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  Recipients see a rich preview card on WhatsApp and
                  LinkedIn  not just a link. Same redaction rules as
                  your public profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-2 font-mono text-xs text-[color:var(--color-ink)]">
                {shareUrl}
              </div>

              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-ink)]"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                      <MessageCircle
                        className="size-4 text-[color:var(--color-brand-strong)]"
                        aria-hidden="true"
                      />
                      WhatsApp
                    </span>
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      Open chat
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={liUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-ink)]"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                      <Linkedin
                        className="size-4 text-[color:var(--color-brand-strong)]"
                        aria-hidden="true"
                      />
                      LinkedIn
                    </span>
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      Open share
                    </span>
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onCopy}
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-ink)]"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                      {copied ? (
                        <Check
                          className="size-4 text-[color:var(--color-brand-strong)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy
                          className="size-4 text-[color:var(--color-ink-soft)]"
                          aria-hidden="true"
                        />
                      )}
                      Copy link
                    </span>
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      {copied ? "Copied" : "Click to copy"}
                    </span>
                  </button>
                </li>
              </ul>

              <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
                Your share-card preview lives at{" "}
                <code className="rounded bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5 text-[0.7rem]">
                  /p/{handle}/card
                </code>
                . Link-preview engines fetch it automatically when you
                share the profile URL.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
