"use server";

/**
 * Phase 9.12  Learning-loop Server Actions.
 *
 * Owns the four state transitions a seeker can drive on their own
 * `learning_items` rows:
 *
 *   acceptRecommendation        ⇒ create row in 'accepted'
 *   startLearningItem(id)       ⇒ 'accepted' → 'in_progress' + startedAt
 *   completeLearningItem(id)    ⇒ * → 'completed' + completedAt + ATTACH SKILL
 *   abandonLearningItem(id,…)   ⇒ * → 'abandoned' + abandonedAt + reason
 *
 * Every transition writes an audit row + the completion path also
 * upserts a `profile_skills` row with `provenance='self_attested_learning'`
 * (D1 honesty contract  upgrades existing `self_attested` rows but
 * never downgrades a `verified_provider` row).
 *
 * Notifications:
 *  - `learning.completed` fires from completeLearningItem (celebration;
 *    exempt from the D5 cross-kind cap).
 *  - `learning.nudge` fires from the cron in 9.12.6, not here.
 *
 * Out of scope here (see 9.12.6): periodic nudges, the D5 cross-kind
 * frequency cap.
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";
import { rankInPoolQuery } from "@/db/queries/analytics";
import { SKILLS } from "@/lib/mock/taxonomy";
import { MOCK_COMPASS } from "@/lib/mock/growth";
import type { LearningPath } from "@/lib/mock/growth";
import {
  ABANDON_REASON_LABEL,
  LEARNING_NOTE_MAX,
  type AbandonReasonValue,
} from "./learning-types";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

/** Resolve the signed-in seeker's profile id (the FK target for
 *  `learning_items.profile_id`). Returns null if no profile row exists
 *  yet  the action returns a friendly message instead of throwing. */
async function getMyProfileId(userId: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return row[0]?.id ?? null;
}

/** Resolve a learning-path catalog entry that unlocks the target skill.
 *  Used by acceptRecommendation to default `title`/`provider`/`resourceKind`
 *  when the caller doesn't provide them. Pure (reads the static catalog). */
function matchLearningPathForSkill(skillSlug: string): LearningPath | null {
  const skillLabel = SKILLS.find((s) => s.slug === skillSlug)?.label;
  if (!skillLabel) return null;
  const labelLower = skillLabel.toLowerCase();
  return (
    MOCK_COMPASS.learningPaths.find((p) =>
      p.unlocksSkills.some((s) => s.toLowerCase() === labelLower),
    ) ?? null
  );
}

