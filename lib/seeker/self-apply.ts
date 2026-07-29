"use server";

/**
 * Phase 34  Self Apply Server Action for a SIGNED-IN seeker on
 * /apply/[token] (docs/PHASE_34_SELF_APPLY_PLAN.md §34.3).
 *
 * Gate order (every one re-checked server-side  the page's render
 * state is advisory only):
 *   1. verifyRole("seeker")            authN + role
 *   2. platform flag                   feature_flag_vacancy_self_apply
 *   3. rate limit                      "self-apply" per user id
 *   4. vacancy by token                toggle ON + status open
 *   5. own profile exists, not deleted
 *   6. seeker hasn't blocked this org  refuse with honest copy (the
 *      inverse of the invite path's silent skip: HERE the seeker is
 *      the actor, so telling them the truth leaks nothing)
 *   7. no existing (vacancy, profile) row  typed outcomes so the UI
 *      can route "already invited" to the invitation instead
 *
 * The write itself (row + notification + audit with D4 disclosure
 * evidence) lives in lib/vacancy/self-apply-internal.ts, shared with
 * the sign-up path.
 */

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { enforce } from "@/lib/rate-limit";
import {
  loadSelfApplyVacancyByToken,
  recordSelfApplication,
} from "@/lib/vacancy/self-apply-internal";

export type SelfApplyResult =
  | {
      ok: true;
      outcome: "applied";
      invitationId: string;
      /** Vacancy skills the seeker doesn't have yet  the congrats nudge. */
      skillsGap: { slug: string; label: string }[];
    }
  | { ok: true; outcome: "already_applied"; invitationId: string }
  | { ok: true; outcome: "already_invited"; invitationId: string }
  | { ok: false; message: string };

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

const UNAVAILABLE =
  "This role is no longer accepting applications. The link may have been switched off or the vacancy filled.";

export async function selfApplyToVacancy(
  token: string,
): Promise<SelfApplyResult> {
  const session = await verifyRole("seeker");

  const flagOn = await getSetting<boolean>("feature_flag_vacancy_self_apply");
  if (!flagOn) return fail(UNAVAILABLE);

  const limit = await enforce("self-apply", session.id);
  if (!limit.ok) {
    return fail(
      "You've applied to quite a few roles this hour  take a breather and try again a little later.",
    );
  }

  if (typeof token !== "string" || token.length < 16 || token.length > 128) {
    return fail(UNAVAILABLE);
  }

  const loaded = await loadSelfApplyVacancyByToken(token);
  if (!loaded || !loaded.selfApplyEnabled || loaded.status !== "open") {
    return fail(UNAVAILABLE);
  }
  const { vacancy } = loaded;

  const db = getDb();
  const profileRow = await db
    .select({ id: schema.profiles.id, deletedAt: schema.profiles.deletedAt })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  const profile = profileRow[0];
  if (!profile || profile.deletedAt) {
    return fail("Finish creating your profile first, then apply.");
  }

  // Honest refusal when the seeker blocked this org  they are the
  // actor here, so naming the reason discloses nothing they don't know.
  const blocked = await db
    .select({ id: schema.seekerBlockedEmployers.id })
    .from(schema.seekerBlockedEmployers)
    .where(
      and(
        eq(schema.seekerBlockedEmployers.profileId, profile.id),
        eq(schema.seekerBlockedEmployers.orgId, vacancy.organizationId),
      ),
    )
    .limit(1);
  if (blocked.length > 0) {
    return fail(
      "You've blocked this employer. Unblock them from your privacy centre if you'd like to apply.",
    );
  }

  const existing = await db
    .select({
      id: schema.vacancyInvitations.id,
      origin: schema.vacancyInvitations.origin,
    })
    .from(schema.vacancyInvitations)
    .where(
      and(
        eq(schema.vacancyInvitations.vacancyId, vacancy.id),
        eq(schema.vacancyInvitations.profileId, profile.id),
      ),
    )
    .limit(1);
  const existingRow = existing[0];
  if (existingRow) {
    return existingRow.origin === "self_apply"
      ? { ok: true, outcome: "already_applied", invitationId: existingRow.id }
      : { ok: true, outcome: "already_invited", invitationId: existingRow.id };
  }

  const recorded = await recordSelfApplication({
    vacancy,
    profileId: profile.id,
    seekerUserId: session.id,
    source: "existing_account",
  });
  if (!recorded.ok) {
    // Raced a concurrent apply/invite  re-read for the honest outcome.
    const raced = await db
      .select({
        id: schema.vacancyInvitations.id,
        origin: schema.vacancyInvitations.origin,
      })
      .from(schema.vacancyInvitations)
      .where(
        and(
          eq(schema.vacancyInvitations.vacancyId, vacancy.id),
          eq(schema.vacancyInvitations.profileId, profile.id),
        ),
      )
      .limit(1);
    const row = raced[0];
    if (row) {
      return row.origin === "self_apply"
        ? { ok: true, outcome: "already_applied", invitationId: row.id }
        : { ok: true, outcome: "already_invited", invitationId: row.id };
    }
    return fail("Something went wrong recording your application  try again.");
  }

  // The congrats nudge: which of the vacancy's asked-for skills is the
  // seeker missing? Labels resolve from the live skills table so the
  // dialog never shows raw slugs.
  let skillsGap: { slug: string; label: string }[] = [];
  if (vacancy.skillSlugs.length > 0) {
    const owned = await db
      .select({ skillSlug: schema.profileSkills.skillSlug })
      .from(schema.profileSkills)
      .where(eq(schema.profileSkills.profileId, profile.id));
    const ownedSet = new Set(owned.map((s) => s.skillSlug));
    const gapSlugs = vacancy.skillSlugs.filter((s) => !ownedSet.has(s));
    if (gapSlugs.length > 0) {
      const labels = await db
        .select({ slug: schema.skills.slug, label: schema.skills.label })
        .from(schema.skills)
        .where(inArray(schema.skills.slug, gapSlugs));
      const labelMap = new Map(labels.map((l) => [l.slug, l.label]));
      skillsGap = gapSlugs.map((slug) => ({
        slug,
        label: labelMap.get(slug) ?? slug,
      }));
    }
  }

  revalidatePath("/dashboard/invitations");

  return {
    ok: true,
    outcome: "applied",
    invitationId: recorded.invitationId,
    skillsGap,
  };
}
