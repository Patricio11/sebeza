/**
 * Phase 13.9  vacancy-location display helper.
 *
 * Single source of truth for rendering a vacancy's location string
 * across the eight surfaces that show one: vacancy list / detail
 * (employer side), vacancy invitation card / detail (seeker side),
 * vacancy snapshot card (Phase 11.3.4), the Invite-from-search
 * modal picker subtitle (Phase 13.8), and gov-side surfaces that
 * happen to render a vacancy row.
 *
 * Why a helper file (not inline at each call-site): the eight render
 * sites were drifting on Phase 9.18's "Remote / Hybrid" labels; this
 * file makes the wording editorial-managed in one place.
 *
 * No React imports  the function returns a plain string so it can be
 * called from both server components + server actions. The
 * `aria-label` callers can pass the same string through unchanged.
 *
 * D7 in PHASE_13_9_PLAN.md: editorial labels capitalise the work-mode
 * noun and use " / " when both `remote` and `hybrid` are present.
 * Never says "anywhere"  the platform is SA-bounded.
 */

// No `"server-only"` directive: this module is pure data formatting
// over static taxonomy + the helper is small enough that a stray
// client-side import is harmless. The Phase 13.9 D5 bucket helpers
// in particular need to be reachable from client + server components
// alike.
import type { WorkAvailabilityKind } from "@/lib/mock/types";
import {
  findProvinceBySlug,
  findCityBySlug,
} from "@/lib/mock/taxonomy";

export interface VacancyLocationInput {
  provinceSlug: string | null;
  citySlug: string | null;
  workAvailability: WorkAvailabilityKind[];
}

/**
 * Render the location string. Examples:
 *
 *   formatVacancyLocation({ provinceSlug: null, citySlug: null,
 *                            workAvailability: ['remote'] })
 *     "Any province  Remote"
 *
 *   formatVacancyLocation({ provinceSlug: null, citySlug: null,
 *                            workAvailability: ['remote','hybrid'] })
 *     "Any province  Remote / Hybrid"
 *
 *   formatVacancyLocation({ provinceSlug: 'western-cape',
 *                            citySlug: 'cape-town',
 *                            workAvailability: ['full_time'] })
 *     "Cape Town, Western Cape"
 *
 *   formatVacancyLocation({ provinceSlug: 'gauteng',
 *                            citySlug: null,
 *                            workAvailability: ['full_time'] })
 *     "Gauteng"
 *
 * Returns "" only when neither location nor work-mode is set, which
 * shouldn't happen for a created vacancy. Callers can either render
 * "" verbatim (becomes invisible) or substitute a fallback.
 */
export function formatVacancyLocation(v: VacancyLocationInput): string {
  if (v.provinceSlug === null) {
    return composeAnyProvinceLabel(v.workAvailability);
  }
  const province = findProvinceBySlug(v.provinceSlug);
  const provinceLabel = province?.label ?? v.provinceSlug;
  if (v.citySlug) {
    const city = findCityBySlug(v.citySlug);
    const cityLabel = city?.label ?? v.citySlug;
    return `${cityLabel}, ${provinceLabel}`;
  }
  return provinceLabel;
}

/**
 * Compose the "Any province  <work-mode>" label. When the vacancy's
 * work_availability includes both `remote` AND `hybrid`, surface both
 * separated by " / " so the candidate sees the full intent.
 *
 * When work_availability somehow lands here without `remote` or
 * `hybrid` (shouldn't happen  the form + server validation gate
 * "Any province" to those modes), fall back to the literal
 * "Any province" rather than guessing. Honest end-state.
 */
function composeAnyProvinceLabel(
  workAvailability: WorkAvailabilityKind[],
): string {
  const hasRemote = workAvailability.includes("remote");
  const hasHybrid = workAvailability.includes("hybrid");
  if (hasRemote && hasHybrid) return "Any province  Remote / Hybrid";
  if (hasRemote) return "Any province  Remote";
  if (hasHybrid) return "Any province  Hybrid";
  return "Any province";
}

/**
 * Phase 13.9 D5  bucket label for gov-side province-grouped
 * aggregates. Returns the row's `province_slug` when set, or the
 * literal sentinel `"national-remote"` when null. Used only inside
 * SQL `GROUP BY COALESCE(...)` clauses; never persisted to a column,
 * never displayed verbatim (the gov UI renders the "national /
 * remote" lane with its own label via `isNationalRemoteBucket`).
 */
export const NATIONAL_REMOTE_BUCKET = "national-remote";

export function vacancyProvinceBucket(
  provinceSlug: string | null,
): string {
  return provinceSlug ?? NATIONAL_REMOTE_BUCKET;
}

export function isNationalRemoteBucket(slug: string): boolean {
  return slug === NATIONAL_REMOTE_BUCKET;
}

/**
 * Display label for the "national / remote" lane on gov-side surfaces.
 * Italicised in the UI by the caller (this returns a plain string so
 * CSV exports get a friendly label too).
 */
export function nationalRemoteBucketLabel(): string {
  return "National / remote";
}
