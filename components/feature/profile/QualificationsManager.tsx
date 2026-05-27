"use client";

/**
 * Qualifications list + add + upload + delete (Phase 3).
 *
 * - "Add qualification" creates the row in `unverified` state with no document yet.
 * - Each row gets an "Upload document" button that pops a file picker;
 *   sending the file via FormData to `uploadQualificationDocument` flips the
 *   row to `pending` and stores the storage key.
 * - "Delete" removes the row and the storage object.
 *
 * Documents themselves are NEVER linked directly. Only the admin verification
 * queue (Phase 7) and the audit-logged employer reveal flow (Phase 5) can read
 * them, via short-lived signed URLs from `lib/storage/signed.ts`.
 */

import { useRef, useState, useTransition } from "react";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import {
  FileText,
  FileUp,
  Plus,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import {
  addQualification,
  uploadQualificationDocument,
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
}

export function QualificationsManager({
  initial,
  labels,
  verificationVisible = true,
}: Props) {
  const [items, setItems] = useState<QualificationRow[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", institution: "", awardedYear: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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
                  <UploadButton
                    qualificationId={q.id}
                    busy={uploadingId === q.id}
                    onUploading={() => setUploadingId(q.id)}
                    onResult={(result) => {
                      setUploadingId(null);
                      if (result.ok) {
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === q.id
                              ? {
                                  ...row,
                                  hasDocument: true,
                                  verification: "pending",
                                }
                              : row,
                          ),
                        );
                      } else {
                        setError(result.message);
                      }
                    }}
                    hasDocument={q.hasDocument}
                  />
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

// ─────────────────────────────────────────────────────────────────────────────

interface UploadButtonProps {
  qualificationId: string;
  busy: boolean;
  hasDocument: boolean;
  onUploading: () => void;
  onResult: (
    result: { ok: true; key: string } | { ok: false; message: string },
  ) => void;
}

function UploadButton({
  qualificationId,
  busy,
  hasDocument,
  onUploading,
  onResult,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onUploading();
    const fd = new FormData();
    fd.append("qualificationId", qualificationId);
    fd.append("file", file);
    void (async () => {
      try {
        const r = await uploadQualificationDocument(fd);
        onResult(r);
      } catch (err) {
        onResult({
          ok: false,
          message: err instanceof Error ? err.message : "Upload failed.",
        });
      }
    })();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={hasDocument ? "Replace document" : "Upload document"}
        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-3 py-2 text-xs font-medium text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-tint)] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileUp className="size-4" aria-hidden="true" />
        )}
        {busy ? "Uploading…" : hasDocument ? "Replace" : "Upload"}
      </button>
    </>
  );
}
