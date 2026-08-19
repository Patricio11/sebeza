"use server";

/**
 * 2026-08-19  "Work & projects" seeker actions
 * (docs/PROFILE_PROJECTS_PLAN.md). Guard-first: every export verifies
 * the seeker session AND the feature flag before touching anything.
 *
 * Deliberate non-features: projects never touch completeness or ranking
 * (many professions have nothing shareable online  rewarding links
 * would down-rank exactly the people this platform exists to serve),
 * and nothing here is ever marked verified (self-declared by design).
 */

import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";
import { uploadProjectImage, deleteStorageObject } from "@/lib/storage/upload";
import { StorageError } from "@/lib/storage/supabase";
import {
  normaliseProjectUrl,
  noteHasContactDetails,
  MAX_PROJECTS,
  MAX_IMAGES_PER_PROJECT,
} from "./project-links";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

const detailSchema = z.object({
  title: z.string().trim().min(2, "Give the project a short title.").max(120),
  url: z.string().trim().max(300).optional().nullable(),
  contribution: z
    .string()
    .trim()
    .min(4, "Say what you did on this project.")
    .max(400, "Keep it under 400 characters."),
  year: z.number().int().min(1970).max(2100).nullable().optional(),
});

/** Session + flag + owning profile in one place. */
async function ctx(): Promise<
  { ok: true; userId: string; profileId: string } | { ok: false; message: string }
> {
  const session = await verifyRole("seeker");
  const on = await getSetting<boolean>("feature_flag_seeker_projects");
  if (!on) return { ok: false, message: "Projects aren't available yet." };
  const rows = await getDb()
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profileId = rows[0]?.id;
  if (!profileId) return { ok: false, message: "Profile not found." };
  return { ok: true, userId: session.id, profileId };
}

