"use client";

/**
 * Talent pools (shortlists) CRUD client island.
 *
 * Lists pools with their member chips, lets the user create a pool
 * (name + optional description) and delete a pool. Adding/removing
 * individual members from search results or the dossier comes in the
 * Phase 5 follow-up — the action already exists in
 * `lib/employer/shortlists.ts` (`addToPool`).
 */

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { TextField, TextareaField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Trash2,
  Users2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  createPool,
  deletePool,
  removeFromPool,
  type PoolSummary,
} from "@/lib/employer/shortlists";

interface Props {
  initial: PoolSummary[];
}

export function ShortlistsManager({ initial }: Props) {
  const [pools, setPools] = useState<PoolSummary[]>(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    if (form.name.trim().length < 2) {
      setError("Give the pool a name (at least 2 characters).");
      return;
    }
    startTransition(async () => {
      const r = await createPool({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setPools([
        {
          id: r.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          createdAt: new Date().toISOString(),
          memberCount: 0,
          members: [],
        },
        ...pools,
      ]);
      setForm({ name: "", description: "" });
      setAdding(false);
    });
  }

  function handleDelete(poolId: string, name: string) {
    if (
      !window.confirm(
        `Delete pool "${name}"? Members are not deleted — they just lose their place in this pool.`,
      )
    )
      return;
    setBusyId(poolId);
    startTransition(async () => {
      const r = await deletePool({ poolId });
      if (r.ok) setPools((prev) => prev.filter((p) => p.id !== poolId));
      setBusyId(null);
    });
  }

  function handleRemoveMember(poolId: string, handle: string) {
    setBusyId(poolId);
    startTransition(async () => {
      const r = await removeFromPool({ poolId, handle });
      if (r.ok) {
        setPools((prev) =>
          prev.map((p) =>
            p.id === poolId
              ? {
                  ...p,
                  members: p.members.filter((m) => m.handle !== handle),
                  memberCount: p.memberCount - 1,
                }
              : p,
          ),
        );
      }
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-6">
      {adding ? (
        <div className="space-y-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            New talent pool
          </div>
          <div className="grid gap-4">
            <TextField
              id="pool-name"
              label="Pool name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Q3 engineering hires"
            />
            <TextareaField
              id="pool-desc"
              label="Notes"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Internal-only context for your team."
              optional
            />
          </div>
          {error && (
            <p className="inline-flex items-center gap-2 text-sm text-[color:var(--color-danger)]">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={pending}
            >
              <Check className="size-4" aria-hidden="true" />
              {pending ? "Creating…" : "Create pool"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            New pool
          </Button>
        </div>
      )}

      {pools.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center text-[color:var(--color-ink-soft)]">
          No pools yet. Create one above, then add candidates to it from any
          dossier (
          <Link href="/search" className="underline">
            /search
          </Link>{" "}
          → click a candidate → "Add to pool" — wires up alongside the Phase
          5 follow-up).
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {pools.map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
            >
              <header className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl">{p.name}</h2>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                  <Users2 className="size-3" aria-hidden="true" />
                  {p.memberCount}
                </span>
              </header>
              {p.description && (
                <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                  {p.description}
                </p>
              )}
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                Created {new Date(p.createdAt).toLocaleDateString()}
              </p>

              {p.members.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {p.members.map((m) => (
                    <li
                      key={m.handle}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/employer/dossier/${m.handle}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {m.displayName}
                        </Link>
                        <div className="text-xs text-[color:var(--color-ink-soft)]">
                          {m.profession} · {m.city}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${m.displayName} from pool`}
                        onClick={() => handleRemoveMember(p.id, m.handle)}
                        disabled={busyId === p.id || pending}
                        className="rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)] disabled:opacity-60"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-3 text-xs text-[color:var(--color-ink-soft)]">
                  No members yet. Add from a candidate's dossier.
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(p.id, p.name)}
                  disabled={busyId === p.id || pending}
                  className="text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-white"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete pool
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
