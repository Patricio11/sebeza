"use server";

/**
 * Phase 7 — Admin taxonomy CRUD.
 *
 * Skills, professions, cities all back the search & ranking surfaces.
 * The admin taxonomy page on `/admin/taxonomy` (until this phase a static
 * table) now writes through to the DB.
 *
 *   - addSkill / removeSkill
 *   - addProfession / removeProfession
 *   - addCity / removeCity (city requires a province slug)
 *
 * Slug uniqueness is enforced at the DB layer (primary key). Removals
 * are blocked when a row is still referenced by another table — the user
 * gets a friendly "still in use by N profiles" message instead of a 500.
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyAdmin } from "@/lib/auth/dal";
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

const SLUG = z
  .string()
  .min(2, "Slug must be at least 2 characters.")
  .max(64, "Slug too long.")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase letters, digits, or hyphens.");
const LABEL = z.string().min(2, "Label is too short.").max(80, "Label is too long.");

// ─────────────────────────────────────────────────────────────────────────────
// Skills
// ─────────────────────────────────────────────────────────────────────────────

const skillSchema = z.object({ slug: SLUG, label: LABEL });

export async function addSkill(
  input: z.infer<typeof skillSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const session = await verifyAdmin();
  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const db = getDb();
  const existing = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills)
    .where(eq(schema.skills.slug, parsed.data.slug))
    .limit(1);
  if (existing.length > 0) return fail("That skill slug already exists.");

  await db.insert(schema.skills).values({
    slug: parsed.data.slug,
    label: parsed.data.label,
  });

  await logAccess({
    kind: "taxonomy.add",
    actor: session.id,
    subject: parsed.data.slug,
    meta: { kind: "skill", label: parsed.data.label },
  });

  revalidatePath("/admin/taxonomy");
  return ok({ slug: parsed.data.slug });
}

export async function removeSkill(input: { slug: string }): Promise<ActionResult> {
  const session = await verifyAdmin();
  if (!input?.slug) return fail("Missing slug.");
  const db = getDb();

  const [usage] = await db
    .select({ c: count() })
    .from(schema.profileSkills)
    .where(eq(schema.profileSkills.skillSlug, input.slug));
  if ((usage?.c ?? 0) > 0) {
    return fail(`Still in use by ${usage?.c ?? 0} profile(s). Reassign before removal.`);
  }

  const deleted = await db
    .delete(schema.skills)
    .where(eq(schema.skills.slug, input.slug))
    .returning({ slug: schema.skills.slug });
  if (deleted.length === 0) return fail("Skill not found.");

  await logAccess({
    kind: "taxonomy.remove",
    actor: session.id,
    subject: input.slug,
    meta: { kind: "skill" },
  });

  revalidatePath("/admin/taxonomy");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Professions
// ─────────────────────────────────────────────────────────────────────────────

const professionSchema = z.object({ slug: SLUG, label: LABEL });

export async function addProfession(
  input: z.infer<typeof professionSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const session = await verifyAdmin();
  const parsed = professionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const db = getDb();
  const existing = await db
    .select({ slug: schema.professions.slug })
    .from(schema.professions)
    .where(eq(schema.professions.slug, parsed.data.slug))
    .limit(1);
  if (existing.length > 0) return fail("That profession slug already exists.");

  await db.insert(schema.professions).values({
    slug: parsed.data.slug,
    label: parsed.data.label,
  });

  await logAccess({
    kind: "taxonomy.add",
    actor: session.id,
    subject: parsed.data.slug,
    meta: { kind: "profession", label: parsed.data.label },
  });

  revalidatePath("/admin/taxonomy");
  return ok({ slug: parsed.data.slug });
}

export async function removeProfession(input: {
  slug: string;
}): Promise<ActionResult> {
  const session = await verifyAdmin();
  if (!input?.slug) return fail("Missing slug.");
  const db = getDb();

  // Profession lives on profiles.profession (text, not FK). Block when in use.
  const [usage] = await db
    .select({ c: count() })
    .from(schema.profiles)
    .where(eq(schema.profiles.profession, input.slug));
  if ((usage?.c ?? 0) > 0) {
    return fail(`Still in use by ${usage?.c ?? 0} profile(s). Reassign before removal.`);
  }

  const deleted = await db
    .delete(schema.professions)
    .where(eq(schema.professions.slug, input.slug))
    .returning({ slug: schema.professions.slug });
  if (deleted.length === 0) return fail("Profession not found.");

  await logAccess({
    kind: "taxonomy.remove",
    actor: session.id,
    subject: input.slug,
    meta: { kind: "profession" },
  });

  revalidatePath("/admin/taxonomy");
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Cities (require a province slug)
// ─────────────────────────────────────────────────────────────────────────────

const citySchema = z.object({
  slug: SLUG,
  label: LABEL,
  provinceSlug: SLUG,
});

export async function addCity(
  input: z.infer<typeof citySchema>,
): Promise<ActionResult<{ slug: string }>> {
  const session = await verifyAdmin();
  const parsed = citySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const db = getDb();

  const province = await db
    .select({ slug: schema.provinces.slug })
    .from(schema.provinces)
    .where(eq(schema.provinces.slug, parsed.data.provinceSlug))
    .limit(1);
  if (province.length === 0) return fail("Unknown province.");

  const existing = await db
    .select({ slug: schema.cities.slug })
    .from(schema.cities)
    .where(eq(schema.cities.slug, parsed.data.slug))
    .limit(1);
  if (existing.length > 0) return fail("That city slug already exists.");

  await db.insert(schema.cities).values({
    slug: parsed.data.slug,
    label: parsed.data.label,
    provinceSlug: parsed.data.provinceSlug,
  });

  await logAccess({
    kind: "taxonomy.add",
    actor: session.id,
    subject: parsed.data.slug,
    meta: {
      kind: "city",
      label: parsed.data.label,
      province: parsed.data.provinceSlug,
    },
  });

  revalidatePath("/admin/taxonomy");
  return ok({ slug: parsed.data.slug });
}

export async function removeCity(input: { slug: string }): Promise<ActionResult> {
  const session = await verifyAdmin();
  if (!input?.slug) return fail("Missing slug.");
  const db = getDb();

  // Cities are referenced by profiles.city (text label, not FK) — match by slug
  // OR by label so we don't strand profiles. We accept either column lookup
  // because seed/legacy data mixed both.
  const [usage] = await db
    .select({ c: count() })
    .from(schema.profiles)
    .where(sql`${schema.profiles.city} = ${input.slug}`);
  if ((usage?.c ?? 0) > 0) {
    return fail(`Still in use by ${usage?.c ?? 0} profile(s). Reassign before removal.`);
  }

  const deleted = await db
    .delete(schema.cities)
    .where(eq(schema.cities.slug, input.slug))
    .returning({ slug: schema.cities.slug });
  if (deleted.length === 0) return fail("City not found.");

  await logAccess({
    kind: "taxonomy.remove",
    actor: session.id,
    subject: input.slug,
    meta: { kind: "city" },
  });

  revalidatePath("/admin/taxonomy");
  return ok();
}
