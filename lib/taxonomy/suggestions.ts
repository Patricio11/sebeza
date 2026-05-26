"use server";

/**
 * Phase 9.15  Taxonomy suggestion queue.
 *
 * One Server Action surface covering both the user-submit path and the
 * four admin resolution paths (promote / edit&promote / merge / reject).
 * The mechanism is identical for professions + institutions; the only
 * variation is how the user's free-text gets stored at submit time + how
 * the backfill runs on resolution.
 *
 * Submit (user-facing):
 *   - For professions: profiles.profession stores the free-text directly.
 *     No FK constraint; no schema gymnastics needed.
 *   - For institutions: a new institutions row is created with
 *     is_pending=true and a generated `other--<kebab>-<rand>` slug.
 *     academic_profiles.institution_slug references it (FK satisfied).
 *     Pickers default to WHERE NOT is_pending so the pending row is
 *     invisible to others until promoted.
 *
 * Resolve (admin-facing):
 *   - promote: insert (slug, label) into the canonical taxonomy (for
 *     professions) OR flip is_pending=false on the existing row (for
 *     institutions). Backfill any other rows that currently match the
 *     same free-text.
 *   - merge: link the suggestion to an existing canonical slug. Backfill
 *     all matching free-text rows to the target slug/label. For
 *     institutions, also DELETE the pending row.
 *   - reject: set state='rejected'. User data is NEVER mutated.
 *
 * Audit: every state change writes a `taxonomy.suggestion.*` row.
 * Notification: submit fires `taxonomy.suggestion.received` to all
 * admins (catalog dedupe handles same-day repeats per kind+text).
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifySession, verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { notifyAllAdmins } from "@/lib/notifications/server";
import { slug as slugify } from "@/lib/mock/helpers";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ─────────────────────────────────────────────────────────────────────
// User submit
// ─────────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  kind: z.enum(["profession", "institution"]),
  customText: z
    .string()
    .min(2, "Too short  at least 2 characters.")
    .max(80, "Too long  cap at 80 characters."),
});

/** Daily per-user submission cap (anti-spam). */
const SUBMIT_CAP_PER_DAY = 5;

export async function submitTaxonomySuggestion(
  input: z.infer<typeof submitSchema>,
): Promise<
  ActionResult<{
    suggestionId: string;
    /** For institution submissions, the pending slug created so the
     *  caller can write it into academic_profiles.institution_slug. */
    pendingInstitutionSlug?: string;
  }>
