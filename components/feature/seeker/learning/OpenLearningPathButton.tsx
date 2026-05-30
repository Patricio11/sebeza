"use client";

/**
 * Phase 11.2.1  outbound CTA for a `<LearningPathCard>`.
 *
 * Renders a primary "Open application" link straight to the provider's
 * URL (D1: no redirect through Sebenza). On click we fire
 * `logLearningPathOpen` so quarterly editorial review knows which paths
 * actually get traffic  the audit row is fire-and-forget; navigation
 * never waits on it.
 *
 * `target="_blank"` + `rel="noopener noreferrer"` keep the seeker's
 * dashboard session intact + close the tabnabbing vector.
 */

import { useTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import { logLearningPathOpen } from "@/lib/seeker/learning";

interface Props {
  url: string;
  title: string;
  provider: string;
  providerKind: string;
}

export function OpenLearningPathButton({
  url,
  title,
  provider,
  providerKind,
}: Props) {
  const [, startTransition] = useTransition();

  function handleClick() {
    // Fire-and-forget. We don't await  the navigation has already
    // started in the browser; the audit row lands a beat later.
    startTransition(() => {
      void logLearningPathOpen({ url, title, provider, providerKind });
    });
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)] transition-colors hover:bg-[color:var(--color-brand-strong)]"
    >
      Open application
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}
