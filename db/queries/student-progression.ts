/**
 * Phase 13.4  student progression timeline read path.
 *
 * Composes a chronological journey for the seeker from five sources:
 *
 *   1. academic_profiles.currentYear + expectedGraduation
 *      → "Year 2 of 4" header + "~18 months to graduation" eyebrow.
 *      Surfaced as a single header row, not a timeline event.
 *
 *   2. qualifications  per-row event with verification status chip.
 *      `awardedYear` is the chronological anchor; we don't synthesise
 *      a month because the column is year-precision.
 *
 *   3. placements (employer_confirmed only)  per-row event keyed by
 *      `hiredAt`. Joined against organizations for the display name.
 *      Verification-Honesty Rule: we do NOT include seeker_reported
 *      placements here  those carry no platform-side verification
 *      and would conflate self-declared with platform-confirmed.
 *
 *   4. learning_items.state='completed'  per-row event keyed by
 *      `completedAt`. The existing /dashboard/grow learning section
 *      handles the in-progress + interested state; the timeline only
 *      surfaces the terminal "completed" event.
 *
 *   5. student_milestones (Phase 13.4)  per-row self-declared event.
 *      Carries a 'self_declared' provenance chip so the student sees
 *      how the platform knows what it knows (D6).
 *
 * All five sources fold into one ordered timeline. The render side
 * sorts DESC by date so the most recent event is at the top.
 */

import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export type ProgressionProvenance =
  /** Inferred from a row the platform already had (qualifications,
   *  placements, learning_items). Carries no extra trust signal beyond
   *  the source row. */
  | "auto"
  /** Self-declared by the seeker on /dashboard/grow. Visible only on
   *  the private timeline; never reaches /p/<handle>. */
  | "self_declared";

export type ProgressionEventKind =
  | "qualification"
  | "placement_confirmed"
  | "learning_completed"
  | "milestone_dissertation_submitted"
  | "milestone_graduation_confirmed"
  | "milestone_first_job_accepted"
  | "milestone_studies_paused"
  | "milestone_other";

export type ProgressionEvent = {
  /** Stable id of the underlying row  used as the React list key
   *  and for the remove-milestone action. */
  id: string;
  kind: ProgressionEventKind;
  /** Display title. e.g. "BSc Computer Science  Wits". */
  title: string;
  /** Optional one-line subtitle (institution, employer, provider). */
  subtitle?: string;
  /** ISO date string. Year-only for qualifications. */
  occurredOn: string;
  provenance: ProgressionProvenance;
  /** Optional status chip text. Empty when no chip applies. */
  statusChip?: string;
  /** Free-text note for self-declared milestones. */
  note?: string;
};

export type ProgressionHeader = {
  currentYear: number | null;
  expectedGraduation: string | null;
  /** Months remaining to expectedGraduation. Null when no expected
   *  graduation date is set. Negative when overdue. */
  monthsToGraduation: number | null;
  /** Quiet nudge string assembled from the auto-derived counts.
   *  Rendered as the eyebrow line on the timeline surface. */
  nextStepHint: string | null;
};

export type StudentProgressionTimeline = {
  header: ProgressionHeader;
  events: ProgressionEvent[];
};

