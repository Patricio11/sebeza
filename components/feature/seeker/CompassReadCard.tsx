"use client";

/**
 * 2026-08-19  "Coach's read" card on the Career compass. One click asks
 * the coach to narrate the seeker's OWN live data; no text input exists
 * by design (the browser sends only the click). English-only v1  the
 * narrative is generated copy, held out of the translation catalogs.
 */

import { useState, useTransition } from "react";
import { Loader2, MessageCircleHeart, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestCompassRead } from "@/lib/seeker/compass-read";
import type { CompassRead } from "@/lib/llm/compass-read";

export function CompassReadCard() {
  const [pending, startTransition] = useTransition();
  const [read, setRead] = useState<CompassRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  function ask() {
    setError(null);
    startTransition(async () => {
      const res = await requestCompassRead();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRead(res.read);
    });
  }

  return (
    <section
      aria-labelledby="compass-read-h"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="compass-read-h" className="flex items-center gap-2 font-display text-lg">
          <MessageCircleHeart
            className="size-5 text-[color:var(--color-brand)]"
            aria-hidden="true"
          />
          Coach&rsquo;s read
        </h2>
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={ask}>
          {pending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
          ) : read ? (
            <RefreshCcw className="mr-1.5 size-3.5" aria-hidden="true" />
          ) : null}
          {read ? "Refresh" : "Explain my compass"}
        </Button>
      </div>

      {!read && !error && (
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          One tap and the coach reads your live numbers below and explains,
          in plain words, where you stand and what to do next. Nothing you
          type is sent. It works only from your own data.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          {error}
        </p>
      )}

      {read && (
        <div className="mt-3">
          <p className="font-display text-xl text-[color:var(--color-ink)]">
            {read.headline}
          </p>
          <div className="mt-2 space-y-2 text-sm text-[color:var(--color-ink)]">
            {read.body.split(/\n{1,2}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <p className="mt-3 border-l-2 border-[color:var(--color-accent)] pl-3 text-xs italic text-[color:var(--color-ink-soft)]">
            {read.caveat}
          </p>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
            AI-written from your live compass data · practice, not a promise
          </p>
        </div>
      )}
    </section>
  );
}
