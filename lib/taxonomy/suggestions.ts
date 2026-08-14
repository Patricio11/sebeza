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
import { and, desc, eq, inArray, isNull, sql, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifySession, verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import {
  createNotification,
  notifyAllAdmins,
} from "@/lib/notifications/server";
import { slug as slugify } from "@/lib/mock/helpers";
import { refreshProfileCompleteness } from "@/lib/profile/completeness-internal";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/**
 * Approval loop (docs/SUGGESTION_APPROVAL_LOOP_PLAN.md): when an
 * admin approves a SKILL suggestion, the approved skill is added to
 * the submitter's live profile automatically (default proficiency,
 * self-attested provenance; the seeker refines it from the editor),
 * and their completeness is refreshed so ranking stays honest.
 * Returns true when the profile actually gained the skill; false when
 * the submitter has no live profile (employer submitters) or already
 * holds the skill.
 */
async function addSkillToSubmitterProfile(
  db: ReturnType<typeof getDb>,
  submitterUserId: string,
  skillSlug: string,
): Promise<boolean> {
  const profileRows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(
      and(
        eq(schema.profiles.userId, submitterUserId),
        isNull(schema.profiles.deletedAt),
      ),
    )
    .limit(1);
  const profileId = profileRows[0]?.id;
  if (!profileId) return false;

  const existing = await db
    .select({ slug: schema.profileSkills.skillSlug })
    .from(schema.profileSkills)
    .where(
      and(
        eq(schema.profileSkills.profileId, profileId),
        eq(schema.profileSkills.skillSlug, skillSlug),
      ),
    )
    .limit(1);
  if (existing.length > 0) return false;

  await db.insert(schema.profileSkills).values({
    profileId,
    skillSlug,
    proficiency: 3,
  });
  await refreshProfileCompleteness(db, profileId);
  return true;
}

/** One approved-skill notification, copy varying on whether the skill
 *  landed on a profile (seeker) or is simply available now (employer). */
async function notifySkillApproved(
  userId: string,
  label: string,
  addedToProfile: boolean,
): Promise<void> {
  await createNotification({
    userId,
    kind: "taxonomy.suggestion.approved",
    title: `Your suggested skill was approved: ${label}`,
    body: addedToProfile
      ? "We added it to your profile automatically, and it now counts in search. You can adjust the proficiency any time from your profile editor."
      : "It is now available in every skill picker. Add it wherever it applies.",
    ...(addedToProfile ? { link: "/dashboard/profile" } : {}),
    meta: { label },
  });
}

// ─────────────────────────────────────────────────────────────────────
// User submit
// ─────────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  kind: z.enum(["profession", "institution", "organisation", "skill"]),
  customText: z
    .string()
    .min(2, "Too short  at least 2 characters.")
    .max(80, "Too long  cap at 80 characters."),
  /**
   * Phase 9.22  optional city for `kind='organisation'` submissions.
   * Lives on the pending organizations row alongside the name so the
   * admin reviewer has location context. Ignored for profession +
   * institution kinds.
   */
  orgCity: z.string().trim().max(80).optional(),
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
    /**
     * Phase 9.22  for organisation submissions, the pending org id
     * created so the caller can write it into
     * profiles.current_employer_org_id.
     */
    pendingOrganisationId?: string;
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
  } else if (parsed.data.kind === "institution") {
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
  } else {
    // organisation  reject only against orgs that would have been
    // picker-visible (sebenza_registered, or seeker_named verified).
    // Pending seeker_named orgs are excluded so multiple submissions
    // of the same name don't collide; admin merges them at the queue.
    const existing = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(
        and(
          sql`lower(${schema.organizations.name}) = lower(${customText})`,
          sql`(${schema.organizations.origin} = 'sebenza_registered' OR ${schema.organizations.verification} = 'verified')`,
        ),
      )
      .limit(1);
    if (existing[0]) {
      return fail(
        `"${customText}" already exists in the employer list  please pick it from the dropdown.`,
      );
    }
  }

  const suggestionId = `tx_${randomUUID()}`;
  let pendingInstitutionSlug: string | undefined;
  let pendingOrganisationId: string | undefined;

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
  } else if (parsed.data.kind === "organisation") {
    // Phase 9.22  insert a pending org row that the seeker's
    // profile can FK into. `origin='seeker_named'` carries the lineage
    // forever (audit + queue + badge). `verification='unverified'`
    // hides the row from the picker until admin promotes; the seeker
    // who submitted it sees the free-text-fallback on their own
    // profile until the row is verified.
    pendingOrganisationId = `org_${randomUUID()}`;
    const orgCity = parsed.data.orgCity?.trim() ?? null;
    await db.insert(schema.organizations).values({
      id: pendingOrganisationId,
      name: customText,
      city: orgCity && orgCity.length > 0 ? orgCity : null,
      origin: "seeker_named",
      verification: "unverified",
      listedBySeekerCount: 0,
    });
  }

  await db.insert(schema.taxonomySuggestions).values({
    id: suggestionId,
    kind: parsed.data.kind,
    customText,
    submittedByUserId: session.id,
    pendingInstitutionSlug: pendingInstitutionSlug ?? null,
    pendingOrganisationId: pendingOrganisationId ?? null,
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
        : parsed.data.kind === "institution"
          ? `A user picked "Other" on the institution picker and entered "${customText}". Review on /admin/taxonomy.`
          : `A seeker picked "Other" on the employer picker and entered "${customText}". Review on /admin/taxonomy.`,
    link: "/admin/taxonomy",
    dedupeKey: `${parsed.data.kind}::${customText.toLowerCase()}`,
    meta: { suggestionId, kind: parsed.data.kind, customText },
  });

  return ok({ suggestionId, pendingInstitutionSlug, pendingOrganisationId });
}

