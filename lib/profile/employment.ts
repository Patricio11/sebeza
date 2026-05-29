"use server";

/**
 * Phase 9.22  current-employment read + write surface for seekers.
 *
 * Two paths:
 *
 *   listEmployerOptions(query)    feeds the employer picker on the
 *                                  signup form + dashboard editor.
 *                                  Returns picker-visible orgs only:
 *                                  sebenza_registered (regardless of
 *                                  KYC state) OR seeker_named with
 *                                  verification='verified'. Order:
 *                                  Sebenza-registered first (the
 *                                  source-of-truth signal), then
 *                                  alphabetical.
 *
 *   updateCurrentEmployment(...)  writes the three new profile
 *                                  columns. When the seeker submitted
 *                                  "Other" with a custom name, the
 *                                  action creates the pending org +
 *                                  suggestion atomically before
 *                                  attaching the FK to the profile.
 *
 * Privacy: every action is gated on `verifyRole('seeker')`; the
 * actor's own profile is the only row mutated. No employer-side
 * surface here  the employer dossier reads the column through the
 * existing public-profile shape (Phase 9.22 T8).
 */

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { submitTaxonomySuggestion } from "@/lib/taxonomy/suggestions";

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
// Picker read
// ─────────────────────────────────────────────────────────────────────

export interface EmployerOption {
  id: string;
  name: string;
  city: string | null;
  /** Phase 9.22 D6  honest badge state. The picker UI renders one of:
   *    sebenza_registered  "Sebenza employer"
   *    seeker_named_verified  "Listed by N seekers" with the count */
  badge: "sebenza_registered" | "seeker_named_verified";
  /** Denormalised seeker count, surfaced when badge=seeker_named_verified. */
  listedBySeekerCount: number;
}

const PICKER_LIMIT = 40;

/**
 * Phase 9.22 D3  picker filter. Sebenza-registered orgs always show
 * (KYC state is irrelevant for the seeker-picker  the org signed up,
 * the picker surfaces them so seekers can self-identify). Seeker-named
 * orgs only show when `verification='verified'` (admin promoted).
 * Rejected rows + unverified seeker_named rows stay hidden.
 *
 * Query is a case-insensitive name prefix. Empty query returns the
 * top PICKER_LIMIT by recency  enough for the seeker to scroll
 * before typing.
 */
export async function listEmployerOptions(
  query: string,
): Promise<EmployerOption[]> {
  const db = getDb();
  const trimmed = query.trim();
  const conditions = [
    or(
      eq(schema.organizations.origin, "sebenza_registered"),
      eq(schema.organizations.verification, "verified"),
    )!,
  ];
  if (trimmed.length > 0) {
    conditions.push(ilike(schema.organizations.name, `${trimmed}%`));
  }
  const rows = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      city: schema.organizations.city,
      origin: schema.organizations.origin,
      verification: schema.organizations.verification,
      listedBySeekerCount: schema.organizations.listedBySeekerCount,
    })
    .from(schema.organizations)
    .where(and(...conditions))
    .orderBy(
      // Sebenza-registered first (CASE expression  Drizzle's ORDER BY
      // accepts a raw sql template). Within each origin, alphabetical.
      sql`CASE WHEN ${schema.organizations.origin} = 'sebenza_registered' THEN 0 ELSE 1 END`,
      asc(schema.organizations.name),
    )
    .limit(PICKER_LIMIT);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city ?? null,
    badge:
      r.origin === "sebenza_registered"
        ? "sebenza_registered"
        : "seeker_named_verified",
    listedBySeekerCount: r.listedBySeekerCount,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────

const updateSchema = z
  .object({
    /** Existing org id picked from the dropdown. NULL clears the
     *  seeker's current employer entirely (next form submit). Mutually
     *  exclusive with customEmployerName. */
    employerOrgId: z.string().min(1).nullable().optional(),
    /** Free-text "Other" name. When set, the action creates a pending
     *  org + suggestion via submitTaxonomySuggestion, then attaches the
     *  resulting org id to the seeker's profile. */
    customEmployerName: z
      .string()
      .trim()
      .min(2, "Employer name must be at least 2 characters.")
      .max(80, "Employer name must be 80 characters or fewer.")
      .optional(),
    /** Optional city for the new pending org. Lives on the org row,
     *  NOT on the profile. Used only with customEmployerName. */
    customEmployerCity: z.string().trim().max(80).optional(),
    /** Day-precision date; the form captures year + month and defaults
     *  the day to 01. NULL clears. */
    roleStartedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .nullable()
      .optional(),
    /** City where the role is performed. Can diverge from profile.city
     *  for cross-province commuters. */
    roleCity: z.string().trim().max(80).nullable().optional(),
  })
  .refine(
    (v) => !(v.employerOrgId && v.customEmployerName),
    {
      message: "Pick from the list OR enter a custom employer  not both.",
      path: ["customEmployerName"],
    },
  );

