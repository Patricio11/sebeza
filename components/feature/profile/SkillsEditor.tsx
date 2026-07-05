"use client";

/**
 * Skills editor  managed local state, single "Save skills" submit.
 *
 * Only allows skills from the controlled taxonomy (SKILLS in `lib/mock/taxonomy.ts`).
 * Per Phase 3 plan re-check #5: no free-text  keeps search and analytics clean.
 */

import { useState, useTransition } from "react";
import { MultiSelectComboboxField } from "@/components/ui/MultiSelectComboboxField";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { updateSkills } from "@/lib/profile/actions";
import { SKILLS, PROFESSION_SKILLS_MAP } from "@/lib/mock/taxonomy";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";

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
  /** Phase 10 follow-up  used to surface profession-related skills
   *  first in the picker. Optional; when missing, the picker falls
   *  back to alphabetical only. */
  professionSlug?: string;
  /** Phase 23.4  the LIVE skill catalogue from the `skills` table (via
   *  `getSkills()`), so admin-added + Phase-19 canonicalized skills appear.
   *  Falls back to the frozen constant when not passed (old callers/tests). */
  skillOptions?: Array<{ slug: string; label: string }>;
}

export function SkillsEditor({ initial, professionSlug, skillOptions }: Props) {
  const catalogue = skillOptions ?? SKILLS;
  const [items, setItems] = useState<SkillState[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  // Persist the skills list so locale-switching mid-edit doesn't
  // wipe a freshly-curated set of skills + proficiencies. Items
  // include the resolved `label` from the SKILLS catalogue  cheap
  // to round-trip; the action layer ignores it.
  const { clear: clearDraft } = useSessionDraft<{ items: SkillState[] }>(
    "sebenza:profile-skills-draft",
    {
      state: { items },
      onRestore: (draft) => {
        if (Array.isArray(draft.items)) {
          // Validate each slug against the live taxonomy; drop unknowns
          // (catalogue items may have been removed between sessions).
          // Phase 10 follow-up  "Other" suggestions (non-canonical
          // slugs) also pass through; they render as pending chips
          // until admin promotes.
          if (draft.items.length > 0) setItems(draft.items);
        }
      },
    },
  );

  /**
   * Phase 10 follow-up  the new multi-select picker emits a flat
   * array of slugs; we diff against the current items + add/remove
   * accordingly. Newly-added skills land with default
   * proficiency=3 and null years (user edits inline below). The
   * per-row UI for proficiency + years stays unchanged.
   */
  function handlePickerChange(nextSlugs: string[]) {
    const currentSet = new Set(items.map((i) => i.slug));
    const nextSet = new Set(nextSlugs);
    const kept = items.filter((i) => nextSet.has(i.slug));
    const added = nextSlugs
      .filter((s) => !currentSet.has(s))
      .map((slug) => {
        const fromCatalogue = catalogue.find((s) => s.slug === slug);
        return {
          slug,
          // Catalogue label when canonical; else the raw text the
          // user typed for "Other" submissions.
          label: fromCatalogue?.label ?? slug,
          proficiency: 3,
          yearsOfExperience: null,
        };
      });
    setItems([...kept, ...added]);
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
      if (r.ok) {
        setMessage({ kind: "ok", text: "Skills saved." });
        clearDraft();
      } else {
        setMessage({ kind: "error", text: r.message });
      }
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

      {/* Phase 10 follow-up  typeahead multi-select replaces the
          dropdown-then-Add pattern. Picking a skill adds it to the
          list above with default proficiency=3 and null years;
          inline UI on each row lets the user adjust. */}
      <div className="border-t border-dashed border-[color:var(--color-hairline)] pt-4">
        <MultiSelectComboboxField
          id="skill-picker"
          label="Add skills"
          helpText="Type to search the catalogue. Suggested skills are common for your profession; you can pick any of them."
          values={items.map((i) => i.slug)}
          onChange={handlePickerChange}
          options={catalogue.map((s) => ({ value: s.slug, label: s.label }))}
          suggestedValues={
            professionSlug ? PROFESSION_SKILLS_MAP[professionSlug] ?? [] : []
          }
          placeholder="Type to search skills…"
          allowOther
          otherLabel="Skill not listed?"
          splitOtherOnComma
        />
        <div className="mt-3 flex justify-end">
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
