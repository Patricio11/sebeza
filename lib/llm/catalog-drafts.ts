/**
 * 2026-08  AI-drafted learning-catalogue entries (COMPASS_FUEL_PLAN B).
 *
 * ADMIN-ONLY drafting: the LLM proposes SA-grounded learning routes for
 * chosen skills; every draft lands in `catalog_drafts` for human review.
 * NOTHING reaches a seeker until an admin approves it into
 * `learning_paths`. Reuses the curriculum posture: same kill-switch
 * (`feature_flag_llm_curriculum_enabled`  the admin drafting family),
 * same provider registry, budget + telemetry counters, and the generic
 * chat transport from seeker-coach.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { coachChat } from "./seeker-coach";
import type { LlmCredentials } from "./seeker-coach";

export const draftEntrySchema = z.object({
  title: z.string().min(4).max(160),
  provider: z.string().min(2).max(120),
  providerKind: z.enum(["seta", "tvet", "university", "open"]),
  cost: z.enum(["free", "subsidised", "paid"]),
  costNote: z.string().max(200).optional().nullable(),
  outcome: z.string().min(4).max(300),
  durationWeeks: z.number().int().min(1).max(260),
  unlocksSkills: z.array(z.string().min(1).max(80)).min(1).max(6),
  national: z.boolean(),
  /** The model must NOT invent URLs  null is honest; the admin adds a
   *  verified link (or leaves null) at review time. */
  url: z.null().or(z.literal("")).transform(() => null),
});
export type DraftEntry = z.infer<typeof draftEntrySchema>;

export type DraftCatalogResult =
  | { ok: true; drafted: number }
  | { ok: false; reason: string };

function systemPrompt(): string {
  return [
    "You curate a South African learning catalogue for job-seekers on a talent platform.",
    "For each requested skill, propose 1-2 realistic learning routes a South African can actually take.",
    "Prefer free and subsidised routes: SETA learnerships, TVET college programmes, recognised free online courses.",
    "NEVER invent URLs; set url to null. NEVER invent institutions, use real, well-known SA providers or major open platforms.",
    'Reply with ONLY a JSON object: {"entries":[{"title":string,"provider":string,"providerKind":"seta"|"tvet"|"university"|"open","cost":"free"|"subsidised"|"paid","costNote":string|null,"outcome":string,"durationWeeks":number,"unlocksSkills":string[],"national":boolean,"url":null}]}',
  ].join(" ");
}

export async function draftCatalogEntries(input: {
  skillSlugs: string[];
  callerUserId: string;
  callerRole: string;
}): Promise<DraftCatalogResult> {
  if (input.callerRole !== "admin") return { ok: false, reason: "not_admin" };
  const enabled = await getSetting<boolean>("feature_flag_llm_curriculum_enabled");
  if (!enabled) {
    return {
      ok: false,
      reason: "The LLM drafting switch is OFF (/admin/llm, curriculum family).",
    };
  }

  const db = getDb();
  const skills = await db
    .select({ slug: schema.skills.slug, label: schema.skills.label })
    .from(schema.skills);
  const bySlug = new Map(skills.map((s) => [s.slug, s.label]));
  const labels = input.skillSlugs
    .map((s) => bySlug.get(s))
    .filter((l): l is string => Boolean(l));
  if (labels.length === 0) return { ok: false, reason: "No valid skills chosen." };

  const [active] = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);
  if (!active) return { ok: false, reason: "No active LLM provider (/admin/llm)." };
  if (!active.credentialsEnc) return { ok: false, reason: "Provider has no credentials." };
  let creds: LlmCredentials;
  try {
    creds = JSON.parse(decryptField(active.credentialsEnc));
  } catch {
    return { ok: false, reason: "Provider credentials could not be decrypted." };
  }
  const spentZar = Number(active.totalSpendZar ?? 0);
  if (active.monthlyBudgetZar <= 0 || spentZar >= active.monthlyBudgetZar) {
    return { ok: false, reason: "Provider budget is exhausted for this month." };
  }

  let text: string;
  let tokenCount = 0;
  let estZarCost = 0;
  try {
    const res = await coachChat(
      active.id,
      creds,
      systemPrompt(),
      `Skills to cover: ${labels.join("; ")}. Return the JSON object only.`,
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

  // Parse + validate. Strip markdown fences the smaller models love.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim());
  } catch {
    return { ok: false, reason: "The model reply wasn't valid JSON  try again." };
  }
  const body = z.object({ entries: z.array(z.unknown()).max(12) }).safeParse(parsed);
  if (!body.success) return { ok: false, reason: "The model reply had no entries." };

  let drafted = 0;
  for (const raw of body.data.entries) {
    const entry = draftEntrySchema.safeParse(raw);
    if (!entry.success) continue; // hallucination guard: silently drop invalid rows
    await db.insert(schema.catalogDrafts).values({
      id: `cd_${randomUUID()}`,
      skillSlugs: input.skillSlugs,
      payload: entry.data as Record<string, unknown>,
      state: "pending",
      rawModel: creds.modelId,
      createdByUserId: input.callerUserId,
    });
    drafted += 1;
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

  await logAccess({
    kind: "catalog.draft",
    actor: input.callerUserId,
    subject: active.id,
    meta: { skills: labels, drafted, modelId: creds.modelId },
  });

  if (drafted === 0) {
    return { ok: false, reason: "The model produced no valid entries, try again." };
  }
  return { ok: true, drafted };
}
