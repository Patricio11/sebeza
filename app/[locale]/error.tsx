"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SAChevron } from "@/components/ui/SAChevron";
import {
  isStaleServerActionError,
  reloadOnceForNewVersion,
} from "@/lib/client/stale-deploy";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  // A tab left open across a deploy calls Server Action ids that no
  // longer exist and lands here. Nothing is broken for the user; the
  // tab needs the new bundle. Reload once (guarded) instead of showing
  // an error they cannot act on.
  const stale = isStaleServerActionError(error);
  useEffect(() => {
    if (stale && reloadOnceForNewVersion()) return;
    // Phase 9: route to Sentry. For now, console.
    console.error(error);
  }, [error, stale]);

  if (stale) {
    return (
      <main className="relative overflow-hidden bg-[color:var(--color-paper)]">
        <div aria-hidden="true" className="flex h-[3px] w-full">
          <div className="flex-[3] bg-[color:var(--color-brand)]" />
          <div className="flex-[2] bg-[color:var(--color-accent)]" />
          <div className="flex-[1] bg-[color:var(--color-danger)]" />
        </div>
        <div className="relative mx-auto max-w-[860px] px-5 py-24 md:py-36">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
            <SAChevron variant="mark" className="size-3" />
            {t("updatingEyebrow")}
          </div>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.98] tracking-[-0.02em]">
            {t("updatingTitle")}
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[color:var(--color-ink-soft)]">
            {t("updatingBody")}
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-paper)] shadow-press"
            >
              {t("updatingReload")}
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden bg-[color:var(--color-paper)]">
      {/* Top flag stripe so even bare error pages stay in the system */}
      <div aria-hidden="true" className="flex h-[3px] w-full">
        <div className="flex-[3] bg-[color:var(--color-brand)]" />
        <div className="flex-[2] bg-[color:var(--color-accent)]" />
        <div className="flex-[1] bg-[color:var(--color-danger)]" />
      </div>

      <SAChevron
        variant="signature"
        className="pointer-events-none absolute -right-32 -top-16 size-[600px] opacity-[0.07]"
      />

      <div className="relative mx-auto max-w-[860px] px-5 py-24 md:py-36">
        <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-danger)]">
          <SAChevron variant="mark" className="size-3" />
          Error · we've logged it
        </div>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.98] tracking-[-0.02em]">
          {t("errorTitle")}
        </h1>
        <p className="mt-5 max-w-lg text-lg text-[color:var(--color-ink-soft)]">
          {t("errorBody")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            {t("retry")}
            <span aria-hidden="true">↻</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
          >
            {t("home")}
          </Link>
        </div>
        {/* Support reference: the digest is what our logs are keyed by,
            so a stuck user can quote it instead of describing symptoms. */}
        {error.digest && (
          <p className="mt-6 text-xs text-[color:var(--color-ink-soft)]">
            {t("errorDigestHint")}{" "}
            <code className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono">
              {error.digest}
            </code>
          </p>
        )}
      </div>
    </main>
  );
}
