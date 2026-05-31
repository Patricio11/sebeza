"use client";

/**
 * Phase 11.5.1  "Open to" tags editor.
 *
 * Four toggleable chips. Independent of employment status (D1)  a
 * fully-employed senior can be "Open to mentorship" without changing
 * primary status. Tags surface on the public profile + are filterable
 * via `/search?open_to=mentorship`.
 *
 * UI is intentionally quiet: this is a secondary signal, not a primary
 * one. The hover/focus hint copy comes from the canonical
 * `OPEN_TO_TAG_HINT` map so the explainer stays consistent across
 * surfaces.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { setOpenToTags } from "@/lib/profile/actions";
import {
  OPEN_TO_TAGS,
  OPEN_TO_TAG_LABEL,
  OPEN_TO_TAG_HINT,
  type OpenToTag,
} from "@/lib/mock/types";
import { Check, Sparkles } from "lucide-react";

interface Props {
  initial: OpenToTag[];
}

export function OpenToTagsEditor({ initial }: Props) {
  const router = useRouter();
  const [tags, setTags] = useState<OpenToTag[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (t: OpenToTag) => {
    setSaved(false);
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const dirty =
    tags.length !== initial.length ||
    !tags.every((t) => initial.includes(t));

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await setOpenToTags({ tags });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-[color:var(--color-ink-soft)]">
        Optional secondary intent. Independent of your employment
        status  a fully-employed senior can still be open to
        mentorship. Employers can filter on these in search, but they
        don&rsquo;t affect your primary ranking.
      </p>
      <ul className="flex flex-wrap gap-2">
        {OPEN_TO_TAGS.map((tag) => {
          const active = tags.includes(tag);
          return (
            <li key={tag}>
              <button
                type="button"
                onClick={() => toggle(tag)}
                disabled={pending}
                aria-pressed={active}
                title={OPEN_TO_TAG_HINT[tag]}
                className={
                  "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors " +
                  (active
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]")
                }
              >
                {active && <Check className="size-3" aria-hidden="true" />}
                {OPEN_TO_TAG_LABEL[tag]}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          {pending ? "Saving" : "Save"}
        </Button>
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-strong)]">
            <Sparkles className="size-3" aria-hidden="true" />
            Saved
          </span>
        )}
        {error && (
          <span className="text-xs text-[color:var(--color-danger)]">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