> {
  const session = await verifySession();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Invalid input.");
  }
  const customText = parsed.data.customText.trim().replace(/\s+/g, " ");
  if (customText.length < 2) return fail("Too short  at least 2 characters.");

  const db = getDb();

  // Anti-spam: max SUBMIT_CAP_PER_DAY suggestions per user in 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.taxonomySuggestions.id })
    .from(schema.taxonomySuggestions)
    .where(
      and(
        eq(schema.taxonomySuggestions.submittedByUserId, session.id),
        sql`${schema.taxonomySuggestions.submittedAt} >= ${since}`,
      ),
    )
    .limit(SUBMIT_CAP_PER_DAY);
  if (recent.length >= SUBMIT_CAP_PER_DAY) {
    return fail(
      "You've submitted the maximum number of suggestions for today. Try again tomorrow.",
    );
  }

  // Reject if the text exactly matches an existing canonical entry
  // (case-insensitive). The user should have picked from the list.
  if (parsed.data.kind === "profession") {
    const existing = await db
      .select({ slug: schema.professions.slug })
      .from(schema.professions)
      .where(sql`lower(${schema.professions.label}) = lower(${customText})`)
      .limit(1);
    if (existing[0]) {
      return fail(
        `"${customText}" already exists in the profession list  please pick it from the dropdown.`,
      );
    }
  } else {
    const existing = await db
      .select({ slug: schema.institutions.slug })
      .from(schema.institutions)
      .where(
        and(
          sql`lower(${schema.institutions.label}) = lower(${customText})`,
          eq(schema.institutions.isPending, false),
          isNull(schema.institutions.deletedAt),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return fail(
        `"${customText}" already exists in the institution list  please pick it from the dropdown.`,
      );
    }
  }

  const suggestionId = `tx_${randomUUID()}`;
  let pendingInstitutionSlug: string | undefined;

  if (parsed.data.kind === "institution") {
    // Create the pending institutions row so academic_profiles can FK
    // to it. Slug is unguessable so we can have multiple "Damelin
    // College" pending rows from different users before admin resolves.
    pendingInstitutionSlug = `other--${slugify(customText)}-${randomUUID().slice(0, 6)}`;
    // Pending institutions use "private" kind + the submitter's
    // location as a hint  city/province come from their profile if
    // they have one. For sign-up before profile exists, fall back to
    // a sensible default.
    const provinceRows = await db
      .select({ province: schema.profiles.province })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, session.id))
      .limit(1);
    const provinceLabel = provinceRows[0]?.province ?? "Gauteng";
    const provinceSlugRows = await db
      .select({ slug: schema.provinces.slug })
      .from(schema.provinces)
      .where(sql`lower(${schema.provinces.label}) = lower(${provinceLabel})`)
      .limit(1);
    const provinceSlug = provinceSlugRows[0]?.slug ?? "gauteng";

    await db.insert(schema.institutions).values({
      slug: pendingInstitutionSlug,
      label: customText,
      kind: "private", // pending  no kind known yet; admin can edit on promote
      city: "Pending",
      provinceSlug,
      isPending: true,
    });
  }

  await db.insert(schema.taxonomySuggestions).values({
    id: suggestionId,
    kind: parsed.data.kind,
    customText,
    submittedByUserId: session.id,
    pendingInstitutionSlug: pendingInstitutionSlug ?? null,
  });

  await logAccess({
    kind: "taxonomy.suggestion.submit",
    actor: session.id,
    subject: suggestionId,
    meta: { kind: parsed.data.kind, customText },
  });

  // Notify admins. Dedupe per (kind, lower(customText))  24h window in
  // the catalog handles same-day repeats automatically.
  await notifyAllAdmins({
    kind: "taxonomy.suggestion.received",
    title: `New ${parsed.data.kind} suggestion: ${customText}`,
    body:
      parsed.data.kind === "profession"
        ? `A user picked "Other" on the profession picker and entered "${customText}". Review on /admin/taxonomy.`
        : `A user picked "Other" on the institution picker and entered "${customText}". Review on /admin/taxonomy.`,
    link: "/admin/taxonomy",
    dedupeKey: `${parsed.data.kind}::${customText.toLowerCase()}`,
    meta: { suggestionId, kind: parsed.data.kind, customText },
  });

  return ok({ suggestionId, pendingInstitutionSlug });
}

// ─────────────────────────────────────────────────────────────────────
// Admin reads
// ─────────────────────────────────────────────────────────────────────

export interface SuggestionRow {
  id: string;
  kind: "profession" | "institution";
  customText: string;
  submittedAt: string;
  state: "pending" | "promoted" | "merged" | "rejected";
  targetSlug: string | null;
  pendingInstitutionSlug: string | null;
  /** Number of rows in profiles/academic_profiles currently carrying
   *  this exact custom text (case-insensitive)  helps the admin gauge
   *  how popular the suggestion is. */
  submitterCount: number;
}

