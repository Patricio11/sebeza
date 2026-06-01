"use client";

/**
 * Phase 13.3  /admin/curriculum client manager.
 *
 * Three stacked panels:
 *   1. Bulk import  paste syllabus, dispatch to active LLM provider,
 *      land suggestions in the queue.
 *   2. Queue  pending llm_suggested rows; approve / reject / edit-
 *      and-approve.
 *   3. Provenance  last 25 approved rows with approver + approved_at.
 *
 * Manual editorial add lives inside the queue panel as a "+ Add by
 * hand" inline form, so admins curating Tier-1 rows for Task 13.5
 * don't have to context-switch.
 */

import { useState, useTransition } from "react";
import { Loader2, Check, X, Pencil, Plus } from "lucide-react";
import {
  approveModuleSkillSuggestion,
  rejectModuleSkillSuggestion,
  editAndApproveModuleSkillSuggestion,
  bulkImportSyllabus,
  addEditorialModuleSkill,
} from "@/lib/admin/curriculum-actions";

export type QueueRow = {
  id: string;
  moduleSlug: string;
  moduleLabel: string;
  skillSlug: string;
  skillLabel: string | null;
  confidence: number;
  institutionSlug: string | null;
  createdAt: string;
};

export type ApprovedRow = {
  id: string;
  moduleLabel: string;
  skillSlug: string;
  skillLabel: string | null;
  confidence: number;
  institutionSlug: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
};

type Props = {
  queue: QueueRow[];
  recentApproved: ApprovedRow[];
  skills: { slug: string; label: string }[];
  institutions: { slug: string; label: string }[];
  bulkImportAvailable: boolean;
  killSwitchOn: boolean;
  hasActiveProvider: boolean;
};

export function CurriculumQueueManager({
  queue,
  recentApproved,
  skills,
  institutions,
  bulkImportAvailable,
  killSwitchOn,
  hasActiveProvider,
}: Props) {
  return (
    <div className="space-y-10">
      <BulkImportPanel
        available={bulkImportAvailable}
        killSwitchOn={killSwitchOn}
        hasActiveProvider={hasActiveProvider}
        institutions={institutions}
      />

      <QueuePanel queue={queue} institutions={institutions} skills={skills} />

      <ProvenancePanel rows={recentApproved} />
    </div>
  );
}

// ─── Bulk import ──────────────────────────────────────────────────

