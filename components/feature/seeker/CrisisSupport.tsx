/**
 * Phase 22.2  the crisis-support response shown when the coach's distress
 * screen fires. Calm and warm, never clinical or alarming (No-Flash). Always
 * carries a hardcoded, safe universal line ("contact emergency services") plus
 * whatever VERIFIED resources an admin has activated  we never invent a number.
 * Presentational only (type-only import of `CrisisResource`, so no server code
 * enters the client bundle).
 */

import { LifeBuoy } from "lucide-react";
import type { CrisisResource } from "@/db/queries/crisis-resources";

export function CrisisSupport({ resources }: { resources: CrisisResource[] }) {
  return (
    <div
      role="status"
      aria-label="Crisis support"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] p-5"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[color:var(--color-ink)]">
        <LifeBuoy className="size-5 text-[color:var(--color-accent)]" aria-hidden="true" />
        You&rsquo;re not alone
      </div>
      <p className="text-sm text-[color:var(--color-ink)]">
        It sounds like things are really hard right now. You don&rsquo;t have to
        face this alone. If you are in immediate danger, please contact your local
        emergency services straight away.
      </p>

      {resources.length > 0 && (
        <ul className="mt-4 space-y-3">
          {resources.map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3"
            >
              <div className="text-sm font-medium text-[color:var(--color-ink)]">
                {r.name}
              </div>
              <div className="text-sm text-[color:var(--color-ink)]">
                {r.contact}
                {r.availability ? (
                  <span className="text-[color:var(--color-ink-soft)]">
                    {" "}
                    · {r.availability}
                  </span>
                ) : null}
              </div>
              {r.note ? (
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  {r.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
        Interview practice will be here whenever you&rsquo;re ready.
      </p>
    </div>
  );
}
