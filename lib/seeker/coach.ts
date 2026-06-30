"use server";

/**
 * Phase 17 ("AI Career Coach")  the seeker-facing Server Action.
 *
 * Gates the caller (seeker), reads ONLY safe profile fields (profession +
 * skills  taxonomy-backed, no PII), and hands off to the LLM dispatcher,
 * which runs the provider / budget / flag / PII gates. The free-text role
 * title is the only seeker-authored input and is PII-guarded downstream.
 */

import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import {
  generateInterviewQuestions,
  type CoachResult,
} from "@/lib/llm/seeker-coach";

export async function requestInterviewPractice(
  roleTitle: string,
): Promise<CoachResult> {
  const me = await verifyRole("seeker");
  const profile = await getMyProfile();
  if (!profile) return { ok: false, reason: "no_provider" };

  const clean = (roleTitle ?? "").trim().slice(0, 120);
  if (clean.length < 2) return { ok: false, reason: "empty" };

  return generateInterviewQuestions({
    callerUserId: me.id,
    profession: profile.profession,
    skills: profile.topSkills.map((s) => s.name),
    roleTitle: clean,
  });
}
