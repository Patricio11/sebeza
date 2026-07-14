/**
 * Phase 17 ("AI Career Coach", flag-gated)  seeker-facing LLM dispatcher.
 *
 * Reuses the Phase 13.3 LLM infrastructure (the admin-configured, encrypted,
 * budgeted `llm_providers` row) with the SAME multi-gate posture the curriculum
 * dispatcher uses  zero spend until every gate is open:
 *   1. `feature_flag_seeker_ai_coach` is ON (the surface switch).
 *   2. There is an active provider with decryptable credentials.
 *   3. `monthly_budget_zar > 0` AND `total_spend_zar < monthly_budget_zar`.
 *   4. The payload carries no obvious PII (only the seeker's profession + skills
 *      + a target-role title  never name / ID / contact).
 *
 * v1 capability: interview practice (a handful of realistic, role-tailored
 * questions). No "guaranteed job" framing  practice, not an outcome. The
 * audit row records token/cost, never the prompt text.
 */

import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { moderateQuestions, detectDistress } from "@/lib/llm/coach-safety";
import { enforce } from "@/lib/rate-limit";
import {
  listActiveCrisisResources,
  type CrisisResource,
} from "@/db/queries/crisis-resources";

export type CoachSkipReason =
  | "flag_off"
  | "no_provider"
  | "no_credentials"
  | "budget"
  | "payload_unsafe"
  | "failed"
  | "empty"
  // Phase 22.1/22.3  the model refused an out-of-scope / unsafe request (or
  // moderation stripped everything). Carries a short, kind redirect message.
  | "off_scope"
  // Phase 22.2  the pre-LLM distress screen fired. The provider was NOT called;
  // the result carries human crisis resources instead of questions.
  | "distress";

export type CoachResult =
  | { ok: true; questions: string[]; providerId: string }
  | { ok: false; reason: "off_scope"; message: string }
  | { ok: false; reason: "distress"; crisisResources: CrisisResource[] }
  | { ok: false; reason: Exclude<CoachSkipReason, "off_scope" | "distress"> };

export interface CoachInput {
  callerUserId: string;
  profession: string;
  skills: string[];
  roleTitle: string;
}

type LlmCredentials = {
  apiKey: string;
  modelId: string;
  endpointUrl?: string;
  extraHeaders?: Record<string, string>;
};

const MAX_QUESTIONS = 5;

export async function generateInterviewQuestions(
  input: CoachInput,
): Promise<CoachResult> {
  const db = getDb();

  // Gate 1  surface flag.
  const enabled = await getSetting<boolean>("feature_flag_seeker_ai_coach");
  if (!enabled) return skip(input.callerUserId, "flag_off", "n/a");

  // Phase 22.2  distress screen FIRST (before any provider interaction). A
  // person in crisis must reach human support regardless of provider/budget, so
  // this fires ahead of every other gate. The provider is NEVER called; we log
  // only that the path fired (a count), never the seeker's text.
  if (detectDistress(input.roleTitle)) {
    await logAccess({
      kind: "seeker.ai_coach.distress",
      actor: input.callerUserId,
      subject: "self",
      meta: {},
    });
    const crisisResources = await listActiveCrisisResources();
    return { ok: false, reason: "distress", crisisResources };
  }

  // Phase 26.2  per-user daily throttle (10/day). Placed AFTER the distress
  // screen on purpose: a person in crisis always reaches human support; only
  // provider-spending calls are throttled. Protects the shared monthly budget
  // from a single account looping the endpoint.
  const limit = await enforce("coach", input.callerUserId);
  if (!limit.ok) {
    return skip(input.callerUserId, "budget", "n/a");
  }

  // Gate 4  PII guard on the only free-text field (the role title).
  if (looksLikePii(input.roleTitle)) {
    return skip(input.callerUserId, "payload_unsafe", "n/a");
  }

  // Gate 2  active provider + credentials.
  const rows = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);
  const active = rows[0];
  if (!active) return skip(input.callerUserId, "no_provider", "n/a");
  if (!active.credentialsEnc) {
    return skip(input.callerUserId, "no_credentials", active.id);
  }
  let creds: LlmCredentials;
  try {
    creds = JSON.parse(decryptField(active.credentialsEnc));
  } catch {
    return skip(input.callerUserId, "no_credentials", active.id);
  }

  // Gate 3  budget configured + not exhausted (shared pool with curriculum).
  const spentZar = Number(active.totalSpendZar ?? 0);
  if (active.monthlyBudgetZar <= 0 || spentZar >= active.monthlyBudgetZar) {
    return skip(input.callerUserId, "budget", active.id);
  }

  // All gates open  dispatch.
  let result: { text: string; tokenCount: number; estZarCost: number };
  try {
    result = await coachChat(
      active.id,
      creds,
      coachSystemPrompt(),
      coachUserPrompt(input),
    );
  } catch {
    await logAccess({
      kind: "seeker.ai_coach.skipped",
      actor: input.callerUserId,
      subject: active.id,
      meta: { gate: "failed", modelId: creds.modelId },
    });
    return { ok: false, reason: "failed" };
  }

  // The call happened + incurred cost regardless of what came back  bump the
  // provider counters + audit the call (token/cost only, never the prompt).
  await db
    .update(schema.llmProviders)
    .set({
      lastUsedAt: new Date(),
      totalCalls: active.totalCalls + 1,
      totalTokens: active.totalTokens + result.tokenCount,
      totalSpendZar: (spentZar + result.estZarCost).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(schema.llmProviders.id, active.id));

  await logAccess({
    kind: "seeker.ai_coach.call",
    actor: input.callerUserId,
    subject: active.id,
    meta: {
      modelId: creds.modelId,
      tokenCount: result.tokenCount,
      estZarCost: result.estZarCost,
    },
  });

  // Phase 22.1  the model may return a structured refusal for an out-of-scope
  // or unsafe request. Honour it (don't try to coerce it into questions).
  const parsed = parseCoachOutput(result.text);
  if (parsed.kind === "refusal") {
    return { ok: false, reason: "off_scope", message: parsed.message };
  }

  // Phase 22.3  moderation backstop: drop any question that slipped past the
  // prompt into a promise / outcome claim / contact detail.
  const { kept, droppedCount } = moderateQuestions(parsed.questions);
  if (droppedCount > 0) {
    await logAccess({
      kind: "seeker.ai_coach.moderation_drop",
      actor: input.callerUserId,
      subject: active.id,
      meta: { droppedCount },
    });
  }
  if (kept.length === 0) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, questions: kept, providerId: active.id };
}

