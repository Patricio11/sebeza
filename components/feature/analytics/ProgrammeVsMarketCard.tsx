/**
 * Phase 9.13.3  "Your programme vs the market" card.
 *
 * Two render modes:
 *
 *  - **Student-side** (`studentScope: true`): a focused view of one
 *    `(institution × programme × province)` cell. Shows two stacks:
 *    "Covered by your programme" + "Wanted by the market, not in
 *    your curriculum." Honest, motivating.
 *
 *  - **Gov-side** (`studentScope: false`): a multi-row table-like
 *    breakdown per institution/programme/province. Below-floor cells
 *    were suppressed upstream; we surface counts so reviewers know
 *    the floor is active.
 *
 * Reuses the visual idiom of `DeclineReasonsCard` (9.8.7)  bars,
 * cells, suppression footer. Civic Editorial; no charting library.
 */

import { Link } from "@/i18n/navigation";
import { GraduationCap, Info, Sparkles, TrendingUp } from "lucide-react";

import type {
  CurriculumCell,
  CurriculumResult,
  InferredSkillRef,
  ModuleSkillsForStudent,
} from "@/db/queries/curriculum";
import { INSTITUTIONS, PROVINCES } from "@/lib/mock/taxonomy";

interface Props {
  data: CurriculumResult;
  locale: string;
  title?: string;
  subtitle?: string;
  exportHref?: string;
  /**
   * Phase 13.2  optional editorial-catalogue inferences from the
   * student's `current_modules` + `elective_chosen` + `project_topic`.
   * Only renders on student-scope cards; the gov-side
   * cross-market view doesn't care about one student's context.
   *
   * Each field can be empty independently  the section renders only
   * when at least one of the three has at least one inferred skill.
   */
  moduleSkills?: ModuleSkillsForStudent;
}

