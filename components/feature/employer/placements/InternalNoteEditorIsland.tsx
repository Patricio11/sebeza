"use client";

/**
 * Phase 9.20 Tier 2  client island for the editable internal note
 * panel on the placement detail page. Read-only display until the
 * user hits "Edit"; switches to a textarea + character counter +
 * Save / Cancel. 1000-char cap (D6).
 *
 * Mirrors the Tier 1 InternalNotePanel exactly when not editing so
 * swapping between "view" and "edit" feels in-place rather than a
 * surprise modal. The server action threads the same closure pattern
 * the rest of the surface uses.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { StickyNote, Pencil, X } from "lucide-react";

const NOTE_MAX = 1000;

interface Props {
  placementId: string;
  /** Current persisted note (null when none). */
  initialNote: string | null;
  /** Owner / Recruiter can edit; Viewer sees the read-only panel. */
  canEdit: boolean;
  action: (input: {
    placementId: string;
    note: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
}

export function InternalNoteEditorIsland({
  placementId,
  initialNote,
  canEdit,
  action,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await action({ placementId, note: draft });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }
  function onCancel() {
    setDraft(initialNote ?? "");
    setEditing(false);
    setError(null);
  }

  return (
    <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <StickyNote className="size-3" aria-hidden="true" />
          Internal note
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Org-private
          </span>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 text-xs text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
            >
              <Pencil className="size-3" aria-hidden="true" />
              {initialNote ? "Edit" : "Add note"}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <label
            htmlFor={`internal-note-${placementId}`}
            className="sr-only"
          >
            Internal note
          </label>
          <textarea
            id={`internal-note-${placementId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            maxLength={NOTE_MAX}
            rows={5}
            placeholder="Durable context only your team sees. Never visible to the seeker."
            className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3 text-sm text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span
              className={
                "text-[0.65rem] uppercase tracking-[0.18em] " +
                (draft.length > NOTE_MAX
                  ? "text-[color:var(--color-danger)]"
                  : "text-[color:var(--color-ink-soft)]")
              }
              aria-live="polite"
            >
              {draft.length} / {NOTE_MAX}  empty clears the note
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onCancel}
                disabled={pending}
              >
                <X className="size-3" aria-hidden="true" />
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onSave}
                disabled={pending}
              >
                {pending ? "Saving" : "Save note"}
              </Button>
            </div>
          </div>
          {error && (
            <div
              role="alert"
              className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
            >
              {error}
            </div>
          )}
        </div>
      ) : initialNote ? (
        <p className="whitespace-pre-wrap text-sm text-[color:var(--color-ink)]">
          {initialNote}
        </p>
      ) : (
        <p className="text-sm italic text-[color:var(--color-ink-soft)]">
          No internal note yet. Use this space for durable context only
          your team sees (never the seeker).
        </p>
      )}
    </section>
  );
}
