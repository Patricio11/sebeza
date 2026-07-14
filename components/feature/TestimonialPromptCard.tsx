"use client";

/**
 * Phase 24  the testimonial collection moment. A small, warm, dismissible
 * card on the dashboard (never a page, never a blocking modal). Dismiss =
 * snoozed 30 days; submit = thanked + never asked again. Explicit public-
 * display consent is part of the form  no consent, no submit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Quote, X, Loader2, Check } from "lucide-react";
import {
  submitTestimonial,
  snoozeTestimonialPrompt,
} from "@/lib/testimonials/actions";

const QUOTE_MAX = 280;

export function TestimonialPromptCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quote, setQuote] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    startTransition(async () => {
      await snoozeTestimonialPrompt();
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const r = await submitTestimonial(quote, consent);
      if (r.ok) {
        setDone(true);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <section
      aria-label="Share your experience"
      className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <Quote className="size-4" aria-hidden="true" />
          Your words, if you&rsquo;d like
        </div>
        {!done && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now  ask me again next month"
            className="grid size-6 place-items-center rounded-full text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {done ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
          <Check className="size-4 text-[color:var(--color-brand)]" aria-hidden="true" />
          Thank you  our team will review it before anything is shown publicly.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-2">
          <p className="text-sm text-[color:var(--color-ink)]">
            Has Sebenza helped you? A sentence or two helps other South
            Africans decide to give it a try.
          </p>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={QUOTE_MAX}
            rows={2}
            placeholder="What changed for you?"
            className="mt-3 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3 text-sm text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-brand)]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-start gap-2 text-xs text-[color:var(--color-ink-soft)]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Sebenza may show these words publicly with my first name and
                role  never my contact details. I can ask for it to be removed
                any time.
              </span>
            </label>
            <button
              type="submit"
              disabled={pending || !consent || quote.trim().length < 20}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Share
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
