/**
 * Phase 13.3  Self-hosted (POPIA-clean) LLM adapter.
 *
 * The recommended path. The platform owner runs an OpenAI-compatible
 * inference server inside the af-south-1 (Cape Town) Postgres
 * residency boundary  vLLM, Ollama, Text-Generation-Inference, or
 * similar  and exposes the standard `/v1/chat/completions` endpoint.
 * No cross-border processing, no s.72 acknowledgement, no per-call
 * vendor invoice. ZAR cost stays at zero for spend-accounting
 * purposes because the inference cost is part of the fixed infra
 * spend; the `total_spend_zar` counter stays nominal.
 *
 * `endpointUrl` is REQUIRED for this adapter  there is no sensible
 * default. The admin enters the URL in the configure flow.
 */

import "server-only";
import type {
  LlmProviderAdapterOpts,
  LlmProviderCall,
  LlmProviderResponse,
  LlmProviderSuggestion,
} from "../types";

// Self-hosted is free at the per-call level (fixed infra cost). We
// still log a token count for the admin dashboard.
const ZAR_PER_TOKEN = 0;

export async function callSelfHosted(
  call: LlmProviderCall,
  opts?: LlmProviderAdapterOpts,
): Promise<LlmProviderResponse> {
  if (!call.endpointUrl?.trim()) {
    throw new Error(
      "self_hosted requires endpointUrl  configure on /admin/llm.",
    );
  }
  const body = {
    model: call.modelId,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt(call.validSkillSlugs) },
      { role: "user", content: userPrompt(call) },
    ],
  };

  const res = await fetch(call.endpointUrl.trim(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Self-hosted servers typically use a shared-secret bearer
      // rather than per-vendor key. The admin can leave apiKey
      // empty if the endpoint is on a private network.
      ...(call.apiKey ? { authorization: `Bearer ${call.apiKey}` } : {}),
      ...(call.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`self_hosted ${res.status}: ${await safeText(res)}`);
  }
  if (opts?.probe) {
    return { suggestions: [], tokenCount: 0, estZarCost: 0 };
  }

  const json = (await res.json()) as SelfHostedResponseShape;
  const text = json.choices?.[0]?.message?.content ?? "";
  const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  const tokenCount = usage.prompt_tokens + usage.completion_tokens;
  const estZarCost = tokenCount * ZAR_PER_TOKEN;

  const suggestions = parseSuggestions(text, call.moduleLabel);
  return { suggestions, tokenCount, estZarCost };
}

function systemPrompt(validSkillSlugs: string[]): string {
  return [
    "You are an editorial assistant for the South African talent platform Sebenza.",
    "Suggest which canonical skill slugs the given module syllabus teaches.",
    "STRICT CONSTRAINTS:",
    "- Only use slugs from the provided taxonomy. Inventing slugs is forbidden.",
    "- Respond ONLY with valid JSON: { \"suggestions\": [{ \"skillSlug\": string, \"confidence\": 1-5, \"rationale\": string }] }.",
    "- 'confidence': 5 = central, 1 = touched briefly.",
    "- 'rationale': one short sentence (<= 25 words).",
    "- If nothing applies, return { \"suggestions\": [] }.",
    "",
    "Valid skill slugs:",
    validSkillSlugs.join(", "),
  ].join("\n");
}

function userPrompt(call: LlmProviderCall): string {
  return [
    `Module label: ${call.moduleLabel}`,
    "Syllabus / module description:",
    call.syllabusText,
  ].join("\n\n");
}

function parseSuggestions(
  raw: string,
  moduleLabel: string,
): LlmProviderSuggestion[] {
  // Some open-source servers wrap JSON in code fences despite the
  // instructions. Strip them defensively.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const arr = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(arr)) return [];
  const moduleSlug = slugify(moduleLabel);
  return arr
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      moduleSlug,
      moduleLabel,
      skillSlug: String(s.skillSlug ?? "").trim(),
      confidence: clamp(Math.round(Number(s.confidence ?? 3)), 1, 5),
      rationale: String(s.rationale ?? "").trim().slice(0, 240),
    }))
    .filter((s) => s.skillSlug.length > 0);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return "(no body)";
  }
}

type SelfHostedResponseShape = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};
