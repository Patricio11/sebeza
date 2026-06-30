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
  COST_ACCESS_ABANDON_REASONS,
  LEARNING_NOTE_MAX,
  type AbandonReasonValue,
} from "./learning-types";
import {
  findFreeAlternativeForSkill,
  type FreeAlternative,
} from "./free-alternatives";

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
  /** Phase 17 — self-paced progress 0..100 on an active item. */
  progressPercent: number;
  state:
    | "interested"
    | "accepted"
    | "in_progress"
    | "completed"
    | "abandoned";
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
    progressPercent: r.progressPercent,
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

// ──────────────────────────────────────────────────────────────────────
// Phase 17 ("The Climb")  self-paced progress on an active learning item.
// External providers mean we can't observe real completion, so this is the
// seeker's own marker. The first move promotes accepted/interested →
// in_progress + stamps startedAt. Completion stays a separate, explicit
// action (with self-assessed proficiency).
// ──────────────────────────────────────────────────────────────────────

export async function setLearningProgress(
  itemId: string,
  percent: number,
): Promise<ActionResult<{ progressPercent: number }>> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const item = await loadOwnedItem(itemId, profileId);
  if (!item) return { ok: false, message: "Learning item not found." };
  if (item.state === "completed" || item.state === "abandoned") {
    return { ok: false, message: "This item is finished  progress can't change." };
  }

  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const promote = item.state === "accepted" || item.state === "interested";

  const db = getDb();
  await db
    .update(schema.learningItems)
    .set({
      progressPercent: clamped,
      ...(promote
        ? { state: "in_progress" as const, startedAt: item.startedAt ?? new Date() }
        : {}),
    })
    .where(eq(schema.learningItems.id, itemId));

  await logAccess({
    kind: "learning.progress",
    actor: me.id,
    subject: itemId,
    meta: {
      skillSlug: item.skillSlug,
      progressPercent: clamped,
      from: item.state,
    },
  });

  revalidatePath("/dashboard/grow");
  revalidatePath("/dashboard");
  return { ok: true, progressPercent: clamped };
}

// ──────────────────────────────────────────────────────────────────────
// Phase 11.2.1  click-through tracking for LearningPathCard CTAs.
// We don't redirect through Sebenza (D1: keeps the trust chain clean);
// the seeker's browser goes straight to the provider URL. This action
// just logs the click so quarterly editorial review knows which paths
// actually get traffic.
// ──────────────────────────────────────────────────────────────────────

export interface OpenLearningPathInput {
  title: string;
  provider: string;
  providerKind: string;
  url: string;
}

export async function logLearningPathOpen(
  input: OpenLearningPathInput,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  // No DB write beyond the audit row  the action is a one-shot ledger
  // event. Per D1 we don't redirect or rewrite the URL; the seeker's
  // browser handles the navigation.
  await logAccess({
    kind: "learning_path.opened",
    actor: me.id,
    subject: input.title,
    meta: {
      provider: input.provider,
      providerKind: input.providerKind,
      url: input.url,
    },
  });
  return { ok: true };
}