/** Ownership check for every per-project action  never trust the id. */
async function ownedProject(profileId: string, projectId: string) {
  const rows = await getDb()
    .select()
    .from(schema.profileProjects)
    .where(
      and(
        eq(schema.profileProjects.id, projectId),
        eq(schema.profileProjects.profileId, profileId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function validateDetails(input: unknown):
  | { ok: true; data: { title: string; url: string | null; contribution: string; year: number | null } }
  | { ok: false; message: string } {
  const parsed = detailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fields." };
  }
  const link = normaliseProjectUrl(parsed.data.url);
  if (!link.ok) return { ok: false, message: link.message };
  if (noteHasContactDetails(parsed.data.contribution)) {
    return {
      ok: false,
      message:
        "Please leave phone numbers and email addresses out. Employers reach you through Sebenza, which keeps the contact audited.",
    };
  }
  return {
    ok: true,
    data: {
      title: parsed.data.title,
      url: link.url,
      contribution: parsed.data.contribution,
      year: parsed.data.year ?? null,
    },
  };
}

export async function addProject(
  input: z.infer<typeof detailSchema>,
): Promise<ActionResult<{ id: string }>> {
  const c = await ctx();
  if (!c.ok) return c;
  const v = validateDetails(input);
  if (!v.ok) return v;

  const db = getDb();
  const [count] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(schema.profileProjects)
    .where(eq(schema.profileProjects.profileId, c.profileId));
  if ((count?.n ?? 0) >= MAX_PROJECTS) {
    return {
      ok: false,
      message: `You can show up to ${MAX_PROJECTS} projects. Remove one to add another.`,
    };
  }

  const id = `proj_${randomUUID()}`;
  await db.insert(schema.profileProjects).values({
    id,
    profileId: c.profileId,
    title: v.data.title,
    url: v.data.url,
    contribution: v.data.contribution,
    year: v.data.year,
    sortOrder: count?.n ?? 0,
  });

  await logAccess({
    kind: "profile.project.add",
    actor: c.userId,
    subject: c.profileId,
    meta: { projectId: id, hasUrl: Boolean(v.data.url) },
  });
  revalidatePath("/dashboard/profile");
  return { ok: true, id };
}

export async function updateProject(
  input: z.infer<typeof detailSchema> & { id: string },
): Promise<ActionResult> {
  const c = await ctx();
  if (!c.ok) return c;
  if (!input?.id) return { ok: false, message: "Missing project." };
  const owned = await ownedProject(c.profileId, input.id);
  if (!owned) return { ok: false, message: "Project not found." };
  const v = validateDetails(input);
  if (!v.ok) return v;

  await getDb()
    .update(schema.profileProjects)
    .set({ ...v.data, updatedAt: new Date() })
    .where(eq(schema.profileProjects.id, input.id));

  await logAccess({
    kind: "profile.project.update",
    actor: c.userId,
    subject: c.profileId,
    meta: { projectId: input.id },
  });
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function deleteProject(input: { id: string }): Promise<ActionResult> {
  const c = await ctx();
  if (!c.ok) return c;
  const owned = await ownedProject(c.profileId, input?.id ?? "");
  if (!owned) return { ok: false, message: "Project not found." };

  // Storage first, best-effort: an orphaned object is recoverable, a
  // dangling row is not. deleteStorageObject sweeps the thumb too.
  for (const key of owned.imageKeys) {
    try {
      await deleteStorageObject(key);
    } catch {
      // orphan sweep is the backstop
    }
  }
  await getDb()
    .delete(schema.profileProjects)
    .where(eq(schema.profileProjects.id, owned.id));

  await logAccess({
    kind: "profile.project.delete",
    actor: c.userId,
    subject: c.profileId,
    meta: { projectId: owned.id, images: owned.imageKeys.length },
  });
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function addProjectImageAction(
  form: FormData,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c.ok) return c;
  const projectId = String(form.get("projectId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Pick an image." };
  const owned = await ownedProject(c.profileId, projectId);
  if (!owned) return { ok: false, message: "Project not found." };
  if (owned.imageKeys.length >= MAX_IMAGES_PER_PROJECT) {
    return {
      ok: false,
      message: `Up to ${MAX_IMAGES_PER_PROJECT} images per project. Remove one to add another.`,
    };
  }

  let key: string;
  try {
    ({ key } = await uploadProjectImage({
      userId: c.userId,
      id: `${projectId}-${randomUUID().slice(0, 8)}`,
      file,
    }));
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof StorageError ? e.message : "Upload failed. Please try again.",
    };
  }

  await getDb()
    .update(schema.profileProjects)
    .set({ imageKeys: [...owned.imageKeys, key], updatedAt: new Date() })
    .where(eq(schema.profileProjects.id, projectId));

  await logAccess({
    kind: "profile.project.image",
    actor: c.userId,
    subject: c.profileId,
    meta: { projectId, action: "add" },
  });
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function removeProjectImage(input: {
  projectId: string;
  key: string;
}): Promise<ActionResult> {
  const c = await ctx();
  if (!c.ok) return c;
  const owned = await ownedProject(c.profileId, input?.projectId ?? "");
  if (!owned) return { ok: false, message: "Project not found." };
  if (!owned.imageKeys.includes(input.key)) {
    return { ok: false, message: "Image not found." };
  }

  try {
    await deleteStorageObject(input.key);
  } catch {
    // orphan sweep is the backstop
  }
  await getDb()
    .update(schema.profileProjects)
    .set({
      imageKeys: owned.imageKeys.filter((k) => k !== input.key),
      updatedAt: new Date(),
    })
    .where(eq(schema.profileProjects.id, owned.id));

  await logAccess({
    kind: "profile.project.image",
    actor: c.userId,
    subject: c.profileId,
    meta: { projectId: owned.id, action: "remove" },
  });
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function moveProject(input: {
  id: string;
  direction: "up" | "down";
}): Promise<ActionResult> {
  const c = await ctx();
  if (!c.ok) return c;
  const db = getDb();
  const rows = await db
    .select({ id: schema.profileProjects.id })
    .from(schema.profileProjects)
    .where(eq(schema.profileProjects.profileId, c.profileId))
    .orderBy(asc(schema.profileProjects.sortOrder), asc(schema.profileProjects.createdAt));

  const idx = rows.findIndex((r) => r.id === input?.id);
  if (idx < 0) return { ok: false, message: "Project not found." };
  const swapWith = input.direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rows.length) return { ok: true };

  const reordered = [...rows];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(swapWith, 0, moved!);
  for (let i = 0; i < reordered.length; i++) {
    await db
      .update(schema.profileProjects)
      .set({ sortOrder: i })
      .where(eq(schema.profileProjects.id, reordered[i]!.id));
  }

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
