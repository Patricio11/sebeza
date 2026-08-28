"use client";

/**
 * Role blueprints editor (docs/ROLE_BLUEPRINTS_PLAN.md). One profession at
 * a time: its tiers and tracks, inline edits, an add row, and the one-click
 * starter import. Every write is a guarded server action; the page refreshes
 * after each so what you see is what the table holds.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check, Download, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ComboboxField } from "@/components/ui/ComboboxField";
import {
  importStarterBlueprints,
  removeBlueprintRow,
  upsertBlueprintRow,
} from "@/lib/admin/blueprints";

export interface BlueprintRowDto {
  skillSlug: string;
  label: string;
  tier: "core" | "expected" | "next_level";
  track: string | null;
  proveIt: string | null;
  source: string;
  live: boolean;
}

interface Props {
  coverage: Array<{
    slug: string;
    label: string;
    dbRows: number;
    starterRows: number;
  }>;
  liveCount: number;
  selected: string;
  rows: BlueprintRowDto[];
  skills: Array<{ slug: string; label: string }>;
}

const TIERS = [
  { value: "core", label: "Core" },
  { value: "expected", label: "Expected" },
  { value: "next_level", label: "Next level" },
];

function RowEditor({
  professionSlug,
  row,
  onDone,
}: {
  professionSlug: string;
  row: BlueprintRowDto;
  onDone: () => void;
}) {
  const [tier, setTier] = useState<BlueprintRowDto["tier"]>(row.tier);
  const [track, setTrack] = useState(row.track ?? "");
  const [proveIt, setProveIt] = useState(row.proveIt ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty =
    tier !== row.tier ||
    track !== (row.track ?? "") ||
    proveIt !== (row.proveIt ?? "");

  return (
    <li className="grid gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 md:grid-cols-[1.2fr_0.9fr_1fr_1.6fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="font-display text-base">{row.label}</div>
        <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          {row.skillSlug} · {row.source}
        </div>
      </div>
      <CustomSelect
        ariaLabel={`Tier for ${row.label}`}
        variant="compact"
        value={tier}
        onChange={(v) => setTier(v as BlueprintRowDto["tier"])}
        options={TIERS}
      />
      <input
        aria-label={`Track for ${row.label}`}
        value={track}
        disabled={tier !== "next_level"}
        onChange={(e) => setTrack(e.target.value)}
        placeholder={tier === "next_level" ? "Track name" : "no track"}
        className="min-h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 text-sm disabled:opacity-50"
      />
      <input
        aria-label={`Prove it for ${row.label}`}
        value={proveIt}
        onChange={(e) => setProveIt(e.target.value)}
        placeholder="Prove it with… (optional, one line)"
        className="min-h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await upsertBlueprintRow({
                professionSlug,
                skillSlug: row.skillSlug,
                tier,
                track: track || null,
                proveIt: proveIt || null,
              });
              if (!r.ok) setError(r.message);
              else onDone();
            })
          }
        >
          <Check className="mr-1 size-3.5" aria-hidden="true" />
          Save
        </Button>
        {row.live && (
          <button
            type="button"
            aria-label={`Remove ${row.label}`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await removeBlueprintRow({
                  professionSlug,
                  skillSlug: row.skillSlug,
                });
                if (!r.ok) setError(r.message);
                else onDone();
              })
            }
            className="inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-[color:var(--color-danger)] md:col-span-5">
          {error}
        </p>
      )}
    </li>
  );
}

export function BlueprintsManager({
  coverage,
  liveCount,
  selected,
  rows,
  skills,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [newTier, setNewTier] = useState<BlueprintRowDto["tier"]>("expected");
  const [newTrack, setNewTrack] = useState("");

  const current = coverage.find((c) => c.slug === selected);
  const live = rows.some((r) => r.live);
  const refresh = () => router.refresh();
  const taken = new Set(rows.map((r) => r.skillSlug));
  const byTier = (t: BlueprintRowDto["tier"]) =>
    rows.filter((r) => r.tier === t);
  const tracks = [
    ...new Set(byTier("next_level").map((r) => r.track ?? "Next level")),
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Coverage
          </div>
          <div className="font-display text-2xl">
            {liveCount}
            <span className="text-[color:var(--color-ink-soft)]">
              {" "}
              / {coverage.length} professions live
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-[color:var(--color-ink-soft)]">
            Professions with no live rows fall back to the starter catalogue for
            seekers. Import writes the catalogue into the table; rows you have
            edited are never overwritten.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setNotice(null);
                const r = await importStarterBlueprints();
                setNotice(
                  r.ok
                    ? `Imported ${r.inserted} new rows, refreshed ${r.refreshed}.`
                    : r.message,
                );
                refresh();
              })
            }
          >
            <Download className="mr-1.5 size-4" aria-hidden="true" />
            {pending ? "Working…" : "Import starter catalogue"}
          </Button>
          {notice && (
            <p className="text-xs text-[color:var(--color-ink-soft)]">
              {notice}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(260px,320px)_1fr] md:items-end">
        <div>
          <div className="mb-1.5 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Profession
          </div>
          <CustomSelect
            ariaLabel="Profession"
            value={selected}
            onChange={(v) =>
              router.push(`/admin/blueprints?profession=${v}` as never)
            }
            options={coverage.map((c) => ({
              value: c.slug,
              label: c.label,
              hint:
                c.dbRows > 0
                  ? `${c.dbRows} live`
                  : `${c.starterRows} in starter`,
            }))}
          />
        </div>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          {current && !live
            ? "Showing the starter catalogue for this profession (not imported yet). Saving any row writes it to the table."
            : "Live rows. Seekers with this profession see exactly this."}
        </p>
      </section>

      {(["core", "expected"] as const).map((tier) => (
        <section key={tier} aria-label={tier}>
          <h2 className="mb-2 border-b border-[color:var(--color-ink)] pb-1 text-[0.72rem] uppercase tracking-[0.22em]">
            {tier === "core" ? "Core" : "Expected"}
            <span className="ml-2 text-[color:var(--color-ink-soft)]">
              {byTier(tier).length}
            </span>
          </h2>
          <ul className="grid gap-2">
            {byTier(tier).map((r) => (
              <RowEditor
                key={r.skillSlug}
                professionSlug={selected}
                row={r}
                onDone={refresh}
              />
            ))}
          </ul>
        </section>
      ))}

      <section aria-label="Next level">
        <h2 className="mb-2 border-b border-[color:var(--color-ink)] pb-1 text-[0.72rem] uppercase tracking-[0.22em]">
          Next level
          <span className="ml-2 text-[color:var(--color-ink-soft)]">
            {byTier("next_level").length}
          </span>
        </h2>
        {tracks.map((track) => (
          <div key={track} className="mb-4">
            <h3 className="mb-1.5 font-display text-lg">{track}</h3>
            <ul className="grid gap-2">
              {byTier("next_level")
                .filter((r) => (r.track ?? "Next level") === track)
                .map((r) => (
                  <RowEditor
                    key={r.skillSlug}
                    professionSlug={selected}
                    row={r}
                    onDone={refresh}
                  />
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section
        aria-label="Add a skill"
        className="grid gap-3 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-4 md:grid-cols-[1.4fr_0.8fr_1fr_auto] md:items-end"
      >
        <ComboboxField
          id="blueprint-add-skill"
          label="Add a skill"
          value={newSkill}
          onChange={setNewSkill}
          options={skills
            .filter((s) => !taken.has(s.slug))
            .map((s) => ({ value: s.slug, label: s.label }))}
          placeholder="Search the taxonomy…"
        />
        <div>
          <div className="mb-1.5 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Tier
          </div>
          <CustomSelect
            ariaLabel="Tier"
            value={newTier}
            onChange={(v) => setNewTier(v as BlueprintRowDto["tier"])}
            options={TIERS}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Track
          </div>
          <input
            aria-label="Track"
            value={newTrack}
            disabled={newTier !== "next_level"}
            onChange={(e) => setNewTrack(e.target.value)}
            placeholder={
              newTier === "next_level" ? "e.g. DevOps & Cloud" : "no track"
            }
            className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 text-sm disabled:opacity-50"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={pending || !newSkill}
          onClick={() =>
            startTransition(async () => {
              setNotice(null);
              const r = await upsertBlueprintRow({
                professionSlug: selected,
                skillSlug: newSkill,
                tier: newTier,
                track: newTrack || null,
                proveIt: null,
              });
              if (!r.ok) setNotice(r.message);
              else {
                setNewSkill("");
                setNewTrack("");
                refresh();
              }
            })
          }
        >
          <Plus className="mr-1 size-4" aria-hidden="true" />
          Add
        </Button>
      </section>
    </div>
  );
}