async function skip(
  callerUserId: string,
  reason: Exclude<CoachSkipReason, "off_scope" | "distress">,
  providerId: string,
): Promise<CoachResult> {
  await logAccess({
    kind: "seeker.ai_coach.skipped",
    actor: callerUserId,
    subject: providerId,
    meta: { gate: reason },
  });
  return { ok: false, reason };
}

// ── Prompts ────────────────────────────────────────────────────────────────

// Exported so a fixture test can guard against safety-drift (a refusal being
// silently removed). The prompt is the coach's first line of defence.
export function coachSystemPrompt(): string {
  return [
    "You are a calm, practical INTERVIEW-PRACTICE coach for South African job seekers on the platform Sebenza.",
    "Your ONLY job is to help them rehearse realistic job-interview questions. You are NOT a careers advisor, lawyer, financial advisor, doctor, or counsellor.",
    "",
    "STRICT RULES:",
    "- Stay strictly in scope: interview practice only.",
    "- REFUSE and gently redirect if asked for FINANCIAL, LEGAL, MEDICAL, or MENTAL-HEALTH advice. Never improvise such advice.",
    "- NEVER promise or imply a job, an interview, a callback, or any outcome. No pass/fail, no scoring, no 'you'll get this'.",
    "- Do NOT pretend to be a specific employer or recruiter, and do not include contact details, links, or phone numbers.",
    "- Plain language, fair and encouraging, in a South African workplace context. No trick questions.",
    "",
    "OUTPUT  respond with JSON ONLY, exactly one of these shapes:",
    `- In scope: { "questions": string[] }  with exactly ${MAX_QUESTIONS} interview-practice questions (a mix of behavioural, e.g. "tell me about a time…", and role-specific / technical).`,
    '- Out of scope or unsafe request: { "refusal": "<one short, kind sentence that redirects to interview practice>" }.',
  ].join("\n");
}

function coachUserPrompt(input: CoachInput): string {
  return [
    `Target role: ${input.roleTitle}`,
    `Candidate profession: ${input.profession}`,
    `Candidate skills: ${input.skills.join(", ") || "(none listed)"}`,
  ].join("\n");
}

type CoachOutput =
  | { kind: "questions"; questions: string[] }
  | { kind: "refusal"; message: string };

function parseCoachOutput(raw: string): CoachOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "questions", questions: [] };
  }
  const obj = parsed as { questions?: unknown; refusal?: unknown };

  // A structured refusal takes precedence.
  if (typeof obj?.refusal === "string" && obj.refusal.trim().length > 0) {
    return { kind: "refusal", message: obj.refusal.trim().slice(0, 240) };
  }

  const arr = obj?.questions;
  if (!Array.isArray(arr)) {
    return { kind: "questions", questions: [] };
  }
  const questions = arr
    .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    .map((q) => q.trim().slice(0, 400))
    .slice(0, MAX_QUESTIONS);
  return { kind: "questions", questions };
}

// ── Generic chat (reuses the configured provider creds) ──────────────────────

const ZAR_PER_INPUT_TOKEN = 0.001;
const ZAR_PER_OUTPUT_TOKEN = 0.004;

async function coachChat(
  providerId: string,
  creds: LlmCredentials,
  system: string,
  user: string,
): Promise<{ text: string; tokenCount: number; estZarCost: number }> {
  if (providerId === "anthropic") {
    const url = creds.endpointUrl?.trim() || "https://api.anthropic.com/v1/messages";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": creds.apiKey,
        "anthropic-version": "2023-06-01",
        ...(creds.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: creds.modelId,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const json = (await res.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = json.content?.[0]?.text ?? "";
    const inT = json.usage?.input_tokens ?? 0;
    const outT = json.usage?.output_tokens ?? 0;
    return {
      text,
      tokenCount: inT + outT,
      estZarCost: inT * ZAR_PER_INPUT_TOKEN + outT * ZAR_PER_OUTPUT_TOKEN,
    };
  }

  // OpenAI-compatible chat completions (openai / mistral / self_hosted).
  const defaultUrl =
    providerId === "mistral"
      ? "https://api.mistral.ai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const url = creds.endpointUrl?.trim() || defaultUrl;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${creds.apiKey}`,
      ...(creds.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: creds.modelId,
      temperature: 0.4,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${providerId} ${res.status}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const inT = json.usage?.prompt_tokens ?? 0;
  const outT = json.usage?.completion_tokens ?? 0;
  return {
    text,
    tokenCount: inT + outT,
    estZarCost: inT * ZAR_PER_INPUT_TOKEN + outT * ZAR_PER_OUTPUT_TOKEN,
  };
}

/** Refuse obvious PII markers before the payload crosses the provider boundary. */
function looksLikePii(text: string): boolean {
  if (/\b\d{13}\b/.test(text)) return true; // RSA ID
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) return true;
  if (/\+27\d{9}\b/.test(text)) return true;
  if (/\b0\d{9}\b/.test(text)) return true;
  return false;
}
