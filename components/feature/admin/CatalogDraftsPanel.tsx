"use client";

/**
 * 2026-08  AI-drafted catalogue growth (COMPASS_FUEL_PLAN B).
 * Pick skills → the LLM drafts SA-grounded learning routes → each draft
 * is edited/approved/rejected here. Only approved rows join the living
 * catalog; the model never supplies a URL (the admin adds a verified one).
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  requestCatalogDrafts,
  approveCatalogDraft,
  rejectCatalogDraft,
  type CatalogDraftRow,
} from "@/lib/admin/catalog-drafts";

interface SkillOpt {
  slug: string;
  label: string;
}

export function CatalogDraftsPanel({
  skills,
  drafts,
}: {
  skills: SkillOpt[];
  drafts: CatalogDraftRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bySlug = new Map(skills.map((s) => [s.slug, s.label]));

  function addPick(slug: string) {
    setPick("");
    if (!slug || picked.includes(slug) || picked.length >= 8) return;
    setPicked((p) => [...p, slug]);
  }

  function draft() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await requestCatalogDrafts({ skillSlugs: picked });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setNotice(`${res.drafted} draft${res.drafted === 1 ? "" : "s"} ready for your review below.`);
      setPicked([]);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="catalog-drafts-h"
      className="mb-8 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <h2 id="catalog-drafts-h" className="flex items-center gap-2 font-display text-lg">
        <Sparkles className="size-4 text-[color:var(--color-accent)]" aria-hidden="true" />
        Draft catalogue entries with AI
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-[color:var(--color-ink-soft)]">
        Pick up to 8 skills; the model proposes SA-grounded learning routes
        (SETA / TVET / free). Nothing reaches seekers until you approve it.
        Uses the active LLM provider and the curriculum drafting switch on
        /admin/llm.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-64">
          <ComboboxField
            id="catalog-draft-skill"
            label="Skill"
            value={pick}
            onChange={addPick}
            options={skills
              .filter((s) => !picked.includes(s.slug))
              .map((s) => ({ value: s.slug, label: s.label }))}
            placeholder="Search skills…"
          />
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || picked.length === 0}
          onClick={draft}
        >
          {pending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
          )}
          Draft {picked.length > 0 ? `for ${picked.length}` : ""}
        </Button>
      </div>
      {picked.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {picked.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setPicked((p) => p.filter((s) => s !== slug))}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-1 text-xs hover:border-[color:var(--color-danger)]"
            >
              {bySlug.get(slug) ?? slug}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {notice && (
        <p role="status" className="mt-2 text-xs text-[color:var(--color-brand-strong)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}

      {drafts.length > 0 && (
        <ul className="mt-5 space-y-4 border-t border-[color:var(--color-hairline)] pt-4">
          {drafts.map((d) => (
            <DraftCard key={d.id} draft={d} pending={pending} start={startTransition} onError={setError} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DraftCard({
  draft,
  pending,
  start,
  onError,
}: {
  draft: CatalogDraftRow;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
  onError: (m: string | null) => void;
}) {
  const router = useRouter();
  const p = draft.payload as Record<string, unknown>;
  const [form, setForm] = useState({
    title: String(p.title ?? ""),
    provider: String(p.provider ?? ""),
    providerKind: String(p.providerKind ?? "open"),
    cost: String(p.cost ?? "free"),
    costNote: String(p.costNote ?? ""),
    outcome: String(p.outcome ?? ""),
    durationWeeks: String(p.durationWeeks ?? "8"),
    unlocksSkills: Array.isArray(p.unlocksSkills) ? (p.unlocksSkills as string[]).join(", ") : "",
    national: Boolean(p.national),
    url: "",
  });
  const field =
    "h-9 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2.5 text-sm";

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function approve() {
    onError(null);
    start(async () => {
      const res = await approveCatalogDraft({
        id: draft.id,
        payload: {
          title: form.title,
          provider: form.provider,
          providerKind: form.providerKind as "seta" | "tvet" | "university" | "open",
          cost: form.cost as "free" | "subsidised" | "paid",
          costNote: form.costNote || null,
          outcome: form.outcome,
          durationWeeks: Number(form.durationWeeks) || 0,
          unlocksSkills: form.unlocksSkills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          national: form.national,
          url: form.url || null,
        },
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    onError(null);
    start(async () => {
      const res = await rejectCatalogDraft({ id: draft.id });
      if (!res.ok) onError(res.message);
      router.refresh();
    });
  }

  return (
    <li className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4">
      <div className="mb-2 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        AI draft · {draft.rawModel ?? "model"} · review before it goes live
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} aria-label="Title" placeholder="Title" />
        <input className={field} value={form.provider} onChange={(e) => set("provider", e.target.value)} aria-label="Provider" placeholder="Provider" />
        <CustomSelect
          ariaLabel="Provider kind"
          variant="compact"
          value={form.providerKind}
          onChange={(v) => set("providerKind", v)}
          options={["seta", "tvet", "university", "open"].map((v) => ({ value: v, label: v }))}
        />
        <CustomSelect
          ariaLabel="Cost"
          variant="compact"
          value={form.cost}
          onChange={(v) => set("cost", v)}
          options={["free", "subsidised", "paid"].map((v) => ({ value: v, label: v }))}
        />
        <input className={field} value={form.costNote} onChange={(e) => set("costNote", e.target.value)} aria-label="Cost note" placeholder="Cost note (optional)" />
        <input className={field} value={form.durationWeeks} onChange={(e) => set("durationWeeks", e.target.value)} aria-label="Duration weeks" placeholder="Duration (weeks)" />
        <input className={`${field} md:col-span-2`} value={form.outcome} onChange={(e) => set("outcome", e.target.value)} aria-label="Outcome" placeholder="Outcome" />
        <input className={field} value={form.unlocksSkills} onChange={(e) => set("unlocksSkills", e.target.value)} aria-label="Unlocked skills" placeholder="Unlocks skills (comma-separated labels)" />
        <input className={field} value={form.url} onChange={(e) => set("url", e.target.value)} aria-label="Verified URL" placeholder="Verified URL (you add it, or leave blank)" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="mr-auto flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.national} onChange={(e) => set("national", e.target.checked)} className="size-4" />
          Available nationally
        </label>
        <Button type="button" variant="primary" size="sm" disabled={pending} onClick={approve}>
          <Check className="mr-1 size-3.5" aria-hidden="true" /> Approve into catalogue
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={reject}>
          <X className="mr-1 size-3.5" aria-hidden="true" /> Reject
        </Button>
      </div>
    </li>
  );
}