// ─────────────────────────────────────────────────────────────────────
// Admin reads
// ─────────────────────────────────────────────────────────────────────

export type SuggestionKind =
  | "profession"
  | "institution"
  | "organisation"
  | "skill";

export interface SuggestionRow {
  id: string;
  kind: SuggestionKind;
  customText: string;
  submittedAt: string;
  state: "pending" | "promoted" | "merged" | "rejected";
  targetSlug: string | null;
  pendingInstitutionSlug: string | null;
  /** Phase 9.22  for org-kind suggestions, the FK to the pending
   *  organizations row. Carries the city the seeker submitted (so
   *  the admin can edit it on promote). */
  pendingOrganisationId: string | null;
  /** Phase 9.22  for org-kind suggestions only. Snapshot of the
   *  pending row's name + city at read time so the admin queue
   *  can render them without a JOIN. NULL for other kinds. */
  pendingOrganisationName: string | null;
  pendingOrganisationCity: string | null;
  /** Number of rows in profiles/academic_profiles currently carrying
   *  this exact custom text (case-insensitive)  helps the admin gauge
   *  how popular the suggestion is. */
  submitterCount: number;
}

export async function listPendingSuggestions(
  kind: SuggestionKind,
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
      pendingOrganisationId: schema.taxonomySuggestions.pendingOrganisationId,
      // Phase 9.22  surface the pending org's editable fields so the
      // admin queue card can render the current name + city.
      pendingOrganisationName: schema.organizations.name,
      pendingOrganisationCity: schema.organizations.city,
    })
    .from(schema.taxonomySuggestions)
    .leftJoin(
      schema.organizations,
      eq(
        schema.organizations.id,
        schema.taxonomySuggestions.pendingOrganisationId,
      ),
    )
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
      kind: r.kind as SuggestionKind,
      customText: r.customText,
      submittedAt: r.submittedAt.toISOString(),
      state: r.state,
      targetSlug: r.targetSlug,
      pendingInstitutionSlug: r.pendingInstitutionSlug,
      pendingOrganisationId: r.pendingOrganisationId,
      pendingOrganisationName: r.pendingOrganisationName ?? null,
      pendingOrganisationCity: r.pendingOrganisationCity ?? null,
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
  /** Phase 9.22  for org-kind suggestions, admin can edit the city
   *  alongside the name. Empty string clears the city to NULL; omitted
   *  keeps the existing value. Ignored for profession + institution. */
  correctedCity: z.string().trim().max(80).optional(),
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
  // The skill branch runs its own per-submitter closure (backfill +
  // notify, incl. same-text dupes); other kinds notify once below.
  let skillLoopClosed = false;

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
  } else if (row.kind === "organisation") {
    // Phase 9.22  promote the pending org: update name + city, flip
    // verification='verified'. Then find any OTHER pending orgs with
    // the same name and merge them in (re-point profile FKs, delete
    // the dupes, sum the seeker counts).
    if (!row.pendingOrganisationId) {
      return fail(
        "Suggestion is missing its pending organisation id  contact engineering.",
      );
    }
    const correctedCity = parsed.data.correctedCity?.trim();
    await db
      .update(schema.organizations)
      .set({
        name: finalLabel,
        ...(correctedCity !== undefined
          ? { city: correctedCity.length > 0 ? correctedCity : null }
          : {}),
        verification: "verified",
        verifiedAt: new Date(),
        verifiedByUserId: session.id,
      })
      .where(eq(schema.organizations.id, row.pendingOrganisationId));

    // De-duplicate: other pending org rows with the same name
    // (case-insensitive). Re-point profile FKs, then delete them. The
    // canonical row's listed_by_seeker_count gets the cumulative
    // total via a recount at the end.
    const dupes = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.origin, "seeker_named"),
          eq(schema.organizations.verification, "unverified"),
          sql`lower(${schema.organizations.name}) = lower(${finalLabel})`,
          ne(schema.organizations.id, row.pendingOrganisationId),
        ),
      );
    if (dupes.length > 0) {
      const dupeIds = dupes.map((d) => d.id);
      const backfill = await db
        .update(schema.profiles)
        .set({ currentEmployerOrgId: row.pendingOrganisationId })
        .where(sql`${schema.profiles.currentEmployerOrgId} = ANY(${dupeIds})`);
      backfilledRows =
        (backfill as unknown as { rowCount?: number }).rowCount ?? 0;
      // Mark the dupe suggestions as merged into this one (so they
      // disappear from the admin queue) BEFORE deleting the org rows
      // (the suggestion's pending_organisation_id FK is ON DELETE SET NULL,
      // so the order isn't critical, but doing it first keeps the audit
      // trail crisper).
      await db
        .update(schema.taxonomySuggestions)
        .set({
          state: "merged",
          targetSlug: row.pendingOrganisationId,
          resolvedByUserId: session.id,
          resolvedAt: new Date(),
          adminNote: `Auto-merged into ${finalLabel} during promote of #${row.id}.`,
        })
        .where(
          and(
            eq(schema.taxonomySuggestions.kind, "organisation"),
            eq(schema.taxonomySuggestions.state, "pending"),
            sql`${schema.taxonomySuggestions.pendingOrganisationId} = ANY(${dupeIds})`,
          ),
        );
      await db
        .delete(schema.organizations)
        .where(sql`${schema.organizations.id} = ANY(${dupeIds})`);
    }
    // Recompute the canonical org's seeker count. Done as a single
    // COUNT(*) read so the denormalised column stays honest after the
    // backfill above. Small table; cheap.
    const recountRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.profiles)
      .where(
        and(
          eq(schema.profiles.currentEmployerOrgId, row.pendingOrganisationId),
          isNull(schema.profiles.deletedAt),
        ),
      );
    const seekerCount = recountRows[0]?.count ?? 0;
    await db
      .update(schema.organizations)
      .set({ listedBySeekerCount: seekerCount })
      .where(eq(schema.organizations.id, row.pendingOrganisationId));

    targetSlug = row.pendingOrganisationId;
  } else if (row.kind === "skill") {
    // Approval loop (docs/SUGGESTION_APPROVAL_LOOP_PLAN.md): promote
    // the skill into the canonical taxonomy AND close the loop for the
    // people who asked. The suggested slug never persisted anywhere
    // (save paths filter non-canonical entries at write time), so the
    // backfill is explicit: the submitter's live profile gains the
    // skill (default proficiency, self-attested), completeness is
    // refreshed, and they are notified. Same-text pending suggestions
    // from OTHER users resolve as merged (the house dupe pattern from
    // organisations/institutions) with the same backfill + closure.
    await db
      .insert(schema.skills)
      .values({ slug: finalSlug, label: finalLabel })
      .onConflictDoNothing();

    const dupes = await db
      .select({
        id: schema.taxonomySuggestions.id,
        submittedByUserId: schema.taxonomySuggestions.submittedByUserId,
      })
      .from(schema.taxonomySuggestions)
      .where(
        and(
          eq(schema.taxonomySuggestions.kind, "skill"),
          eq(schema.taxonomySuggestions.state, "pending"),
          sql`lower(${schema.taxonomySuggestions.customText}) = lower(${row.customText})`,
          ne(schema.taxonomySuggestions.id, row.id),
        ),
      );
    if (dupes.length > 0) {
      await db
        .update(schema.taxonomySuggestions)
        .set({
          state: "merged",
          targetSlug: finalSlug,
          resolvedByUserId: session.id,
          resolvedAt: new Date(),
          adminNote: `Auto-merged into ${finalLabel} during promote of #${row.id}.`,
        })
        .where(
          inArray(
            schema.taxonomySuggestions.id,
            dupes.map((d) => d.id),
          ),
        );
    }

    // One backfill + one notification per distinct submitter.
    const submitterIds = Array.from(
      new Set(
        [row.submittedByUserId, ...dupes.map((d) => d.submittedByUserId)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );
    for (const userId of submitterIds) {
      const added = await addSkillToSubmitterProfile(db, userId, finalSlug);
      if (added) backfilledRows++;
      await notifySkillApproved(userId, finalLabel, added);
    }
    skillLoopClosed = true;
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

  // Approval loop: tell the submitter their contribution made it in.
  // Profession/organisation/institution backfills already ran above
  // (their profiles point at the approved entry); this is the closure.
  if (!skillLoopClosed && row.submittedByUserId) {
    const copy: Record<string, { title: string; body: string }> = {
      profession: {
        title: `Your suggested profession was approved: ${finalLabel}`,
        body: "It is now part of the official register, and your profile shows the approved label.",
      },
      organisation: {
        title: `The employer you added was approved: ${finalLabel}`,
        body: "It is now a verified organisation on the register, and your profile's employer entry points at it.",
      },
      institution: {
        title: `Your institution was approved: ${finalLabel}`,
        body: "It is now officially listed. Your academic profile already points at it, so nothing else to do.",
      },
    };
    const c = copy[row.kind];
    if (c) {
      await createNotification({
        userId: row.submittedByUserId,
        kind: "taxonomy.suggestion.approved",
        title: c.title,
        body: c.body,
        link: "/dashboard/profile",
        meta: { kind: row.kind, label: finalLabel },
      });
    }
  }

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
  // Same closure pattern as promote: the skill branch handles its own
  // notification; other kinds notify once below with the target label.
  let skillLoopClosed = false;
  let approvedLabel: string | null = null;

  if (row.kind === "profession") {
    const targetRows = await db
      .select({ label: schema.professions.label })
      .from(schema.professions)
      .where(eq(schema.professions.slug, parsed.data.targetSlug))
      .limit(1);
    const targetLabel = targetRows[0]?.label;
    if (!targetLabel) return fail("Target profession not found.");
    approvedLabel = targetLabel;
    const result = await db
      .update(schema.profiles)
      .set({ profession: targetLabel })
      .where(sql`lower(${schema.profiles.profession}) = lower(${row.customText})`);
    backfilledRows = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  } else if (row.kind === "organisation") {
    // Phase 9.22  merge into an existing canonical org. Target must
    // be picker-visible (sebenza_registered, or verified seeker_named).
    if (!row.pendingOrganisationId) {
      return fail("Suggestion is missing its pending organisation id.");
    }
    const targetRows = await db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        origin: schema.organizations.origin,
        verification: schema.organizations.verification,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, parsed.data.targetSlug))
      .limit(1);
    const target = targetRows[0];
    if (!target) return fail("Target organisation not found.");
    if (
      !(
        target.origin === "sebenza_registered" || target.verification === "verified"
      )
    ) {
      return fail(
        "Target organisation is not picker-visible (must be Sebenza-registered or verified seeker-named).",
      );
    }
    approvedLabel = target.name;
    // Re-point seeker profiles using the pending org id  target.
    const result = await db
      .update(schema.profiles)
      .set({ currentEmployerOrgId: parsed.data.targetSlug })
      .where(eq(schema.profiles.currentEmployerOrgId, row.pendingOrganisationId));
    backfilledRows =
      (result as unknown as { rowCount?: number }).rowCount ?? 0;
    // Recount the target's seeker count + delete the pending row.
    const recountRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.profiles)
      .where(
        and(
          eq(schema.profiles.currentEmployerOrgId, parsed.data.targetSlug),
          isNull(schema.profiles.deletedAt),
        ),
      );
    const seekerCount = recountRows[0]?.count ?? 0;
    await db
      .update(schema.organizations)
      .set({ listedBySeekerCount: seekerCount })
      .where(eq(schema.organizations.id, parsed.data.targetSlug));
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, row.pendingOrganisationId));
  } else if (row.kind === "skill") {
    // Approval loop: merging a skill suggestion into an existing
    // canonical skill still means the submitter's ask was ACCEPTED,
    // their wording was just a variant. So the closure is identical to
    // promote: the target skill lands on their live profile (skip if
    // already there), completeness refreshes, and they are told. The
    // targetSlug stamp on the resolved suggestion lets the admin
    // retrace which canonical entry the merge pointed to.
    const targetRows = await db
      .select({ slug: schema.skills.slug, label: schema.skills.label })
      .from(schema.skills)
      .where(eq(schema.skills.slug, parsed.data.targetSlug))
      .limit(1);
    const target = targetRows[0];
    if (!target) return fail("Target skill not found.");
    if (row.submittedByUserId) {
      const added = await addSkillToSubmitterProfile(
        db,
        row.submittedByUserId,
        target.slug,
      );
      if (added) backfilledRows++;
      await notifySkillApproved(row.submittedByUserId, target.label, added);
    }
    skillLoopClosed = true;
  } else {
    if (!row.pendingInstitutionSlug) {
      return fail("Suggestion is missing its pending institution slug.");
    }
    // Verify the target exists + is not soft-deleted + not pending.
    const targetRows = await db
      .select({
        slug: schema.institutions.slug,
        label: schema.institutions.label,
      })
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
    approvedLabel = targetRows[0].label;
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
      // Null out the pending slug/id since we deleted the dependent row.
      pendingInstitutionSlug:
        row.kind === "institution" ? null : row.pendingInstitutionSlug,
      pendingOrganisationId:
        row.kind === "organisation" ? null : row.pendingOrganisationId,
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

  // Approval loop: a merge is still an acceptance. Tell the submitter
  // their entry now maps to the approved one (backfills ran above).
  if (!skillLoopClosed && row.submittedByUserId && approvedLabel) {
    const copy: Record<string, { title: string; body: string }> = {
      profession: {
        title: `Your suggested profession was matched: ${approvedLabel}`,
        body: `"${row.customText}" is already in the register under this name, and your profile now shows the approved label.`,
      },
      organisation: {
        title: `The employer you added was matched: ${approvedLabel}`,
        body: `"${row.customText}" is already on the register under this name, and your profile's employer entry now points at it.`,
      },
      institution: {
        title: `Your institution was matched: ${approvedLabel}`,
        body: `"${row.customText}" is already listed under this name, and your academic profile now points at it.`,
      },
    };
    const c = copy[row.kind];
    if (c) {
      await createNotification({
        userId: row.submittedByUserId,
        kind: "taxonomy.suggestion.approved",
        title: c.title,
        body: c.body,
        link: "/dashboard/profile",
        meta: { kind: row.kind, label: approvedLabel },
      });
    }
  }

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
