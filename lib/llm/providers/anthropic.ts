/**
 * Phase 13.3  Anthropic Messages API adapter.
 *
 * Cross-border processing: Anthropic is a US processor. The admin
 * configure flow on /admin/llm gates configuration behind an
 * explicit POPIA s.72 acknowledgement before the credentials land.
 * Self-hosted remains the POPIA-clean recommended path.
 *
 * Rough cost model: 4 ZAR per 1,000 input + 20 ZAR per 1,000 output
 * tokens at Claude Sonnet scale. Tune against actual invoices.
 */

import "server-only";
import type {
  LlmProviderAdapterOpts,
  LlmProviderCall,
  LlmProviderResponse,
  LlmProviderSuggestion,
} from "../types";

const ANTHROPIC_DEFAULT_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ZAR_PER_INPUT_TOKEN = 0.004;
const ZAR_PER_OUTPUT_TOKEN = 0.02;

export async function callAnthropic(
  call: LlmProviderCall,
  opts?: LlmProviderAdapterOpts,
): Promise<LlmProviderResponse> {
  const url = call.endpointUrl?.trim() || ANTHROPIC_DEFAULT_URL;
  const body = {
    model: call.modelId,
    max_tokens: 1024,
    temperature: 0,
    system: systemPrompt(call.validSkillSlugs),
    messages: [
      { role: "user" as const, content: userPrompt(call) },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": call.apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      ...(call.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await safeText(res)}`);
  }
  if (opts?.probe) {
    return { suggestions: [], tokenCount: 0, estZarCost: 0 };
  }

  const json = (await res.json()) as AnthropicResponseShape;
  const text = json.content?.[0]?.text ?? "";
  const usage = json.usage ?? { input_tokens: 0, output_tokens: 0 };
  const tokenCount = usage.input_tokens + usage.output_tokens;
  const estZarCost =
    usage.input_tokens * ZAR_PER_INPUT_TOKEN +
    usage.output_tokens * ZAR_PER_OUTPUT_TOKEN;

  const suggestions = parseSuggestions(text, call.moduleLabel);
  return { suggestions, tokenCount, estZarCost };
}

function systemPrompt(validSkillSlugs: string[]): string {
  return [
    "You are an editorial assistant for the South African talent platform Sebenza.",
    "Your task: given a module syllabus, suggest which canonical skill slugs the module teaches.",
    "STRICT CONSTRAINTS:",
    "- You may ONLY use slugs from the provided taxonomy. Inventing a new slug is forbidden.",
    "- Respond ONLY with valid JSON of the shape: { \"suggestions\": [{ \"skillSlug\": string, \"confidence\": 1-5, \"rationale\": string }] }.",
    "- No prose around the JSON; the receiver parses your entire reply as JSON.",
    "- 'confidence': 5 = central to the module, 1 = touched only briefly.",
    "- 'rationale': one sentence, <= 25 words.",
    "- If no listed slug applies, return { \"suggestions\": [] }.",
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
  // Strip code fences if the model surrounded the JSON despite the
  // instructions.
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

type AnthropicResponseShape = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
};
