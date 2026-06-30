"use client";

/**
 * Phase 18.2 ("Living Learning Catalog")  the editorial admin island.
 *
 * A "Needs re-verification" rail (the freshness heartbeat made actionable) over
 * a full table of paths with per-row Verify / Edit / Delete-or-Restore + an Add
 * form. Calls the admin Server Actions, then refreshes the route. Civic
 * Editorial: thick rules, eyebrows, tabular numerals, ochre on stale rows.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { CheckCircle2, Pencil, Trash2, RotateCcw, Plus, AlertTriangle } from "lucide-react";
import {
  createLearningPath,
  updateLearningPath,
  markLearningPathVerified,
  softDeleteLearningPath,
  restoreLearningPath,
  type PathInput,
} from "@/lib/admin/learning-paths";

export interface AdminPathDto {
  id: string;
  title: string;
  provider: string;
  providerKind: string;
  cost: string;
  costNote: string | null;
  outcome: string;
  durationWeeks: number;
  unlocksSkills: string[];
  national: boolean;
  url: string | null;
  sebenzaReviewed: boolean;
  lastVerifiedAt: string | null;
  reviewCount: number;
  recommendCount: number;
  deleted: boolean;
  stale: boolean;
}

export function LearningPathsManager({ paths }: { paths: AdminPathDto[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const stale = paths.filter((p) => p.stale);

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Needs re-verification rail */}
      <section>
        <div className="mb-3 flex items-center gap-2 border-b-2 border-[color:var(--color-ink)] pb-2">
          <AlertTriangle className="size-4 text-[color:var(--color-accent)]" aria-hidden="true" />
          <h2 className="font-display text-lg">Needs re-verification</h2>
          <span className="font-display tabular text-sm text-[color:var(--color-ink-soft)]">
            {stale.length}
          </span>
        </div>
        {stale.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Every live path was re-verified within the last 90 days.
          </p>
        ) : (
          <ul className="space-y-2">
            {stale.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/[0.06] p-3"
              >
                <div className="text-sm">
                  <strong>{p.title}</strong>
                  <span className="text-[color:var(--color-ink-soft)]">
                    {"  "}
                    {p.lastVerifiedAt
                      ? `last verified ${formatDate(p.lastVerifiedAt)}`
                      : "never verified"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => markLearningPathVerified(p.id))}
                  className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-3 text-xs text-[color:var(--color-brand-strong)] hover:bg-[color:var(--color-brand-tint)] disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Verify now
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add */}
      <section>
        {adding ? (
          <PathForm
            heading="Add a learning path"
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              run(async () => {
                const r = await createLearningPath(input);
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
            Add a learning path
          </button>
        )}
      </section>

      {/* Full table */}
      <section>
        <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-lg">
          All paths{" "}
          <span className="font-display tabular text-sm text-[color:var(--color-ink-soft)]">
            {paths.length}
          </span>
        </h2>
        <ul className="space-y-3">
          {paths.map((p) => (
            <li
              key={p.id}
              className={`rounded-[var(--radius-md)] border p-4 ${
                p.deleted
                  ? "border-dashed border-[color:var(--color-hairline)] opacity-60"
                  : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]"
              }`}
            >
              {editingId === p.id ? (
                <PathForm
                  heading="Edit path"
                  initial={p}
                  pending={pending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(input) =>
                    run(async () => {
                      const r = await updateLearningPath(p.id, input);
                      if (r.ok) setEditingId(null);
                    })
                  }
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      <span>{p.providerKind}</span>
                      <span>·</span>
                      <span>{p.cost}</span>
                      {p.stale && (
                        <span className="text-[color:var(--color-accent)]">· stale</span>
                      )}
                      {p.deleted && <span>· removed</span>}
                    </div>
                    <h3 className="font-display text-base">{p.title}</h3>
                    <p className="text-sm text-[color:var(--color-ink-soft)]">{p.provider}</p>
                    <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                      {p.reviewCount > 0
                        ? `${p.recommendCount}/${p.reviewCount} recommend`
                        : "no reviews yet"}
                      {"  "}
                      {p.lastVerifiedAt
                        ? `verified ${formatDate(p.lastVerifiedAt)}`
                        : "never verified"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {!p.deleted && (
                      <>
                        <RowBtn
                          label="Verify"
                          icon={<CheckCircle2 className="size-3.5" />}
                          pending={pending}
                          onClick={() => run(() => markLearningPathVerified(p.id))}
                        />
                        <RowBtn
                          label="Edit"
                          icon={<Pencil className="size-3.5" />}
                          pending={pending}
                          onClick={() => setEditingId(p.id)}
                        />
                        <RowBtn
                          label="Remove"
                          icon={<Trash2 className="size-3.5" />}
                          pending={pending}
                          onClick={() => run(() => softDeleteLearningPath(p.id))}
                        />
                      </>
                    )}
                    {p.deleted && (
                      <RowBtn
                        label="Restore"
                        icon={<RotateCcw className="size-3.5" />}
                        pending={pending}
                        onClick={() => run(() => restoreLearningPath(p.id))}
                      />
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RowBtn({
  label,
  icon,
  onClick,
  pending,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)] disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function PathForm({
  heading,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial?: AdminPathDto;
  pending: boolean;
  onSubmit: (input: PathInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    provider: initial?.provider ?? "",
    providerKind: initial?.providerKind ?? "open",
    cost: (initial?.cost as "free" | "subsidised" | "paid") ?? "free",
    costNote: initial?.costNote ?? "",
    outcome: initial?.outcome ?? "",
    durationWeeks: initial?.durationWeeks ?? 4,
    unlocksSkills: (initial?.unlocksSkills ?? []).join(", "),
    national: initial?.national ?? false,
    url: initial?.url ?? "",
    sebenzaReviewed: initial?.sebenzaReviewed ?? false,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title: form.title,
      provider: form.provider,
      providerKind: form.providerKind,
      cost: form.cost,
      costNote: form.costNote,
      outcome: form.outcome,
      durationWeeks: form.durationWeeks,
      unlocksSkills: form.unlocksSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      national: form.national,
      url: form.url,
      sebenzaReviewed: form.sebenzaReviewed,
    });
  }

  const field =
    "h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]";

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-display text-base">{heading}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
        <input className={field} placeholder="Provider" value={form.provider} onChange={(e) => set("provider", e.target.value)} required />
        <input className={field} placeholder="Provider kind (seta/tvet/university/open…)" value={form.providerKind} onChange={(e) => set("providerKind", e.target.value)} required />
        <select className={field} value={form.cost} onChange={(e) => set("cost", e.target.value as typeof form.cost)}>
          <option value="free">free</option>
          <option value="subsidised">subsidised</option>
          <option value="paid">paid</option>
        </select>
        <input className={field} type="number" min={0} placeholder="Duration (weeks)" value={form.durationWeeks} onChange={(e) => set("durationWeeks", Number(e.target.value))} />
        <input className={field} placeholder="Cost note (optional)" value={form.costNote} onChange={(e) => set("costNote", e.target.value)} />
        <input className={`${field} sm:col-span-2`} placeholder="Outcome" value={form.outcome} onChange={(e) => set("outcome", e.target.value)} required />
        <input className={`${field} sm:col-span-2`} placeholder="Enrolment URL (optional)" value={form.url} onChange={(e) => set("url", e.target.value)} />
        <input className={`${field} sm:col-span-2`} placeholder="Unlocks skills (comma-separated labels)" value={form.unlocksSkills} onChange={(e) => set("unlocksSkills", e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.national} onChange={(e) => set("national", e.target.checked)} />
          National
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.sebenzaReviewed} onChange={(e) => set("sebenzaReviewed", e.target.checked)} />
          Sebenza reviewed
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}
