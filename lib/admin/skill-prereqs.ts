"use server";

/**
 * Phase 20 ("Skill Prerequisites")  admin write path for the dependency graph.
 * Admin-gated, Zod-validated, audited (`admin.skill_prereq.edit`). Cycle-guarded:
 * an edge that would close a loop (directly or transitively) is refused, so the
 * compass re-ranking can never deadlock.
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { listAllPrereqEdges } from "@/db/queries/skill-prereqs";
import { wouldCreateCycle } from "@/lib/skills/prereq-graph";

export type PrereqResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  skillSlug: z.string().trim().min(1),
  prereqSkillSlug: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(200),
});

function revalidate() {
  revalidatePath("/admin/skill-prereqs");
  revalidatePath("/dashboard/grow");
}

export async function addSkillPrereq(
  input: z.input<typeof addSchema>,
): Promise<PrereqResult> {
  const admin = await verifyAdmin();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid prerequisite." };
  const { skillSlug, prereqSkillSlug, reason } = parsed.data;

  if (skillSlug === prereqSkillSlug) {
    return { ok: false, error: "A skill can't require itself." };
  }

  const db = getDb();

  // Both slugs must be real canonical skills.
  const found = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills);
  const slugSet = new Set(found.map((s) => s.slug));
  if (!slugSet.has(skillSlug) || !slugSet.has(prereqSkillSlug)) {
    return { ok: false, error: "Both must be canonical skills." };
  }

  // Cycle guard.
  const edges = await listAllPrereqEdges();
  if (wouldCreateCycle(edges, skillSlug, prereqSkillSlug)) {
    return {
      ok: false,
      error: "That would create a prerequisite cycle.",
    };
  }

  await db
    .insert(schema.skillPrereqs)
    .values({ skillSlug, prereqSkillSlug, reason })
    .onConflictDoNothing();

  await logAccess({
    kind: "admin.skill_prereq.edit",
    actor: admin.id,
    subject: skillSlug,
    meta: { prereqSkillSlug, action: "add" },
  });
  revalidate();
  return { ok: true };
}

export async function removeSkillPrereq(
  skillSlug: string,
  prereqSkillSlug: string,
): Promise<PrereqResult> {
  const admin = await verifyAdmin();
  if (!skillSlug || !prereqSkillSlug) {
    return { ok: false, error: "Invalid prerequisite." };
  }
  const db = getDb();
  await db
    .delete(schema.skillPrereqs)
    .where(
      and(
        eq(schema.skillPrereqs.skillSlug, skillSlug),
        eq(schema.skillPrereqs.prereqSkillSlug, prereqSkillSlug),
      ),
    );

  await logAccess({
    kind: "admin.skill_prereq.edit",
    actor: admin.id,
    subject: skillSlug,
    meta: { prereqSkillSlug, action: "remove" },
  });
  revalidate();
  return { ok: true };
}
