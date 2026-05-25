/**
 * Phase 9.12  Learning-loop value catalogs.
 *
 * Plain TS module (NOT a `"use server"` module) so client components +
 * Server Actions share the same constants. Lives next to `learning.ts`
 * for symmetry with the 9.8.5 `invitations-types.ts` / 9.10
 * `vetting-types.ts` pattern.
 */

import type {
  abandonReason as abandonReasonEnum,
  learningState as learningStateEnum,
  skillProvenance as skillProvenanceEnum,
} from "@/db/schema";

export type LearningStateValue =
  (typeof learningStateEnum.enumValues)[number];

export type AbandonReasonValue =
  (typeof abandonReasonEnum.enumValues)[number];

export type SkillProvenanceValue =
  (typeof skillProvenanceEnum.enumValues)[number];

/** Human-readable label for the abandon-reason picker + the audit meta
 *  rendering. Order = display order in the abandon modal. */
export const ABANDON_REASON_LABEL: Record<AbandonReasonValue, string> = {
  too_expensive: "Too expensive",
  no_time: "Not enough time",
  course_quality: "Course quality wasn't what I expected",
  access_transport: "Access / transport made it impractical",
  changed_direction: "I changed direction",
  too_difficult: "Too difficult for where I'm at",
  other: "Another reason",
};

/** D3  reasons that trigger the cost/access re-recommend on the next
 *  compass render (surface a *free* alternative for the same skill). */
export const COST_ACCESS_ABANDON_REASONS: ReadonlySet<AbandonReasonValue> =
  new Set(["too_expensive", "access_transport"]);

/** UI honesty contract  derived label for a profile_skills row. */
export function provenanceLabel(p: SkillProvenanceValue): string {
  switch (p) {
    case "self_attested":
      return "Self-attested";
    case "self_attested_learning":
      return "Self-attested · via learning";
    case "imported":
      return "Imported";
    case "verified_provider":
      return "Verified";
  }
}

/** Renders "Verified" ONLY when the honesty contract is met (D1). */
export function isVerifiedSkill(
  provenance: SkillProvenanceValue,
  verifiedAt: Date | null | undefined,
): boolean {
  return provenance === "verified_provider" && verifiedAt != null;
}

export const LEARNING_NOTE_MAX = 200;