function BulkImportPanel({
  available,
  killSwitchOn,
  hasActiveProvider,
  institutions,
}: {
  available: boolean;
  killSwitchOn: boolean;
  hasActiveProvider: boolean;
  institutions: { slug: string; label: string }[];
}) {
  const [moduleLabel, setModuleLabel] = useState("");
  const [institutionSlug, setInstitutionSlug] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function submit() {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const res = await bulkImportSyllabus({
        moduleLabel,
        institutionSlug: institutionSlug || undefined,
        syllabusText,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSummary(
        `Landed ${res.inserted} suggestions · dropped ${res.droppedHallucinations} hallucination(s) · ${res.tokenCount} tokens · est R ${res.estZarCost.toFixed(2)}.`,
      );
      setSyllabusText("");
      setModuleLabel("");
    });
  }

  return (
    <section>
      <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
        Bulk import
      </h2>
      {!available && (
        <p className="mb-3 rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-3 py-2 text-xs text-[color:var(--color-ink)]">
          {!killSwitchOn
            ? "Kill-switch is OFF. Bulk import is disabled until feature_flag_llm_curriculum_enabled is on."
            : !hasActiveProvider
              ? "No active LLM provider. Configure one on /admin/llm first."
              : "Bulk import is currently unavailable."}
        </p>
      )}
      <fieldset className="grid gap-3" disabled={!available || pending}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
              Module label
            </span>
            <input
              type="text"
              value={moduleLabel}
              onChange={(e) => setModuleLabel(e.target.value)}
              placeholder="Database Systems"
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
              Institution (optional)
            </span>
            <select
              value={institutionSlug}
              onChange={(e) => setInstitutionSlug(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
            >
              <option value="">Canonical (cross-institution)</option>
              {institutions.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Syllabus or module description
          </span>
          <textarea
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            rows={6}
            placeholder="Paste the official syllabus or module description from the institution's prospectus. Generic academic text only  no seeker PII."
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
          />
          <span className="text-[color:var(--color-ink-soft)]">
            {syllabusText.length} / 20,000 chars
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={
              !available ||
              pending ||
              !moduleLabel ||
              syllabusText.trim().length < 40
            }
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
            Dispatch to LLM
          </button>
        </div>
      </fieldset>
      {summary && (
        <p className="mt-3 text-xs text-[color:var(--color-positive)]">
          {summary}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs text-[color:var(--color-warning)]">
          {error}
        </p>
      )}
    </section>
  );
}

// ─── Queue ────────────────────────────────────────────────────────

function QueuePanel({
  queue,
  institutions,
  skills,
}: {
  queue: QueueRow[];
  institutions: { slug: string; label: string }[];
  skills: { slug: string; label: string }[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
        <h2 className="font-display text-xl">Pending queue</h2>
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
        >
          <Plus className="size-3" aria-hidden />
          Add by hand
        </button>
      </div>

      {addOpen && (
        <ManualAddForm
          skills={skills}
          institutions={institutions}
          onDone={() => setAddOpen(false)}
        />
      )}

      {queue.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-6 text-center text-xs text-[color:var(--color-ink-soft)]">
          Nothing pending. Land suggestions via bulk import above, or add
          editorial rows by hand.
        </p>
      ) : (
        <ul className="grid gap-3">
          {queue.map((row) => (
            <QueueRowCard key={row.id} row={row} institutions={institutions} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueRowCard({
  row,
  institutions,
}: {
  row: QueueRow;
  institutions: { slug: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confidence, setConfidence] = useState(row.confidence);
  const [moduleLabel, setModuleLabel] = useState(row.moduleLabel);
  const [institutionSlug, setInstitutionSlug] = useState(
    row.institutionSlug ?? "",
  );

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveModuleSkillSuggestion({ rowId: row.id });
      if (!res.ok) setError(res.message);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectModuleSkillSuggestion({ rowId: row.id });
      if (!res.ok) setError(res.message);
    });
  }

  function editAndApprove() {
    setError(null);
    startTransition(async () => {
      const res = await editAndApproveModuleSkillSuggestion({
        rowId: row.id,
        confidence,
        moduleLabel: moduleLabel.trim() || undefined,
        institutionSlug: institutionSlug || undefined,
      });
      if (!res.ok) {
        setError(res.message);
      } else {
        setEditOpen(false);
      }
    });
  }

  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm">
            <span className="font-medium">{row.moduleLabel}</span>
            <span className="text-[color:var(--color-ink-soft)]"> → </span>
            <span>{row.skillLabel ?? row.skillSlug}</span>
            <span className="ml-2 inline-flex items-center rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-[color:var(--color-ink-soft)]">
              Confidence {row.confidence}/5
            </span>
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            {row.institutionSlug
              ? `Scoped to ${row.institutionSlug}`
              : "Canonical · cross-institution"}
            {" · "}suggested{" "}
            {new Date(row.createdAt).toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={approve}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[color:var(--color-positive)]/60 bg-[color:var(--color-surface)] px-2 py-1 text-xs uppercase tracking-[0.14em] text-[color:var(--color-positive)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="size-3" aria-hidden /> Approve
          </button>
          <button
            type="button"
            onClick={() => setEditOpen((o) => !o)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="size-3" aria-hidden /> Edit
          </button>
          <button
            type="button"
            onClick={reject}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-surface)] px-2 py-1 text-xs uppercase tracking-[0.14em] text-[color:var(--color-warning)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-3" aria-hidden /> Reject
          </button>
        </div>
      </div>

      {editOpen && (
        <fieldset
          className="mt-3 grid gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-3 text-xs"
          disabled={pending}
        >
          <label className="grid gap-1">
            <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
              Module label
            </span>
            <input
              type="text"
              value={moduleLabel}
              onChange={(e) => setModuleLabel(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
              Confidence (1-5)
            </span>
            <input
              type="number"
              min={1}
              max={5}
              value={confidence}
              onChange={(e) =>
                setConfidence(
                  Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                )
              }
              className="w-24 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="grid gap-1">
            <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
              Institution scope
            </span>
            <select
              value={institutionSlug}
              onChange={(e) => setInstitutionSlug(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
            >
              <option value="">Canonical (cross-institution)</option>
              {institutions.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={editAndApprove}
            disabled={pending}
            className="self-start rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save edits + approve
          </button>
        </fieldset>
      )}

      {error && (
        <p className="mt-2 text-xs text-[color:var(--color-warning)]">
          {error}
        </p>
      )}
    </li>
  );
}

function ManualAddForm({
  skills,
  institutions,
  onDone,
}: {
  skills: { slug: string; label: string }[];
  institutions: { slug: string; label: string }[];
  onDone: () => void;
}) {
  const [moduleLabel, setModuleLabel] = useState("");
  const [skillSlug, setSkillSlug] = useState("");
  const [confidence, setConfidence] = useState(4);
  const [institutionSlug, setInstitutionSlug] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addEditorialModuleSkill({
        moduleLabel,
        skillSlug,
        confidence,
        institutionSlug: institutionSlug || undefined,
      });
      if (res.ok) {
        setModuleLabel("");
        setSkillSlug("");
        setConfidence(4);
        setInstitutionSlug("");
        onDone();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <fieldset
      className="mb-4 grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4 text-xs"
      disabled={pending}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Module label
          </span>
          <input
            type="text"
            value={moduleLabel}
            onChange={(e) => setModuleLabel(e.target.value)}
            placeholder="Database Systems"
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="grid gap-1">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Skill
          </span>
          <select
            value={skillSlug}
            onChange={(e) => setSkillSlug(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          >
            <option value=""></option>
            {skills.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label} ({s.slug})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Confidence (1-5)
          </span>
          <input
            type="number"
            min={1}
            max={5}
            value={confidence}
            onChange={(e) =>
              setConfidence(
                Math.max(1, Math.min(5, Number(e.target.value) || 1)),
              )
            }
            className="w-24 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm tabular-nums"
          />
        </label>
        <label className="grid gap-1">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Institution scope
          </span>
          <select
            value={institutionSlug}
            onChange={(e) => setInstitutionSlug(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          >
            <option value="">Canonical (cross-institution)</option>
            {institutions.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !moduleLabel || !skillSlug}
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving" : "Add editorial row"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-xs text-[color:var(--color-warning)]">{error}</p>
      )}
    </fieldset>
  );
}

// ─── Provenance ───────────────────────────────────────────────────

function ProvenancePanel({ rows }: { rows: ApprovedRow[] }) {
  return (
    <section>
      <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
        Recently approved
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-6 text-center text-xs text-[color:var(--color-ink-soft)]">
          No editorial rows yet. Approved or hand-added rows surface here.
        </p>
      ) : (
        <ul className="grid gap-2 text-xs">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2"
            >
              <span>
                <span className="font-medium">{r.moduleLabel}</span>
                <span className="text-[color:var(--color-ink-soft)]"> → </span>
                <span>{r.skillLabel ?? r.skillSlug}</span>
                <span className="ml-2 text-[color:var(--color-ink-soft)]">
                  ({r.confidence}/5)
                </span>
              </span>
              <span className="text-[color:var(--color-ink-soft)]">
                {r.approvedAt
                  ? new Date(r.approvedAt).toISOString().slice(0, 10)
                  : ""}
                {r.approvedBy && ` · ${r.approvedBy.slice(0, 12)}`}
                {r.institutionSlug && ` · ${r.institutionSlug}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
