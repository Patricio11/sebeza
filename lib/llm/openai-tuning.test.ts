import { describe, expect, test } from "vitest";

import { generationParams, isReasoningFamily } from "./openai-tuning";

describe("OpenAI-compatible generation params", () => {
  test("gpt-5 and o-series: max_completion_tokens, no temperature", () => {
    expect(
      generationParams("openai", "gpt-5.4-mini", {
        maxOutput: 1024,
        temperature: 0.4,
      }),
    ).toEqual({
      max_completion_tokens: 1024,
    });
    expect(
      generationParams("openai", "o3-mini", { maxOutput: 1, temperature: 0 }),
    ).toEqual({
      max_completion_tokens: 1,
    });
  });

  test("gpt-4 family on OpenAI keeps temperature but uses max_completion_tokens", () => {
    expect(
      generationParams("openai", "gpt-4o-mini", {
        maxOutput: 800,
        temperature: 0,
      }),
    ).toEqual({
      max_completion_tokens: 800,
      temperature: 0,
    });
  });

  test("mistral and self-hosted keep max_tokens + temperature", () => {
    expect(
      generationParams("mistral", "mistral-small-latest", {
        maxOutput: 1024,
        temperature: 0.4,
      }),
    ).toEqual({
      max_tokens: 1024,
      temperature: 0.4,
    });
    expect(
      generationParams("self_hosted", "llama-3.1-8b", {
        maxOutput: 800,
        temperature: 0,
      }),
    ).toEqual({
      max_tokens: 800,
      temperature: 0,
    });
  });

  test("family detection", () => {
    expect(isReasoningFamily("gpt-5.4-mini")).toBe(true);
    expect(isReasoningFamily("GPT-5")).toBe(true);
    expect(isReasoningFamily("o1")).toBe(true);
    expect(isReasoningFamily("gpt-4.1-mini")).toBe(false);
    expect(isReasoningFamily("gpt-4o")).toBe(false);
  });
});