export async function completeLearningItem(
  itemId: string,
  /** Phase 17 — the seeker's self-assessed depth on completion. Applied to a
   *  newly-attached skill (replaces the old hardcoded proficiency 3); existing
   *  rows keep the upgrade-only honesty contract. */
  opts?: { proficiency?: number; yearsOfExperience?: number | null },
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

  // Seeker-owned self-assessment (Phase 17). Clamp 1..5 / 0..60; default to the
  // old honest "basics + <1yr" when the caller doesn't pass one.
  const chosenProficiency = Math.max(
    1,
    Math.min(5, Math.round(opts?.proficiency ?? 3)),
  );
  const chosenYears =
    opts?.yearsOfExperience == null
      ? null
      : Math.max(0, Math.min(60, Math.round(opts.yearsOfExperience)));

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
        proficiency: chosenProficiency,
        yearsOfExperience: chosenYears,
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

  // Phase 11.2.7  Career-Compass + dashboard surfaces depend on the
  // skill set; refresh both so the celebration line sees the new rank.
  revalidatePath("/dashboard/grow");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
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

// ──────────────────────────────────────────────────────────────────────
// Phase 11.2.2  cost-driven swap to a free alternative.
//
// `fetchFreeAlternativeForItem` is the read used by the AbandonModal
// once the seeker picks a cost-access reason: it excludes paths the
// seeker has already abandoned for the same skill and returns the
// next-best free / subsidised path, or null if nothing matches.
//
// `swapToFreeAlternative` is the atomic two-step: abandon the original
// + accept the free alternative in a single transaction so a partial
// failure can't leave the seeker stranded mid-state. Audits both
// transitions; fires a single `learning.swapped_to_free` notification.
// ──────────────────────────────────────────────────────────────────────

export async function fetchFreeAlternativeForItem(
  itemId: string,
): Promise<FreeAlternative | null> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return null;
  const item = await loadOwnedItem(itemId, profileId);
  if (!item) return null;

  const db = getDb();
  const prior = await db
    .select({ title: schema.learningItems.title })
    .from(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.profileId, profileId),
        eq(schema.learningItems.skillSlug, item.skillSlug),
        eq(schema.learningItems.state, "abandoned"),
      ),
    );
  const exclude = [item.title, ...prior.map((r) => r.title)];
  return findFreeAlternativeForSkill(item.skillSlug, exclude);
}

export interface SwapToFreeAlternativeInput {
  abandonItemId: string;
  reason: AbandonReasonValue;
  note?: string;
  freePathTitle: string;
  freePathProvider: string;
  freePathProviderKind: string;
  freePathIsFree: boolean;
}

export async function swapToFreeAlternative(
  input: SwapToFreeAlternativeInput,
): Promise<ActionResult<{ newItemId: string }>> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const item = await loadOwnedItem(input.abandonItemId, profileId);
  if (!item) return { ok: false, message: "Learning item not found." };
  if (item.state === "completed") {
    return { ok: false, message: "Already completed  can't be abandoned." };
  }
  if (item.state === "abandoned") {
    return { ok: false, message: "Already marked as abandoned." };
  }
  if (!COST_ACCESS_ABANDON_REASONS.has(input.reason)) {
    return {
      ok: false,
      message: "Swap-to-free only applies to cost or access reasons.",
    };
  }
  const note = (input.note ?? "").trim();
  if (note.length > LEARNING_NOTE_MAX) {
    return {
      ok: false,
      message: `Note can't exceed ${LEARNING_NOTE_MAX} characters.`,
    };
  }
  if (input.freePathTitle.trim().length === 0) {
    return { ok: false, message: "Free alternative title missing." };
  }

  const db = getDb();
  const newId = `lrn_${randomUUID()}`;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.learningItems)
      .set({
        state: "abandoned",
        abandonedAt: new Date(),
        abandonReason: input.reason,
        abandonNote: note.length > 0 ? note : null,
      })
      .where(eq(schema.learningItems.id, input.abandonItemId));

    await tx.insert(schema.learningItems).values({
      id: newId,
      profileId,
      skillSlug: item.skillSlug,
      title: input.freePathTitle,
      provider: input.freePathProvider,
      resourceUrl: null,
      resourceKind: input.freePathProviderKind,
      isFree: input.freePathIsFree,
    });
  });

  await logAccess({
    kind: "learning.abandon",
    actor: me.id,
    subject: input.abandonItemId,
    meta: {
      skillSlug: item.skillSlug,
      from: item.state,
      reason: input.reason,
      seekerAuthoredFreeText: note.length > 0,
      swappedToFree: true,
    },
  });
  await logAccess({
    kind: "learning.swapped_to_free",
    actor: me.id,
    subject: input.abandonItemId,
    meta: {
      originalSkillSlug: item.skillSlug,
      newItemId: newId,
      newPathTitle: input.freePathTitle,
      newProvider: input.freePathProvider,
    },
  });
  await logAccess({
    kind: "learning.accept",
    actor: me.id,
    subject: newId,
    meta: { skillSlug: item.skillSlug, matchedFromCatalog: true, viaSwap: true },
  });

  const skill = SKILLS.find((s) => s.slug === item.skillSlug);
  await createNotification({
    userId: me.id,
    kind: "learning.swapped_to_free",
    title: `Switched to a free path for ${skill?.label ?? item.skillSlug}`,
    body: `${input.freePathTitle} (${input.freePathProvider}) is now on your learning list.`,
    link: "/dashboard/grow",
    meta: {
      skillSlug: item.skillSlug,
      newItemId: newId,
      newPathTitle: input.freePathTitle,
    },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true, newItemId: newId };
}

