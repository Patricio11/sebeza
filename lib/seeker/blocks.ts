"use server";

/**
 * Phase 11.3.2  seeker-private employer block list.
 *
 * D2 invariant: blocks are private + employer-invisible. The employer
 * is not notified. They are not visible on any employer surface. They
 * are not exposed in audit logs the employer can read. The employer's
 * view of `/search` silently excludes blocked-seeker profiles (the
 * search query gains a NOT EXISTS clause keyed on the caller's org
 * id). The employer's bulk-invite silently skips blocked seekers
 * (matches the existing consent-not-granted skip pattern).
 *
 * Three Server Actions: `blockEmployer`, `unblockEmployer`,
 * `listMyBlocks`. The seeker's privacy page is the canonical surface
 * for managing existing blocks.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

const REASON_MAX = 200;

async function getMyProfileId(userId: string): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return row[0]?.id ?? null;
}

export interface BlockEmployerInput {
  orgId: string;
  reason?: string;
}

export async function blockEmployer(
  input: BlockEmployerInput,
): Promise<ActionResult<{ blockId: string }>> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) {
    return { ok: false, message: "Finish setting up your profile first." };
  }
  const reason = (input.reason ?? "").trim();
  if (reason.length > REASON_MAX) {
    return {
      ok: false,
      message: `Reason can't exceed ${REASON_MAX} characters.`,
    };
  }

  const db = getDb();
  // Dedupe at the UNIQUE-constraint layer + return the existing block
  // id on re-block (idempotent UX from the seeker's perspective).
  const existing = await db
    .select({ id: schema.seekerBlockedEmployers.id })
    .from(schema.seekerBlockedEmployers)
    .where(
      and(
        eq(schema.seekerBlockedEmployers.profileId, profileId),
        eq(schema.seekerBlockedEmployers.orgId, input.orgId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true, blockId: existing[0].id };
  }

  const id = `blk_${randomUUID()}`;
  await db.insert(schema.seekerBlockedEmployers).values({
    id,
    profileId,
    orgId: input.orgId,
    reason: reason.length > 0 ? reason : null,
  });

  await logAccess({
    kind: "seeker.block.added",
    actor: me.id,
    subject: profileId,
    meta: {
      blockId: id,
      orgId: input.orgId,
      seekerAuthoredFreeText: reason.length > 0,
    },
  });

  revalidatePath("/dashboard/privacy");
  return { ok: true, blockId: id };
}

export async function unblockEmployer(
  orgId: string,
): Promise<ActionResult> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return { ok: false, message: "Profile not found." };

  const db = getDb();
  const existing = await db
    .select({ id: schema.seekerBlockedEmployers.id })
    .from(schema.seekerBlockedEmployers)
    .where(
      and(
        eq(schema.seekerBlockedEmployers.profileId, profileId),
        eq(schema.seekerBlockedEmployers.orgId, orgId),
      ),
    )
    .limit(1);
  if (!existing[0]) return { ok: true };

  await db
    .delete(schema.seekerBlockedEmployers)
    .where(eq(schema.seekerBlockedEmployers.id, existing[0].id));

  await logAccess({
    kind: "seeker.block.removed",
    actor: me.id,
    subject: profileId,
    meta: { blockId: existing[0].id, orgId },
  });

  revalidatePath("/dashboard/privacy");
  return { ok: true };
}

export interface BlockedEmployer {
  blockId: string;
  orgId: string;
  orgName: string;
  blockedAt: string;
  reason: string | null;
}

/**
 * Read the seeker's current blocks. Newest first. Used by the
 * `<BlockedEmployersList>` on `/dashboard/privacy`.
 */
export async function listMyBlocks(): Promise<BlockedEmployer[]> {
  const me = await verifyRole("seeker");
  const profileId = await getMyProfileId(me.id);
  if (!profileId) return [];

  const db = getDb();
  const rows = await db
    .select({
      blockId: schema.seekerBlockedEmployers.id,
      orgId: schema.seekerBlockedEmployers.orgId,
      blockedAt: schema.seekerBlockedEmployers.blockedAt,
      reason: schema.seekerBlockedEmployers.reason,
      orgName: schema.organizations.name,
    })
    .from(schema.seekerBlockedEmployers)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.seekerBlockedEmployers.orgId),
    )
    .where(eq(schema.seekerBlockedEmployers.profileId, profileId))
    .orderBy(schema.seekerBlockedEmployers.blockedAt);

  return rows
    .map((r) => ({
      blockId: r.blockId,
      orgId: r.orgId,
      orgName: r.orgName,
      blockedAt: r.blockedAt.toISOString(),
      reason: r.reason,
    }))
    .reverse();
}
