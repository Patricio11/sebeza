"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  addSkill,
  removeSkill,
  addProfession,
  removeProfession,
  addCity,
  removeCity,
} from "@/lib/admin/taxonomy";

export type TaxonomyKind = "skills" | "professions" | "cities" | "provinces";

export interface TaxonomyRow {
  slug: string;
  label: string;
  /** Cities only. */
  provinceSlug?: string;
  provinceLabel?: string;
  /** Provinces aren't editable from this surface (seeded by Stats SA). */
  readOnly?: boolean;
}

interface Props {
  kind: TaxonomyKind;
  rows: TaxonomyRow[];
  /** For cities only — list of provinces to pick from. */
  provinces?: Array<{ slug: string; label: string }>;
}

export function TaxonomyManager({ kind, rows, provinces }: Props) {
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [provinceSlug, setProvinceSlug] = useState(provinces?.[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);

  const readOnlyKind = kind === "provinces";

  function submitAdd() {
    setError(null);
    startTransition(async () => {
      const res =
        kind === "skills"
          ? await addSkill({ slug, label })
          : kind === "professions"
            ? await addProfession({ slug, label })
            : await addCity({ slug, label, provinceSlug });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setShowAdd(false);
      setSlug("");
      setLabel("");
    });
  }

  function submitRemove(rowSlug: string) {
    if (!window.confirm(`Remove "${rowSlug}" from ${kind}? This cannot be undone.`))
      return;
    setError(null);
    startTransition(async () => {
      const res =
        kind === "skills"
          ? await removeSkill({ slug: rowSlug })
          : kind === "professions"
            ? await removeProfession({ slug: rowSlug })
            : await removeCity({ slug: rowSlug });
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <div>
      {!readOnlyKind && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            {rows.length} {kind}
          </span>
          {!showAdd && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="size-4" aria-hidden="true" /> Add {kind.slice(0, -1)}
            </Button>
          )}
        </div>
      )}

      {showAdd && !readOnlyKind && (
        <form
          className="mb-4 grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            submitAdd();
          }}
        >
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (display name)"
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 text-sm"
          />
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="slug-kebab-case"
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 font-mono text-xs"
          />
          {kind === "cities" && provinces ? (
            <CustomSelect
              ariaLabel="Province"
              variant="compact"
              name="province"
              defaultValue={provinceSlug}
              onChange={(v) => setProvinceSlug(v)}
              options={provinces.map((p) => ({ value: p.slug, label: p.label }))}
            />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p className="md:col-span-4 text-xs text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
        </form>
      )}

      {error && !showAdd && (
        <p className="mb-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger-tint,#FEECEB)] px-3 py-2 text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              <th className="px-5 py-3 font-normal">Label</th>
              <th className="px-5 py-3 font-normal">Slug</th>
              {kind === "cities" && (
                <th className="px-5 py-3 font-normal">Province</th>
              )}
              <th className="px-5 py-3 font-normal w-px" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.slug}
                className="border-t border-[color:var(--color-hairline)]"
              >
                <td className="px-5 py-2.5 font-display text-base">{row.label}</td>
                <td className="px-5 py-2.5 font-mono text-xs text-[color:var(--color-ink-soft)]">
                  {row.slug}
                </td>
                {kind === "cities" && (
                  <td className="px-5 py-2.5 text-[color:var(--color-ink-soft)]">
                    {row.provinceLabel ?? "—"}
                  </td>
                )}
                <td className="px-5 py-2.5 text-right">
                  {!readOnlyKind && (
                    <button
                      type="button"
                      aria-label={`Remove ${row.label}`}
                      disabled={pending}
                      onClick={() => submitRemove(row.slug)}
                      className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-60"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row.slug}
            className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3"
          >
            <div className="min-w-0">
              <div className="font-display text-base leading-tight">{row.label}</div>
              <div className="truncate text-xs">
                <code className="font-mono text-[color:var(--color-ink-soft)]">
                  {row.slug}
                </code>
                {row.provinceLabel && (
                  <span className="ml-2 text-[color:var(--color-ink-soft)]">
                    · {row.provinceLabel}
                  </span>
                )}
              </div>
            </div>
            {!readOnlyKind && (
              <button
                type="button"
                aria-label={`Remove ${row.label}`}
                disabled={pending}
                onClick={() => submitRemove(row.slug)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-60"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
