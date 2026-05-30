"use client";

/**
 * Experience CRUD on the seeker dashboard. Single client island owning the
 * list + the inline "add" + "edit" form. Submits to add/update/deleteExperience.
 */

import { useState, useTransition } from "react";
import { TextField, TextareaField } from "@/components/ui/FormField";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import {
  addExperience,
  updateExperience,
  deleteExperience,
} from "@/lib/profile/experience";

export interface ExperienceRow {
  id: string;
  role: string;
  organization: string;
  city: string | null;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
}

interface Props {
  initial: ExperienceRow[];
  labels: {
    add: string;
    to: string;
    current: string;
    empty: string;
  };
}

type Mode = "idle" | { kind: "add" } | { kind: "edit"; id: string };

interface FormState {
  role: string;
  organization: string;
  city: string;
  startedAt: string;
  endedAt: string;
  isCurrent: boolean;
  description: string;
}

const EMPTY_FORM: FormState = {
  role: "",
  organization: "",
  city: "",
  startedAt: "",
  endedAt: "",
  isCurrent: false,
  description: "",
};

export function ExperienceManager({ initial, labels }: Props) {
  const [items, setItems] = useState<ExperienceRow[]>(initial);
  const [mode, setMode] = useState<Mode>("idle");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setMode({ kind: "add" });
  }

  function openEdit(row: ExperienceRow) {
    setForm({
      role: row.role,
      organization: row.organization,
      city: row.city ?? "",
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? "",
      isCurrent: row.endedAt === null,
      description: row.description ?? "",
    });
    setError(null);
    setMode({ kind: "edit", id: row.id });
  }

  function cancel() {
    setMode("idle");
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    const payload = {
      role: form.role.trim(),
      organization: form.organization.trim(),
      city: form.city.trim() || null,
      startedAt: form.startedAt,
      endedAt: form.isCurrent ? null : form.endedAt || null,
      description: form.description.trim() || null,
    };
    if (!payload.role || !payload.organization || !payload.startedAt) {
      setError("Role, organisation and start date are required.");
      return;
    }
    startTransition(async () => {
      if (mode !== "idle" && mode.kind === "edit") {
        const r = await updateExperience({ id: mode.id, ...payload });
        if (!r.ok) {
          setError(r.message);
          return;
        }
        setItems((prev) =>
          prev.map((row) =>
            row.id === mode.id ? { ...row, ...payload, city: payload.city ?? null } : row,
          ),
        );
      } else {
        const r = await addExperience(payload);
        if (!r.ok) {
          setError(r.message);
          return;
        }
        setItems((prev) => [
          { id: r.id, ...payload, city: payload.city ?? null },
          ...prev,
        ]);
      }
      setMode("idle");
      setForm(EMPTY_FORM);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteExperience(id);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== id));
    });
  }

  const isAdding = mode !== "idle" && mode.kind === "add";

  return (
    <div className="space-y-6">
      {mode === "idle" && (
        <div className="flex justify-end">
          <Button type="button" variant="primary" size="md" onClick={openAdd}>
            <Plus className="size-4" aria-hidden="true" />
            {labels.add}
          </Button>
        </div>
      )}

      {mode !== "idle" && (
        <div className="space-y-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {isAdding ? "New role" : "Edit role"}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="exp-role"
              label="Role title"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              autoComplete="off"
            />
            <TextField
              id="exp-org"
              label="Organisation"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              autoComplete="organization"
            />
            <TextField
              id="exp-city"
              label="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              autoComplete="address-level2"
            />
            {/* Phase 10 follow-up  civic-editorial month+year pickers
                replace the browser-default <input type="month">. The
                wire shape (ISO yyyy-mm) is unchanged. */}
            <MonthYearPicker
              id="exp-start"
              label="Started"
              value={form.startedAt}
              onChange={(v) => setForm({ ...form, startedAt: v })}
              maxYear={new Date().getFullYear()}
              minYear={new Date().getFullYear() - 60}
            />
            <MonthYearPicker
              id="exp-end"
              label={labels.to}
              value={form.isCurrent ? "" : form.endedAt}
              onChange={(v) => setForm({ ...form, endedAt: v })}
              disabled={form.isCurrent}
              maxYear={new Date().getFullYear()}
              minYear={new Date().getFullYear() - 60}
            />
            <Checkbox
              className="mt-2 md:mt-auto md:pb-3"
              align="center"
              checked={form.isCurrent}
              onChange={(v) =>
                setForm({
                  ...form,
                  isCurrent: v,
                  endedAt: v ? "" : form.endedAt,
                })
              }
              label={labels.current}
            />
            <TextareaField
              id="exp-desc"
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="md:col-span-2"
              hint="Two sentences max. What did you own, what did you ship."
            />
          </div>
          {error && <p className="text-xs text-[color:var(--color-danger)]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={pending}
            >
              <Check className="size-4" aria-hidden="true" />
              {pending ? "Saving…" : isAdding ? "Add role" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancel}
              disabled={pending}
            >
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center">
          <p className="text-[color:var(--color-ink-soft)]">{labels.empty}</p>
        </div>
      ) : (
        <ol className="space-y-4">
          {items.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[1fr_auto] items-start gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
            >
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  {e.startedAt} {labels.to}{" "}
                  {e.endedAt ?? (
                    <span className="text-[color:var(--color-accent)]">
                      {labels.current}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-display text-xl">{e.role}</div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {e.organization}
                  {e.city ? ` · ${e.city}` : ""}
                </div>
                {e.description && (
                  <p className="mt-2 text-sm">{e.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                  onClick={() => openEdit(e)}
                  aria-label={`Edit ${e.role}`}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                  onClick={() => handleDelete(e.id)}
                  disabled={pending}
                  aria-label={`Delete ${e.role}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
