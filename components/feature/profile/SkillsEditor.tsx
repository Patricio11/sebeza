"use client";

/**
 * Skills editor  managed local state that AUTOSAVES.
 *
 * 2026-08-28 (founder): a seeker's skills sat in the session draft for
 * days and never reached the database; the editor showed them, the
 * dashboard truthfully counted zero. Now every change is written a
 * moment after it happens (debounced), the status chip says Unsaved /
 * Saving / Saved / error honestly, the explicit button stays as an
 * immediate save, and a restored draft is saved for real on arrival.
 *
 * Only allows skills from the controlled taxonomy (SKILLS in `lib/mock/taxonomy.ts`).
 * Per Phase 3 plan re-check #5: no free-text  keeps search and analytics clean.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { MultiSelectComboboxField } from "@/components/ui/MultiSelectComboboxField";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { updateSkills } from "@/lib/profile/actions";
import { SKILLS, PROFESSION_SKILLS_MAP } from "@/lib/mock/taxonomy";
import { useSessionDraft } from "@/lib/hooks/useSessionDraft";
import {
  MAX_PROFILE_SKILLS,
  serialiseSkills,
} from "@/lib/profile/skills-draft";
import { useRouter } from "@/i18n/navigation";
import {
  isStaleServerActionError,
  reloadOnceForNewVersion,
} from "@/lib/client/stale-deploy";

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
   *  Falls back to the frozen constant when not passed (old callers/tests).
   *  2026-08-24: carries `category` (technical | professional) for the
   *  grouped sections below. */
  skillOptions?: Array<{ slug: string; label: string; category?: string }>;
}

