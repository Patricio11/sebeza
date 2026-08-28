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
import { STARTER_BLUEPRINTS } from "@/lib/blueprints/catalogue";
type ActionResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; message: string };

function fail(message: string): ActionResult {
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