export function ProgrammeVsMarketCard({
  data,
  locale,
  title,
  subtitle,
  exportHref,
  moduleSkills,
}: Props) {
  const nfmt = new Intl.NumberFormat(locale);
  const grouped = groupByProgramme(data.cells);
  const isEmpty = grouped.length === 0;
  const showModuleSkills =
    data.studentScope &&
    !!moduleSkills &&
    (moduleSkills.fromModules.length > 0 ||
      moduleSkills.fromElective.length > 0 ||
      moduleSkills.fromProject.length > 0);

  const cardTitle =
    title ??
    (data.studentScope
      ? "Your programme vs the market"
      : "Curriculum vs demand");
  const cardSubtitle =
    subtitle ??
    (data.studentScope
      ? "Skills your programme covers + the in-demand skills it doesn't  the gap signal."
      : "Cross-market. One row per (institution × programme × province) cell that meets the k-anonymity floor.");

  return (
    <section
      aria-labelledby="curriculum-card-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]"
    >
      <header className="border-b border-[color:var(--color-hairline)] px-5 py-4">
        <div className="flex items-start gap-3">
          <GraduationCap
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
              Supply signal · curriculum coverage
            </p>
            <h3
              id="curriculum-card-h"
              className="mt-1 font-display text-xl text-[color:var(--color-ink)]"
            >
              {cardTitle}
            </h3>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              {cardSubtitle}
            </p>
          </div>
        </div>
      </header>

      {showModuleSkills && moduleSkills && (
        <ModuleSkillsSection moduleSkills={moduleSkills} />
      )}

      {isEmpty ? (
        <EmptyState studentScope={data.studentScope} k={data.k} />
      ) : (
        <ul className="divide-y divide-[color:var(--color-hairline)]">
          {grouped.map((g) => (
            <li key={`${g.institutionSlug}::${g.programme}::${g.provinceSlug}`} className="px-5 py-4">
              <CellHeader cell={g} nfmt={nfmt} studentScope={data.studentScope} />
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <StackList
                  label={data.studentScope ? "In your curriculum" : "Covered"}
                  items={g.covered}
                  tone="brand"
                  nfmt={nfmt}
                />
                <StackList
                  label={data.studentScope ? "Wanted by market, not covered" : "Market wants, programme doesn't cover"}
                  items={g.gaps}
                  tone="accent"
                  nfmt={nfmt}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-5 py-3 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {data.studentScope ? (
          <span>Your programme · honest 1:1 view · freshness-weighted demand</span>
        ) : (
          <span>
            Floor k = {data.k} · {data.suppressed} cell
            {data.suppressed === 1 ? "" : "s"} suppressed (primary +
            complementary) · freshness-weighted · outcomes_research consent gate
          </span>
        )}
        {exportHref && (
          <Link
            href={exportHref as never}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
          >
            Download CSV
          </Link>
        )}
      </footer>

      {!data.studentScope && (
        <div className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-brand-tint)] px-5 py-3 text-xs text-[color:var(--color-ink)]">
          <Info
            className="mr-1 inline size-3.5 align-text-bottom text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <strong>Read with the Justification Index + stall reasons.</strong>{" "}
          A (programme × institution × province) cell with strong demand the
          programme doesn&rsquo;t cover is one half of an education-to-work
          gap; the matching <em>stall reasons</em> below tell you whether
          learners stop building it because of cost, access, or course
          quality. Open the{" "}
          <Link
            href={"/gov/shortage" as never}
            className="underline hover:text-[color:var(--color-brand-strong)]"
          >
            Skills-Shortage Justification Index
          </Link>{" "}
          alongside this card.
        </div>
      )}
    </section>
  );
}

interface ProgrammeGroup {
  institutionSlug: string;
  institutionLabel: string;
  programme: string;
  provinceSlug: string;
  provinceLabel: string;
  covered: CurriculumCell[];
  gaps: CurriculumCell[];
}

function groupByProgramme(cells: CurriculumCell[]): ProgrammeGroup[] {
  const map = new Map<string, ProgrammeGroup>();
  for (const c of cells) {
    const key = `${c.institution_slug}::${c.programme}::${c.province_slug}`;
    let g = map.get(key);
    if (!g) {
      g = {
        institutionSlug: c.institution_slug,
        institutionLabel:
          INSTITUTIONS.find((i) => i.slug === c.institution_slug)?.label ??
          c.institution_slug,
        programme: c.programme,
        provinceSlug: c.province_slug,
        provinceLabel:
          PROVINCES.find((p) => p.slug === c.province_slug)?.label ??
          c.province_slug,
        covered: [],
        gaps: [],
      };
      map.set(key, g);
    }
    if (c.in_programme) g.covered.push(c);
    else g.gaps.push(c);
  }
  // Sort covered by weight DESC; gaps by demand_score DESC.
  for (const g of map.values()) {
    g.covered.sort((a, b) => b.weight - a.weight);
    g.gaps.sort((a, b) => b.demand_score - a.demand_score);
  }
  // Sort the groups: most-gap-driven first (loudest signal up top).
  return Array.from(map.values()).sort(
    (a, b) =>
      b.gaps.reduce((s, c) => s + c.demand_score, 0) -
      a.gaps.reduce((s, c) => s + c.demand_score, 0),
  );
}

function CellHeader({
  cell,
  nfmt,
  studentScope,
}: {
  cell: ProgrammeGroup;
  nfmt: Intl.NumberFormat;
  studentScope: boolean;
}) {
  const gapTotal = cell.gaps.reduce((s, c) => s + c.demand_score, 0);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="font-display text-base text-[color:var(--color-ink)]">
        {studentScope
          ? `${cell.programme}`
          : `${cell.programme} · ${cell.institutionLabel}`}
        <span className="ml-1 text-[color:var(--color-ink-soft)]">
           {cell.provinceLabel}
        </span>
      </h4>
      <p className="text-xs text-[color:var(--color-ink-soft)]">
        {cell.covered.length} covered
        {" · "}
        <strong>{cell.gaps.length}</strong> market-gap
        {cell.gaps.length === 1 ? "" : "s"}
        {gapTotal > 0 && (
          <>
            {" · "}
            <TrendingUp className="inline size-3 align-text-bottom" aria-hidden="true" />{" "}
            {nfmt.format(gapTotal)} searches
          </>
        )}
      </p>
    </div>
  );
}

function StackList({
  label,
  items,
  tone,
  nfmt,
}: {
  label: string;
  items: CurriculumCell[];
  tone: "brand" | "accent";
  nfmt: Intl.NumberFormat;
}) {
  const max =
    items.length > 0
      ? Math.max(...items.map((c) => c.demand_score || c.weight))
      : 0;
  const toneClass =
    tone === "brand"
      ? "bg-[color:var(--color-brand)]"
      : "bg-[color:var(--color-accent)]";
  return (
    <div>
      <h5 className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}  {items.length}
      </h5>
      {items.length === 0 ? (
        <p className="mt-1 text-xs italic text-[color:var(--color-ink-soft)]">
          {tone === "brand"
            ? "Nothing recorded yet."
            : "No major market gaps detected."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 8).map((c) => {
            const value = c.in_programme ? c.weight : c.demand_score;
            const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
            return (
              <li
                key={c.skill_slug}
                className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs"
              >
                <span className="truncate text-[color:var(--color-ink)]">
                  {c.skill_label}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                >
                  <span
                    className={`block h-full ${toneClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-right font-display tabular text-sm text-[color:var(--color-ink)]">
                  {c.in_programme ? `w${c.weight}` : nfmt.format(c.demand_score)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Phase 13.2  inferred-skills section. Renders above the existing
 * programme-vs-market cells when the student has declared any
 * current modules / elective / project topic + the editorial
 * catalogue returned at least one inferred skill. Silent when empty
 * (the existing programme-level analysis still renders); no empty
 * state nudge here  the seeker's own editor is the surface that
 * prompts capture.
 *
 * Grouped by source text so the student can see which input
 * produced which skills ("Database Systems  SQL, PostgreSQL").
 */
function ModuleSkillsSection({
  moduleSkills,
}: {
  moduleSkills: ModuleSkillsForStudent;
}) {
  // Group all three sources by `matchedFrom` so a student who
  // declared the same skill via two modules sees the chip once but
  // attributed honestly.
  const modulesGrouped = groupByMatchedFrom(moduleSkills.fromModules);
  const electiveGrouped = groupByMatchedFrom(moduleSkills.fromElective);
  const projectGrouped = groupByMatchedFrom(moduleSkills.fromProject);

  return (
    <div className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-brand-tint)]/30 px-5 py-4">
      <div className="flex items-baseline gap-2">
        <Sparkles
          className="size-3.5 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <h4 className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          Skills from your current studies
        </h4>
      </div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
        Inferred from the modules + elective + project topic on your
        profile, matched against the editorial curriculum catalogue.
        Each chip&rsquo;s tooltip names the originating module so
        you can trace any recommendation back to its source.
      </p>

      <div className="mt-3 space-y-3">
        {modulesGrouped.map(([source, skills]) => (
          <InferredSkillRow
            key={`mod-${source}`}
            label="Module"
            source={source}
            skills={skills}
          />
        ))}
        {electiveGrouped.map(([source, skills]) => (
          <InferredSkillRow
            key={`elec-${source}`}
            label="Elective"
            source={source}
            skills={skills}
          />
        ))}
        {projectGrouped.map(([source, skills]) => (
          <InferredSkillRow
            key={`proj-${source}`}
            label="Project topic"
            source={source}
            skills={skills}
          />
        ))}
      </div>
    </div>
  );
}

function groupByMatchedFrom(
  refs: InferredSkillRef[],
): Array<[string, InferredSkillRef[]]> {
  const map = new Map<string, InferredSkillRef[]>();
  for (const r of refs) {
    const list = map.get(r.matchedFrom);
    if (list) list.push(r);
    else map.set(r.matchedFrom, [r]);
  }
  return Array.from(map.entries());
}

function InferredSkillRow({
  label,
  source,
  skills,
}: {
  label: string;
  source: string;
  skills: InferredSkillRef[];
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[10rem_1fr] md:items-baseline">
      <div className="text-xs">
        <span className="font-display text-sm text-[color:var(--color-ink)]">
          {source}
        </span>
        <span className="ml-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          {label}
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li key={s.slug}>
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)]"
              // Phase 13.7 D7  provenance annotation. The chip's
              // accessible title spells out the catalogue attribution
              // so the student sees how the platform derived the
              // recommendation (and the auditor can trace which row
              // surfaced it).
              title={`via module "${s.matchedFrom}"  editorial catalogue  confidence ${s.confidence}/5`}
              aria-label={`${s.label}, via module ${s.matchedFrom}, editorial confidence ${s.confidence} of 5`}
            >
              {s.label}
              <span
                aria-hidden="true"
                className="text-[color:var(--color-ink-soft)]"
              >
                · {s.confidence}/5
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({
  studentScope,
  k,
}: {
  studentScope: boolean;
  k: number;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-display text-base text-[color:var(--color-ink)]">
        Limited data so far.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[color:var(--color-ink-soft)]">
        {studentScope
          ? "We don't yet have a programme_skills mapping for your enrolment. As the curated mapping expands (and the dormant Phase 8 SAQA feed activates), this card will populate."
          : `Each (programme × institution × province) cell needs at least ${k} matching search-events before it can be shown publicly (k-anonymity floor + complementary suppression). The floor is a privacy protection, not a bug  cells unsuppress as data accumulates.`}
      </p>
    </div>
  );
}
