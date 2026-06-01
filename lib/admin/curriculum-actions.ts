"use server";

/**
 * Phase 13.3  /admin/curriculum Server Actions.
 *
 * The editorial-curation workflow over the `module_skills` catalogue.
 * Three classes of action:
 *
 *   1. Queue actions  approve / reject / edit-and-approve rows in
 *      pending `source = 'llm_suggested'` state. Approval flips the
 *      row to `source = 'editorial'` + stamps approved_by + approved_at.
 *      The read path in db/queries/curriculum.ts only surfaces
 *      `source = 'editorial'` rows  llm_suggested rows are admin-only
 *      until approved.
 *
 *   2. Bulk import  the admin pastes a syllabus + optional module
 *      label hint, the dispatcher calls the active LLM provider,
 *      validated suggestions land in the queue as `llm_suggested`.
 *      Six-gate dispatch in lib/llm/curriculum.ts gates the call.
 *
 *   3. Manual add  the admin can also create an editorial row by
 *      hand, no LLM involved. Convenient for the Tier-1 catalogue
 *      seed work in Task 13.5.
 *
 * Every terminal action writes an audit row. Module-skills.id is a
 * stable string composed of module_slug + skill_slug + optional
 * institution_slug, scoped under `ms_` so the audit ledger reads
 * `subject=ms_database-systems_sql_<inst>`.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { logAccess } from "@/lib/audit";
import { verifyAdmin } from "@/lib/auth/dal";
import { suggestModuleSkills } from "@/lib/llm/curriculum";

export type CurationActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─── Approve / Reject / Edit-and-approve ──────────────────────────

const idSchema = z.object({ rowId: z.string().min(1).max(160) });

export async function approveModuleSkillSuggestion(
  input: z.infer<typeof idSchema>,
): Promise<CurationActionResult> {
  const session = await verifyAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid row id.");

  const db = getDb();
  const row = await db
    .select({
      id: schema.moduleSkills.id,
      moduleSlug: schema.moduleSkills.moduleSlug,
      skillSlug: schema.moduleSkills.skillSlug,
      source: schema.moduleSkills.source,
    })
    .from(schema.moduleSkills)
    .where(eq(schema.moduleSkills.id, parsed.data.rowId))
    .limit(1);

  const current = row[0];
  if (!current) return fail("Row not found.");
  if (current.source === "editorial") {
    return fail("Row is already editorial.");
  }

  await db
    .update(schema.moduleSkills)
    .set({
      source: "editorial",
      approvedBy: session.id,
      approvedAt: new Date(),
    })
    .where(eq(schema.moduleSkills.id, parsed.data.rowId));

  await logAccess({
    kind: "admin.curriculum.module_skill.approved",
    actor: session.id,
    subject: parsed.data.rowId,
    meta: {
      moduleSlug: current.moduleSlug,
      skillSlug: current.skillSlug,
      fromSource: current.source,
    },
  });

  revalidatePath("/admin/curriculum");
  return ok({});
}

const rejectSchema = z.object({
  rowId: z.string().min(1).max(160),
  reason: z.string().trim().max(240).optional(),
});

export async function rejectModuleSkillSuggestion(
  input: z.infer<typeof rejectSchema>,
): Promise<CurationActionResult> {
  const session = await verifyAdmin();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const db = getDb();
  const row = await db
    .select({
      moduleSlug: schema.moduleSkills.moduleSlug,
      skillSlug: schema.moduleSkills.skillSlug,
      source: schema.moduleSkills.source,
    })
    .from(schema.moduleSkills)
    .where(eq(schema.moduleSkills.id, parsed.data.rowId))
    .limit(1);
  const current = row[0];
  if (!current) return fail("Row not found.");
  if (current.source === "editorial") {
    return fail(
      "Editorial rows are deleted from the catalogue surface, not rejected.",
    );
  }

  // Hard delete on reject  llm_suggested rows that fail review
  // carry no historical value at the catalogue layer (the audit
  // log carries the historical record). Keeps the queue from
  // bloating with rejected rows.
  await db
    .delete(schema.moduleSkills)
    .where(eq(schema.moduleSkills.id, parsed.data.rowId));

  await logAccess({
    kind: "admin.curriculum.module_skill.rejected",
    actor: session.id,
    subject: parsed.data.rowId,
    meta: {
      moduleSlug: current.moduleSlug,
      skillSlug: current.skillSlug,
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/admin/curriculum");
  return ok({});
}

const editAndApproveSchema = z.object({
  rowId: z.string().min(1).max(160),
  confidence: z.number().int().min(1).max(5).optional(),
  moduleLabel: z.string().trim().min(1).max(160).optional(),
  institutionSlug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function editAndApproveModuleSkillSuggestion(
  input: z.infer<typeof editAndApproveSchema>,
): Promise<CurationActionResult> {
  const session = await verifyAdmin();
  const parsed = editAndApproveSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const data = parsed.data;

  const db = getDb();
  const row = await db
    .select({
      moduleSlug: schema.moduleSkills.moduleSlug,
      moduleLabel: schema.moduleSkills.moduleLabel,
      skillSlug: schema.moduleSkills.skillSlug,
      confidence: schema.moduleSkills.confidence,
      institutionSlug: schema.moduleSkills.institutionSlug,
      source: schema.moduleSkills.source,
    })
    .from(schema.moduleSkills)
    .where(eq(schema.moduleSkills.id, data.rowId))
    .limit(1);
  const current = row[0];
  if (!current) return fail("Row not found.");

  const changedFields: string[] = [];
  const update: Record<string, unknown> = {
    source: "editorial",
    approvedBy: session.id,
    approvedAt: new Date(),
  };

  if (data.confidence !== undefined && data.confidence !== current.confidence) {
    update.confidence = data.confidence;
    changedFields.push("confidence");
  }
  if (data.moduleLabel && data.moduleLabel !== current.moduleLabel) {
    update.moduleLabel = data.moduleLabel;
    changedFields.push("module_label");
  }
  if (
    data.institutionSlug !== undefined &&
    (data.institutionSlug || null) !== current.institutionSlug
  ) {
    update.institutionSlug = data.institutionSlug || null;
    changedFields.push("institution");
  }

  await db
    .update(schema.moduleSkills)
    .set(update)
    .where(eq(schema.moduleSkills.id, data.rowId));

  await logAccess({
    kind: "admin.curriculum.module_skill.edited",
    actor: session.id,
    subject: data.rowId,
    meta: {
      moduleSlug: current.moduleSlug,
      skillSlug: current.skillSlug,
      changedFields,
    },
  });

  revalidatePath("/admin/curriculum");
  return ok({});
}

// ─── Bulk import ──────────────────────────────────────────────────

const bulkImportSchema = z.object({
  syllabusText: z
    .string()
    .trim()
    .min(40, "Paste at least a short module description.")
    .max(20_000, "Syllabus over 20 000 chars is too large for one call."),
  moduleLabel: z.string().trim().min(1).max(160),
  institutionSlug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function bulkImportSyllabus(
  input: z.infer<typeof bulkImportSchema>,
): Promise<
  CurationActionResult<{
    inserted: number;
    droppedHallucinations: number;
    estZarCost: number;
    tokenCount: number;
  }>
> {
  const session = await verifyAdmin();
  const parsed = bulkImportSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const result = await suggestModuleSkills({
    callerUserId: session.id,
    callerRole: "admin",
    syllabusText: data.syllabusText,
    moduleLabel: data.moduleLabel,
    institutionSlug: data.institutionSlug ?? null,
  });

  if (!result.ok) {
    return fail(`LLM dispatch refused: ${result.reason}`);
  }

  // Land every accepted suggestion in the queue as `llm_suggested`.
  // The admin reviews them via the queue UI.
  const db = getDb();
  let inserted = 0;
  for (const sug of result.suggestions) {
    const rowId = makeRowId(
      sug.moduleSlug,
      sug.skillSlug,
      data.institutionSlug ?? null,
    );
    try {
      await db.insert(schema.moduleSkills).values({
        id: rowId,
        moduleSlug: sug.moduleSlug,
        moduleLabel: sug.moduleLabel,
        skillSlug: sug.skillSlug,
        confidence: sug.confidence,
        source: "llm_suggested",
        approvedBy: null,
        approvedAt: null,
        institutionSlug: data.institutionSlug ?? null,
      });
      inserted += 1;
    } catch {
      // Partial unique index already enforces uniqueness; a duplicate
      // is silently skipped (the admin can edit the existing row
      // from the queue instead).
    }
  }

  revalidatePath("/admin/curriculum");
  return ok({
    inserted,
    droppedHallucinations: result.droppedHallucinations.length,
    estZarCost: result.estZarCost,
    tokenCount: result.tokenCount,
  });
}

// ─── Manual add ──────────────────────────────────────────────────

const manualAddSchema = z.object({
  moduleLabel: z.string().trim().min(1).max(160),
  skillSlug: z.string().trim().min(1).max(80),
  confidence: z.number().int().min(1).max(5).optional(),
  institutionSlug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function addEditorialModuleSkill(
  input: z.infer<typeof manualAddSchema>,
): Promise<CurationActionResult<{ rowId: string }>> {
  const session = await verifyAdmin();
  const parsed = manualAddSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const moduleSlug = slugify(data.moduleLabel);

  const db = getDb();
  // Validate skill exists in the taxonomy. The skills.slug FK would
  // catch this at insert time, but a friendlier error is worth one
  // extra query.
  const skill = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills)
    .where(eq(schema.skills.slug, data.skillSlug))
    .limit(1);
  if (skill.length === 0) {
    return fail(
      "Skill slug is not in the controlled taxonomy. Add it via /admin/taxonomy first.",
    );
  }

  const rowId = makeRowId(moduleSlug, data.skillSlug, data.institutionSlug ?? null);

  try {
    await db.insert(schema.moduleSkills).values({
      id: rowId,
      moduleSlug,
      moduleLabel: data.moduleLabel,
      skillSlug: data.skillSlug,
      confidence: data.confidence ?? 4,
      source: "editorial",
      approvedBy: session.id,
      approvedAt: new Date(),
      institutionSlug: data.institutionSlug ?? null,
    });
  } catch {
    return fail("That module → skill mapping already exists.");
  }

  await logAccess({
    kind: "admin.curriculum.module_skill.approved",
    actor: session.id,
    subject: rowId,
    meta: {
      moduleSlug,
      skillSlug: data.skillSlug,
      fromSource: "manual",
    },
  });

  revalidatePath("/admin/curriculum");
  return ok({ rowId });
}

// ─── helpers ─────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function makeRowId(
  moduleSlug: string,
  skillSlug: string,
  institutionSlug: string | null,
): string {
  const tail = institutionSlug ? `_${institutionSlug}` : "";
  return `ms_${moduleSlug}_${skillSlug}${tail}`;
}
