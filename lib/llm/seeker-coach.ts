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

export type CoachSkipReason =
  | "flag_off"
  | "no_provider"
  | "no_credentials"
  | "budget"
  | "payload_unsafe"
  | "failed"
  | "empty";

export type CoachResult =
  | { ok: true; questions: string[]; providerId: string }
  | { ok: false; reason: CoachSkipReason };

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

  const questions = parseQuestions(result.text);
  if (questions.length === 0) {
    return { ok: false, reason: "empty" };
  }

  // Bump provider counters + audit (token/cost only, never the prompt).
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
      questionCount: questions.length,
    },
  });

  return { ok: true, questions, providerId: active.id };
}

async function skip(
  callerUserId: string,
  reason: CoachSkipReason,
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

function coachSystemPrompt(): string {
  return [
    "You are a calm, practical interview coach for South African job seekers on the platform Sebenza.",
    "Given a target role plus the candidate's profession and skills, write realistic interview questions so they can practise.",
    "Rules:",
    `- Exactly ${MAX_QUESTIONS} questions: a mix of behavioural ("tell me about a time…") and role-specific / technical.`,
    "- Grounded and fair, in a South African workplace context. No trick questions.",
    "- NEVER promise a job, an interview, or any outcome. This is practice, not a guarantee.",
    '- Respond ONLY as JSON of the shape: { "questions": string[] }.',
  ].join("\n");
}

function coachUserPrompt(input: CoachInput): string {
  return [
    `Target role: ${input.roleTitle}`,
    `Candidate profession: ${input.profession}`,
    `Candidate skills: ${input.skills.join(", ") || "(none listed)"}`,
  ].join("\n");
}

function parseQuestions(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const arr = (parsed as { questions?: unknown })?.questions;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    .map((q) => q.trim().slice(0, 400))
    .slice(0, MAX_QUESTIONS);
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
