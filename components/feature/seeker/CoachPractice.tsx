"use client";

/**
 * Phase 17 ("AI Career Coach")  the interview-practice client flow.
 *
 * Calm + text-only (No-Flash): a single role field, a button, then a numbered
 * list of practice questions or an honest unavailable/error message. The seeker
 * never types (or sends) PII  only a role title, which the dispatcher PII-
 * guards server-side. Every non-ok reason maps to plain, non-alarming copy.
 */

import { useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestInterviewPractice } from "@/lib/seeker/coach";
import type { CoachResult } from "@/lib/llm/seeker-coach";
import { CrisisSupport } from "@/components/feature/seeker/CrisisSupport";
import { HelpLink } from "@/components/feature/help/HelpLink";

const REASON_COPY: Record<string, string> = {
  no_provider:
    "AI coaching isn't switched on yet  an administrator still needs to connect a provider. Please check back soon.",
  no_credentials:
    "AI coaching isn't switched on yet  an administrator still needs to connect a provider. Please check back soon.",
  budget:
    "AI coaching has paused for this month while we manage costs. Please check back soon.",
  flag_off: "AI coaching isn't available right now.",
  payload_unsafe:
    "Please remove any personal details (ID number, email, or phone) from the role and try again  just the job title is enough.",
  failed:
    "The coach couldn't be reached right now. Please try again in a moment.",
  empty:
    "No questions came back  try describing the role a little differently.",
  off_scope:
    "I can only help you practise interview questions. Try a role you're preparing for.",
};

export function CoachPractice({ defaultRole }: { defaultRole: string }) {
  const [role, setRole] = useState(defaultRole);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CoachResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || role.trim().length < 2) return;
    setPending(true);
    setResult(null);
    try {
      setResult(await requestInterviewPractice(role.trim()));
    } catch {
      setResult({ ok: false, reason: "failed" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Phase 22.3  structural anti-opportunity framing. Always visible; not
          copy the model can override. This is practice, never a real opening. */}
      <p className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-3 text-xs text-[color:var(--color-ink-soft)]">
        This is practice to help you prepare  it is not a real interview, and
        not a job offer.
      </p>

      <form onSubmit={onSubmit} className="mb-6">
        <label
          htmlFor="coach-role"
          className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
        >
          Target role
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="coach-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Junior software developer"
            maxLength={120}
            className="h-11 flex-1 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-brand)]"
          />
          <Button type="submit" disabled={pending || role.trim().length < 2}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Preparing
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden="true" />
                Get practice questions
              </>
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          We only send the role and your listed skills  never your name, ID, or
          contact details.
        </p>
      </form>

      {/* Phase 22.2  distress takes precedence over everything: human support,
          never the model. */}
      {result && !result.ok && result.reason === "distress" && (
        <CrisisSupport resources={result.crisisResources} />
      )}

      {result && !result.ok && result.reason !== "distress" && (
        <div
          role="status"
          className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 text-sm text-[color:var(--color-ink-soft)]"
        >
          <p>
            {result.reason === "off_scope"
              ? result.message || REASON_COPY.off_scope
              : REASON_COPY[result.reason] ?? REASON_COPY.failed}
          </p>
          {/* Phase 22.4  never a dead end: point to the human-written guide. */}
          <div className="mt-3">
            <HelpLink
              role="seeker"
              slug="prepare-for-an-interview"
              label="In the meantime: how to prepare for an interview"
            />
          </div>
        </div>
      )}

      {result && result.ok && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            <Bot className="size-4 text-[color:var(--color-brand)]" aria-hidden="true" />
            Practice questions
          </div>
          <ol className="space-y-2">
            {result.questions.map((q, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3"
              >
                <span className="font-[family-name:var(--font-display)] text-lg tabular-nums text-[color:var(--color-brand)]">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm text-[color:var(--color-ink)]">
                  {q}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
            AI-generated to help you rehearse. Real interviews vary  treat these
            as practice, not predictions.
          </p>
        </div>
      )}
    </div>
  );
}
