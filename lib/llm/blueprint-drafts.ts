/**
 * AI-drafted role blueprints (docs/ROLE_BLUEPRINTS_PLAN.md, part 2).
 *
 * ADMIN-ONLY drafting for professions the starter catalogue does not
 * cover (or to refresh one). The model picks from the LIVE skill taxonomy
 * by slug, may propose a handful of genuinely new skills, and returns one
 * small JSON object. Every draft lands in `blueprint_drafts` for review;
 * NOTHING reaches a seeker until an admin approves it. Same kill-switch,
 * provider registry, budget counters and chat transport as the catalogue
 * drafts (`feature_flag_llm_curriculum_enabled`, the admin drafting family).
 *
 * Token posture: one call per profession, admin-triggered, lean prompt
 * (slugs only, no labels), reply capped by the transport's 1024 tokens.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { coachChat, type LlmCredentials } from "./seeker-coach";
import { parseBlueprintDraft } from "@/lib/blueprints/draft-parser";

export {
  blueprintDraftSchema,
  parseBlueprintDraft,
  type BlueprintDraftPayload,
} from "@/lib/blueprints/draft-parser";

function systemPrompt(): string {
  return [
    "You design role skill blueprints for a South African national talent platform.",
    "Use ONLY skill slugs from the provided list. If a skill the role truly needs is absent, add it under newSkills (max 6) with a short kebab-case slug, a label (max 40 chars) and category technical or professional; then use that slug. The skill the role is NAMED for (what the person actually does all day) MUST appear in core, added under newSkills if the list lacks it; never substitute a generic skill for it.",
    "Tiers: core = 3-5 skills every person in this role has; expected = 2-4 skills employers assume; tracks = 1-4 named routes to the next level (a South African career step, e.g. supervision, a specialisation, running your own business), each with 2-5 skills.",
    "proveIt: for up to 4 skills, one concrete sentence describing a small project that proves the skill.",
    "Be honest and local: no invented certifications, no promises about pay.",
    'Reply with ONLY this JSON object: {"core":[slug],"expected":[slug],"tracks":[{"name":string,"skills":[slug]}],"proveIt":{slug:string},"newSkills":[{"slug":string,"label":string,"category":"technical"|"professional"}]}',
  ].join(" ");
}

export type DraftBlueprintResult =
  { ok: true; draftId: string } | { ok: false; reason: string };

export async function draftBlueprint(input: {
  professionSlug: string;
  professionLabel: string;
  callerUserId: string;
  callerRole: string;
}): Promise<DraftBlueprintResult> {
  if (input.callerRole !== "admin") return { ok: false, reason: "not_admin" };
  const enabled = await getSetting<boolean>(
    "feature_flag_llm_curriculum_enabled",
  );
  if (!enabled) {
    return {
      ok: false,
      reason: "The LLM drafting switch is OFF (/admin/llm, curriculum family).",
    };
  }
  const db = getDb();
  const skills = await db
    .select({ slug: schema.skills.slug })
    .from(schema.skills);
  const known = new Set(skills.map((s) => s.slug));

  const [active] = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);
  if (!active)
    return { ok: false, reason: "No active LLM provider (/admin/llm)." };
  if (!active.credentialsEnc)
    return { ok: false, reason: "Provider has no credentials." };
  let creds: LlmCredentials;
  try {
    creds = JSON.parse(decryptField(active.credentialsEnc));
  } catch {
    return {
      ok: false,
      reason: "Provider credentials could not be decrypted.",
    };
  }
  const spentZar = Number(active.totalSpendZar ?? 0);
  if (active.monthlyBudgetZar <= 0 || spentZar >= active.monthlyBudgetZar) {
    return {
      ok: false,
      reason: "Provider budget is exhausted for this month.",
    };
  }

  let text: string;
  let tokenCount = 0;
  let estZarCost = 0;
  try {
    const res = await coachChat(
      active.id,
      creds,
      systemPrompt(),
      `Profession: ${input.professionLabel}. Skill slugs: ${[...known].sort().join(",")}. JSON only.`,
    );
    text = res.text;
    tokenCount = res.tokenCount;
    estZarCost = res.estZarCost;
  } catch (e) {
    return {
      ok: false,
      reason: `Provider call failed: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }

  await db
    .update(schema.llmProviders)
    .set({
      lastUsedAt: new Date(),
      totalCalls: active.totalCalls + 1,
      totalTokens: active.totalTokens + tokenCount,
      totalSpendZar: (spentZar + estZarCost).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(schema.llmProviders.id, active.id));

  const parsed = parseBlueprintDraft(text, known);
  if (!parsed.ok) {
    await logAccess({
      kind: "blueprint.draft",
      actor: input.callerUserId,
      subject: input.professionSlug,
      meta: {
        ok: false,
        reason: parsed.reason,
        modelId: creds.modelId,
        tokenCount,
      },
    });
    return parsed;
  }
  const id = `bd_${randomUUID()}`;
  await db.insert(schema.blueprintDrafts).values({
    id,
    professionSlug: input.professionSlug,
    payload: parsed.payload as unknown as Record<string, unknown>,
    state: "pending",
    rawModel: creds.modelId,
    createdByUserId: input.callerUserId,
  });
  await logAccess({
    kind: "blueprint.draft",
    actor: input.callerUserId,
    subject: input.professionSlug,
    meta: {
      ok: true,
      draftId: id,
      modelId: creds.modelId,
      tokenCount,
      core: parsed.payload.core.length,
      tracks: parsed.payload.tracks.length,
      newSkills: parsed.payload.newSkills.length,
    },
  });
  return { ok: true, draftId: id };
}