// ──────────────────────────────────────────────────────────────────────
// Phase 11.2.4  parking-lot lifecycle.
//
// Per D4 the new `interested` state lands as a learning_state enum
// value, not a separate column or table. `markLearningInterested`
// creates the parking-lot row; `promoteInterestedToPlanned` upgrades
// it to `accepted` (the existing planned/committed entry point). No
// notification fires on either transition  parking is silent by
// design.
//
// `interested` rows do NOT count toward completion/abandonment
// analytics. The 9.13 stall analytics already filters on the
// `abandoned` state; the celebration notifications fire only on
// `completed`. No downstream gates need touching.
// ──────────────────────────────────────────────────────────────────────

export async function markLearningInterested(
  skillSlug: string,
): Promise<ActionResult<{ itemId: string }>> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) {
    return { ok: false, message: "Finish setting up your profile first." };
  }
  const skill = SKILLS.find((s) => s.slug === skillSlug);
  if (!skill) return { ok: false, message: "Unknown skill." };

  const db = getDb();
  // De-dupe against any open lifecycle row for the same skill
  // interested OR accepted OR in_progress all count as "already on the
  // list" from the seeker's perspective.
  const existing = await db
    .select({ id: schema.learningItems.id, state: schema.learningItems.state })
    .from(schema.learningItems)
    .where(
      and(
        eq(schema.learningItems.profileId, profileId),
        eq(schema.learningItems.skillSlug, skillSlug),
        sql`${schema.learningItems.state} IN ('interested','accepted','in_progress')`,
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, itemId: existing[0].id };
  }

  const matched = matchLearningPathForSkill(skillSlug);
  const id = `lrn_${randomUUID()}`;
  await db.insert(schema.learningItems).values({
    id,
    profileId,
    skillSlug,
    title: matched?.title ?? `Learn ${skill.label}`,
    provider: matched?.provider ?? "Pick a course",
    resourceUrl: null,
    resourceKind: matched ? matched.providerKind : "other",
    isFree: matched ? matched.cost === "free" : false,
    state: "interested",
  });

  await logAccess({
    kind: "learning.interested",
    actor: me.id,
    subject: id,
    meta: { skillSlug, matchedFromCatalog: matched != null },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true, itemId: id };
}

export async function promoteInterestedToPlanned(
  itemId: string,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const item = await loadOwnedItem(itemId, profileId);
  if (!item) return { ok: false, message: "Learning item not found." };
  if (item.state !== "interested") {
    return {
      ok: false,
      message: "This item is already past the parking-lot step.",
    };
  }

  const db = getDb();
  await db
    .update(schema.learningItems)
    .set({ state: "accepted" })
    .where(eq(schema.learningItems.id, itemId));

  await logAccess({
    kind: "learning.interested.promote",
    actor: me.id,
    subject: itemId,
    meta: { skillSlug: item.skillSlug, to: "accepted" },
  });

  revalidatePath("/dashboard/grow");
  return { ok: true };
}
