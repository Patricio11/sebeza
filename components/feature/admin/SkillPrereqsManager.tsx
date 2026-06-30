"use client";

/**
 * Phase 20  the skill-prerequisite editorial island. An add form (skill →
 * requires → prereq + reason) over the current edge list with per-row remove.
 * The action cycle-guards; a rejected edge surfaces inline. Civic Editorial.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { addSkillPrereq, removeSkillPrereq } from "@/lib/admin/skill-prereqs";
import type { AdminPrereqRow } from "@/db/queries/skill-prereqs";

interface SkillOption {
  slug: string;
  label: string;
}

export function SkillPrereqsManager({
  rows,
  skills,
}: {
  rows: AdminPrereqRow[];
  skills: SkillOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [skill, setSkill] = useState("");
  const [prereq, setPrereq] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const r = await addSkillPrereq({
        skillSlug: skill,
        prereqSkillSlug: prereq,
        reason,
      });
      if (r.ok) {
        setSkill("");
        setPrereq("");
        setReason("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function remove(s: string, p: string) {
    if (pending) return;
    startTransition(async () => {
      await removeSkillPrereq(s, p);
      router.refresh();
    });
  }

  const field =
    "h-10 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-2 text-sm outline-none focus:border-[color:var(--color-brand)]";

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-lg">
          Add a prerequisite
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Skill
            </label>
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className={`${field} w-48`}
              aria-label="Skill"
            >
              <option value="">Select…</option>
              {skills.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            requires
          </span>
          <div>
            <label className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Prerequisite
            </label>
            <select
              value={prereq}
              onChange={(e) => setPrereq(e.target.value)}
              className={`${field} w-48`}
              aria-label="Prerequisite"
            >
              <option value="">Select…</option>
              {skills.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Reason
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Why this ordering?"
              className={`${field} w-full`}
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={pending || !skill || !prereq || reason.trim().length < 3}
            aria-label="Add prerequisite"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 text-sm text-[color:var(--color-paper)] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Add
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-lg">
          Prerequisites{" "}
          <span className="font-display tabular text-sm text-[color:var(--color-ink-soft)]">
            {rows.length}
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            No prerequisites yet.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {rows.map((r) => (
              <li
                key={`${r.skillSlug}|${r.prereqSkillSlug}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <strong>{r.skillLabel}</strong>
                    <ArrowRight className="size-3.5 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
                    <span>{r.prereqLabel}</span>
                  </div>
                  <p className="text-xs text-[color:var(--color-ink-soft)]">{r.reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.skillSlug, r.prereqSkillSlug)}
                  disabled={pending}
                  aria-label={`Remove ${r.skillLabel} requires ${r.prereqLabel}`}
                  className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 text-xs hover:border-[color:var(--color-ink)] disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
