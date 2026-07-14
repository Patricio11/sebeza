"use client";

/**
 * Phase 19.1 ("Custom Skills")  the seeker-facing escape hatch, shown below
 * the taxonomy skill picker on /dashboard/profile (flag-gated). The taxonomy
 * picker stays the primary path; this is the clearly-secondary way to claim a
 * niche skill that isn't catalogued yet.
 *
 * Honesty: a quiet "not yet searchable" note  these are self-described and
 * never surface in employer search until an admin canonicalizes the label.
 * Calm + No-Flash: one inline add row, a distinct "Self-described" list.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, X, Info, Loader2 } from "lucide-react";
import { addCustomSkill, removeCustomSkill } from "@/lib/profile/custom-skills";
import type { CustomSkill } from "@/db/queries/custom-skills";

const LEVELS = [
  { value: 1, label: "Just starting" },
  { value: 2, label: "Basic" },
  { value: 3, label: "Comfortable" },
  { value: 4, label: "Strong" },
  { value: 5, label: "Expert" },
];

export function CustomSkillsEditor({
  initial,
  max,
}: {
  initial: CustomSkill[];
  max: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [proficiency, setProficiency] = useState(3);
  const [years, setYears] = useState("");
  const [error, setError] = useState<string | null>(null);

  const atCap = initial.length >= max;

  function add() {
    if (pending) return;
    setError(null);
    const yrs = years.trim() === "" ? null : Number(years);
    startTransition(async () => {
      const r = await addCustomSkill(label, proficiency, yrs);
      if (r.ok) {
        setLabel("");
        setYears("");
        setProficiency(3);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function remove(id: string) {
    if (pending) return;
    startTransition(async () => {
      await removeCustomSkill(id);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Self-described skills
        </h3>
        <span className="font-display tabular text-xs text-[color:var(--color-ink-soft)]">
          {initial.length}/{max}
        </span>
      </div>
      <p className="mb-4 flex items-start gap-1.5 text-xs text-[color:var(--color-ink-soft)]">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Don&rsquo;t see your skill above? Add it here. These count toward your
        profile completeness but aren&rsquo;t searchable by employers yet
        we use them to decide which new skills to add.
      </p>

      {initial.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {initial.map((s) => (
            <li
              key={s.id}
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] py-1 pl-3 pr-1.5 text-sm"
            >
              <span>{s.label}</span>
              <span className="text-xs text-[color:var(--color-ink-soft)]">
                {LEVELS.find((l) => l.value === s.proficiency)?.label}
                {s.yearsOfExperience != null
                  ? ` · ${s.yearsOfExperience} yr${s.yearsOfExperience === 1 ? "" : "s"}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => remove(s.id)}
                disabled={pending}
                aria-label={`Remove ${s.label}`}
                className="grid size-5 place-items-center rounded-full text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-sunk)] hover:text-[color:var(--color-ink)] disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {atCap ? (
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          You&rsquo;ve added the maximum of {max} custom skills. Remove one to
          add another.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="custom-skill-label"
              className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
            >
              Skill
            </label>
            <input
              id="custom-skill-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              placeholder="e.g. Permaculture design"
              className="h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
            />
          </div>
          <div>
            <label
              htmlFor="custom-skill-prof"
              className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
            >
              Level
            </label>
            <select
              id="custom-skill-prof"
              value={proficiency}
              onChange={(e) => setProficiency(Number(e.target.value))}
              className="h-10 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-2 text-sm outline-none focus:border-[color:var(--color-brand)]"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label
              htmlFor="custom-skill-years"
              className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
            >
              Years
            </label>
            <input
              id="custom-skill-years"
              type="number"
              min={0}
              max={60}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder=""
              className="h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-2 text-sm outline-none focus:border-[color:var(--color-brand)]"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={pending || label.trim().length < 2}
            aria-label="Add custom skill"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-sm hover:bg-[color:var(--color-surface-sunk)] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Add
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
