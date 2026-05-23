"use server";

/**
 * Phase 5  Shortlist pools (talent pools).
 *
 * Per-org, like saved searches. Adding a profile to a pool writes
 * `profile.shortlist.add`; removing writes `profile.shortlist.remove`.
 * The audit trail lets the seeker see (in their /dashboard/activity)
 * that they've been shortlisted, even though we don't render that as a
 * seeker-visible kind today.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyEmployer } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────────────

const createPoolSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(280).optional(),
});

export async function createPool(
  input: z.infer<typeof createPoolSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  const parsed = createPoolSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");

  const db = getDb();
  const id = `pool_${randomUUID()}`;
  await db.insert(schema.shortlistPools).values({
    id,
    organizationId: session.orgId,
    createdByUserId: session.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });

  await logAccess({
    kind: "pool.create",
    actor: session.id,
    subject: id,
    meta: { orgId: session.orgId, name: parsed.data.name },
  });

  revalidatePath("/employer/shortlists");
  return ok({ id });
}

export async function deletePool(input: {
  poolId: string;
}): Promise<ActionResult> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  if (!input?.poolId) return fail("Missing pool id.");
  const db = getDb();
  await db
    .delete(schema.shortlistPools)
    .where(
      and(
        eq(schema.shortlistPools.id, input.poolId),
        eq(schema.shortlistPools.organizationId, session.orgId),
      ),
    );

  await logAccess({
    kind: "pool.delete",
    actor: session.id,
    subject: input.poolId,
    meta: { orgId: session.orgId },
  });

  revalidatePath("/employer/shortlists");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────

export async function addToPool(input: {
  poolId: string;
  handle: string;
}): Promise<ActionResult> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  if (!input?.poolId || !input?.handle) return fail("Missing input.");

  const db = getDb();

  // Verify pool ownership.
  const pool = (
    await db
      .select({ id: schema.shortlistPools.id })
      .from(schema.shortlistPools)
      .where(
        and(
          eq(schema.shortlistPools.id, input.poolId),
          eq(schema.shortlistPools.organizationId, session.orgId),
        ),
      )
      .limit(1)
  )[0];
  if (!pool) return fail("Pool not found.");

  // Resolve handle to profile id.
  const profile = (
    await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.handle, input.handle))
      .limit(1)
  )[0];
  if (!profile) return fail("Profile not found.");

  // ON CONFLICT DO NOTHING  adding the same profile twice is a no-op.
  await db
    .insert(schema.shortlistMembers)
    .values({
      poolId: pool.id,
      profileId: profile.id,
      addedByUserId: session.id,
    })
    .onConflictDoNothing();

  await logAccess({
    kind: "profile.shortlist.add",
    actor: session.id,
    subject: profile.id,
    meta: { orgId: session.orgId, poolId: pool.id, handle: input.handle },
  });

  revalidatePath("/employer/shortlists");
  return ok();
}

export async function removeFromPool(input: {
  poolId: string;
  handle: string;
}): Promise<ActionResult> {
  const session = await verifyEmployer();
  if (!session.orgId) return fail("No organisation membership on file.");
  if (!input?.poolId || !input?.handle) return fail("Missing input.");

  const db = getDb();

  const profile = (
    await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.handle, input.handle))
      .limit(1)
  )[0];
  if (!profile) return fail("Profile not found.");

  // Scope deletion to this org's pool by joining through shortlist_pools.
  await db.execute(
    sql`DELETE FROM shortlist_members m
        USING shortlist_pools p
        WHERE m.pool_id = p.id
          AND p.id = ${input.poolId}
          AND p.organization_id = ${session.orgId}
          AND m.profile_id = ${profile.id}`,
  );

  await logAccess({
    kind: "profile.shortlist.remove",
    actor: session.id,
    subject: profile.id,
    meta: { orgId: session.orgId, poolId: input.poolId, handle: input.handle },
  });

  revalidatePath("/employer/shortlists");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────────────────────

export interface PoolSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  members: Array<{
    handle: string;
    displayName: string;
    profession: string;
    city: string;
  }>;
}

export async function loadPools(): Promise<PoolSummary[]> {
  const session = await verifyEmployer();
  if (!session.orgId) return [];
  const db = getDb();

  const pools = await db
    .select()
    .from(schema.shortlistPools)
    .where(eq(schema.shortlistPools.organizationId, session.orgId))
    .orderBy(desc(schema.shortlistPools.createdAt));

  if (pools.length === 0) return [];

  // Load all members in one query then group by pool.
  const memberRows = await db
    .select({
      poolId: schema.shortlistMembers.poolId,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      profession: schema.profiles.profession,
      city: schema.profiles.city,
    })
    .from(schema.shortlistMembers)
    .innerJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.shortlistMembers.profileId),
    )
    .where(
      inArray(
        schema.shortlistMembers.poolId,
        pools.map((p) => p.id),
      ),
    )
    .orderBy(asc(schema.shortlistMembers.addedAt));

  const byPool = new Map<string, PoolSummary["members"]>();
  for (const r of memberRows) {
    const list = byPool.get(r.poolId) ?? [];
    list.push({
      handle: r.handle,
      displayName: r.displayName,
      profession: r.profession,
      city: r.city,
    });
    byPool.set(r.poolId, list);
  }

  return pools.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
    memberCount: byPool.get(p.id)?.length ?? 0,
    members: byPool.get(p.id) ?? [],
  }));
}
