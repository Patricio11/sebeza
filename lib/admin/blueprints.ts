"use server";

/**
 * Role blueprint admin actions (docs/ROLE_BLUEPRINTS_PLAN.md). Import the
 * starter catalogue, edit a (profession, skill) row, remove one. Every
 * export is admin-guarded (the Server-Action-guard build test enforces it)
 * and audit-logged.
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import {
  STARTER_BLUEPRINTS,
  starterBlueprintFor,
} from "@/lib/blueprints/catalogue";
import {
  draftBlueprint,
  blueprintDraftSchema,
} from "@/lib/llm/blueprint-drafts";
import { desc } from "drizzle-orm";
type ActionResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; message: string };

function fail<T extends object = object>(message: string): ActionResult<T> {
  return { ok: false, message };
}

const rowSchema = z.object({
  professionSlug: z.string().min(1).max(80),
  skillSlug: z.string().min(1).max(80),
  tier: z.enum(["core", "expected", "next_level"]),
  track: z.string().trim().max(60).nullable().optional(),
  proveIt: z.string().trim().max(240).nullable().optional(),
});

/**
 * Upsert the starter catalogue. Rows an admin already edited (source
 * 'admin') are left alone; seed rows are refreshed so a catalogue update
 * ships to every install with one click.
 */
export async function importStarterBlueprints(): Promise<
  ActionResult<{ inserted: number; refreshed: number }>
> {
  const admin = await verifyAdmin();
  const db = getDb();
  let inserted = 0;
  let refreshed = 0;
  const known = new Set(
    (await db.select({ slug: schema.skills.slug }).from(schema.skills)).map(
      (s) => s.slug,
    ),
  );
  const existing = new Map(
    (
      await db
        .select({
          p: schema.professionSkillBlueprints.professionSlug,
          s: schema.professionSkillBlueprints.skillSlug,
          source: schema.professionSkillBlueprints.source,
        })
        .from(schema.professionSkillBlueprints)
    ).map((r) => [`${r.p}:${r.s}`, r.source]),
  );
  const toInsert = STARTER_BLUEPRINTS.filter(
    (r) =>
      known.has(r.skillSlug) &&
      !existing.has(`${r.professionSlug}:${r.skillSlug}`),
  );
  const toRefresh = STARTER_BLUEPRINTS.filter(
    (r) =>
      known.has(r.skillSlug) &&
      existing.get(`${r.professionSlug}:${r.skillSlug}`) === "seed",
  );
  await db.transaction(async (tx) => {
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      await tx.insert(schema.professionSkillBlueprints).values(
        chunk.map((r) => ({
          professionSlug: r.professionSlug,
          skillSlug: r.skillSlug,
          tier: r.tier,
          track: r.track,
          proveIt: r.proveIt,
          source: "seed",
          updatedByUserId: admin.id,
        })),
      );
      inserted += chunk.length;
    }
    for (const r of toRefresh) {
      await tx
        .update(schema.professionSkillBlueprints)
        .set({
          tier: r.tier,
          track: r.track,
          proveIt: r.proveIt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              schema.professionSkillBlueprints.professionSlug,
              r.professionSlug,
            ),
            eq(schema.professionSkillBlueprints.skillSlug, r.skillSlug),
          ),
        );
      refreshed++;
    }
  });
  await logAccess({
    kind: "blueprint.import",
    actor: admin.id,
    subject: "starter-catalogue",
    meta: {
      inserted,
      refreshed,
      skipped: STARTER_BLUEPRINTS.length - inserted - refreshed,
    },
  });
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard/grow");
  return { ok: true, inserted, refreshed };
}

export async function upsertBlueprintRow(
  input: z.infer<typeof rowSchema>,
): Promise<ActionResult> {
  const admin = await verifyAdmin();
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) return fail("Check the row and try again.");
  const v = parsed.data;
  if (v.tier === "next_level" && !v.track)
    return fail("Next-level skills need a track name.");
  const db = getDb();
  const skill = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills)
    .where(eq(schema.skills.slug, v.skillSlug))
    .limit(1);
  if (!skill[0]) return fail("That skill is not in the taxonomy.");
  await db
    .insert(schema.professionSkillBlueprints)
    .values({
      professionSlug: v.professionSlug,
      skillSlug: v.skillSlug,
      tier: v.tier,
      track: v.tier === "next_level" ? (v.track ?? null) : null,
      proveIt: v.proveIt || null,
      source: "admin",
      updatedByUserId: admin.id,
    })
    .onConflictDoUpdate({
      target: [
        schema.professionSkillBlueprints.professionSlug,
        schema.professionSkillBlueprints.skillSlug,
      ],
      set: {
        tier: v.tier,
        track: v.tier === "next_level" ? (v.track ?? null) : null,
        proveIt: v.proveIt || null,
        source: "admin",
        updatedAt: new Date(),
        updatedByUserId: admin.id,
      },
    });
  await logAccess({
    kind: "blueprint.update",
    actor: admin.id,
    subject: `${v.professionSlug}:${v.skillSlug}`,
    meta: { tier: v.tier, track: v.track ?? null },
  });
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard/grow");
  return { ok: true };
}