export function SkillsEditor({ initial, professionSlug, skillOptions }: Props) {
  const t = useTranslations("seekerDash.skillsGroups");
  const catalogue = skillOptions ?? SKILLS;
  const [items, setItems] = useState<SkillState[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** Fingerprint of the list the database last accepted. */
  const [lastSaved, setLastSaved] = useState(() => serialiseSkills(initial));
  /** Fingerprint of the last list we TRIED to save. A failed attempt is
      not retried until the list changes again (no retry storm). */
  const [lastAttempted, setLastAttempted] = useState<string | null>(null);
  const router = useRouter();
  const fingerprint = serialiseSkills(items);
  const dirty = fingerprint !== lastSaved;
  const overCap = items.length > MAX_PROFILE_SKILLS;

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
    const room = Math.max(0, MAX_PROFILE_SKILLS - kept.length);
    const added = nextSlugs
      .filter((s) => !currentSet.has(s))
      .slice(0, room)
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

  const clearDraftRef = useRef(clearDraft);
  useEffect(() => {
    clearDraftRef.current = clearDraft;
  });

  function persist(snapshot: SkillState[]) {
    setMessage(null);
    setLastAttempted(serialiseSkills(snapshot));
    setStatus("saving");
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof updateSkills>>;
      try {
        r = await updateSkills({
          skills: snapshot.map((i) => ({
            slug: i.slug,
            proficiency: i.proficiency,
            yearsOfExperience: i.yearsOfExperience,
          })),
        });
      } catch (e) {
        // A tab from before a deploy calls action ids that no longer
        // exist. The draft survives a reload, so reload once and the
        // autosave completes on the new bundle.
        if (isStaleServerActionError(e) && reloadOnceForNewVersion()) return;
        setStatus("error");
        setMessage({ kind: "error", text: t("statusError") });
        return;
      }
      if (r.ok) {
        setLastSaved(serialiseSkills(snapshot));
        clearDraftRef.current();
        setStatus("saved");
        // The completeness bar and the dashboard steps read the server.
        router.refresh();
        setSavedAt(
          new Date().toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } else {
        setStatus("error");
        setMessage({ kind: "error", text: r.message });
      }
    });
  }

  // Autosave: a moment after the list stops changing, write it. The
  // fingerprint guard means a save only fires when something differs
  // from what the database last accepted (a restored draft counts).
  useEffect(() => {
    if (!dirty || pending || overCap) return;
    if (fingerprint === lastAttempted) return;
    const timer = setTimeout(() => persist(items), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, dirty, pending, overCap, fingerprint, lastAttempted]);

  function handleSave() {
    persist(items);
  }

  // 2026-08-24  Technical / Professional grouping (founder request).
  // Category comes from the live catalogue; entries typed by the seeker
  // that aren't canonical yet get their own "awaiting review" group so
  // nothing silently disappears.
  const categoryBySlug = new Map(
    catalogue.map((c) => [
      c.slug,
      (c as { category?: string }).category ?? "technical",
    ]),
  );
  const canonicalSlugs = new Set(catalogue.map((c) => c.slug));
  const groups: Array<{
    key: string;
    title: string;
    note?: string;
    items: SkillState[];
  }> = [
    {
      key: "technical",
      title: t("technical"),
      items: items.filter(
        (i) =>
          canonicalSlugs.has(i.slug) &&
          categoryBySlug.get(i.slug) !== "professional",
      ),
    },
    {
      key: "professional",
      title: t("professional"),
      items: items.filter(
        (i) =>
          canonicalSlugs.has(i.slug) &&
          categoryBySlug.get(i.slug) === "professional",
      ),
    },
    {
      key: "pending",
      title: t("pending"),
      note: t("pendingNote"),
      items: items.filter((i) => !canonicalSlugs.has(i.slug)),
    },
  ];

  const renderCard = (s: SkillState) => (
    <li
      key={s.slug}
      className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3"
    >
      <div className="min-w-0">
        <div className="truncate font-medium">{s.label}</div>
        <div className="text-xs text-[color:var(--color-ink-soft)]">
          Proficiency: {s.proficiency}/5
          {s.yearsOfExperience !== null && (
            <>
              {" "}
              {s.yearsOfExperience === 0
                ? "<1 yr"
                : `${s.yearsOfExperience} yr${s.yearsOfExperience === 1 ? "" : "s"}`}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Proficiency"
        >
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
  );

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 text-sm text-[color:var(--color-ink-soft)]">
          No skills yet. Pick one or two below to start.
        </p>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key} aria-label={g.title}>
              <div className="mb-2 flex items-baseline gap-2 border-b border-[color:var(--color-hairline)] pb-1.5">
                <h3 className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
                  {g.title}
                </h3>
                <span className="text-[0.65rem] text-[color:var(--color-ink-soft)]">
                  {g.items.length}
                </span>
                {g.note && (
                  <span className="text-[0.65rem] italic text-[color:var(--color-ink-soft)]">
                    {g.note}
                  </span>
                )}
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.items.map((s) => renderCard(s))}
              </ul>
            </section>
          ))
      )}

      {/* Phase 10 follow-up  typeahead multi-select replaces the
          dropdown-then-Add pattern. Picking a skill adds it to the
          list above with default proficiency=3 and null years;
          inline UI on each row lets the user adjust. */}
      <div className="border-t border-dashed border-[color:var(--color-hairline)] pt-4">
        <MultiSelectComboboxField
          id="skill-picker"
          label="Add skills"
          helpText="Type to search the catalogue. Can't find a skill? Type it anyway and add it - it goes to our team for review, shows as pending on your profile, and you'll be notified the moment it's approved."
          values={items.map((i) => i.slug)}
          onChange={handlePickerChange}
          options={catalogue.map((s) => ({ value: s.slug, label: s.label }))}
          suggestedValues={
            professionSlug ? (PROFESSION_SKILLS_MAP[professionSlug] ?? []) : []
          }
          placeholder="Type to search skills…"
          allowOther
          otherLabel="Skill not listed?"
          otherHint="Can't find your skill? Just keep typing it and add it - our team reviews new skills."
          splitOtherOnComma
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p
            role="status"
            aria-live="polite"
            className={
              "text-[0.7rem] uppercase tracking-[0.18em] " +
              (status === "error" || overCap
                ? "text-[color:var(--color-danger)]"
                : dirty || status === "saving"
                  ? "text-[color:var(--color-accent)]"
                  : "text-[color:var(--color-ink-soft)]")
            }
          >
            {overCap
              ? t("overCap", { max: MAX_PROFILE_SKILLS, n: items.length })
              : status === "saving" || pending
                ? t("statusSaving")
                : dirty
                  ? t("statusUnsaved")
                  : status === "saved" && savedAt
                    ? t("statusSaved", { time: savedAt })
                    : status === "error"
                      ? t("statusError")
                      : t("autosaveHint")}
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={pending || !dirty || overCap}
          >
            {pending ? t("statusSaving") : t("saveButton")}
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