export async function updateCurrentEmployment(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult<{ employerOrgId: string | null }>> {
  const session = await verifyRole("seeker");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid employment input.");
  }
  const v = parsed.data;
  const db = getDb();

  // Locate the seeker's profile row.
  const profileRows = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(
      and(eq(schema.profiles.userId, session.id), isNull(schema.profiles.deletedAt)),
    )
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return fail("Profile not found.");

  // Resolve the employer FK. Three paths:
  //   1) employerOrgId picked from dropdown  use it directly (verify
  //      it exists + is picker-visible to prevent FK probing).
  //   2) customEmployerName  delegate to submitTaxonomySuggestion
  //      (handles dedup, rate-limit, pending row creation, admin
  //      notification, audit). Use the returned pendingOrganisationId.
  //   3) Neither  the seeker is clearing their current employer.
  let resolvedEmployerOrgId: string | null = null;
  if (v.employerOrgId) {
    const orgRows = await db
      .select({
        id: schema.organizations.id,
        origin: schema.organizations.origin,
        verification: schema.organizations.verification,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, v.employerOrgId))
      .limit(1);
    const org = orgRows[0];
    if (!org) return fail("Picked employer not found.");
    if (
      !(
        org.origin === "sebenza_registered" ||
        org.verification === "verified"
      )
    ) {
      return fail(
        "Picked employer isn't picker-visible  pick again from the dropdown.",
      );
    }
    resolvedEmployerOrgId = org.id;
  } else if (v.customEmployerName) {
    const submission = await submitTaxonomySuggestion({
      kind: "organisation",
      customText: v.customEmployerName,
      orgCity: v.customEmployerCity ?? undefined,
    });
    if (!submission.ok) return fail(submission.message);
    if (!submission.pendingOrganisationId) {
      return fail("Suggestion submission did not return a pending org id.");
    }
    resolvedEmployerOrgId = submission.pendingOrganisationId;
  }

  // Read the prior employer id so we can decrement its seeker count
  // when it changes. Cheap; same row we already partial-loaded above
  // but we want the column.
  const priorRows = await db
    .select({
      currentEmployerOrgId: schema.profiles.currentEmployerOrgId,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profile.id))
    .limit(1);
  const priorEmployerOrgId = priorRows[0]?.currentEmployerOrgId ?? null;

  // Apply the patch + maintain denormalised counts. The seeker count
  // is incremented on the new employer + decremented on the prior.
  // Order: write the profile FIRST, then bump counts via a recount on
  // each side (atomic enough; the nightly cron is the drift backstop).
  await db
    .update(schema.profiles)
    .set({
      currentEmployerOrgId: resolvedEmployerOrgId,
      currentRoleStartedAt: v.roleStartedAt ?? null,
      currentRoleCity:
        v.roleCity && v.roleCity.length > 0 ? v.roleCity : null,
    })
    .where(eq(schema.profiles.id, profile.id));

  // Maintain listed_by_seeker_count on both ends of the swap. Recount
  // each side from authoritative source (the profiles table) so we
  // never drift from a missed +1/-1.
  const idsToRecount = new Set<string>();
  if (priorEmployerOrgId) idsToRecount.add(priorEmployerOrgId);
  if (resolvedEmployerOrgId) idsToRecount.add(resolvedEmployerOrgId);
  for (const orgId of idsToRecount) {
    const cnt = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.profiles)
      .where(
        and(
          eq(schema.profiles.currentEmployerOrgId, orgId),
          isNull(schema.profiles.deletedAt),
        ),
      );
    await db
      .update(schema.organizations)
      .set({ listedBySeekerCount: cnt[0]?.count ?? 0 })
      .where(eq(schema.organizations.id, orgId));
  }

  // Audit. The free-text custom name (if any) is captured in the
  // suggestion submit row already; here we log the effective state.
  await logAccess({
    kind: "profile.employment.update",
    actor: session.id,
    subject: profile.id,
    meta: {
      employerOrgId: resolvedEmployerOrgId,
      priorEmployerOrgId,
      roleStartedAt: v.roleStartedAt ?? null,
      roleCity: v.roleCity ?? null,
      cleared: resolvedEmployerOrgId === null,
    },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return ok({ employerOrgId: resolvedEmployerOrgId });
}
