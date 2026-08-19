"use client";

/**
 * 2026-08-19  "Work & projects" editor
 * (docs/PROFILE_PROJECTS_PLAN.md). A link and/or up to 5 images per
 * project, each with the seeker's own contribution note. The empty
 * state adapts to their profession so it lands for a welder as
 * naturally as for a developer.
 */

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  addProject,
  updateProject,
  deleteProject,
  addProjectImageAction,
  removeProjectImage,
  moveProject,
} from "@/lib/profile/projects";
import type { ProjectView } from "@/lib/profile/projects-read";
import {
  MAX_IMAGES_PER_PROJECT,
  type ProjectHintKind,
} from "@/lib/profile/project-links";

interface Props {
  projects: ProjectView[];
  hint: ProjectHintKind;
}

const EMPTY_DRAFT = { title: "", url: "", contribution: "", year: "" };

export function ProjectsEditor({ projects, hint }: Props) {
  const t = useTranslations("seekerDash.projects");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const field =
    "h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 text-sm";

  function openNew() {
    setEditing("new");
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function openEdit(p: ProjectView) {
    setEditing(p.id);
    setDraft({
      title: p.title,
      url: p.url ?? "",
      contribution: p.contribution,
      year: p.year ? String(p.year) : "",
    });
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      title: draft.title,
      url: draft.url,
      contribution: draft.contribution,
      year: draft.year ? Number(draft.year) : null,
    };
    startTransition(async () => {
      const res =
        editing === "new"
          ? await addProject(payload)
          : await updateProject({ ...payload, id: editing! });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      router.refresh();
    });
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && res.message) setError(res.message);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          {t("lead")}
        </p>
        {editing === null && projects.length < 6 && (
          <Button type="button" variant="primary" size="sm" onClick={openNew}>
            <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
            {t("add")}
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-paper)] px-3 py-2 text-sm text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}

      {editing !== null && (
        <form
          onSubmit={submit}
          className="mt-4 grid gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:grid-cols-2"
        >
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
              {t("titleField")}
            </span>
            <input
              autoFocus
              required
              className={field}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
              {t("urlField")}
            </span>
            <input
              className={field}
              placeholder="https://"
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
              {t("yearField")}
            </span>
            <input
              className={field}
              inputMode="numeric"
              value={draft.year}
              onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))}
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
              {t("contributionField")}
            </span>
            <textarea
              required
              rows={2}
              maxLength={400}
              className="w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3 text-sm"
              value={draft.contribution}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contribution: e.target.value }))
              }
            />
          </label>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
              )}
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(null);
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {projects.length === 0 && editing === null ? (
        <p className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
          {t(`empty.${hint}`)}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {projects.map((p, i) => (
            <li
              key={p.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-[color:var(--color-ink)]">
                    {p.title}
                    {p.year && (
                      <span className="ml-2 text-sm text-[color:var(--color-ink-soft)]">
                        · {p.year}
                      </span>
                    )}
                  </p>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-[color:var(--color-brand)] hover:underline"
                    >
                      <ExternalLink className="size-3" aria-hidden="true" />
                      {p.hostname}
                    </a>
                  )}
                  <p className="mt-1.5 max-w-2xl text-sm text-[color:var(--color-ink)]">
                    {p.contribution}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${p.title} up`}
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveProject({ id: p.id, direction: "up" }))}
                    className="rounded-full border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${p.title} down`}
                    disabled={pending || i === projects.length - 1}
                    onClick={() => run(() => moveProject({ id: p.id, direction: "down" }))}
                    className="rounded-full border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${p.title}`}
                    disabled={pending}
                    onClick={() => openEdit(p)}
                    className="rounded-full border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${p.title}`}
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`Delete "${p.title}"? This also removes its images.`)) return;
                      run(() => deleteProject({ id: p.id }));
                    }}
                    className="rounded-full border border-[color:var(--color-hairline)] p-1.5 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <ImageStrip project={p} pending={pending} run={run} onError={setError} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs italic text-[color:var(--color-ink-soft)]">
        {t("selfDeclared")}
      </p>
    </div>
  );
}

function ImageStrip({
  project,
  pending,
  run,
  onError,
}: {
  project: ProjectView;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; message?: string }>) => void;
  onError: (m: string | null) => void;
}) {
  const t = useTranslations("seekerDash.projects");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const full = project.images.length >= MAX_IMAGES_PER_PROJECT;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onError(null);
    const form = new FormData();
    form.set("projectId", project.id);
    form.set("file", file);
    run(() => addProjectImageAction(form));
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {project.images.map((img) => (
          <span key={img.key} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbUrl ?? ""}
              alt=""
              loading="lazy"
              className="size-20 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] object-cover"
            />
            <button
              type="button"
              aria-label={t("remove")}
              disabled={pending}
              onClick={() =>
                run(() => removeProjectImage({ projectId: project.id, key: img.key }))
              }
              className="absolute -right-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        {!full && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              className="inline-flex size-20 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)] disabled:opacity-50"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              {t("addImage")}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={onPick}
            />
          </>
        )}
      </div>
      <p className="mt-1.5 text-xs text-[color:var(--color-ink-soft)]">
        {t("imageCap")}
      </p>
    </div>
  );
}
