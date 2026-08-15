"use client";

/**
 * Languages editor (docs/PROFILE_LANGUAGES_PLAN.md) - managed local
 * state, single "Save languages" submit, the SkillsEditor idiom.
 *
 * Fixed list only (LANGUAGES constant - the 12 official languages incl.
 * SASL + common additional ones); each row carries a SPOKEN and a
 * WRITTEN level on the plain four-step scale. Levels are self-declared
 * review-time information for recruiters, so the copy never implies
 * verification. Cap 6 languages (the action layer enforces it too).
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { X, Languages as LanguagesIcon } from "lucide-react";
import { updateLanguages } from "@/lib/profile/actions";
import {
  LANGUAGES,
  LANGUAGE_LEVELS,
  type LanguageLevel,
} from "@/lib/mock/taxonomy";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";

interface LanguageRow {
  slug: string;
  label: string;
  spoken: LanguageLevel;
  written: LanguageLevel;
}

const MAX_LANGUAGES = 6;

export function LanguagesEditor({ initial }: { initial: LanguageRow[] }) {
  const [items, setItems] = useState<LanguageRow[]>(initial);
  const [pickerValue, setPickerValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  // Locale-switch mid-edit must not wipe the curated list (the
  // SkillsEditor draft idiom).
  const { clear: clearDraft } = useSessionDraft<{ items: LanguageRow[] }>(
    "sebenza:profile-languages-draft",
    {
      state: { items },
      onRestore: (draft) => {
        if (Array.isArray(draft.items)) {
          const valid = new Set(LANGUAGES.map((l) => l.slug));
          setItems(draft.items.filter((i) => valid.has(i.slug)));
        }
      },
    },
  );

  const available = LANGUAGES.filter(
    (l) => !items.some((i) => i.slug === l.slug),
  );

  function addLanguage(label: string) {
    const entry = LANGUAGES.find((l) => l.label === label);
    if (!entry || items.some((i) => i.slug === entry.slug)) return;
    if (items.length >= MAX_LANGUAGES) {
      setMessage({
        kind: "error",
        text: `Up to ${MAX_LANGUAGES} languages - remove one first.`,
      });
      return;
    }
    setMessage(null);
    setItems((prev) => [
      ...prev,
      // Sensible starting point: most people adding a language speak it
      // at least conversationally; they tune both levels right here.
      { slug: entry.slug, label: entry.label, spoken: "fluent", written: "intermediate" },
    ]);
    setPickerValue("");
  }

  function setLevel(
    slug: string,
    dimension: "spoken" | "written",
    level: LanguageLevel,
  ) {
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, [dimension]: level } : i)),
    );
  }

  function remove(slug: string) {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateLanguages({
        languages: items.map((i) => ({
          slug: i.slug,
          spoken: i.spoken,
          written: i.written,
        })),
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      clearDraft();
      setMessage({ kind: "ok", text: "Languages saved." });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
        <LanguagesIcon
          className="mr-1 inline size-3.5 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        The languages you can work in, with how well you speak and write
        each. Employers see these when they review you - many roles need a
        specific language. Self-declared, so be honest; it counts toward
        your profile completeness.
      </p>

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.slug}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-base text-[color:var(--color-ink)]">
                  {item.label}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item.slug)}
                  disabled={pending}
                  aria-label={`Remove ${item.label}`}
                  className="rounded-[var(--radius-pill)] p-1.5 text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:var(--color-surface-sunk)] hover:text-[color:var(--color-ink)]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["spoken", "written"] as const).map((dimension) => (
                  <div key={dimension}>
                    <span
                      id={`lang-${item.slug}-${dimension}`}
                      className="block text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
                    >
                      {dimension}
                    </span>
                    <div
                      role="group"
                      aria-labelledby={`lang-${item.slug}-${dimension}`}
                      className="mt-1 inline-flex overflow-hidden rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)]"
                    >
                      {LANGUAGE_LEVELS.map((level) => {
                        const active = item[dimension] === level.value;
                        return (
                          <button
                            key={level.value}
                            type="button"
                            disabled={pending}
                            aria-pressed={active}
                            onClick={() =>
                              setLevel(item.slug, dimension, level.value)
                            }
                            className={
                              "px-2.5 py-1 text-xs transition-colors " +
                              (active
                                ? "bg-[color:var(--color-ink)] text-[color:var(--color-surface)]"
                                : "bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
                            }
                          >
                            {level.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length < MAX_LANGUAGES && (
        <ComboboxField
          id="language-picker"
          label="Add a language"
          value={pickerValue}
          onChange={addLanguage}
          options={available.map((l) => ({ value: l.label }))}
          placeholder="Search languages…"
        />
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            "rounded-[var(--radius-sm)] border px-3 py-2 text-sm " +
            (message.kind === "error"
              ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
              : "border-[color:var(--color-positive)]/40 bg-[color:var(--color-positive)]/10 text-[color:var(--color-ink)]")
          }
        >
          {message.text}
        </p>
      )}

      <div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={save}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save languages"}
        </Button>
      </div>
    </div>
  );
}
