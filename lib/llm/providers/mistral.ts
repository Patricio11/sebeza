/**
 * Phase 13.3  Mistral Chat Completions adapter.
 *
 * Mistral hosts in the EU (la Plate-forme). The EU has POPIA-
 * equivalent data-protection regime (GDPR), so Mistral does NOT
 * trigger the cross-border s.72 acknowledgement gate that openai +
 * anthropic do  the configure flow on /admin/llm skips that step.
 *
 * Cost model: roughly 1 ZAR per 1,000 input + 3 ZAR per 1,000 output
 * tokens for mistral-small. Tune against actual invoices.
 */

import "server-only";
import type {
  LlmProviderAdapterOpts,
  LlmProviderCall,
  LlmProviderResponse,
  LlmProviderSuggestion,
} from "../types";

const MISTRAL_DEFAULT_URL = "https://api.mistral.ai/v1/chat/completions";
const ZAR_PER_INPUT_TOKEN = 0.001;
const ZAR_PER_OUTPUT_TOKEN = 0.003;

export async function callMistral(
  call: LlmProviderCall,
  opts?: LlmProviderAdapterOpts,
): Promise<LlmProviderResponse> {
  const url = call.endpointUrl?.trim() || MISTRAL_DEFAULT_URL;
  const body = {
    model: call.modelId,
    temperature: 0,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: systemPrompt(call.validSkillSlugs) },
      { role: "user", content: userPrompt(call) },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${call.apiKey}`,
      ...(call.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`mistral ${res.status}: ${await safeText(res)}`);
  }
  if (opts?.probe) {
    return { suggestions: [], tokenCount: 0, estZarCost: 0 };
  }

  const json = (await res.json()) as MistralResponseShape;
  const text = json.choices?.[0]?.message?.content ?? "";
  const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  const tokenCount = usage.prompt_tokens + usage.completion_tokens;
  const estZarCost =
    usage.prompt_tokens * ZAR_PER_INPUT_TOKEN +
    usage.completion_tokens * ZAR_PER_OUTPUT_TOKEN;

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
    "- 'rationale': one short sentence.",
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
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

type MistralResponseShape = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};
