"use server";

/**
 * Phase 13.1  student-context Server Action.
 *
 * Edits the three Phase 13 fields on `academic_profiles`:
 *   - currentModules text[]
 *   - electiveChosen text
 *   - projectTopic text
 *
 * Why a dedicated action (not part of `updateProfileBasics`):
 * These three fields are ephemeral context  they describe what the
 * student is doing THIS semester. They are independent of the
 * institution / programme / NQF-level fields, which are credential-
 * shaped (verification-sensitive, SAQA-bound) and stay read-only on
 * the editor until Phase 8 wires SAQA. Splitting the action keeps
 * the verification-state coupling small: editing modules / elective
 * / project NEVER reopens the qualification verification flow.
 *
 * D1 invariant: every field is optional. A row exists for the
 * student (from sign-up); we only patch the three columns.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import {
  STUDENT_MODULES_MAX,
  STUDENT_PROJECT_TOPIC_MAX,
  STUDENT_ELECTIVE_MAX,
} from "@/lib/mock/types";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

const schemaInput = z.object({
  currentModules: z
    .array(z.string().min(1).max(80))
    .max(STUDENT_MODULES_MAX)
    .optional(),
  electiveChosen: z
    .string()
    .max(STUDENT_ELECTIVE_MAX)
    .nullable()
    .optional(),
  projectTopic: z
    .string()
    .max(STUDENT_PROJECT_TOPIC_MAX)
    .nullable()
    .optional(),
});

export async function updateStudentContext(
  input: z.infer<typeof schemaInput>,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  const parsed = schemaInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the form  one or more fields are too long." };
  }

  const db = getDb();
  // Resolve the seeker's profile id (academic row keys off profile_id).
  const profileRows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return { ok: false, message: "Profile not found." };

  // Existence guard: this action is only meaningful when the seeker
  // has flagged themselves as a student (academic_profiles row
  // exists). If not, surface a clear message rather than silently
  // creating a half-row.
  const acadRows = await db
    .select({ id: schema.academicProfiles.id })
    .from(schema.academicProfiles)
    .where(eq(schema.academicProfiles.profileId, profile.id))
    .limit(1);
  const acad = acadRows[0];
  if (!acad) {
    return {
      ok: false,
      message:
        "Tick &ldquo;I&rsquo;m currently a student&rdquo; on your profile first to declare studies.",
    };
  }

  // Normalise: trim, drop empties, dedupe the modules; collapse
  // empty-string electiveChosen / projectTopic to NULL so the column
  // is a clean tri-state (set / cleared / absent).
  const modules = Array.from(
    new Set(
      (parsed.data.currentModules ?? [])
        .map((m) => m.trim())
        .filter((m) => m.length > 0),
    ),
  ).slice(0, STUDENT_MODULES_MAX);
  const elective = (parsed.data.electiveChosen ?? "").trim() || null;
  const project = (parsed.data.projectTopic ?? "").trim() || null;

  await db
    .update(schema.academicProfiles)
    .set({
      currentModules: modules,
      electiveChosen: elective,
      projectTopic: project,
      updatedAt: new Date(),
    })
    .where(eq(schema.academicProfiles.id, acad.id));

  await logAccess({
    kind: "profile.update",
    actor: session.id,
    subject: profile.id,
    meta: {
      fields: ["academic.currentModules", "academic.electiveChosen", "academic.projectTopic"],
      modulesCount: modules.length,
      electiveLength: elective?.length ?? 0,
      projectLength: project?.length ?? 0,
      // PII flag mirror of the Phase 9.8.5 decline-note pattern: free-
      // text content is not in audit meta; only its presence + length.
      seekerAuthoredFreeText:
        modules.length > 0 || !!elective || !!project,
    },
  });

  revalidatePath("/dashboard/profile");
  // Career Compass reads from the matcher inputs; updating context
  // should invalidate the cached recommendations.
  revalidatePath("/dashboard/grow");
  return { ok: true };
}
