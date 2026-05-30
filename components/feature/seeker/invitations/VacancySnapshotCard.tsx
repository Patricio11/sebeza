/**
 * Phase 11.3.4  Vacancy snapshot card on the invitation detail page.
 *
 * Server component. Renders the spec the employer published when the
 * invite was sent (D4 invariant: integrity over freshness). Collapsed
 * by default to keep the page scannable; the seeker expands when they
 * want the full spec.
 *
 * The card has two render paths:
 *   - snapshot exists  show frozen spec with the capture timestamp.
 *   - snapshot is null  show the live `description` fallback with a
 *     subtle "Live  may have changed" annotation.
 */

import { Briefcase, ClockArrowUp, Tag } from "lucide-react";
import type { VacancySnapshot } from "@/lib/seeker/invitations-types";
import { SKILLS, PROVINCES, PROFESSIONS } from "@/lib/mock/taxonomy";

interface Props {
  snapshot: VacancySnapshot | null;
  /** Live description fallback when snapshot is null. */
  liveDescription: string | null;
  /** Captured-at fallback for the annotation when snapshot is null. */
  liveProfession: string | null;
  liveProvince: string | null;
  locale: string;
}

export function VacancySnapshotCard({
  snapshot,
  liveDescription,
  liveProfession,
  liveProvince,
  locale,
}: Props) {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (!snapshot) {
    if (!liveDescription) return null;
    return (
      <details className="mt-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <summary className="cursor-pointer text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="size-3.5" aria-hidden="true" />
            Vacancy spec (live  may have changed)
          </span>
        </summary>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--color-ink)]">
          {liveDescription}
        </p>
      </details>
    );
  }

  const professionLabel =
    PROFESSIONS.find((p) => p.slug === snapshot.professionSlug)?.label ??
    snapshot.professionSlug ??
    liveProfession ??
    snapshot.professionSlug;
  const provinceLabel =
    PROVINCES.find((p) => p.slug === snapshot.provinceSlug)?.label ??
    snapshot.provinceSlug ??
    liveProvince ??
    snapshot.provinceSlug;
  const skillLabels = snapshot.skillSlugs
    .map((s) => SKILLS.find((sk) => sk.slug === s)?.label ?? s)
    .filter(Boolean);

  return (
    <details
      open
      className="mt-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="size-3.5" aria-hidden="true" />
          Vacancy spec  frozen at send
        </span>
        <span className="inline-flex items-center gap-1 normal-case text-xs italic">
          <ClockArrowUp className="size-3" aria-hidden="true" />
          Captured {fmt.format(new Date(snapshot.capturedAt))}
        </span>
      </summary>

      <h3 className="mt-3 font-display text-lg text-[color:var(--color-ink)]">
        {snapshot.title}
      </h3>
      <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
        {professionLabel}
        {snapshot.seniority ? `  ${snapshot.seniority}` : ""}
        {" · "}
        {provinceLabel}
      </p>

      {snapshot.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--color-ink)]">
          {snapshot.description}
        </p>
      )}

      {skillLabels.length > 0 && (
        <div className="mt-4">
          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Required skills
          </div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {skillLabels.map((s) => (
              <li
                key={s}
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] text-[color:var(--color-ink)]"
              >
                <Tag className="size-3" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(snapshot.minYearsExperience != null ||
        snapshot.minNqfLevel != null ||
        snapshot.salaryBand) && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {snapshot.minYearsExperience != null && (
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Min years experience
              </dt>
              <dd className="font-display tabular text-base text-[color:var(--color-ink)]">
                {snapshot.minYearsExperience}
              </dd>
            </div>
          )}
          {snapshot.minNqfLevel != null && (
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Min NQF level
              </dt>
              <dd className="font-display tabular text-base text-[color:var(--color-ink)]">
                {snapshot.minNqfLevel}
              </dd>
            </div>
          )}
          {snapshot.salaryBand && (
            <div className="col-span-2">
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Salary band
              </dt>
              <dd className="text-sm text-[color:var(--color-ink)]">
                {snapshot.salaryBand}
              </dd>
            </div>
          )}
        </dl>
      )}
    </details>
  );
}
