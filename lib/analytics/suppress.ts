/**
 * Phase 9.7.1  Reusable statistical-disclosure-control primitive.
 *
 * The k-anonymity floor + complementary-suppression algorithm originally
 * inlined in `lib/analytics/outcomes.ts` (Phase 7.5.4), extracted here so
 * the rest of Phase 9.7 (nationality dimension, Justification Index,
 * Opportunity Map) reuses the same engine instead of re-implementing.
 *
 * The extraction is **zero behaviour change** vs. the inlined version
 * the outcomes-compliance assertions still pass against an outcomesQuery
 * that delegates here. See `suppress.test.ts` for the fixtures that
 * codify the behaviour contract.
 *
 * ───────────────────────────────────────────────────────────────────────
 * What this guards against
 *
 *  1. **Primary suppression (k-anonymity floor).** Any cell whose count
 *     is below `k` is dropped. Default k=10 mirrors the outcomes engine.
 *
 *  2. **Complementary suppression.** A surviving cell can sometimes be
 *     reconstructed by subtraction from totals if it is the *only*
 *     survivor in its row or column AND at least one sibling along the
 *     complement axis was suppressed. For example: if a (programme,
 *     institution, year) row has 4 province cells in the source data
 *     and 3 are suppressed, the surviving 1 is recoverable as
 *     `row_total - sum(visible others)`. Drop it too.
 *
 *     Complementary suppression is the line that turns the floor from a
 *     fig leaf into actual disclosure control.
 *
 * Pure function: no DB calls, no I/O. Easy to test, easy to reason about.
 */

export interface SuppressionAxis<R> {
  /**
   * The dimensions that, together, identify the "row" or "column" within
   * which complementary suppression applies. For the outcomes engine,
   * the row axis groups by (programme, institution, graduation_year)
   * and complements over province; the column axis groups by
   * (programme, institution, province) and complements over
   * graduation_year.
   */
  groupBy: (keyof R)[];
  /**
   * The dimension whose suppressed siblings can reveal a surviving cell
   * via subtraction from totals.
   */
  complementOver: keyof R;
}

export interface SuppressionOptions<R> {
  /** Cell-count field. Rows with `row[countKey] < k` are dropped (primary). */
  countKey: keyof R;
  /** k-anonymity floor. */
  k: number;
  /**
   * Zero or more complementary-suppression passes. Each pass runs over
   * the survivors of all prior passes (and primary). Order can matter
   * for edge cases; the outcomes engine runs row-pass then column-pass.
   */
  axes?: SuppressionAxis<R>[];
}

export interface SuppressionResult<R> {
  /** Rows that survived primary + every complementary pass. */
  passed: R[];
  /** Total dropped count (primary + every complementary pass combined). */
  suppressedCount: number;
}

export function suppress<R extends object>(
  rows: R[],
  opts: SuppressionOptions<R>,
): SuppressionResult<R> {
  const { countKey, k, axes = [] } = opts;

  // ── Primary k-floor ────────────────────────────────────────────────
  const primary = rows.filter((r) => Number(r[countKey]) >= k);
  let suppressedCount = rows.length - primary.length;

  // Survivors as a Set so successive axis passes can delete in place
  // without rebuilding arrays.
  const survivors = new Set<R>(primary);

  // ── Complementary passes ───────────────────────────────────────────
  for (const axis of axes) {
    // Re-group survivors at the start of each pass (prior passes may
    // have dropped cells that this pass would also have flagged).
    const groups = new Map<string, R[]>();
    for (const r of survivors) {
      const key = axis.groupBy.map((d) => String(r[d])).join("::");
      const list = groups.get(key);
      if (list) list.push(r);
      else groups.set(key, [r]);
    }

    for (const cells of groups.values()) {
      if (cells.length !== 1) continue;
      const cell = cells[0]!;
      const hasSuppressedSibling = rows.some((r) => {
        if (r === cell) return false;
        // Same groupBy (i.e. same row/col group).
        for (const d of axis.groupBy) {
          if (r[d] !== cell[d]) return false;
        }
        // Different value along the complement axis  i.e. an actual
        // sibling, not the cell itself viewed twice.
        if (r[axis.complementOver] === cell[axis.complementOver]) return false;
        // Was this sibling suppressed? (count below k)
        return Number(r[countKey]) < k;
      });
      if (hasSuppressedSibling) {
        survivors.delete(cell);
        suppressedCount++;
      }
    }
  }

  return {
    passed: Array.from(survivors),
    suppressedCount,
  };
}