export async function removeBlueprintRow(input: {
  professionSlug: string;
  skillSlug: string;
}): Promise<ActionResult> {
  const admin = await verifyAdmin();
  if (!input?.professionSlug || !input?.skillSlug) return fail("Missing row.");
  const db = getDb();
  const deleted = await db
    .delete(schema.professionSkillBlueprints)
    .where(
      and(
        eq(
          schema.professionSkillBlueprints.professionSlug,
          input.professionSlug,
        ),
        eq(schema.professionSkillBlueprints.skillSlug, input.skillSlug),
      ),
    )
    .returning({ s: schema.professionSkillBlueprints.skillSlug });
  if (deleted.length === 0) return fail("Row not found.");
  await logAccess({
    kind: "blueprint.remove",
    actor: admin.id,
    subject: `${input.professionSlug}:${input.skillSlug}`,
  });
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard/grow");
  return { ok: true };
}

// ── AI drafts (part 2) ────────────────────────────────────────────────────

export async function requestBlueprintDraft(input: {
  professionSlug: string;
}): Promise<ActionResult<{ draftId: string }>> {
  const admin = await verifyAdmin();
  const slug = input?.professionSlug?.trim();
  if (!slug) return fail("Pick a profession.");
  const db = getDb();
  const [prof] = await db
    .select({ label: schema.professions.label })
    .from(schema.professions)
    .where(eq(schema.professions.slug, slug))
    .limit(1);
  if (!prof) return fail("That profession is not in the taxonomy.");
  const res = await draftBlueprint({
    professionSlug: slug,
    professionLabel: prof.label,
    callerUserId: admin.id,
    callerRole: admin.role,
  });
  if (!res.ok) return fail(res.reason);
  revalidatePath("/admin/blueprints");
  return { ok: true, draftId: res.draftId };
}

/**
 * Draft the next N professions that have neither live rows nor a starter
 * entry. Sequential, capped, admin-triggered: N model calls at most.
 */
export async function draftMissingBlueprints(input: {
  limit: number;
}): Promise<
  ActionResult<{ drafted: number; failed: number; remaining: number }>
> {
  const admin = await verifyAdmin();
  const limit = Math.max(
    1,
    Math.min(10, Math.floor(Number(input?.limit ?? 5))),
  );
  const db = getDb();
  const professions = await db
    .select({ slug: schema.professions.slug, label: schema.professions.label })
    .from(schema.professions);
  const live = new Set(
    (
      await db
        .selectDistinct({ p: schema.professionSkillBlueprints.professionSlug })
        .from(schema.professionSkillBlueprints)
    ).map((r) => r.p),
  );
  const pendingDrafts = new Set(
    (
      await db
        .select({ p: schema.blueprintDrafts.professionSlug })
        .from(schema.blueprintDrafts)
        .where(eq(schema.blueprintDrafts.state, "pending"))
    ).map((r) => r.p),
  );
  const missing = professions.filter(
    (p) =>
      !live.has(p.slug) &&
      !pendingDrafts.has(p.slug) &&
      starterBlueprintFor(p.slug).length === 0,
  );
  let drafted = 0;
  let failed = 0;
  for (const p of missing.slice(0, limit)) {
    const res = await draftBlueprint({
      professionSlug: p.slug,
      professionLabel: p.label,
      callerUserId: admin.id,
      callerRole: admin.role,
    });
    if (res.ok) drafted++;
    else {
      failed++;
      // A switched-off provider or an exhausted budget fails every call
      // the same way; stop after the first such failure instead of burning
      // the batch.
      if (/switch is OFF|budget|No active|credentials/i.test(res.reason)) break;
    }
  }
  revalidatePath("/admin/blueprints");
  return {
    ok: true,
    drafted,
    failed,
    remaining: Math.max(0, missing.length - drafted),
  };
}

