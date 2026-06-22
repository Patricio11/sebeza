"use client";

/**
 * Phase 13.1  student-context editor on the profile-editor page.
 *
 * Edits the three ephemeral student-context fields on the seeker's
 * `academic_profiles` row: current modules, elective chosen, project
 * topic. Independent of the credential-shaped fields (institution,
 * programme, NQF level)  those stay read-only until Phase 8 wires
 * the SAQA verification path.
 *
 * Three-section layout, all optional:
 *   1. Current modules  chip-input style. Type a module label, hit
 *      Enter or comma to commit; X to remove. Cap of 8 enforced
 *      client-side; server re-checks.
 *   2. Elective chosen  rendered when academic.currentYear >= 2.
 *   3. Project / dissertation topic  rendered when
 *      academic.currentYear >= 3.
 *
 * Saves are explicit (no auto-save). The save button is disabled
 * until the form is dirty.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { updateStudentContext } from "@/lib/profile/academic-context";
import {
  STUDENT_MODULES_MAX,
  STUDENT_PROJECT_TOPIC_MAX,
  STUDENT_ELECTIVE_MAX,
} from "@/lib/mock/types";
import { Plus, X, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  initialModules: string[];
  initialElective: string | null;
  initialProject: string | null;
  currentYear: number | null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function StudentContextEditor({
  initialModules,
  initialElective,
  initialProject,
  currentYear,
}: Props) {
  const router = useRouter();
  const [modules, setModules] = useState<string[]>(initialModules);
  const [moduleDraft, setModuleDraft] = useState("");
  const [elective, setElective] = useState<string>(initialElective ?? "");
  const [project, setProject] = useState<string>(initialProject ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const showElective = (currentYear ?? 0) >= 2;
  const showProject = (currentYear ?? 0) >= 3;

  const dirty =
    !arraysEqual(modules, initialModules) ||
    elective.trim() !== (initialElective ?? "") ||
    project.trim() !== (initialProject ?? "");

  const moduleLimitReached = modules.length >= STUDENT_MODULES_MAX;

  function addModuleFromDraft() {
    // Split on commas so a pasted/typed list ("Calculus, Stats, OS") becomes
    // separate module chips, not one. (Typing a comma also triggers this via
    // the keydown handler below.)
    const parts = moduleDraft
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return;
    const next = [...modules];
    for (const part of parts) {
      if (next.length >= STUDENT_MODULES_MAX) break;
      const clean = part.slice(0, 80);
      if (next.includes(clean)) continue;
      next.push(clean);
    }
    if (next.length !== modules.length) {
      setModules(next);
      setSaved(false);
    }
    setModuleDraft("");
  }

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateStudentContext({
        currentModules: modules,
        electiveChosen: elective.trim() || null,
        projectTopic: project.trim() || null,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="max-w-prose text-sm text-[color:var(--color-ink-soft)]">
        Three optional fields the matcher uses on top of your
        programme + field of study. The more concrete the signal, the
        better the skill recommendations on Career Compass.
      </p>

      {/* Current modules  chip input */}
      <div>
        <label
          htmlFor="student-modules-input"
          className="block text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
        >
          Modules this semester  {modules.length}/{STUDENT_MODULES_MAX}
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-2">
          {modules.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-1 text-sm text-[color:var(--color-ink)]"
            >
              {m}
              <button
                type="button"
                onClick={() => {
                  setModules(modules.filter((x) => x !== m));
                  setSaved(false);
                }}
                aria-label={`Remove ${m}`}
                className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id="student-modules-input"
            type="text"
            value={moduleDraft}
            onChange={(e) => setModuleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addModuleFromDraft();
              } else if (e.key === "Backspace" && moduleDraft === "" && modules.length > 0) {
                setModules(modules.slice(0, -1));
                setSaved(false);
              }
            }}
            placeholder={
              moduleLimitReached
                ? "Limit reached"
                : modules.length === 0
                  ? "e.g. Operating Systems"
                  : "Add another"
            }
            disabled={moduleLimitReached || pending}
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--color-ink-soft)] disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={addModuleFromDraft}
            disabled={!moduleDraft.trim() || moduleLimitReached || pending}
            aria-label="Add module"
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-1 text-[color:var(--color-ink)] disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
          Press Enter or comma to add  or paste a comma-separated list.
          Backspace removes the last one.
        </p>
      </div>

      {/* Elective chosen  year 2+ */}
      {showElective && (
        <TextField
          id="student-elective"
          label="Elective you chose"
          value={elective}
          onChange={(e) => {
            setElective(e.target.value.slice(0, STUDENT_ELECTIVE_MAX));
            setSaved(false);
          }}
          placeholder="e.g. Cloud Computing"
          hint="The one elective you picked when you had options."
        />
      )}

      {/* Project topic  year 3+ */}
      {showProject && (
        <div>
          <TextField
            id="student-project"
            label="Project / dissertation topic"
            value={project}
            onChange={(e) => {
              setProject(e.target.value.slice(0, STUDENT_PROJECT_TOPIC_MAX));
              setSaved(false);
            }}
            placeholder="e.g. Anomaly detection on IoT sensor streams"
          />
          <div className="mt-1 flex items-center justify-end text-[0.62rem] text-[color:var(--color-ink-soft)]">
            <span className="tabular">
              {project.length}/{STUDENT_PROJECT_TOPIC_MAX}
            </span>
          </div>
        </div>
      )}

      {!showElective && (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-3 py-2 text-xs italic text-[color:var(--color-ink-soft)]">
          The elective + project fields open up from year 2 and year 3.
          Update your year of study on the section above to surface them.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          {pending ? "Saving" : "Save context"}
        </Button>
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-strong)]">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