export async function loadStudentProgressionTimeline(
  profileId: string,
): Promise<StudentProgressionTimeline | null> {
  const db = getDb();

  const academic = await db
    .select({
      currentYear: schema.academicProfiles.currentYear,
      expectedGraduation: schema.academicProfiles.expectedGraduation,
      electiveChosen: schema.academicProfiles.electiveChosen,
      projectTopic: schema.academicProfiles.projectTopic,
    })
    .from(schema.academicProfiles)
    .where(eq(schema.academicProfiles.profileId, profileId))
    .limit(1);

  const ac = academic[0];
  if (!ac) return null;

  // 2. qualifications  by awardedYear ASC (oldest first; the render
  // re-sorts globally DESC after merging).
  const qualifications = await db
    .select({
      id: schema.qualifications.id,
      title: schema.qualifications.title,
      institution: schema.qualifications.institution,
      awardedYear: schema.qualifications.awardedYear,
      verification: schema.qualifications.verification,
    })
    .from(schema.qualifications)
    .where(eq(schema.qualifications.profileId, profileId));

  // 3. placements  employer_confirmed only, joined to organizations.
  const placements = await db
    .select({
      id: schema.placements.id,
      role: schema.placements.role,
      hiredAt: schema.placements.hiredAt,
      orgName: schema.organizations.name,
      source: schema.placements.source,
      currentStatus: schema.placements.currentStatus,
    })
    .from(schema.placements)
    .leftJoin(
      schema.organizations,
      eq(schema.placements.organizationId, schema.organizations.id),
    )
    .where(
      and(
        eq(schema.placements.profileId, profileId),
        eq(schema.placements.source, "employer_confirmed"),
      ),
    )
    .orderBy(desc(schema.placements.hiredAt));

  // 4. learning_items completed.
  const learning = await db
    .select({
      id: schema.learningItems.id,
      title: schema.learningItems.title,
      provider: schema.learningItems.provider,
      completedAt: schema.learningItems.completedAt,
    })
    .from(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.profileId, profileId),
        eq(schema.learningItems.state, "completed"),
        isNotNull(schema.learningItems.completedAt),
      ),
    )
    .orderBy(desc(schema.learningItems.completedAt));

  // 5. self-declared milestones.
  const milestones = await db
    .select({
      id: schema.studentMilestones.id,
      kind: schema.studentMilestones.kind,
      occurredOn: schema.studentMilestones.occurredOn,
      note: schema.studentMilestones.note,
    })
    .from(schema.studentMilestones)
    .where(eq(schema.studentMilestones.profileId, profileId))
    .orderBy(desc(schema.studentMilestones.occurredOn));

  const events: ProgressionEvent[] = [];

  for (const q of qualifications) {
    // Year-precision dates synthesise to mid-year so the sort lands
    // qualifications between January placements and December
    // learning items predictably.
    const occurredOn = q.awardedYear ? `${q.awardedYear}-06-30` : null;
    if (!occurredOn) continue;
    events.push({
      id: q.id,
      kind: "qualification",
      title: q.title,
      subtitle: q.institution,
      occurredOn,
      provenance: "auto",
      statusChip:
        q.verification === "verified"
          ? "Verified"
          : q.verification === "pending"
            ? "Pending review"
            : q.verification === "rejected"
              ? "Verification rejected"
              : "Unverified",
    });
  }

  for (const p of placements) {
    const occurredOn = p.hiredAt.toISOString().slice(0, 10);
    events.push({
      id: p.id,
      kind: "placement_confirmed",
      title: p.role,
      subtitle: p.orgName ?? undefined,
      occurredOn,
      provenance: "auto",
      statusChip:
        p.currentStatus === "active"
          ? "Active"
          : p.currentStatus === "departed"
            ? "Departed"
            : undefined,
    });
  }

  for (const l of learning) {
    if (!l.completedAt) continue;
    const occurredOn = l.completedAt.toISOString().slice(0, 10);
    events.push({
      id: l.id,
      kind: "learning_completed",
      title: l.title,
      subtitle: l.provider ?? undefined,
      occurredOn,
      provenance: "auto",
      statusChip: "Completed",
    });
  }

  for (const m of milestones) {
    events.push({
      id: m.id,
      kind: mapMilestoneKind(m.kind),
      title: milestoneTitle(m.kind),
      occurredOn: m.occurredOn,
      provenance: "self_declared",
      note: m.note ?? undefined,
    });
  }

  // Global sort: most recent first. Year-anchored qualifications use
  // the synthetic mid-year date; ties on the same day keep insertion
  // order (qualification → placement → learning → milestone) which
  // is a reasonable secondary ordering.
  events.sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));

  const header: ProgressionHeader = buildHeader(ac, {
    qualificationsCount: qualifications.length,
    placementsCount: placements.length,
    learningCompletedCount: learning.length,
    hasElective: !!ac.electiveChosen,
    hasProject: !!ac.projectTopic,
  });

  return { header, events };
}

function mapMilestoneKind(kind: string): ProgressionEventKind {
  switch (kind) {
    case "dissertation_submitted":
      return "milestone_dissertation_submitted";
    case "graduation_confirmed":
      return "milestone_graduation_confirmed";
    case "first_job_accepted":
      return "milestone_first_job_accepted";
    case "studies_paused":
      return "milestone_studies_paused";
    default:
      return "milestone_other";
  }
}

function milestoneTitle(kind: string): string {
  switch (kind) {
    case "dissertation_submitted":
      return "Dissertation submitted";
    case "graduation_confirmed":
      return "Graduation date confirmed";
    case "first_job_accepted":
      return "First job offer accepted";
    case "studies_paused":
      return "Studies paused";
    default:
      return "Milestone";
  }
}

function buildHeader(
  ac: {
    currentYear: number | null;
    expectedGraduation: string | null;
  },
  counts: {
    qualificationsCount: number;
    placementsCount: number;
    learningCompletedCount: number;
    hasElective: boolean;
    hasProject: boolean;
  },
): ProgressionHeader {
  const months = monthsBetween(new Date(), ac.expectedGraduation);
  const hint = buildHint(ac, counts);
  return {
    currentYear: ac.currentYear,
    expectedGraduation: ac.expectedGraduation,
    monthsToGraduation: months,
    nextStepHint: hint,
  };
}

function monthsBetween(now: Date, expectedYm: string | null): number | null {
  if (!expectedYm) return null;
  const m = expectedYm.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const yearDelta = year - now.getUTCFullYear();
  const monthDelta = month - 1 - now.getUTCMonth();
  return yearDelta * 12 + monthDelta;
}

/**
 * One quiet sentence that nudges the student towards the next
 * profile-completion step. No pressure language; pick the most
 * impactful gap by ordered priority:
 *
 *   1. No qualifications declared → ask for one (verification ramp).
 *   2. Year >= 3 and no project topic → declare project topic.
 *   3. Year >= 2 and no elective → declare elective.
 *   4. Learning completed = 0 → suggest Career Compass.
 *
 * Returns null when nothing obvious is missing.
 */
function buildHint(
  ac: { currentYear: number | null; expectedGraduation: string | null },
  c: {
    qualificationsCount: number;
    placementsCount: number;
    learningCompletedCount: number;
    hasElective: boolean;
    hasProject: boolean;
  },
): string | null {
  if (c.qualificationsCount === 0) {
    return "Next: add a qualification on your profile so we can plot your verified credentials here.";
  }
  if ((ac.currentYear ?? 0) >= 3 && !c.hasProject) {
    return "Next: declare your project / dissertation topic on your profile  it's the strongest single skill signal we can capture.";
  }
  if ((ac.currentYear ?? 0) >= 2 && !c.hasElective) {
    return "Next: declare your elective on your profile so the matcher can read the intentional bit of your degree.";
  }
  if (c.learningCompletedCount === 0) {
    return "Next: start a learning path from Career Compass  the first completion lands here as a verified row.";
  }
  return null;
}