export async function approveBlueprintDraft(input: {
  id: string;
  drop?: string[];
}): Promise<ActionResult> {
  const admin = await verifyAdmin();
  if (!input?.id) return fail("Missing draft.");
  const drop = new Set((input.drop ?? []).map(String));
  const db = getDb();
  const [draft] = await db
    .select()
    .from(schema.blueprintDrafts)
    .where(
      and(
        eq(schema.blueprintDrafts.id, input.id),
        eq(schema.blueprintDrafts.state, "pending"),
      ),
    )
    .limit(1);
  if (!draft) return fail("Draft not found or already resolved.");
  const parsed = blueprintDraftSchema.safeParse(draft.payload);
  if (!parsed.success)
    return fail("The stored draft is malformed; reject it and draft again.");
  const p = parsed.data;
  const keep = (slugs: string[]) => slugs.filter((s) => !drop.has(s));
  const core = keep(p.core);
  if (core.length < 3) return fail("Keep at least three core skills.");
  const expected = keep(p.expected);
  const tracks = p.tracks
    .map((t) => ({ name: t.name, skills: keep(t.skills) }))
    .filter((t) => t.skills.length > 0);
  const used = new Set([
    ...core,
    ...expected,
    ...tracks.flatMap((t) => t.skills),
  ]);
  const proveIt = p.proveIt ?? {};

  await db.transaction(async (tx) => {
    const fresh = p.newSkills.filter((s) => used.has(s.slug));
    if (fresh.length > 0) {
      await tx
        .insert(schema.skills)
        .values(
          fresh.map((s) => ({
            slug: s.slug,
            label: s.label,
            category: s.category,
          })),
        )
        .onConflictDoNothing();
    }
    // Only slugs the taxonomy actually holds may be referenced (FK).
    const known = new Set(
      (await tx.select({ slug: schema.skills.slug }).from(schema.skills)).map(
        (s) => s.slug,
      ),
    );
    await tx
      .delete(schema.professionSkillBlueprints)
      .where(
        eq(
          schema.professionSkillBlueprints.professionSlug,
          draft.professionSlug,
        ),
      );
    const rows = [
      ...core.map((s) => ({
        skillSlug: s,
        tier: "core",
        track: null as string | null,
      })),
      ...expected.map((s) => ({
        skillSlug: s,
        tier: "expected",
        track: null as string | null,
      })),
      ...tracks.flatMap((t) =>
        t.skills.map((s) => ({
          skillSlug: s,
          tier: "next_level",
          track: t.name,
        })),
      ),
    ].filter((r) => known.has(r.skillSlug));
    if (rows.length > 0) {
      await tx.insert(schema.professionSkillBlueprints).values(
        rows.map((r) => ({
          professionSlug: draft.professionSlug,
          skillSlug: r.skillSlug,
          tier: r.tier,
          track: r.track,
          proveIt: proveIt[r.skillSlug] ?? null,
          source: "ai",
          updatedByUserId: admin.id,
        })),
      );
    }
    await tx
      .update(schema.blueprintDrafts)
      .set({
        state: "approved",
        resolvedByUserId: admin.id,
        resolvedAt: new Date(),
      })
      .where(eq(schema.blueprintDrafts.id, draft.id));
  });
  await logAccess({
    kind: "blueprint.draft.approve",
    actor: admin.id,
    subject: draft.professionSlug,
    meta: {
      draftId: draft.id,
      dropped: [...drop],
      core: core.length,
      tracks: tracks.length,
    },
  });
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard/grow");
  return { ok: true };
}

export async function rejectBlueprintDraft(input: {
  id: string;
}): Promise<ActionResult> {
  const admin = await verifyAdmin();
  if (!input?.id) return fail("Missing draft.");
  const db = getDb();
  const updated = await db
    .update(schema.blueprintDrafts)
    .set({
      state: "rejected",
      resolvedByUserId: admin.id,
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(schema.blueprintDrafts.id, input.id),
        eq(schema.blueprintDrafts.state, "pending"),
      ),
    )
    .returning({ p: schema.blueprintDrafts.professionSlug });
  if (updated.length === 0) return fail("Draft not found or already resolved.");
  await logAccess({
    kind: "blueprint.draft.reject",
    actor: admin.id,
    subject: updated[0]!.p,
    meta: { draftId: input.id },
  });
  revalidatePath("/admin/blueprints");
  return { ok: true };
}

/** Latest pending draft for a profession (server-side read for the page). */
export async function latestPendingDraft(professionSlug: string) {
  await verifyAdmin();
  const [row] = await getDb()
    .select()
    .from(schema.blueprintDrafts)
    .where(
      and(
        eq(schema.blueprintDrafts.professionSlug, professionSlug),
        eq(schema.blueprintDrafts.state, "pending"),
      ),
    )
    .orderBy(desc(schema.blueprintDrafts.createdAt))
    .limit(1);
  return row ?? null;
}
