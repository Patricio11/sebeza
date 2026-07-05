"use client";

/**
 * Phase 24  the testimonials admin island: campaign toggle (starts/stops the
 * dashboard collection card), approve / hide / delete, and manual creation.
 * Only approved rows reach the landing rail.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Megaphone, Check, EyeOff, Trash2, Plus, Loader2, Quote } from "lucide-react";
import {
  setTestimonialCampaign,
  setTestimonialState,
  createTestimonial,
  deleteTestimonial,
} from "@/lib/admin/testimonials";
import type { AdminTestimonial } from "@/lib/testimonials";

export function TestimonialsManager({
  rows,
  campaignOn,
}: {
  rows: AdminTestimonial[];
  campaignOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ quote: "", displayName: "", displayContext: "" });
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const pendingRows = rows.filter((r) => r.state === "pending");

  return (
    <div className="space-y-8">
      {/* Campaign toggle */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
        <div className="flex items-start gap-2">
          <Megaphone className="mt-0.5 size-5 text-[color:var(--color-brand)]" aria-hidden="true" />
          <div>
            <div className="font-display text-base">Collection campaign</div>
            <p className="text-xs text-[color:var(--color-ink-soft)]">
              While ON, eligible seekers + employers see a small dismissible
              card on their dashboard. Dismiss = snoozed 30 days; submitted =
              never asked again.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => run(() => setTestimonialCampaign(!campaignOn))}
          disabled={pending}
          className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] px-4 text-sm disabled:opacity-50 ${
            campaignOn
              ? "border border-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]"
              : "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
          }`}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {campaignOn ? "Stop collecting" : "Start collecting"}
        </button>
      </section>

      {/* Manual creation */}
      <section>
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              run(async () => {
                const r = await createTestimonial(form);
                if (r.ok) {
                  setAdding(false);
                  setForm({ quote: "", displayName: "", displayContext: "" });
                } else {
                  setError(r.error);
                }
              });
            }}
            className="space-y-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4"
          >
            <h3 className="font-display text-base">Create a testimonial</h3>
            <textarea
              value={form.quote}
              onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
              maxLength={280}
              rows={2}
              placeholder="The quote (20–280 characters)"
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Display name (e.g. Thandeka M.)"
                className="h-10 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                required
              />
              <input
                value={form.displayContext}
                onChange={(e) => setForm((f) => ({ ...f, displayContext: e.target.value }))}
                placeholder="Context (e.g. Pastry Chef · Cape Town)"
                className="h-10 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-xs text-[color:var(--color-danger)]">{error}</p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50">
                Create (approved)
              </button>
              <button type="button" onClick={() => setAdding(false)} className="inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-sm hover:bg-[color:var(--color-surface-sunk)]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Create a testimonial
          </button>
        )}
      </section>

      {/* Pending queue first, then everything */}
      <section>
        <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-lg">
          Review queue{" "}
          <span className="font-display tabular text-sm text-[color:var(--color-ink-soft)]">
            {pendingRows.length}
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Nothing yet  start a campaign to collect real words from users.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`rounded-[var(--radius-md)] border p-4 ${
                  r.state === "approved"
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
                    : r.state === "hidden"
                      ? "border-dashed border-[color:var(--color-hairline)] opacity-60"
                      : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <blockquote className="flex items-start gap-2 text-sm text-[color:var(--color-ink)]">
                      <Quote className="mt-0.5 size-4 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
                      <span>&ldquo;{r.quote}&rdquo;</span>
                    </blockquote>
                    <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                      {r.displayName} · {r.displayContext} · {r.authorRole}
                      {" · "}
                      <span className="uppercase tracking-[0.14em]">{r.state}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {r.state !== "approved" && (
                      <button
                        type="button"
                        onClick={() => run(() => setTestimonialState(r.id, "approved"))}
                        disabled={pending}
                        className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-2.5 text-xs text-[color:var(--color-brand-strong)] hover:bg-[color:var(--color-brand-tint)] disabled:opacity-50"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        Approve
                      </button>
                    )}
                    {r.state !== "hidden" && (
                      <button
                        type="button"
                        onClick={() => run(() => setTestimonialState(r.id, "hidden"))}
                        disabled={pending}
                        className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs hover:border-[color:var(--color-ink)] disabled:opacity-50"
                      >
                        <EyeOff className="size-3.5" aria-hidden="true" />
                        Hide
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => run(() => deleteTestimonial(r.id))}
                      disabled={pending}
                      className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs hover:border-[color:var(--color-ink)] disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
