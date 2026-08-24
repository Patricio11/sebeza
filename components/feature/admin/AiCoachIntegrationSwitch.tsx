"use client";

/**
 * Phase 22.5  the system-wide AI Career Coach switch, on the Integrations
 * (/admin/llm) surface next to the LLM provider + budget config.
 *
 * This is a DIFFERENT risk class from every other flag: an LLM addressing job
 * seekers, some vulnerable. So turning it ON is a DELIBERATE, acknowledged act
 * the admin must confirm the Phase 22 safety review is complete + crisis
 * resources are live before it can be enabled (mirrors the s.72 cross-border
 * ack on providers). Turning it OFF is always immediate. Toggles the existing
 * `feature_flag_seeker_ai_coach` setting  one source of truth, safer entry point.
 */

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { AlertTriangle, Bot, CheckCircle2, Loader2, Power, XCircle } from "lucide-react";
import { updateSetting } from "@/lib/admin/settings-actions";

const KEY = "feature_flag_seeker_ai_coach" as const;

export function AiCoachIntegrationSwitch({
  enabled,
  crisisResourceCount,
  activeProviderName,
}: {
  enabled: boolean;
  /** Active rows on /admin/crisis-resources. The HARD precondition:
   *  the server refuses to enable with zero (settings-actions gate). */
  crisisResourceCount: number;
  /** The active LLM provider's display name, if any. Soft: without
   *  one the coach degrades to "not available", so it informs rather
   *  than blocks. */
  activeProviderName: string | null;
}) {
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
      aria-labelledby="ai-coach-switch-h"
      className="mt-10 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <h2
          id="ai-coach-switch-h"
          className="flex items-center gap-2 font-display text-lg"
        >
          <Bot className="size-5 text-[color:var(--color-brand)]" aria-hidden="true" />
          AI Career Coach, system-wide switch
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

      {/* The different-risk-class line + a LIVE readiness checklist
          (2026-08-24). The Phase 22 safety suite is BUILT and tested;
          what this panel checks is the operational state that can
          drift: crisis resources and the provider. */}
      <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] p-3 text-sm">
        <p className="flex items-start gap-2 font-medium text-[color:var(--color-ink)]">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]"
            aria-hidden="true"
          />
          A different risk class: an LLM speaking to job seekers. Readiness:
        </p>
        <ul className="mt-3 space-y-2 text-[color:var(--color-ink-soft)]">
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-[color:var(--color-positive)]"
              aria-hidden="true"
            />
            <span>
              <strong className="text-[color:var(--color-ink)]">Safety suite shipped (Phase 22).</strong>{" "}
              Pre-LLM distress screening, refusal boundaries (no financial /
              legal / medical / mental-health advice), output moderation, and
              the &ldquo;practice, not a promise&rdquo; framing are built and
              covered by the test suite. Spec:{" "}
              <code className="text-[0.85em]">docs/PHASE_22_AI_COACH_SAFETY_PLAN.md</code>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            {crisisResourceCount > 0 ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-positive)]"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-danger)]"
                aria-hidden="true"
              />
            )}
            <span>
              <strong className="text-[color:var(--color-ink)]">
                {crisisResourceCount > 0
                  ? `${crisisResourceCount} crisis-support resource${crisisResourceCount === 1 ? "" : "s"} live.`
                  : "No active crisis-support resources."}
              </strong>{" "}
              The distress pathway routes here, so this is a hard requirement;
              the server refuses to enable without at least one. Manage on{" "}
              <Link
                href="/admin/crisis-resources"
                className="underline underline-offset-2 hover:text-[color:var(--color-ink)]"
              >
                Crisis resources
              </Link>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            {activeProviderName ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-positive)]"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]"
                aria-hidden="true"
              />
            )}
            <span>
              <strong className="text-[color:var(--color-ink)]">
                {activeProviderName
                  ? `Provider active: ${activeProviderName}.`
                  : "No active provider."}
              </strong>{" "}
              {activeProviderName
                ? "Budget and spend tracked on the card above."
                : "Not blocking: the coach shows “not available” until a provider is activated above."}
            </span>
          </li>
        </ul>
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
                I confirm the crisis-support resources listed are real, current,
                and verified by a human (the Phase 22 safety suite itself is
                shipped and tested; this acknowledges the operational part only
                a person can check).
              </span>
            </label>
            <button
              type="button"
              onClick={() => setEnabled(true)}
              disabled={pending || !ack || crisisResourceCount < 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Power className="size-4" aria-hidden="true" />
              )}
              Enable AI Coach system-wide
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
