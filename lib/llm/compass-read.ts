/**
 * 2026-08-19  "Coach's read": the AI narrates the seeker's OWN compass
 * data. NO user free-text ever reaches this path (the distress-screen
 * problem cannot occur by construction); the payload is pseudonymous
 * (profession, skills, demand numbers, catalogue titles  never name /
 * contact / ID). Rides the COACH safety family: same flag
 * (`feature_flag_seeker_ai_coach`, ack-gated on /admin/llm), same
 * provider + budget gates, same per-user daily throttle, plus an
 * output-moderation backstop (no promises, no invented links).
 *
 * Cached in `compass_reads` keyed by a hash of the inputs  one provider
 * call per real data change, not per visit.
 */

import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { enforce } from "@/lib/rate-limit";
import { coachChat, type LlmCredentials } from "./seeker-coach";

export interface CompassReadInput {
  callerUserId: string;
  profileId: string;
  profession: string;
  province: string;
  /** [label, proficiency 1..5] pairs for skills already held. */
  skills: Array<[string, number]>;
  /** Recommended-gap skills with their blended demand-signal counts. */
  gaps: Array<[string, number]>;
  demandBasis: "local" | "national";
  /** Top matched learning paths: [title, provider, cost, weeks]. */
  paths: Array<[string, string, string, number]>;
  rank: { current: number; projected: number } | null;
}

export type CompassRead = {
  headline: string;
  body: string;
  caveat: string;
  cached: boolean;
};

export type CompassReadResult =
  | { ok: true; read: CompassRead }
  | { ok: false; reason: string };

const readSchema = z.object({
  headline: z.string().min(8).max(120),
  body: z.string().min(40).max(900),
  caveat: z.string().min(8).max(240),
});

/** Deterministic hash of everything the narrative depends on. */
export function compassInputHash(input: CompassReadInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.profession,
        input.province,
        input.skills,
        input.gaps,
        input.demandBasis,
        input.paths,
        input.rank,
      ]),
    )
    .digest("hex")
    .slice(0, 32);
}

function systemPrompt(): string {
  return [
    "You are a supportive, honest career coach on a South African talent platform, writing a short read of ONE job-seeker's live data.",
    "HARD RULES:",
    "1. Reference ONLY the skills, numbers, courses and providers given. Never invent employers, courses, links, salaries or statistics.",
    "2. Never promise outcomes. No 'you will get hired', no 'guaranteed'. Learning improves visibility; it is not a job promise.",
    "3. Plain, warm English a second-language reader follows easily. Short sentences. No jargon, no URLs, no contact details.",
    "4. If demandBasis is 'national', say the picture is national because there isn't enough local employer activity yet.",
    "5. The word 'South Africa' stays in English exactly as written.",
    'Reply with ONLY a JSON object: {"headline": string (<=120 chars, second person), "body": string (2-4 short paragraphs, <=120 words total), "caveat": string (one honest sentence about what this can and cannot promise)}',
  ].join("\n");
}

/** Output moderation: reject reads that slipped into promises or links. */
export function narrativeViolations(text: string): string[] {
  const hits: string[] = [];
  if (/https?:\/\/|www\./i.test(text)) hits.push("url");
  if (/guarantee|you will (get|be) (hired|employed|placed)|promise[sd]? (you )?a job/i.test(text)) {
    hits.push("promise");
  }
  if (/\b\d{10,}\b|@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) hits.push("contact");
  return hits;
}

export async function generateCompassRead(
  input: CompassReadInput,
): Promise<CompassReadResult> {
  const db = getDb();

  // Gate 1  the coach surface flag (ack-gated on /admin/llm).
  const enabled = await getSetting<boolean>("feature_flag_seeker_ai_coach");
  if (!enabled) return { ok: false, reason: "flag_off" };

  // Cache first: a hash match costs nothing.
  const hash = compassInputHash(input);
  const [cached] = await db
    .select()
    .from(schema.compassReads)
    .where(eq(schema.compassReads.profileId, input.profileId))
    .limit(1);
  if (cached && cached.inputHash === hash) {
    return {
      ok: true,
      read: {
        headline: cached.headline,
        body: cached.body,
        caveat: cached.caveat,
        cached: true,
      },
    };
  }

  // Gate 2  per-user daily throttle (shared "coach" bucket).
  const limit = await enforce("coach", input.callerUserId);
  if (!limit.ok) return { ok: false, reason: "throttled" };

  // Gates 3-4  active provider + credentials + budget.
  const [active] = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);
  if (!active?.credentialsEnc) return { ok: false, reason: "no_provider" };
  let creds: LlmCredentials;
  try {
    creds = JSON.parse(decryptField(active.credentialsEnc));
  } catch {
    return { ok: false, reason: "no_provider" };
  }
  const spentZar = Number(active.totalSpendZar ?? 0);
  if (active.monthlyBudgetZar <= 0 || spentZar >= active.monthlyBudgetZar) {
    return { ok: false, reason: "budget" };
  }

  const user = JSON.stringify({
    profession: input.profession,
    province: input.province,
    currentSkills: input.skills,
    gapSkillsWithDemandSignals: input.gaps,
    demandBasis: input.demandBasis,
    learningPaths: input.paths,
    rank: input.rank,
  });

  let text: string;
  let tokenCount = 0;
  let estZarCost = 0;
  try {
    const res = await coachChat(active.id, creds, systemPrompt(), user);
    text = res.text;
    tokenCount = res.tokenCount;
    estZarCost = res.estZarCost;
  } catch {
    return { ok: false, reason: "failed" };
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
    kind: "seeker.compass_read.call",
    actor: input.callerUserId,
    subject: active.id,
    meta: { modelId: creds.modelId, tokenCount, estZarCost },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim(),
    );
  } catch {
    return { ok: false, reason: "failed" };
  }
  const read = readSchema.safeParse(parsed);
  if (!read.success) return { ok: false, reason: "failed" };

  // Moderation backstop  a violating read is DROPPED, never shown.
  const violations = narrativeViolations(
    `${read.data.headline} ${read.data.body} ${read.data.caveat}`,
  );
  if (violations.length > 0) {
    await logAccess({
      kind: "seeker.compass_read.moderation_drop",
      actor: input.callerUserId,
      subject: active.id,
      meta: { violations },
    });
    return { ok: false, reason: "failed" };
  }

  await db
    .insert(schema.compassReads)
    .values({
      profileId: input.profileId,
      inputHash: hash,
      headline: read.data.headline,
      body: read.data.body,
      caveat: read.data.caveat,
      model: creds.modelId,
    })
    .onConflictDoUpdate({
      target: schema.compassReads.profileId,
      set: {
        inputHash: hash,
        headline: read.data.headline,
        body: read.data.body,
        caveat: read.data.caveat,
        model: creds.modelId,
        createdAt: new Date(),
      },
    });

  return { ok: true, read: { ...read.data, cached: false } };
}
