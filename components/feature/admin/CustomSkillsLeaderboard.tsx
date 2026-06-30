"use client";

/**
 * Phase 19.2  the unindexed-custom-skill leaderboard. Aggregate + anonymized
 * (a seeker COUNT per label, never which seekers). One-click "Promote" reveals
 * a slug field (pre-filled from the label) → `canonicalizeCustomSkill`, which
 * creates the canonical skill + migrates every holder into the searchable
 * taxonomy. Civic Editorial: ordinal pillars, tabular counts, thick rule.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { canonicalizeCustomSkill } from "@/lib/admin/custom-skills";
import type { CustomSkillAggregate } from "@/db/queries/custom-skills";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function CustomSkillsLeaderboard({
  rows,
}: {
  rows: CustomSkillAggregate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [promoting, setPromoting] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(r: CustomSkillAggregate) {
    setPromoting(r.labelNormalized);
    setSlug(slugify(r.label));
    setError(null);
  }

  function confirm(r: CustomSkillAggregate) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await canonicalizeCustomSkill({
        labelNormalized: r.labelNormalized,
        label: r.label,
        slug,
      });
      if (res.ok) {
        setPromoting(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        No self-described skills yet. When seekers add skills outside the
        taxonomy, the most-requested labels appear here to promote into the
        searchable taxonomy.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[color:var(--color-hairline)]">
      {rows.map((r, i) => (
        <li key={r.labelNormalized} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-display tabular text-sm text-[color:var(--color-ink-soft)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="font-display text-base">{r.label}</span>
                <span className="ml-2 text-xs text-[color:var(--color-ink-soft)]">
                  {r.seekerCount} seeker{r.seekerCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            {promoting !== r.labelNormalized && (
              <button
                type="button"
                onClick={() => open(r)}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-3 text-xs text-[color:var(--color-brand-strong)] hover:bg-[color:var(--color-brand-tint)]"
              >
                <ArrowUpCircle className="size-3.5" aria-hidden="true" />
                Promote to canonical
              </button>
            )}
          </div>

          {promoting === r.labelNormalized && (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3">
              <p className="mb-2 text-xs text-[color:var(--color-ink-soft)]">
                Creates a canonical skill and moves all {r.seekerCount} holder
                {r.seekerCount === 1 ? "" : "s"} into the searchable taxonomy at
                their own self-attested level. This can&rsquo;t be undone in one
                click.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label
                    htmlFor={`slug-${i}`}
                    className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
                  >
                    Canonical slug
                  </label>
                  <input
                    id={`slug-${i}`}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="h-9 w-64 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => confirm(r)}
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50"
                >
                  {pending && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  Confirm promote
                </button>
                <button
                  type="button"
                  onClick={() => setPromoting(null)}
                  className="inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm"
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
                  {error}
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
