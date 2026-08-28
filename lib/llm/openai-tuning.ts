/**
 * Generation parameters for OpenAI-compatible chat completions, per
 * provider and model family. Pure, so it is unit-tested and shared by the
 * curriculum adapter and the coach transport.
 *
 * Why: OpenAI's newer families (gpt-5*, o-series) reject `max_tokens`
 * ("use max_completion_tokens") and reject any non-default `temperature`.
 * With the founder's model set to gpt-5.4-mini every call the app made
 * returned 400, even with credit on the account. Mistral and self-hosted
 * OpenAI-compatible servers still speak `max_tokens`.
 */

export type OpenAiCompatibleProvider =
  "openai" | "mistral" | "self_hosted" | string;

export interface GenerationParams {
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
}

/** Families that only accept the default temperature. */
export function isReasoningFamily(modelId: string): boolean {
  return /^(gpt-5|o[1-9])/i.test(modelId.trim());
}

export function generationParams(
  providerId: OpenAiCompatibleProvider,
  modelId: string,
  opts: { maxOutput: number; temperature?: number },
): GenerationParams {
  const out: GenerationParams = {};
  if (providerId === "openai") {
    out.max_completion_tokens = opts.maxOutput;
    if (opts.temperature !== undefined && !isReasoningFamily(modelId)) {
      out.temperature = opts.temperature;
    }
  } else {
    out.max_tokens = opts.maxOutput;
    if (opts.temperature !== undefined) out.temperature = opts.temperature;
  }
  return out;
}
