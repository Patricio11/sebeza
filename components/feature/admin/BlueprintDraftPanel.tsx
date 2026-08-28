"use client";

/**
 * AI drafting for role blueprints (docs/ROLE_BLUEPRINTS_PLAN.md, part 2).
 * Draft one profession, or the next batch of professions that have no
 * blueprint at all; review the draft (untick rows you disagree with),
 * approve (replaces that profession's rows) or reject. Nothing reaches a
 * seeker until Approve. One model call per profession, on click only.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  approveBlueprintDraft,
  draftMissingBlueprints,
  rejectBlueprintDraft,
  requestBlueprintDraft,
} from "@/lib/admin/blueprints";

export interface BlueprintDraftDto {
  id: string;
  professionSlug: string;
  rawModel: string | null;
  createdAt: string;
  payload: {
    core: string[];
    expected: string[];
    tracks: Array<{ name: string; skills: string[] }>;
    proveIt: Record<string, string>;
    newSkills: Array<{ slug: string; label: string; category: string }>;
  };
}

interface Props {
  selected: string;
  selectedLabel: string;
  hasRows: boolean;
  draft: BlueprintDraftDto | null;
  labels: Record<string, string>;
  missing: Array<{ slug: string; label: string }>;
}

export function BlueprintDraftPanel({
  selected,
  selectedLabel,
  hasRows,
  draft,
  labels,
  missing,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const label = (slug: string) =>
    labels[slug] ??
    draft?.payload.newSkills.find((s) => s.slug === slug)?.label ??
    slug;
  const toggle = (slug: string) =>
    setDropped((d) => {
      const n = new Set(d);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; message: string }>,
    done?: string,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
      else if (done) setNotice(done);
      router.refresh();
    });
  }

  const Row = ({ slug }: { slug: string }) => {
    const off = dropped.has(slug);
    return (
      <li>
        <label className="flex cursor-pointer items-start gap-2 py-1 text-sm">
          <input
            type="checkbox"
            checked={!off}
            onChange={() => toggle(slug)}
            className="mt-1 size-4 accent-[color:var(--color-brand)]"
            aria-label={`Keep ${label(slug)}`}
          />
          <span
            className={
              off ? "text-[color:var(--color-ink-soft)] line-through" : ""
            }
          >
            {label(slug)}
            {draft?.payload.proveIt[slug] && (
              <span className="block text-xs text-[color:var(--color-ink-soft)]">
                Prove it: {draft.payload.proveIt[slug]}
              </span>
            )}
          </span>
        </label>
      </li>
    );
  };

  return (
    <section
      aria-labelledby="blueprint-drafts-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <h2
        id="blueprint-drafts-h"
        className="flex items-center gap-2 font-display text-lg"
      >
        <Sparkles
          className="size-4 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        Draft with AI
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-[color:var(--color-ink-soft)]">
        The model picks from the live skill taxonomy (it may propose a few new
        skills), one call per profession, only when you click. You review every
        row; nothing reaches a seeker until you approve. Uses the active
        provider and the curriculum drafting switch on /admin/llm.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => requestBlueprintDraft({ professionSlug: selected }),
              `Draft ready for ${selectedLabel}. Review it below.`,
            )
          }
        >
          {pending ? (
            <Loader2
              className="mr-1.5 size-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
          )}
          {hasRows ? `Redraft ${selectedLabel}` : `Draft ${selectedLabel}`}
        </Button>
        {missing.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await draftMissingBlueprints({ limit: 10 });
                if (!r.ok) return r;
                setNotice(
                  `Drafted ${r.drafted}, failed ${r.failed}. Open each profession to review.`,
                );
                return { ok: true };
              })
            }
          >
            Draft the next {Math.min(10, missing.length)} of {missing.length}{" "}
            professions with no blueprint
          </Button>
        )}
      </div>
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
          No blueprint yet:{" "}
          {missing
            .slice(0, 8)
            .map((m) => m.label)
            .join(", ")}
          {missing.length > 8 ? ` and ${missing.length - 8} more` : ""}.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-2 text-xs text-[color:var(--color-brand-strong)]"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      )}

      {draft && (
        <div className="mt-5 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg">
              Proposed blueprint for {selectedLabel}
            </h3>
            <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {draft.rawModel ?? "model"} · untick anything you disagree with
            </span>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="text-[0.7rem] uppercase tracking-[0.22em]">
                Core
              </h4>
              <ul>
                {draft.payload.core.map((s) => (
                  <Row key={s} slug={s} />
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[0.7rem] uppercase tracking-[0.22em]">
                Expected
              </h4>
              <ul>
                {draft.payload.expected.map((s) => (
                  <Row key={s} slug={s} />
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[0.7rem] uppercase tracking-[0.22em]">
                Next level
              </h4>
              {draft.payload.tracks.map((t) => (
                <div key={t.name} className="mb-2">
                  <div className="font-display text-base">{t.name}</div>
                  <ul>
                    {t.skills.map((s) => (
                      <Row key={s} slug={s} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          {draft.payload.newSkills.length > 0 && (
            <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
              New skills this draft adds to the taxonomy on approval:{" "}
              {draft.payload.newSkills
                .map((s) => `${s.label} (${s.category})`)
                .join(", ")}
              .
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    approveBlueprintDraft({ id: draft.id, drop: [...dropped] }),
                  `Approved. ${selectedLabel} now uses this blueprint.`,
                )
              }
            >
              <Check className="mr-1 size-3.5" aria-hidden="true" />
              Approve{hasRows ? " (replaces current rows)" : ""}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => rejectBlueprintDraft({ id: draft.id }),
                  "Draft rejected.",
                )
              }
            >
              <X className="mr-1 size-3.5" aria-hidden="true" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
