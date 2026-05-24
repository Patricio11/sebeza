/**
 * Phase 9.7.3  Skills-Shortage Justification Index classifier.
 *
 * The honest classifier for each (profession × province) cell. Three
 * inputs, four thresholds, three possible labels. No ML, no opaque
 * scoring  the rule below is the rule that ships on `/gov` and the
 * one a policy team can read off the page and argue with.
 *
 * Per D1 (PHASE_9_7_PLAN.md, closed 2026-05-24):
 *
 *   Genuine local shortage:
 *     demand_score          >= lmi_demand_floor
 *     AND local_supply_ratio < lmi_local_supply_threshold
 *     AND foreign_fill_share >= lmi_foreign_fill_floor
 *     AND total_placements   >= employer_mix_min_placements
 *
 *   Local supply available:
 *     demand_score          >= lmi_demand_floor
 *     AND local_supply_ratio >= 1.0
 *
 *   Indeterminate / low priority:
 *     anything else  shown as blank or "too few signals to classify".
 *     Never guessed, never "borderline".
 *
 * Pure function. SQL plumbing for the inputs lives in
 * `db/queries/justification.ts`. The thresholds come from
 * `lib/admin/settings.ts` so policy can tune the knobs without a deploy.
 */

export type JustificationLabel =
  | "shortage"
  | "supply_available"
  | "indeterminate";

export interface JustificationCellInputs {
  /** Distinct employer searches / 10, trailing 30 days. */
  demand_score: number;
  /** SA-citizen available supply ÷ (demand_score × 10). */
  local_supply_ratio: number;
  /** Foreign-national placements ÷ total employer_confirmed placements. */
  foreign_fill_share: number;
  /** Employer-confirmed placements in this (profession × province) cell. */
  total_placements: number;
}

export interface JustificationThresholds {
  /** Default 1.0 = 10 distinct employers / province / 30 days. */
  demandFloor: number;
  /** Default 0.5  below this, supply is "thin". */
  localSupplyThreshold: number;
  /** Default 0.5  majority of placements went to foreign nationals. */
  foreignFillFloor: number;
  /** Default 5  minimum confirmed placements before any classification fires. */
  minPlacements: number;
}

export function classifyJustification(
  cell: JustificationCellInputs,
  thresholds: JustificationThresholds,
): JustificationLabel {
  // Cells below the demand floor are not actively wanted by employers at
  // all  the policy question doesn't even apply. Indeterminate.
  if (cell.demand_score < thresholds.demandFloor) return "indeterminate";

  // "Local supply available" depends only on demand + ratio. If the
  // local talent pool can plausibly meet demand, that's the headline
  // labels with "shortage" require ALL three other conditions on top.
  if (cell.local_supply_ratio >= 1.0) return "supply_available";

  // "Genuine local shortage" requires every guard: a thin local supply
  // pool AND most placements going to foreign nationals AND enough
  // placement volume that the fill_share isn't just noise.
  const isShortage =
    cell.local_supply_ratio < thresholds.localSupplyThreshold &&
    cell.foreign_fill_share >= thresholds.foreignFillFloor &&
    cell.total_placements >= thresholds.minPlacements;

  return isShortage ? "shortage" : "indeterminate";
}
