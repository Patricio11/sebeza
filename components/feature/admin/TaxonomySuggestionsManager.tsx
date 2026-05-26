"use client";

/**
 * Phase 9.15  Admin queue for the "Other" taxonomy suggestions.
 *
 * Lists pending profession + institution suggestions, grouped by kind.
 * For each, the admin can:
 *   - Promote: add the custom text to the canonical list (with optional
 *     spelling correction) + backfill any matching profile/academic rows
 *   - Merge into existing: pick an existing canonical entry to merge
 *     this into; the canonical comboxbox picker reuses the patterns
 *     from sign-up + search; backfill happens server-side
 *   - Reject: dismiss the suggestion. User data is NEVER mutated.
 *
 * Each action prompts inline (no modal) so the admin can review quickly.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { ComboboxField } from "@/components/ui/ComboboxField";
import {
  promoteTaxonomySuggestion,
  mergeTaxonomySuggestion,
  rejectTaxonomySuggestion,
  type SuggestionRow,
} from "@/lib/taxonomy/suggestions";
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  PencilLine,
  ShieldOff,
  Users,
} from "lucide-react";

interface CanonicalOption {
  value: string; // slug
  label: string;
}

interface Props {
  professionSuggestions: SuggestionRow[];
  institutionSuggestions: SuggestionRow[];
  /** Canonical professions for the merge-into picker. */
  canonicalProfessions: CanonicalOption[];
  /** Canonical institutions (non-pending, non-deleted) for the merge picker. */
  canonicalInstitutions: CanonicalOption[];
}

export function TaxonomySuggestionsManager({
  professionSuggestions,
  institutionSuggestions,
  canonicalProfessions,
  canonicalInstitutions,
}: Props) {
  return (
    <div className="space-y-10">
      <Section
        title="Profession suggestions"
        empty="No pending profession suggestions."
        rows={professionSuggestions}
        canonical={canonicalProfessions}
        kindLabel="profession"
      />
      <Section
        title="Institution suggestions"
        empty="No pending institution suggestions."
        rows={institutionSuggestions}
        canonical={canonicalInstitutions}
        kindLabel="institution"
      />
    </div>
  );
}

function Section({
  title,
  empty,
  rows,
  canonical,
  kindLabel,
}: {
  title: string;
  empty: string;
  rows: SuggestionRow[];
  canonical: CanonicalOption[];
  kindLabel: string;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
        <h2 className="font-display text-2xl">{title}</h2>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          {rows.length} pending
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 text-sm italic text-[color:var(--color-ink-soft)]">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <SuggestionRowCard
                row={row}
                canonical={canonical}
                kindLabel={kindLabel}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionRowCard({
  row,
  canonical,
  kindLabel,
}: {
  row: SuggestionRow;
  canonical: CanonicalOption[];
  kindLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<
    "idle" | "promote" | "merge" | "reject"
  >("idle");
  const [correctedLabel, setCorrectedLabel] = useState(row.customText);
  const [mergeTarget, setMergeTarget] = useState("");
  const [reason, setReason] = useState("");

  function onPromote() {
    setError(null);
    startTransition(async () => {
      const res = await promoteTaxonomySuggestion({
        suggestionId: row.id,
        correctedLabel:
          correctedLabel.trim() !== row.customText.trim()
            ? correctedLabel
            : undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onMerge() {
    setError(null);
    if (!mergeTarget) {
      setError("Pick an existing entry to merge into.");
      return;
    }
    startTransition(async () => {
      const res = await mergeTaxonomySuggestion({
        suggestionId: row.id,
        targetSlug: mergeTarget,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function onReject() {
    setError(null);
    if (reason.trim().length < 2) {
      setError("Add a short rejection reason (>= 2 chars).");
      return;
    }
    startTransition(async () => {
      const res = await rejectTaxonomySuggestion({
        suggestionId: row.id,
        reason: reason.trim(),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-lg text-[color:var(--color-ink)]">
            {row.customText}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
            <Users className="mr-1 inline size-3" aria-hidden="true" />
            {row.submitterCount} submitter{row.submitterCount === 1 ? "" : "s"}
            {" · first "}
            {new Date(row.submittedAt).toLocaleDateString()}
          </p>
        </div>
        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setMode("promote")}
            >
              <CheckCircle2 className="mr-1 size-3.5" aria-hidden="true" />
              Promote
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMode("merge")}
            >
              <GitMerge className="mr-1 size-3.5" aria-hidden="true" />
              Merge
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("reject")}
            >
              <ShieldOff className="mr-1 size-3.5" aria-hidden="true" />
              Reject
            </Button>
          </div>
        )}
      </header>

      {mode === "promote" && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-3">
          <label className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
            <PencilLine className="mr-1 inline size-3" aria-hidden="true" />
            Promote with corrected label (leave as-is to keep original)
          </label>
          <input
            type="text"
            value={correctedLabel}
            onChange={(e) => setCorrectedLabel(e.target.value)}
            maxLength={80}
            disabled={pending}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode("idle");
                setCorrectedLabel(row.customText);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onPromote}
              disabled={pending || correctedLabel.trim().length < 2}
            >
              {pending ? "Promoting" : "Confirm promote"}
            </Button>
          </div>
        </div>
      )}

      {mode === "merge" && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] p-3">
          <ComboboxField
            label={`Merge into existing ${kindLabel}`}
            value={mergeTarget}
            onChange={setMergeTarget}
            options={canonical}
            placeholder={`Search existing ${kindLabel}s…`}
            helpText="All profiles carrying this exact custom text will be re-pointed at the target."
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode("idle");
                setMergeTarget("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onMerge}
              disabled={pending || !mergeTarget}
            >
              {pending ? "Merging" : "Confirm merge"}
            </Button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 p-3">
          <label className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-danger)]">
            Rejection reason (audit log; user not notified)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            maxLength={280}
            rows={2}
            placeholder="Why reject? (spam, joke, abusive, etc.)"
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[0.65rem] italic text-[color:var(--color-ink-soft)]">
            The submitter&rsquo;s profile data is preserved. This just removes
            the suggestion from the queue.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode("idle");
                setReason("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onReject}
              disabled={pending || reason.trim().length < 2}
            >
              {pending ? "Rejecting" : "Confirm reject"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

