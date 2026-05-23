"use client";

/**
 * Saved-searches CRUD client island.
 *
 * Lists existing rows (passed in), exposes:
 *   - "Save current" form: name + the same SearchFilters shape
 *   - "Run" button: re-executes filters server-side and refreshes match count
 *   - "Delete" button per row
 *
 * For Phase 5 we keep the filter inputs minimal (query + province slug).
 * The full search filter set is already in /search; saving from there is
 * the typical flow we'll wire in Phase 6.
 */

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Trash2,
  Bell,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  saveSearch,
  runSavedSearch,
  deleteSavedSearch,
  type SavedSearchRow,
} from "@/lib/employer/saved-searches";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  initial: SavedSearchRow[];
  locale: string;
}

export function SavedSearchesManager({ initial, locale }: Props) {
  const [rows, setRows] = useState<SavedSearchRow[]>(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", query: "", province: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    if (form.name.trim().length < 2) {
      setError("Give the search a name (at least 2 characters).");
      return;
    }
    startTransition(async () => {
      const r = await saveSearch({
        name: form.name.trim(),
        filters: {
          query: form.query.trim() || undefined,
          province: form.province.trim() || null,
        },
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setRows([
        {
          id: r.id,
          name: form.name.trim(),
          filters: {
            query: form.query.trim() || undefined,
            province: form.province.trim() || null,
          },
          createdAt: new Date().toISOString(),
          lastRunAt: new Date().toISOString(),
          newMatchesCount: 0,
          createdByUserId: "you",
        },
        ...rows,
      ]);
      setForm({ name: "", query: "", province: "" });
      setAdding(false);
    });
  }

  function handleRun(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const r = await runSavedSearch({ id });
      if (r.ok) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id
              ? {
                  ...row,
                  newMatchesCount: r.count,
                  lastRunAt: new Date().toISOString(),
                }
              : row,
          ),
        );
      }
      setBusyId(null);
    });
  }

  function handleDelete(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteSavedSearch({ id });
      if (r.ok) setRows((prev) => prev.filter((row) => row.id !== id));
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-5">
      {adding ? (
        <div className="space-y-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            New saved search
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <TextField
              id="ss-name"
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Senior Software Developer · Gauteng"
            />
            <TextField
              id="ss-query"
              label="Query"
              value={form.query}
              onChange={(e) => setForm({ ...form, query: e.target.value })}
              placeholder="developer"
              optional
            />
            <TextField
              id="ss-province"
              label="Province slug"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
              placeholder="gauteng"
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
              onClick={handleAdd}
              disabled={pending}
            >
              <Check className="size-4" aria-hidden="true" />
              {pending ? "Saving…" : "Save search"}
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
            Save a search
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center text-[color:var(--color-ink-soft)]">
          No saved searches yet. Save one above, or save from{" "}
          <Link href="/search" className="underline">
            /search
          </Link>{" "}
          (the in-page "save" CTA wires in Phase 6).
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const query = (s.filters.query as string) || "";
            const province = (s.filters.province as string) || "";
            return (
              <li
                key={s.id}
                className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={
                      {
                        pathname: "/search",
                        query: {
                          ...(query ? { query } : {}),
                          ...(province ? { province } : {}),
                        },
                      } as never
                    }
                    className="block truncate font-display text-xl hover:underline"
                  >
                    {s.name}
                  </Link>
                  <div className="text-sm text-[color:var(--color-ink-soft)]">
                    {query ? <span>"{query}"</span> : <em>no query</em>}
                    {province && <span> · {province}</span>}
                  </div>
                  <div className="mt-1.5 text-xs text-[color:var(--color-ink-soft)]">
                    Last run{" "}
                    {s.lastRunAt
                      ? formatRelativeTime(s.lastRunAt, locale)
                      : "never"}
                    {s.newMatchesCount > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium text-[color:var(--color-accent)]">
                          {s.newMatchesCount} match
                          {s.newMatchesCount === 1 ? "" : "es"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Link
                  href={
                    {
                      pathname: "/search",
                      query: {
                        ...(query ? { query } : {}),
                        ...(province ? { province } : {}),
                      },
                    } as never
                  }
                  className="text-sm text-[color:var(--color-brand)] hover:underline"
                >
                  Run search →
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Alerts (Phase 8)"
                    title="Email alerts wire in Phase 8 alongside Resend"
                    disabled
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] opacity-50 cursor-not-allowed"
                  >
                    <Bell className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Refresh match count"
                    onClick={() => handleRun(s.id)}
                    disabled={busyId === s.id || pending}
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)] disabled:opacity-60"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete saved search"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete saved search "${s.name}"? You can recreate it any time.`,
                        )
                      )
                        return;
                      handleDelete(s.id);
                    }}
                    disabled={busyId === s.id || pending}
                    className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-60"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
