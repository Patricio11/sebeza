/**
 * Phase 13.3  LLM provider adapter contract.
 *
 * Every provider exposes the same shape so the dispatcher in
 * curriculum.ts is provider-agnostic. The dispatcher passes a
 * controlled list of skill slugs the LLM is constrained to choose
 * from; the adapter is responsible for shoving that list into the
 * provider-specific system prompt.
 *
 * Adapters NEVER persist anything, NEVER call logAccess(), NEVER
 * read from the DB. They are pure stateless transports. Persistence
 * + audit lives in the dispatcher so the lifecycle stays in one place.
 */

export type LlmProviderCall = {
  apiKey: string;
  modelId: string;
  endpointUrl?: string;
  extraHeaders?: Record<string, string>;
  /** The syllabus or module text the admin pasted. Generic
   *  academic text; never seeker PII (Gate 6 in the dispatcher
   *  enforces this before we reach the adapter). */
  syllabusText: string;
  moduleLabel: string;
  /** Skills the LLM is allowed to suggest. The adapter shoves
   *  this into the system prompt; the dispatcher additionally
   *  filters the response so a misbehaving provider can't sneak
   *  hallucinations through. */
  validSkillSlugs: string[];
};

export type LlmProviderSuggestion = {
  moduleSlug: string;
  moduleLabel: string;
  skillSlug: string;
  /** 1..5. The dispatcher clamps to this range. */
  confidence: number;
  /** One-sentence rationale shown to the admin in the queue. */
  rationale: string;
};

export type LlmProviderResponse = {
  suggestions: LlmProviderSuggestion[];
  /** Total input + output token count for spend accounting. */
  tokenCount: number;
  /** Provider-reported (or adapter-estimated) ZAR cost for this call. */
  estZarCost: number;
};

export type LlmProviderAdapterOpts = {
  /** When true, the call is a probe: bypass response parsing +
   *  return immediately on a 200. The dispatcher's testActiveProvider
   *  sets this. */
  probe?: boolean;
};