/** Fetch + ownership-check in one round trip. Returns the row or null. */
async function loadOwnedItem(
  itemId: string,
  profileId: string,
): Promise<typeof schema.learningItems.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.id, itemId),
        eq(schema.learningItems.profileId, profileId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ──────────────────────────────────────────────────────────────────────
// Reads (callable from server components AND server actions; the
// "use server" wrapping is harmless for read-only paths since they
// don't mutate.)
// ──────────────────────────────────────────────────────────────────────

export interface MyLearningRow {
  id: string;
  skillSlug: string;
  skillLabel: string;
  title: string;
  provider: string;
  resourceUrl: string | null;
  resourceKind: string;
  isFree: boolean;
  state: "accepted" | "in_progress" | "completed" | "abandoned";
  startedAt: string | null;
  completedAt: string | null;
  abandonedAt: string | null;
  abandonReason: AbandonReasonValue | null;
  createdAt: string;
}

/** Recent learning items for the signed-in seeker, newest first.
 *  Caps at 25  the My Learning section is a digest, not a log. */
export async function listMyLearningItems(): Promise<MyLearningRow[]> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return [];

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.learningItems)
    .where(eq(schema.learningItems.profileId, profileId))
    .orderBy(sql`${schema.learningItems.createdAt} DESC`)
    .limit(25);

  const labelBySlug = new Map(SKILLS.map((s) => [s.slug, s.label]));
  return rows.map((r) => ({
    id: r.id,
    skillSlug: r.skillSlug,
    skillLabel: labelBySlug.get(r.skillSlug) ?? r.skillSlug,
    title: r.title,
    provider: r.provider,
    resourceUrl: r.resourceUrl,
    resourceKind: r.resourceKind,
    isFree: r.isFree,
    state: r.state,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    abandonedAt: r.abandonedAt?.toISOString() ?? null,
    abandonReason: (r.abandonReason ?? null) as AbandonReasonValue | null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** D3  the most recent abandoned reason per skill, used by the compass
 *  to surface a free alternative when reason is cost/access-driven.
 *  Returns a map keyed by skillSlug. */
export async function listRecentAbandonReasonsBySkill(): Promise<
  Map<string, AbandonReasonValue>
> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      skillSlug: schema.learningItems.skillSlug,
      reason: schema.learningItems.abandonReason,
      abandonedAt: schema.learningItems.abandonedAt,
    })
    .from(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.profileId, profileId),
        eq(schema.learningItems.state, "abandoned"),
      ),
    )
    .orderBy(sql`${schema.learningItems.abandonedAt} DESC`);

  const out = new Map<string, AbandonReasonValue>();
  for (const r of rows) {
    if (!out.has(r.skillSlug) && r.reason) {
      out.set(r.skillSlug, r.reason as AbandonReasonValue);
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Actions
// ──────────────────────────────────────────────────────────────────────

export interface AcceptInput {
  skillSlug: string;
  /** Optional overrides if the caller wants a specific provider/path. */
  title?: string;
  provider?: string;
  resourceUrl?: string;
  resourceKind?: string;
  isFree?: boolean;
}

export async function acceptRecommendation(
  input: AcceptInput,
): Promise<ActionResult<{ itemId: string }>> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) {
    return { ok: false, message: "Finish setting up your profile first." };
  }

  const skill = SKILLS.find((s) => s.slug === input.skillSlug);
  if (!skill) return { ok: false, message: "Unknown skill." };

  // De-dupe: if the seeker already has an active (accepted/in_progress)
  // row for this skill, return it instead of creating a second one. The
  // compass shows "Continue learning" rather than "Accept again."
  const db = getDb();
  const existing = await db
    .select({ id: schema.learningItems.id })
    .from(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.profileId, profileId),
        eq(schema.learningItems.skillSlug, input.skillSlug),
        sql`${schema.learningItems.state} IN ('accepted','in_progress')`,
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, itemId: existing[0].id };
  }

  const matched = matchLearningPathForSkill(input.skillSlug);
  const id = `lrn_${randomUUID()}`;
  await db.insert(schema.learningItems).values({
    id,
    profileId,
    skillSlug: input.skillSlug,
    title: input.title ?? matched?.title ?? `Learn ${skill.label}`,
    provider: input.provider ?? matched?.provider ?? "Pick a course",
    resourceUrl: input.resourceUrl ?? null,
    resourceKind:
      input.resourceKind ??
      (matched ? matched.providerKind : "other"),
    isFree:
      input.isFree ??
      (matched ? matched.cost === "free" : false),
  });

  await logAccess({
    kind: "learning.accept",
    actor: me.id,
    subject: id,
    meta: { skillSlug: input.skillSlug, matchedFromCatalog: matched != null },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true, itemId: id };
}

