/**
 * Phase 9.11  vacancy-outcome notification body composer.
 *
 * NOT a `"use server"` module  this is a pure helper (synchronous
 * once data is loaded) that the combined Mark-as-Filled Server
 * Action calls per recipient. Plain module so callers can also
 * unit-test the body composition.
 *
 * Privacy invariant (D4 in PHASE_9_11_PLAN.md): the composed body
 * NEVER mentions, names, or attributes the hired person. The
 * comparison axis is recipient profile  vacancy requirements.
 * The hired person's data stays inside the `placements` row + the
 * audit log, never leaks into a notification surface another seeker
 * can see.
 */

import "server-only";

import { SKILLS } from "@/lib/mock/taxonomy";
import {
  DECLINE_REASON_LABEL,
  type DeclineReasonValue,
} from "@/db/queries/decline-reasons";

export interface OutcomeComposerInput {
  /** Vacancy attribution. */
  orgName: string;
  vacancyTitle: string;
  professionLabel: string;
  /** Required-skill SLUGS  the canonical key the form stored. */
  requiredSkillSlugs: string[];
  /** Seniority free-text from the vacancy ("Junior" / "Senior" / null). */
  seniorityLabel: string | null;
  /** Recipient profile  the seeker's own data, never the hired person's. */
  recipientSkillSlugs: string[];
  recipientYearsExperience: number | null;
  /** Optional dominant decline reason for this (profession  province)
   *  cell from the 9.8.7 cross-market aggregate. NULL when below k. */
  dominantDeclineReason: DeclineReasonValue | null;
}

export interface OutcomeComposerResult {
  title: string;
  body: string;
  link: string;
  /** Skill slugs the role wanted that the recipient's profile didn't
   *  show. Passed in the audit meta + the link query string so the
   *  Career Compass landing can pre-highlight. Capped at 5 to keep
   *  the URL + the body line readable. */
  missingSkillSlugs: string[];
}

const SLUG_TO_LABEL = new Map(SKILLS.map((s) => [s.slug, s.label]));

function labelFor(slug: string): string {
  return SLUG_TO_LABEL.get(slug) ?? slug;
}

function joinHumanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} + ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  const tail = items[items.length - 1];
  return `${head} + ${tail}`;
}

export function composeOutcomeNotification(
  input: OutcomeComposerInput,
): OutcomeComposerResult {
  const requiredSet = new Set(input.requiredSkillSlugs);
  const recipientSet = new Set(input.recipientSkillSlugs);
  const missing = Array.from(requiredSet)
    .filter((s) => !recipientSet.has(s))
    .slice(0, 5);
  const overlap = Array.from(requiredSet)
    .filter((s) => recipientSet.has(s))
    .slice(0, 3);

  const title = `${input.orgName} hired someone else for "${input.vacancyTitle}"`;

  const link = missing.length
    ? `/dashboard/grow?missing=${missing.join(",")}`
    : `/dashboard/grow`;

  // ── Body composition ──────────────────────────────────────────────────
  // Honest, never lecturing. Lead with what the role wanted (the
  // structural truth) rather than what the recipient lacks (which
  // reads as personal). Decline-reason context only when the cell
  // has enough data to be above the k-floor.

  const lines: string[] = [];

  // Lead: vacancy attribution + honest closure.
  lines.push(
    `An honest read: ${input.orgName} filled the ${input.vacancyTitle} role with another candidate. Here's the structural picture.`,
  );

  // The role's published requirements.
  if (input.requiredSkillSlugs.length > 0) {
    const requiredLabels = input.requiredSkillSlugs
      .slice(0, 3)
      .map(labelFor);
    lines.push(
      `The role wanted: ${joinHumanList(requiredLabels)}${input.seniorityLabel ? `, at ${input.seniorityLabel.toLowerCase()} level` : ""}.`,
    );
  } else if (input.seniorityLabel) {
    lines.push(
      `The role was pitched at ${input.seniorityLabel.toLowerCase()} level.`,
    );
  }

  // Gap analysis  vacancy-vs-recipient.
  if (missing.length > 0) {
    lines.push(
      `Your profile shows ${overlap.length ? joinHumanList(overlap.map(labelFor)) : "some of these"}; the role also asked for ${joinHumanList(missing.map(labelFor))}.`,
    );
  } else if (input.requiredSkillSlugs.length > 0) {
    // Recipient matched every required skill  decision was about other factors.
    lines.push(
      `Your profile shows every skill the role asked for. The decision came down to factors not on the profile  keep your status fresh and apply your skills to other open roles.`,
    );
  }

  // Cross-market decline-reason signal (Phase 9.8.7 honesty layer).
  if (input.dominantDeclineReason) {
    lines.push(
      `Across recent ${input.professionLabel} declines in the same area, the most common reason was "${DECLINE_REASON_LABEL[input.dominantDeclineReason].toLowerCase()}". Worth knowing as you weigh similar roles.`,
    );
  }

  // Closing nudge to Career Compass.
  if (missing.length > 0) {
    lines.push(
      `Career Compass has a path to add ${joinHumanList(missing.slice(0, 3).map(labelFor))}.`,
    );
  } else {
    lines.push(
      `Open Career Compass for the next set of growth moves in your field.`,
    );
  }

  return {
    title,
    body: lines.join(" "),
    link,
    missingSkillSlugs: missing,
  };
}
