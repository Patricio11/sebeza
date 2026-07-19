"use client";

/**
 * Phase 31 ("Data minimisation")  the system-wide ID/passport COLLECTION
 * switch, on /admin/verifications beside the Seeker IDs review queue.
 *
 * Default OFF: Sebenza runs on self-reported profiles with zero ID/passport
 * collected  the biggest POPIA liability in the system stays dormant until
 * a real verification partnership (Home Affairs / KYC SaaS / SAQA) is
 * confirmed. Turning it ON is a DELIBERATE, acknowledged act (mirrors the
 * Phase 22.5 AI-coach switch); turning it OFF is always immediate.
 *
 * The flag gates COLLECTION only  seekers who already stored an ID keep
 * their remove/revoke affordances regardless (data-subject rights never
 * switch off), and this review queue keeps working for already-submitted
 * documents.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { AlertTriangle, Fingerprint, Loader2, Power } from "lucide-react";
import { updateSetting } from "@/lib/admin/settings-actions";

const KEY = "feature_flag_id_verification_enabled" as const;

export function IdVerificationSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setEnabled(next: boolean) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateSetting({ key: KEY, value: next });
      if (res.ok) {
        setAck(false);
        router.refresh();
      } else {
        setError(res.message ?? "Could not update the switch.");
      }
    });
  }

  return (
    <section
      aria-labelledby="id-verification-switch-h"
      className="mb-8 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <h2
          id="id-verification-switch-h"
          className="flex items-center gap-2 font-display text-lg"
        >
          <Fingerprint
            className="size-5 text-[color:var(--color-brand)]"
            aria-hidden="true"
          />
          ID / passport collection  system-wide switch
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium ${
            enabled
              ? "border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
              : "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          <Power className="size-3.5" aria-hidden="true" />
          {enabled ? "ON" : "OFF"}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] p-3 text-sm">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <div className="text-[color:var(--color-ink-soft)]">
          <p className="font-medium text-[color:var(--color-ink)]">
            OFF is the launch posture: self-reported profiles, zero ID numbers
            held.
          </p>
          <p className="mt-1">
            While OFF, seekers are never asked for an ID or passport anywhere
            &mdash; the profile-editor ID section and document upload are hidden
            and the Server Actions refuse. Seekers who stored an ID before keep
            their <strong>remove</strong> affordance (data-subject rights never
            switch off), and this queue still reviews already-submitted
            documents. Turn ON only once a real verification partnership is
            confirmed and lawful; the existing opt-in KYC flow then activates
            exactly as built. See{" "}
            <code className="text-[0.85em]">docs/PHASE_9_19_PLAN.md</code>{" "}
            (ships as Phase 31).
          </p>
        </div>
      </div>

      <div className="mt-4">
        {enabled ? (
          <button
            type="button"
            onClick={() => setEnabled(false)}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-sm hover:bg-[color:var(--color-surface-sunk)] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Power className="size-4" aria-hidden="true" />
            )}
            Turn OFF (immediate)
          </button>
        ) : (
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm text-[color:var(--color-ink)]">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm a verification partnership is confirmed and lawful,
                and the DPIA has been updated for the ON state.
              </span>
            </label>
            <button
              type="button"
              onClick={() => setEnabled(true)}
              disabled={pending || !ack}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Power className="size-4" aria-hidden="true" />
              )}
              Enable ID / passport collection
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
    </section>
  );
}
