"use server";

/**
 * 2026-08-19  seeker action for the "Coach's read" (COMPASS narrative).
 * Assembles the pseudonymous snapshot server-side (the browser sends
 * NOTHING but the click) and delegates to the gated generator.
 */

import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import { getCompassForProfile } from "@/db/queries/career-compass";
import {
  generateCompassRead,
  type CompassRead,
} from "@/lib/llm/compass-read";

export type ActionResult =
  | { ok: true; read: CompassRead }
  | { ok: false; message: string };

export async function requestCompassRead(): Promise<ActionResult> {
  const session = await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) return { ok: false, message: "Profile not found." };

  const compass = await getCompassForProfile(me);

  const res = await generateCompassRead({
    callerUserId: session.id,
    profileId: me.profileId,
    profession: me.profession,
    province: me.province,
    skills: me.topSkills.map((s) => [s.name, s.proficiency]),
    gaps: compass.recommendations
      .slice(0, 5)
      .map((r) => [r.skill.label, r.demandSignal?.searches ?? 0]),
    demandBasis: compass.demandBasis ?? "local",
    paths: compass.learningPaths
      .slice(0, 3)
      .map((p) => [p.title, p.provider, p.cost, p.durationWeeks]),
    rank:
      compass.headline.currentRank > 0
        ? {
            current: compass.headline.currentRank,
            projected: compass.headline.projectedRank,
          }
        : null,
  });

  if (!res.ok) {
    const message =
      res.reason === "flag_off"
        ? "The coach isn't switched on yet."
        : res.reason === "throttled"
          ? "You've reached today's coach limit. Try again tomorrow."
          : res.reason === "budget" || res.reason === "no_provider"
            ? "The coach is taking a break right now. Your compass below has everything it would say."
            : "Couldn't write your read just now. Please try again.";
    return { ok: false, message };
  }
  return { ok: true, read: res.read };
}
