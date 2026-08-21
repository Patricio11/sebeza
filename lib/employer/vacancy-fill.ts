/**
 * How many people does this vacancy still need?
 *
 * A pure module (no `"use server"`, no db) so the vacancy page, the
 * match page and the mark-as-filled modal all answer that question the
 * same way, and so the arithmetic is unit-testable.
 *
 * Before this, `vacancies.positions` was written by one form field, read
 * in two places, and never compared to anything: a recruiter who needed
 * five people was never told they were three short. See
 * docs/HIRING_LOOP_GAPS.md, G1.
 *
 * The honest counting rule
 * ------------------------
 * "Filled" means different things at different points in the lifecycle,
 * and conflating them would overstate progress:
 *
 *   - While the vacancy is OPEN, an acceptance is the best available
 *     signal. It is not a hire, and this module never calls it one.
 *   - Once hires are LOGGED, placements are the truth (Placement-Truth
 *     Rule) and acceptances stop being counted, because someone can
 *     accept and then not be selected.
 *
 * So `filled` is placements when any exist, and acceptances otherwise.
 * Never the sum: that would double-count the same person.
 */

export interface FillInput {
  /** `vacancies.positions`. NULL means the employer never set a target. */
  positions: number | null;
  /** Invitations in `accepted` or `accepted_with_notice`. */
  acceptedCount: number;
  /** Rows in `placements` for this vacancy. */
  placementCount: number;
}

export interface FillState {
  /** The target, or null when none was set. */
  positions: number | null;
  /** People counted as filling a seat, by the rule above. */
  filled: number;
  /** Which of the two the `filled` number came from. */
  basis: "placements" | "acceptances" | "none";
  /** Seats left. Null when no target was set: with no target there is
   *  no such thing as short, and we must not invent one. */
  remaining: number | null;
  /** A target exists and is not yet met. */
  isShort: boolean;
  /** The target exists and is met or exceeded. */
  isMet: boolean;
  /** More people than seats. Not an error: employers over-hire, and
   *  people decline late. Worth showing, never worth blocking. */
  isOver: boolean;
}

export function fillState(input: FillInput): FillState {
  const positions =
    input.positions != null && input.positions > 0 ? input.positions : null;

  const filled =
    input.placementCount > 0 ? input.placementCount : input.acceptedCount;
  const basis =
    input.placementCount > 0
      ? "placements"
      : input.acceptedCount > 0
        ? "acceptances"
        : "none";

  if (positions == null) {
    return {
      positions: null,
      filled,
      basis,
      remaining: null,
      isShort: false,
      isMet: false,
      isOver: false,
    };
  }

  const remaining = Math.max(0, positions - filled);
  return {
    positions,
    filled,
    basis,
    remaining,
    isShort: remaining > 0,
    isMet: filled >= positions,
    isOver: filled > positions,
  };
}

/**
 * The fill line as data, not prose.
 *
 * The words live in the message catalogs (employerVacancies.fill.*) so
 * the line renders in the viewer's language; this module only decides
 * WHICH line, because that decision carries the honesty rule: an
 * acceptance is "accepted", a placement is "hired", and "all filled" is
 * a claim only placements can earn. Components call
 * t(`fill.${id}`, params).
 */
export type FillLabelId =
  | "noneYet" // a target, nothing filled
  | "accepted" // counted from acceptances (never says hired/filled)
  | "acceptedShort" // acceptances, still short
  | "hiredShort" // placements, still short
  | "allFilled" // placements met the target
  | "overHired"; // more placements than seats

export interface FillLabelParts {
  id: FillLabelId;
  params: { positions: number; filled: number; remaining: number };
}

export function fillLabelParts(state: FillState): FillLabelParts | null {
  if (state.positions == null) return null;
  const params = {
    positions: state.positions,
    filled: state.filled,
    remaining: state.remaining ?? 0,
  };
  if (state.basis === "none") return { id: "noneYet", params };
  if (state.basis === "acceptances") {
    return { id: state.isShort ? "acceptedShort" : "accepted", params };
  }
  if (state.isOver) return { id: "overHired", params };
  if (state.isMet) return { id: "allFilled", params };
  return { id: "hiredShort", params };
}
