"use client";

/**
 * Skills editor  managed local state, single "Save skills" submit.
 *
 * Only allows skills from the controlled taxonomy (SKILLS in `lib/mock/taxonomy.ts`).
 * Per Phase 3 plan re-check #5: no free-text  keeps search and analytics clean.
 */

import { useMemo, useState, useTransition } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Button } from "@/components/ui/Button";
import { X, Plus } from "lucide-react";
import { updateSkills } from "@/lib/profile/actions";
import { SKILLS } from "@/lib/mock/taxonomy";

interface SkillState {
  slug: string;
  label: string;
  proficiency: number;
  /** Phase 9.9  per-skill years of experience. NULL = "rather not say."
   *  UI accepts blank or 0..60; the action layer clamps. */
  yearsOfExperience: number | null;
}

interface Props {
  initial: SkillState[];
}

export function SkillsEditor({ initial }: Props) {
  const [items, setItems] = useState<SkillState[]>(initial);
  const [pickerSlug, setPickerSlug] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const usedSlugs = new Set(items.map((i) => i.slug));
  const remaining = useMemo(
    () =>
      SKILLS.filter((s) => !usedSlugs.has(s.slug)).map((s) => ({
        value: s.slug,
        label: s.label,
      })),
    [usedSlugs],
  );

  function addSkill() {
    if (!pickerSlug) return;
    const candidate = SKILLS.find((s) => s.slug === pickerSlug);
    if (!candidate) return;
    setItems((prev) => [
      ...prev,
      {
        slug: candidate.slug,
        label: candidate.label,
        proficiency: 3,
        yearsOfExperience: null,
      },
    ]);
    setPickerSlug("");
  }

  function setYears(slug: string, raw: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.slug !== slug) return i;
        if (raw === "") return { ...i, yearsOfExperience: null };
        const n = Math.max(0, Math.min(60, Math.floor(Number(raw))));
        if (!Number.isFinite(n)) return i;
        return { ...i, yearsOfExperience: n };
      }),
    );
  }

  function removeSkill(slug: string) {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }

  function setProficiency(slug: string, level: number) {
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, proficiency: level } : i)),
    );
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const r = await updateSkills({
        skills: items.map((i) => ({
          slug: i.slug,
          proficiency: i.proficiency,
          yearsOfExperience: i.yearsOfExperience,
        })),
      });
      if (r.ok) setMessage({ kind: "ok", text: "Skills saved." });
      else setMessage({ kind: "error", text: r.message });
    });
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {items.length === 0 ? (
          <li className="md:col-span-2 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 text-sm text-[color:var(--color-ink-soft)]">
            No skills yet. Pick one or two below to start.
          </li>
        ) : (
          items.map((s) => (
            <li
              key={s.slug}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{s.label}</div>
                <div className="text-xs text-[color:var(--color-ink-soft)]">
                  Proficiency: {s.proficiency}/5
                  {s.yearsOfExperience !== null && (
                    <>  {s.yearsOfExperience === 0 ? "<1 yr" : `${s.yearsOfExperience} yr${s.yearsOfExperience === 1 ? "" : "s"}`}</>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5" role="group" aria-label="Proficiency">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-label={`Set proficiency ${level}`}
                      onClick={() => setProficiency(s.slug, level)}
                      className="size-3 rounded-full"
                      style={{
                        background:
                          level <= s.proficiency
                            ? "var(--color-brand)"
                            : "var(--color-hairline)",
                      }}
                    />
                  ))}
                </div>
                {/* Phase 9.9  per-skill years input. 5ch wide so the
                    row stays single-line at 360px. NULL when blank. */}
                <input
                  type="number"
                  min={0}
                  max={60}
                  inputMode="numeric"
                  placeholder="yrs"
                  aria-label={`Years of ${s.label}`}
                  value={s.yearsOfExperience ?? ""}
                  onChange={(e) => setYears(s.slug, e.target.value)}
                  className="h-7 w-14 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-1.5 text-xs"
                />
                <button
                  type="button"
                  aria-label={`Remove ${s.label}`}
                  onClick={() => removeSkill(s.slug)}
                  className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-4">
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Add a skill
          </label>
          <CustomSelect
            ariaLabel="Add a skill"
            variant="compact"
            value={pickerSlug}
            onChange={setPickerSlug}
            options={remaining}
            placeholder={remaining.length === 0 ? "All catalog skills added" : "Pick from catalog…"}
            disabled={remaining.length === 0}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addSkill}
          disabled={!pickerSlug}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save skills"}
        </Button>
      </div>

      {message && (
        <p
          className={
            message.kind === "ok"
              ? "text-sm text-[color:var(--color-employed)]"
              : "text-sm text-[color:var(--color-danger)]"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
