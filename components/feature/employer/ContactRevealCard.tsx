"use client";

/**
 * Contact reveal card — the headline Phase 5 control.
 *
 * Three render states:
 *   - already-revealed (this org saw the contact recently)
 *     → shows the email + the audit-log indicator
 *   - reveal-available (consent granted, not yet revealed by us)
 *     → "Reveal contact" button
 *   - reveal-blocked (consent not granted)
 *     → disabled button + honest explanation
 */

import { useState, useTransition } from "react";
import { Lock, MailCheck, ShieldCheck, AlertTriangle } from "lucide-react";
import { revealContact, type ContactReveal } from "@/lib/employer/reveal";

interface Props {
  handle: string;
  consentState: "granted" | "revoked" | "none";
  /** Set when this org has already revealed this seeker recently. */
  initialReveal?: ContactReveal | null;
}

export function ContactRevealCard({
  handle,
  consentState,
  initialReveal,
}: Props) {
  const [reveal, setReveal] = useState<ContactReveal | null>(
    initialReveal ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleReveal() {
    setError(null);
    startTransition(async () => {
      const r = await revealContact({ handle });
      if (r.ok) {
        setReveal(r.contact);
      } else {
        setError(r.message);
      }
    });
  }

  // 1. Already revealed — show contact + the audit-log indicator
  if (reveal) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
            Contact revealed
          </div>
          <span className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Audit-logged
          </span>
        </div>
        <a
          href={`mailto:${reveal.email}`}
          className="mt-2 block break-all font-display text-2xl text-[color:var(--color-ink)] hover:underline"
        >
          {reveal.email}
        </a>
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          {reveal.city} · consent v{reveal.consentVersion} on file ·
          revealed{" "}
          {new Date(reveal.revealedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
    );
  }

  // 2. Consent not granted — block honestly
  if (consentState !== "granted") {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Contact withheld
          </div>
          <span className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            <Lock className="size-3" aria-hidden="true" />
            POPIA
          </span>
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink)]">
          This seeker hasn't granted contact-reveal consent. Sebenza won't
          surface their email or phone — even to verified employers — until
          they explicitly opt in.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink-soft)] opacity-60"
        >
          <Lock className="size-4" aria-hidden="true" />
          Reveal contact
        </button>
        <p className="mt-2 text-xs italic text-[color:var(--color-ink-soft)]">
          You can still add this seeker to a shortlist and revisit when
          consent changes.
        </p>
      </div>
    );
  }

  // 3. Reveal available
  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          Contact available
        </div>
        <span className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
          <ShieldCheck className="size-3" aria-hidden="true" />
          Consent on file
        </span>
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
        Clicking reveal writes a row to the audit log under your name. The
        seeker can see this on their activity ledger.
      </p>
      <button
        type="button"
        onClick={handleReveal}
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)] disabled:opacity-60"
      >
        <MailCheck className="size-4" aria-hidden="true" />
        {pending ? "Revealing…" : "Reveal contact"}
      </button>
      {error && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-[color:var(--color-danger)]">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
