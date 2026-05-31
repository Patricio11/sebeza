"use client";

/**
 * Phase 11.4.3  data-saver toggle on /dashboard/account.
 *
 * Single boolean. On = skip images, swap charts for tables, lazy-load
 * more aggressively. The browser's `Save-Data: on` header is the
 * floor  if the browser already signals it, the seeker sees the
 * downgraded UI regardless of this toggle.
 *
 * Civic-Editorial copy: respectful, no "premium / lite" implication.
 * SA reality is that mobile data is expensive; treating this as a
 * first-class option signals trust.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setDataSaverMode } from "@/lib/preferences/actions";
import { Gauge } from "lucide-react";

interface Props {
  initial: boolean;
}

export function DataSaverPreference({ initial }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const res = await setDataSaverMode(next);
      if (!res.ok) {
        setEnabled(!next);
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="data-saver-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Gauge
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <h3
              id="data-saver-h"
              className="font-display text-base text-[color:var(--color-ink)]"
            >
              Data + bandwidth
            </h3>
            <p className="mt-1 max-w-prose text-sm text-[color:var(--color-ink-soft)]">
              On low-data plans? Turn this on to skip avatars, charts,
              and animated elements. We&rsquo;ll still load everything
              you need to use Sebenza  just lighter. Your browser&rsquo;s
              <em> Save-Data </em> setting also turns it on automatically.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          role="switch"
          aria-checked={enabled}
          className={
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors " +
            (enabled
              ? "bg-[color:var(--color-ink)]"
              : "bg-[color:var(--color-hairline)]")
          }
        >
          <span
            className={
              "inline-block size-5 transform rounded-full bg-[color:var(--color-paper)] shadow transition-transform " +
              (enabled ? "translate-x-5" : "translate-x-0.5")
            }
          />
          <span className="sr-only">
            {enabled ? "Data saver on" : "Data saver off"}
          </span>
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}
    </section>
  );
}
