"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SAChevron } from "@/components/ui/SAChevron";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    // Phase 9: route to Sentry. For now, console.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

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
      </div>
    </main>
  );
}
