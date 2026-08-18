"use client";

/**
 * Qualifications list + add + delete (Phase 3; evidence uploads RETIRED
 * 2026-08 per docs/SELFIE_VERIFICATION_PLAN.md).
 *
 * Qualifications are self-declared and honestly labelled unverified; the
 * profile Verified badge is earned via the live selfie. Rows that already
 * have a document keep their "Document on file" note + earned badges.
 */

import { useState, useTransition } from "react";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { FileText, Plus, Trash2, X, Check } from "lucide-react";
import {
  addQualification,
  deleteQualification,
} from "@/lib/profile/qualifications";
import type { VerificationStatus } from "@/lib/mock/types";

export interface QualificationRow {
  id: string;
  title: string;
  institution: string;
  awardedYear: number | null;
  verification: VerificationStatus;
  hasDocument: boolean;
}

interface Props {
  initial: QualificationRow[];
  labels: { add: string; empty: string };
  /**
   * Phase 9.16.1  threaded from the parent server page (reads the
   * `feature_flag_verification_badges_visible` platform setting).
   * Default true so existing callers stay unchanged.
   */
  verificationVisible?: boolean;
  /**
   * Phase 11.2.3  bridge from the learning-loop celebration. When set,
   * we auto-open the Add panel with the title + institution fields
   * pre-filled (still editable). Per D3 we do NOT link the resulting
   * qualification row to the learning_items row  decoupling is correct
   * (seeker may have taken a different course than the suggested one).
   */
  prefill?: { title: string; institution: string };
}

export function QualificationsManager({
  initial,
  labels,
  verificationVisible = true,
  prefill,
}: Props) {
  const [items, setItems] = useState<QualificationRow[]>(initial);
  const [adding, setAdding] = useState(!!prefill);
  const [draft, setDraft] = useState({
    title: prefill?.title ?? "",
    institution: prefill?.institution ?? "",
    awardedYear: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    const title = draft.title.trim();
    const institution = draft.institution.trim();
    if (!title || !institution) {
      setError("Title and institution are required.");
      return;
    }
    const year = draft.awardedYear.trim();
    const awardedYear = year ? Number(year) : null;
    if (year && (Number.isNaN(awardedYear) || awardedYear! < 1950 || awardedYear! > 2100)) {
      setError("Year doesn't look right.");
      return;
    }
    startTransition(async () => {
      const r = await addQualification({ title, institution, awardedYear });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setItems((prev) => [
        {
          id: r.id,
          title,
          institution,
          awardedYear,
          verification: "unverified",
          hasDocument: false,
        },
        ...prev,
      ]);
      setDraft({ title: "", institution: "", awardedYear: "" });
      setAdding(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteQualification(id);
      if (r.ok) {
        setItems((prev) => prev.filter((x) => x.id !== id));
      } else {
        setError(r.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Add row */}
      {adding ? (
        <div className="space-y-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            New qualification
          </div>
          <div className="grid gap-4 md:grid-cols-[2fr_2fr_1fr]">
            <TextField
              id="q-title"
              label="Title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="National Diploma in Electrical Engineering"
            />
            <TextField
              id="q-inst"
              label="Institution"
              value={draft.institution}
              onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
              placeholder="Tshwane University of Technology"
            />
            <TextField
              id="q-year"
              label="Year awarded"
              value={draft.awardedYear}
              onChange={(e) => setDraft({ ...draft, awardedYear: e.target.value })}
              type="number"
              inputMode="numeric"
              placeholder="2021"
              optional
            />
          </div>
          {error && <p className="text-xs text-[color:var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="primary" size="sm" onClick={handleAdd} disabled={pending}>
              <Check className="size-4" aria-hidden="true" />
              {pending ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError(null);
                setDraft({ title: "", institution: "", awardedYear: "" });
              }}
            >
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="primary" size="md" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {labels.add}
          </Button>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center">
          <p className="text-[color:var(--color-ink-soft)]">{labels.empty}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((q) => (
            <li
              key={q.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-display text-lg">{q.title}</div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {q.institution}
                  {q.awardedYear ? ` · ${q.awardedYear}` : ""}
                  {q.hasDocument && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                      <FileText className="size-3" aria-hidden="true" />
                      Document on file
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <VerificationBadge state={q.verification} visible={verificationVisible} />
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Delete ${q.title}`}
                    onClick={() => handleDelete(q.id)}
                    disabled={pending}
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-[color:var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
