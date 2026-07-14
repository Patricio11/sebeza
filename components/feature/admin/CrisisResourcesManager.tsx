"use client";

/**
 * Phase 22.2  admin manager for crisis-support resources. Add / edit / remove +
 * an ACTIVE toggle (only active rows reach seekers). Carries an unmissable
 * "verify before activating" warning  a wrong number is a safety failure.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, Pencil, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import {
  addCrisisResource,
  updateCrisisResource,
  removeCrisisResource,
  type CrisisResourceInput,
} from "@/lib/admin/crisis-resources";
import type { AdminCrisisResource } from "@/db/queries/crisis-resources";

export function CrisisResourcesManager({
  resources,
}: {
  resources: AdminCrisisResource[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const activeCount = resources.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]" aria-hidden="true" />
        <p className="text-[color:var(--color-ink-soft)]">
          <strong className="text-[color:var(--color-ink)]">Verify every number against an
          authoritative source before activating it.</strong>{" "}
          A dead or wrong crisis line is itself a safety failure. Only{" "}
          <strong>active</strong> resources are shown to seekers  currently{" "}
          <strong>{activeCount}</strong>.
        </p>
      </div>

      {adding ? (
        <ResourceForm
          heading="Add a resource"
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            run(async () => {
              const r = await addCrisisResource(input);
              if (r.ok) setAdding(false);
            })
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-sm hover:bg-[color:var(--color-surface-sunk)]"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a resource
        </button>
      )}

      <ul className="space-y-3">
        {resources.map((r) => (
          <li
            key={r.id}
            className={`rounded-[var(--radius-md)] border p-4 ${
              r.active
                ? "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]"
                : "border-dashed border-[color:var(--color-hairline)] opacity-70"
            }`}
          >
            {editingId === r.id ? (
              <ResourceForm
                heading="Edit resource"
                initial={r}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(input) =>
                  run(async () => {
                    const res = await updateCrisisResource(r.id, input);
                    if (res.ok) setEditingId(null);
                  })
                }
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base">{r.name}</span>
                    <span
                      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] ${
                        r.active
                          ? "border border-[color:var(--color-brand)] text-[color:var(--color-brand-strong)]"
                          : "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]"
                      }`}
                    >
                      {r.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-sm text-[color:var(--color-ink)]">
                    {r.contact}
                    {r.availability ? (
                      <span className="text-[color:var(--color-ink-soft)]"> · {r.availability}</span>
                    ) : null}
                  </div>
                  {r.note ? (
                    <p className="text-xs text-[color:var(--color-ink-soft)]">{r.note}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingId(r.id)}
                    disabled={pending}
                    className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs hover:border-[color:var(--color-ink)] disabled:opacity-50"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => removeCrisisResource(r.id))}
                    disabled={pending}
                    className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs hover:border-[color:var(--color-ink)] disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceForm({
  heading,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial?: AdminCrisisResource;
  pending: boolean;
  onSubmit: (input: CrisisResourceInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    contact: initial?.contact ?? "",
    availability: initial?.availability ?? "",
    note: initial?.note ?? "",
    active: initial?.active ?? false,
  });

  const field =
    "h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: form.name,
          contact: form.contact,
          availability: form.availability,
          note: form.note,
          active: form.active,
        });
      }}
      className="space-y-3"
    >
      <h3 className="font-display text-base">{heading}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Name (e.g. SADAG Mental Health Line)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <input className={field} placeholder="Verified contact (e.g. 0800 … / SMS …)" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} required />
        <input className={field} placeholder="Availability (e.g. 24/7)  optional" value={form.availability} onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))} />
        <input className={field} placeholder="Note  optional" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
        Active (shown to seekers)  only tick once the contact is verified
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
        <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
