/**
 * Phase 9.20  shared types + runtime label catalog for the
 * placements lifecycle surface.
 *
 * Lives in a plain module (not `"use server"`) because the runtime
 * constants used by client islands (the departure-category radio list)
 * need to be importable from `"use client"` files. Mirrors the
 * `vacancies-types.ts` split that Phase 9.8 introduced for the same
 * reason.
 *
 * The shape of these types mirrors the Postgres enums in
 * `db/schema.ts:placementLifecycleStatus` /
 * `db/schema.ts:placementDepartureCategory`. Keep them in lockstep.
 */

/**
 * Lifecycle bucket per Phase 9.20 D5.
 *
 *   active    the default for any new hire
 *   departed  set by the Tier 3 markPlacementDeparted action
 *   unknown   reserved for legacy / imported rows where we genuinely
 *             don't know  conservative posture (no implicit "active")
 */
export type PlacementLifecycleStatus = "active" | "departed" | "unknown";

/**
 * Departure category per Phase 9.20 D4. SA labour-relations vocabulary;
 * the *category* is the fact captured, the *reason* is deliberately not.
 * Recording the reason would make Sebenza a record-of-truth for LRA /
 * CCMA disputes  D0 territory.
 */
export type PlacementDepartureCategory =
  | "resigned"
  | "contract_ended"
  | "dismissed"
  | "retrenched"
  | "moved_internally"
  | "mutual_separation"
  | "other";

/**
 * Display order + descriptions for the departure modal's category
 * radio list. Order is deliberate: the most common voluntary
 * departures rank first; involuntary categories sit lower (no UX
 * pressure to "just pick dismissed"). Descriptions explain each in
 * one line  the same level of detail an Owner / Recruiter needs to
 * pick correctly without resorting to HR jargon.
 */
export const PLACEMENT_DEPARTURE_CATEGORIES: ReadonlyArray<{
  value: PlacementDepartureCategory;
  label: string;
  description: string;
}> = [
  {
    value: "resigned",
    label: "Resigned",
    description: "The seeker initiated  voluntary departure.",
  },
  {
    value: "contract_ended",
    label: "Contract ended",
    description: "Fixed-term contract reached its natural end.",
  },
  {
    value: "moved_internally",
    label: "Moved internally",
    description:
      "Same employer, different role  the platform's pipeline can still see them.",
  },
  {
    value: "retrenched",
    label: "Retrenched",
    description: "Operational requirements / restructuring.",
  },
  {
    value: "mutual_separation",
    label: "Mutual separation",
    description: "Both sides agreed to part ways.",
  },
  {
    value: "dismissed",
    label: "Dismissed",
    description:
      "Employer-initiated. The category is the fact; the reason is not recorded.",
  },
  {
    value: "other",
    label: "Other",
    description: "Escape hatch  use sparingly.",
  },
];