export async function startLearningItem(
  itemId: string,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const item = await loadOwnedItem(itemId, profileId);
  if (!item) return { ok: false, message: "Learning item not found." };
  if (item.state !== "accepted") {
    return { ok: false, message: "This item is already past the start step." };
  }

  const db = getDb();
  await db
    .update(schema.learningItems)
    .set({ state: "in_progress", startedAt: new Date() })
    .where(eq(schema.learningItems.id, itemId));

  await logAccess({
    kind: "learning.start",
    actor: me.id,
    subject: itemId,
    meta: { skillSlug: item.skillSlug, from: item.state },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true };
}

export async function completeLearningItem(
  itemId: string,
): Promise<
  ActionResult<{
    attachedSkill: boolean;
    rankDelta: { current: number | null; projected: number | null } | null;
  }>
> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const item = await loadOwnedItem(itemId, profileId);
  if (!item) return { ok: false, message: "Learning item not found." };
  if (item.state === "completed") {
    return { ok: false, message: "Already marked complete." };
  }
  if (item.state === "abandoned") {
    return {
      ok: false,
      message: "This item was abandoned. Accept the recommendation again to restart.",
    };
  }

  const skill = SKILLS.find((s) => s.slug === item.skillSlug);
  if (!skill) return { ok: false, message: "Skill no longer in taxonomy." };

  const db = getDb();
  let attached = false;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.learningItems)
      .set({ state: "completed", completedAt: new Date() })
      .where(eq(schema.learningItems.id, itemId));

    // D1 honesty contract  upsert with provenance upgrade-only semantics.
    // A skill already present as `self_attested` gets upgraded to
    // `self_attested_learning` (better honesty). A skill marked
    // `verified_provider` is left alone (never downgraded). A skill not
    // yet present is inserted at default proficiency 3 + NULL years
    // (honest "<1 yr" per UI rule).
    const upsertResult = await tx
      .insert(schema.profileSkills)
      .values({
        profileId,
        skillSlug: item.skillSlug,
        proficiency: 3,
        yearsOfExperience: null,
        provenance: "self_attested_learning",
        verifiedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          schema.profileSkills.profileId,
          schema.profileSkills.skillSlug,
        ],
        // Only upgrade self_attested rows. The WHERE filter keeps
        // verified_provider rows untouched (verifiedAt + provenance
        // stay as-is per D1 honesty).
        set: { provenance: "self_attested_learning" },
        setWhere: sql`${schema.profileSkills.provenance} = 'self_attested'`,
      });
    // Drizzle's pg driver doesn't expose rowCount reliably from upsert
    // here; the boolean we surface to the UI is "did we touch
    // profile_skills at all" rather than "was it a new insert." Good
    // enough for the celebration copy on the client.
    attached = upsertResult != null;
  });

  // Fresh rank computation for the celebration copy. Read-only; never
  // throws  it's UI polish, not a load-bearing call.
  let rankDelta: { current: number | null; projected: number | null } | null =
    null;
  try {
    const profileRow = await db
      .select({
        handle: schema.profiles.handle,
        profession: schema.profiles.profession,
        province: schema.profiles.province,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, profileId))
      .limit(1);
    const p = profileRow[0];
    if (p) {
      const rank = await rankInPoolQuery({
        handle: p.handle,
        profession: p.profession,
        province: p.province,
        projectedSkillBoost: 1,
      });
      if (rank) {
        rankDelta = { current: rank.rank, projected: rank.projectedRank };
      }
    }
  } catch {
    // ignore  celebration copy degrades gracefully.
  }

  await logAccess({
    kind: "learning.complete",
    actor: me.id,
    subject: itemId,
    meta: {
      skillSlug: item.skillSlug,
      attachedToProfile: attached,
      rankCurrent: rankDelta?.current ?? null,
      rankProjected: rankDelta?.projected ?? null,
    },
  });

  // Celebration notification. Exempt from D5 cap per plan  positive
  // payoff is never throttled.
  await createNotification({
    userId: me.id,
    kind: "learning.completed",
    title: `Nice work  ${skill.label} added to your profile`,
    body: rankDelta?.current
      ? `Your projected rank in ${p_poolLabel(item.skillSlug)} moved from #${rankDelta.current} toward #${rankDelta.projected ?? rankDelta.current}. Keep your status fresh in search.`
      : `It's on your profile as self-attested (via learning). Keep your status fresh in search.`,
    link: "/dashboard/profile",
    meta: { itemId, skillSlug: item.skillSlug },
  });

  revalidatePath("/dashboard/grow");
  revalidatePath("/dashboard/profile");
  return { ok: true, attachedSkill: attached, rankDelta };
}

function p_poolLabel(skillSlug: string): string {
  return SKILLS.find((s) => s.slug === skillSlug)?.label ?? "your pool";
}

export interface AbandonInput {
  itemId: string;
  reason: AbandonReasonValue;
  note?: string;
}

export async function abandonLearningItem(
  input: AbandonInput,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const item = await loadOwnedItem(input.itemId, profileId);
  if (!item) return { ok: false, message: "Learning item not found." };
  if (item.state === "completed") {
    return { ok: false, message: "Already completed  can't be abandoned." };
  }
  if (item.state === "abandoned") {
    return { ok: false, message: "Already marked as abandoned." };
  }
  if (!ABANDON_REASON_LABEL[input.reason]) {
    return { ok: false, message: "Pick a reason from the list." };
  }
  const note = (input.note ?? "").trim();
  if (input.reason === "other" && note.length === 0) {
    return { ok: false, message: "Add a short note when picking 'Another reason'." };
  }
  if (note.length > LEARNING_NOTE_MAX) {
    return {
      ok: false,
      message: `Note can't exceed ${LEARNING_NOTE_MAX} characters.`,
    };
  }

  const db = getDb();
  await db
    .update(schema.learningItems)
    .set({
      state: "abandoned",
      abandonedAt: new Date(),
      abandonReason: input.reason,
      abandonNote: note.length > 0 ? note : null,
    })
    .where(eq(schema.learningItems.id, input.itemId));

  await logAccess({
    kind: "learning.abandon",
    actor: me.id,
    subject: input.itemId,
    meta: {
      skillSlug: item.skillSlug,
      from: item.state,
      reason: input.reason,
      seekerAuthoredFreeText: note.length > 0,
      // PII-flag mirrors the 9.8.5 decline-note pattern. The note text
      // itself is NOT in audit meta (would defeat the redaction posture);
      // only its presence is recorded.
    },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true };
}