export async function listPendingSuggestions(
  kind: "profession" | "institution",
): Promise<SuggestionRow[]> {
  await verifyAdmin();
  const db = getDb();

  const rows = await db
    .select({
      id: schema.taxonomySuggestions.id,
      kind: schema.taxonomySuggestions.kind,
      customText: schema.taxonomySuggestions.customText,
      submittedAt: schema.taxonomySuggestions.submittedAt,
      state: schema.taxonomySuggestions.state,
      targetSlug: schema.taxonomySuggestions.targetSlug,
      pendingInstitutionSlug: schema.taxonomySuggestions.pendingInstitutionSlug,
    })
    .from(schema.taxonomySuggestions)
    .where(
      and(
        eq(schema.taxonomySuggestions.kind, kind),
        eq(schema.taxonomySuggestions.state, "pending"),
      ),
    )
    .orderBy(desc(schema.taxonomySuggestions.submittedAt))
    .limit(200);

  // Compute submitterCount for each unique customText.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.customText.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Deduplicate by customText, keep the oldest id, sum the submitterCount.
  const seen = new Set<string>();
  const out: SuggestionRow[] = [];
  for (const r of rows) {
    const key = r.customText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: r.id,
      kind: r.kind,
      customText: r.customText,
      submittedAt: r.submittedAt.toISOString(),
      state: r.state,
      targetSlug: r.targetSlug,
      pendingInstitutionSlug: r.pendingInstitutionSlug,
      submitterCount: counts.get(key) ?? 1,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Admin resolve
// ─────────────────────────────────────────────────────────────────────

const promoteSchema = z.object({
  suggestionId: z.string().min(1),
  /** Optional admin-corrected label. When omitted, the customText is
   *  promoted as-is. Useful for fixing casing/spelling before adding. */
  correctedLabel: z.string().max(80).optional(),
  note: z.string().max(280).optional(),
});

export async function promoteTaxonomySuggestion(
  input: z.infer<typeof promoteSchema>,
): Promise<ActionResult<{ backfilledRows: number }>> {
  const session = await verifyAdmin();
  const parsed = promoteSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.taxonomySuggestions)
    .where(eq(schema.taxonomySuggestions.id, parsed.data.suggestionId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Suggestion not found.");
  if (row.state !== "pending")
    return fail("This suggestion has already been resolved.");

  const finalLabel = (parsed.data.correctedLabel ?? row.customText)
    .trim()
    .replace(/\s+/g, " ");
  if (finalLabel.length < 2) return fail("Label too short.");
  const finalSlug = slugify(finalLabel);

  let backfilledRows = 0;
  let targetSlug = finalSlug;

  if (row.kind === "profession") {
    // Insert into canonical professions (idempotent  if slug already
    // exists from a prior promotion, no-op + just backfill).
    await db
      .insert(schema.professions)
      .values({ slug: finalSlug, label: finalLabel })
      .onConflictDoNothing();
    // Backfill: every profile carrying the ORIGINAL custom_text gets
    // the canonical label.
    const result = await db
      .update(schema.profiles)
      .set({ profession: finalLabel })
      .where(sql`lower(${schema.profiles.profession}) = lower(${row.customText})`);
    backfilledRows = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  } else {
    // Institution: flip is_pending=false on the existing pending row.
    // Also update label if the admin corrected it.
    if (!row.pendingInstitutionSlug) {
      return fail(
        "Suggestion is missing its pending institution slug  contact engineering.",
      );
    }
    await db
      .update(schema.institutions)
      .set({ isPending: false, label: finalLabel })
      .where(eq(schema.institutions.slug, row.pendingInstitutionSlug));
    // No backfill needed for academic_profiles  they already point at
    // this slug. But we DO need to find any OTHER pending institutions
    // rows with the same label and merge them into this one.
    const dupes = await db
      .select({ slug: schema.institutions.slug })
      .from(schema.institutions)
      .where(
        and(
          eq(schema.institutions.isPending, true),
          sql`lower(${schema.institutions.label}) = lower(${finalLabel})`,
          ne(schema.institutions.slug, row.pendingInstitutionSlug),
        ),
      );
    if (dupes.length > 0) {
      const dupeSlugs = dupes.map((d) => d.slug);
      const backfill = await db
        .update(schema.academicProfiles)
        .set({ institutionSlug: row.pendingInstitutionSlug })
        .where(sql`${schema.academicProfiles.institutionSlug} = ANY(${dupeSlugs})`);
      backfilledRows = (backfill as unknown as { rowCount?: number }).rowCount ?? 0;
      // Clean up the now-orphaned dupe rows.
      await db
        .delete(schema.institutions)
        .where(sql`${schema.institutions.slug} = ANY(${dupeSlugs})`);
    }
    targetSlug = row.pendingInstitutionSlug;
  }

  await db
    .update(schema.taxonomySuggestions)
    .set({
      state: "promoted",
      targetSlug,
      resolvedByUserId: session.id,
      resolvedAt: new Date(),
      adminNote: parsed.data.note ?? null,
    })
    .where(eq(schema.taxonomySuggestions.id, row.id));

  await logAccess({
    kind: "taxonomy.suggestion.promote",
    actor: session.id,
    subject: row.id,
    meta: {
      kind: row.kind,
      customText: row.customText,
      finalLabel,
      finalSlug: targetSlug,
      backfilledRows,
      note: parsed.data.note ?? null,
    },
  });

  revalidatePath("/admin/taxonomy");
  return ok({ backfilledRows });
}

const mergeSchema = z.object({
  suggestionId: z.string().min(1),
  /** The existing canonical slug (profession.slug or institution.slug)
   *  to merge this suggestion INTO. */
  targetSlug: z.string().min(1),
  note: z.string().max(280).optional(),
});

export async function mergeTaxonomySuggestion(
  input: z.infer<typeof mergeSchema>,
): Promise<ActionResult<{ backfilledRows: number }>> {
  const session = await verifyAdmin();
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.taxonomySuggestions)
    .where(eq(schema.taxonomySuggestions.id, parsed.data.suggestionId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Suggestion not found.");
  if (row.state !== "pending")
    return fail("This suggestion has already been resolved.");

  let backfilledRows = 0;

  if (row.kind === "profession") {
    const targetRows = await db
      .select({ label: schema.professions.label })
      .from(schema.professions)
      .where(eq(schema.professions.slug, parsed.data.targetSlug))
      .limit(1);
    const targetLabel = targetRows[0]?.label;
    if (!targetLabel) return fail("Target profession not found.");
    const result = await db
      .update(schema.profiles)
      .set({ profession: targetLabel })
      .where(sql`lower(${schema.profiles.profession}) = lower(${row.customText})`);
    backfilledRows = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  } else {
    if (!row.pendingInstitutionSlug) {
      return fail("Suggestion is missing its pending institution slug.");
    }
    // Verify the target exists + is not soft-deleted + not pending.
    const targetRows = await db
      .select({ slug: schema.institutions.slug })
      .from(schema.institutions)
      .where(
        and(
          eq(schema.institutions.slug, parsed.data.targetSlug),
          eq(schema.institutions.isPending, false),
          isNull(schema.institutions.deletedAt),
        ),
      )
      .limit(1);
    if (!targetRows[0]) return fail("Target institution not found or not active.");
    // Re-point any academic_profiles using the pending slug → target.
    const result = await db
      .update(schema.academicProfiles)
      .set({ institutionSlug: parsed.data.targetSlug })
      .where(
        eq(schema.academicProfiles.institutionSlug, row.pendingInstitutionSlug),
      );
    backfilledRows = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    // Delete the now-orphaned pending row.
    await db
      .delete(schema.institutions)
      .where(eq(schema.institutions.slug, row.pendingInstitutionSlug));
  }

  await db
    .update(schema.taxonomySuggestions)
    .set({
      state: "merged",
      targetSlug: parsed.data.targetSlug,
      resolvedByUserId: session.id,
      resolvedAt: new Date(),
      adminNote: parsed.data.note ?? null,
      // Null out the pending slug since we deleted the row.
      pendingInstitutionSlug:
        row.kind === "institution" ? null : row.pendingInstitutionSlug,
    })
    .where(eq(schema.taxonomySuggestions.id, row.id));

  await logAccess({
    kind: "taxonomy.suggestion.merge",
    actor: session.id,
    subject: row.id,
    meta: {
      kind: row.kind,
      customText: row.customText,
      targetSlug: parsed.data.targetSlug,
      backfilledRows,
      note: parsed.data.note ?? null,
    },
  });

  revalidatePath("/admin/taxonomy");
  return ok({ backfilledRows });
}

const rejectSchema = z.object({
  suggestionId: z.string().min(1),
  reason: z.string().min(2).max(280),
});

export async function rejectTaxonomySuggestion(
  input: z.infer<typeof rejectSchema>,
): Promise<ActionResult> {
  const session = await verifyAdmin();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a short rejection reason (2-280 chars).");
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.taxonomySuggestions)
    .where(eq(schema.taxonomySuggestions.id, parsed.data.suggestionId))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Suggestion not found.");
  if (row.state !== "pending")
    return fail("This suggestion has already been resolved.");

  // CRITICAL CONTRACT: user data is NEVER mutated on reject. Their
  // profile/academic_profile keeps the custom text. The suggestion just
  // stops surfacing in the admin queue. The pending institutions row
  // also stays (the user's academic profile is still linked to it)
  //  it's just marked as rejected so admins know not to act on it again.
  await db
    .update(schema.taxonomySuggestions)
    .set({
      state: "rejected",
      resolvedByUserId: session.id,
      resolvedAt: new Date(),
      adminNote: parsed.data.reason,
    })
    .where(eq(schema.taxonomySuggestions.id, row.id));

  await logAccess({
    kind: "taxonomy.suggestion.reject",
    actor: session.id,
    subject: row.id,
    meta: {
      kind: row.kind,
      customText: row.customText,
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/admin/taxonomy");
  return ok();
}
