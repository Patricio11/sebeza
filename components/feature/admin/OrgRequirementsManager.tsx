"use client";

/**
 * "Documents orgs must upload" (2026-08, founder decision per the SRS
 * blueprint): the admin-managed checklist that drives the employer
 * onboarding form. Add, edit, require/optional, retire/restore
 * (soft-delete), reorder. Every change is audited and reflected on
 * /employer/onboarding immediately.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  moveDocumentRequirement,
  saveDocumentRequirement,
  toggleDocumentRequirement,
  type AdminRequirementRow,
} from "@/lib/admin/org-requirements";

export function OrgRequirementsManager({
  rows,
}: {
  rows: AdminRequirementRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function openEditor(row?: AdminRequirementRow) {
    setEditing(row ? row.id : "new");
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setRequired(row?.required ?? true);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveDocumentRequirement({
        id: editing === "new" ? undefined : (editing ?? undefined),
        name,
        description: description || undefined,
        required,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function toggle(row: AdminRequirementRow) {
    startTransition(async () => {
      const res = await toggleDocumentRequirement({
        id: row.id,
        active: !row.active,
      });
      if (!res.ok) setError(res.message);
      router.refresh();
    });
  }

  function move(row: AdminRequirementRow, direction: "up" | "down") {
    startTransition(async () => {
      await moveDocumentRequirement({ id: row.id, direction });
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="org-reqs-h"
      className="mb-8 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="org-reqs-h"
            className="font-display text-lg text-[color:var(--color-ink)]"
          >
            Documents orgs must upload
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-[color:var(--color-ink-soft)]">
            This checklist drives the employer onboarding form. Changes apply
            immediately to every org still in the draft state; retired items
            keep their already-uploaded documents attached for review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-3.5 text-xs font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add document
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 py-2 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}

      {editing !== null && (
        <form
          onSubmit={submit}
          className="mt-4 grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4 md:grid-cols-[2fr_3fr_auto_auto]"
        >
          <input
            autoFocus
            required
            minLength={3}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Document name (e.g. B-BBEE certificate)"
            aria-label="Document name"
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
          <input
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Helper text shown to the org (optional)"
            aria-label="Helper text"
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
          <label className="flex h-10 items-center gap-2 text-xs text-[color:var(--color-ink)]">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="size-4"
            />
            Required
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-xs uppercase tracking-[0.18em] text-[color:var(--color-paper)] disabled:opacity-60"
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="mt-4 divide-y divide-[color:var(--color-hairline)]">
        {rows.map((row, i) => (
          <li
            key={row.id}
            className={
              "flex flex-wrap items-center gap-3 py-2.5 " +
              (row.active ? "" : "opacity-50")
            }
          >
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                aria-label={`Move ${row.name} up`}
                disabled={pending || i === 0}
                onClick={() => move(row, "up")}
                className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Move ${row.name} down`}
                disabled={pending || i === rows.length - 1}
                onClick={() => move(row, "down")}
                className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[color:var(--color-ink)]">
                {row.name}
                {row.required && (
                  <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--color-brand-strong)]">
                    required
                  </span>
                )}
                {!row.active && (
                  <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
                    retired
                  </span>
                )}
              </p>
              {row.description && (
                <p className="truncate text-xs text-[color:var(--color-ink-soft)]">
                  {row.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openEditor(row)}
                className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
              >
                <Pencil className="size-3" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(row)}
                className={
                  "inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] " +
                  (row.active
                    ? "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
                    : "text-[color:var(--color-brand-strong)] hover:underline")
                }
              >
                {row.active ? (
                  <>
                    <Trash2 className="size-3" aria-hidden="true" />
                    Retire
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-3" aria-hidden="true" />
                    Restore
                  </>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
