"use client";

/**
 * "Mark as hired" — the Placement-Truth Rule control.
 *
 * Gate: a prior `profile.contact.reveal` must exist for this org+profile
 * in the last 30 days. The server checks this; we mirror the state on
 * the client so the form is only enabled when it'll succeed.
 *
 * When a placement exists already, we show a confirmation card instead.
 */

import { useState, useTransition } from "react";
import { Briefcase, Check, AlertTriangle } from "lucide-react";
import { TextField } from "@/components/ui/FormField";
import { markAsHired } from "@/lib/employer/placements";
import type { ContactReveal } from "@/lib/employer/reveal";

interface ExistingPlacement {
  role: string;
  city: string;
  hiredAt: string;
}

interface Props {
  handle: string;
  defaultRole: string;
  defaultCity: string;
  /** Server-side: any prior reveal within the 30-day window. Null = no
      reveal yet → form is disabled until the user clicks Reveal. */
  priorReveal: ContactReveal | null;
  /** Server-side: any existing placement this org already logged. */
  existingPlacement: ExistingPlacement | null;
}

export function MarkAsHiredCard({
  handle,
  defaultRole,
  defaultCity,
  priorReveal,
  existingPlacement,
}: Props) {
  const [form, setForm] = useState({
    role: defaultRole,
    city: defaultCity,
    hiredAt: new Date().toISOString().slice(0, 10),
    salaryBand: "",
  });
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<ExistingPlacement | null>(existingPlacement);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Already logged — show the receipt
  if (done) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-employed,#1f7a4a)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-employed,#1f7a4a)]">
            Hire logged
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Audit-logged
          </span>
        </div>
        <div className="mt-2 font-display text-xl">{done.role}</div>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
          {done.city} · hired{" "}
          {new Date(done.hiredAt).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </p>
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          This placement contributes to the live{" "}
          <a className="underline" href="/insights">
            national insights
          </a>{" "}
          — Placement-Truth Rule.
        </p>
      </div>
    );
  }

  // Gate: must have revealed in last 30 days
  if (!priorReveal) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Mark as hired
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink)]">
          You can log this candidate as hired once you've revealed their
          contact (within the last 30 days). This keeps the audit trail
          honest and the placement count clean.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink-soft)] opacity-60"
        >
          <Briefcase className="size-4" aria-hidden="true" />
          Mark as hired
        </button>
      </div>
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await markAsHired({
        handle,
        role: form.role,
        city: form.city,
        hiredAt: form.hiredAt,
        salaryBand: form.salaryBand || undefined,
      });
      if (r.ok) {
        setDone({
          role: form.role,
          city: form.city,
          hiredAt: form.hiredAt,
        });
      } else {
        setError(r.message);
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
        Mark as hired
      </div>
      {!open ? (
        <>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            Logging a placement bumps the live national hire count and
            prompts the seeker to update their status. Salary band stays
            private.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
          >
            <Briefcase className="size-4" aria-hidden="true" />
            Mark as hired
          </button>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              id="hire-role"
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
            <TextField
              id="hire-city"
              label="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <TextField
              id="hire-date"
              label="Hired on"
              type="date"
              value={form.hiredAt}
              onChange={(e) => setForm({ ...form, hiredAt: e.target.value })}
            />
            <TextField
              id="hire-salary"
              label="Salary band (private)"
              value={form.salaryBand}
              onChange={(e) => setForm({ ...form, salaryBand: e.target.value })}
              placeholder="e.g. R 28k – R 35k / month"
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
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)] disabled:opacity-60"
            >
              <Check className="size-4" aria-hidden="true" />
              {pending ? "Logging…" : "Confirm hire"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-sunk)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
