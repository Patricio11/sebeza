"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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
    <main className="mx-auto max-w-[760px] px-5 py-24 md:py-32">
      <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-stale)]">
        Error
      </div>
      <h1 className="mt-2 font-display text-5xl leading-tight md:text-7xl">
        {t("errorTitle")}
      </h1>
      <p className="mt-4 max-w-md text-[color:var(--color-ink-soft)]">
        {t("errorBody")}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-ink)]"
        >
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
