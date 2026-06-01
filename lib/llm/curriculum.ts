/**
 * Phase 13.3  LLM-backed editorial curriculum-curation dispatcher.
 *
 * The single entry point for "ask an LLM to suggest skill mappings
 * for this module syllabus". Admin-only. Never user-facing.
 *
 * Six-gate dispatch (mirrors the SMS / WhatsApp gate posture in spirit
 * even though provider config is DB-driven, not env-driven):
 *
 *   1. A row exists in `llm_providers` with `active = true`.
 *   2. `credentials_enc` is non-null AND decrypts successfully.
 *   3. `monthly_budget_zar > 0` AND `total_spend_zar < monthly_budget_zar`.
 *   4. The caller has `admin` role on `appUser`.
 *   5. The platform flag `feature_flag_llm_curriculum_enabled` is ON.
 *   6. The request payload is syllabus / module text only  no PII.
 *
 * If any gate fails, the dispatcher writes `llm.curriculum.skipped` with
 * the reason and returns a clear error to the admin. ZERO SPEND until
 * all six are simultaneously true.
 *
 * Hallucination guard: the LLM is constrained at the system-prompt
 * layer to suggest only slugs that exist in `skills`. Any response slug
 * outside the controlled taxonomy is dropped silently (with an audit
 * row); we never let the LLM invent new tags.
 */

import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { callOpenAi } from "./providers/openai";
import { callAnthropic } from "./providers/anthropic";
import { callMistral } from "./providers/mistral";
import { callSelfHosted } from "./providers/self-hosted";
import type { LlmProviderCall, LlmProviderResponse } from "./types";

export type LlmGate =
  | "no_active"
  | "kill_switch"
  | "no_credentials"
  | "budget_exhausted"
  | "budget_zero"
  | "not_admin"
  | "payload_unsafe";

export type SuggestModuleSkillsInput = {
  callerUserId: string;
  callerRole: "admin" | "moderator" | "seeker" | "employer" | "gov" | string;
  syllabusText: string;
  /** Optional module label hint; the LLM is prompted to attribute the
   *  skills to this label so the queue row reads naturally. */
  moduleLabel?: string;
  /** Optional institution scope. NULL = canonical cross-institution. */
  institutionSlug?: string | null;
};

export type SuggestedRow = {
  moduleSlug: string;
  moduleLabel: string;
  skillSlug: string;
  confidence: number;
  rationale: string;
};

export type SuggestModuleSkillsResult =
  | {
      ok: true;
      providerId: string;
      modelId: string;
      tokenCount: number;
      estZarCost: number;
      suggestions: SuggestedRow[];
      droppedHallucinations: string[];
    }
  | {
      ok: false;
      reason: LlmGate | "failed";
      detail?: string;
    };

/**
 * Public entry. Runs all six gates, then dispatches to the active
 * provider, then filters hallucinations against the controlled
 * taxonomy. Writes one audit row per terminal outcome.
 */
export async function suggestModuleSkills(
  input: SuggestModuleSkillsInput,
): Promise<SuggestModuleSkillsResult> {
  const db = getDb();
  const syllabusSha256 = sha256(input.syllabusText);

  // Gate 4  caller is admin.
  if (input.callerRole !== "admin") {
    await skip(
      input.callerUserId,
      "not_admin",
      syllabusSha256,
      "n/a",
    );
    return { ok: false, reason: "not_admin" };
  }

  // Gate 5  kill-switch above the DB-stored config.
  const enabled = await getSetting<boolean>(
    "feature_flag_llm_curriculum_enabled",
  );
  if (!enabled) {
    await skip(
      input.callerUserId,
      "kill_switch",
      syllabusSha256,
      "n/a",
    );
    return { ok: false, reason: "kill_switch" };
  }

  // Gate 6  the request payload is syllabus / module text only,
  // never seeker PII. We can't statically prove the negative, but
  // we can refuse obvious markers (RSA-ID-shaped 13-digit strings,
  // email addresses, phone-number-shaped strings). The admin UI
  // makes the same check client-side; this is the server backstop.
  if (looksLikePii(input.syllabusText)) {
    await skip(
      input.callerUserId,
      "payload_unsafe",
      syllabusSha256,
      "n/a",
    );
    return { ok: false, reason: "payload_unsafe" };
  }

  // Gate 1  there is an active provider.
  const active = await getActiveLlmProvider();
  if (!active) {
    await skip(
      input.callerUserId,
      "no_active",
      syllabusSha256,
      "n/a",
    );
    return { ok: false, reason: "no_active" };
  }

  // Gate 2  credentials present + decrypt successfully.
  let creds: LlmCredentials;
  if (!active.credentialsEnc) {
    await skip(
      input.callerUserId,
      "no_credentials",
      syllabusSha256,
      active.id,
    );
    return { ok: false, reason: "no_credentials" };
  }
  try {
    creds = JSON.parse(decryptField(active.credentialsEnc));
  } catch {
    await skip(
      input.callerUserId,
      "no_credentials",
      syllabusSha256,
      active.id,
    );
    return { ok: false, reason: "no_credentials" };
  }

  // Gate 3  budget configured + not exhausted.
  if (active.monthlyBudgetZar <= 0) {
    await skip(
      input.callerUserId,
      "budget_zero",
      syllabusSha256,
      active.id,
    );
    return { ok: false, reason: "budget_zero" };
  }
  const spentZar = Number(active.totalSpendZar ?? 0);
  if (spentZar >= active.monthlyBudgetZar) {
    await skip(
      input.callerUserId,
      "budget_exhausted",
      syllabusSha256,
      active.id,
    );
    return { ok: false, reason: "budget_exhausted" };
  }

  // All six gates open. Build the controlled-taxonomy slug set the
  // LLM is constrained to choose from.
  const validSlugs = await loadControlledTaxonomySlugs();

  const call: LlmProviderCall = {
    apiKey: creds.apiKey,
    modelId: creds.modelId,
    endpointUrl: creds.endpointUrl,
    extraHeaders: creds.extraHeaders,
    syllabusText: input.syllabusText,
    moduleLabel: input.moduleLabel ?? "(unspecified)",
    validSkillSlugs: Array.from(validSlugs),
  };

  let response: LlmProviderResponse;
  try {
    response = await dispatchToProvider(active.id, call);
  } catch (err) {
    await logAccess({
      kind: "llm.curriculum.failed",
      actor: input.callerUserId,
      subject: active.id,
      meta: {
        modelId: creds.modelId,
        errorCategory: classifyError(err),
        syllabusSha256,
      },
    });
    return {
      ok: false,
      reason: "failed",
      detail:
        err instanceof Error
          ? err.message
          : "Provider call failed.",
    };
  }

  // Hallucination guard: drop slugs not in the controlled taxonomy.
  const dropped: string[] = [];
  const accepted: SuggestedRow[] = [];
  for (const row of response.suggestions) {
    if (!validSlugs.has(row.skillSlug)) {
      dropped.push(row.skillSlug);
      continue;
    }
    accepted.push(row);
  }

  // Bump the provider counters in one update.
  await db
    .update(schema.llmProviders)
    .set({
      lastUsedAt: new Date(),
      totalCalls: active.totalCalls + 1,
      totalTokens: active.totalTokens + response.tokenCount,
      totalSpendZar: (spentZar + response.estZarCost).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(schema.llmProviders.id, active.id));

  // Audit row for the successful call.
  await logAccess({
    kind: "llm.curriculum.suggest",
    actor: input.callerUserId,
    subject: active.id,
    meta: {
      modelId: creds.modelId,
      tokenCount: response.tokenCount,
      suggestionCount: accepted.length,
      droppedHallucinationCount: dropped.length,
      estZarCost: response.estZarCost,
      syllabusSha256,
    },
  });

  // Budget-alert side-effect: if this call pushed us past 80%, fire
  // the alert audit row. The admin /admin/llm dashboard renders the
  // ledger and can show recent alert rows distinctly.
  const newSpend = spentZar + response.estZarCost;
  const alertThreshold = active.monthlyBudgetZar * 0.8;
  if (spentZar < alertThreshold && newSpend >= alertThreshold) {
    await logAccess({
      kind: "admin.llm.budget.alert",
      actor: "system",
      subject: active.id,
      meta: {
        spentZar: Number(newSpend.toFixed(2)),
        budgetZar: active.monthlyBudgetZar,
        percent: Math.round((newSpend / active.monthlyBudgetZar) * 100),
      },
    });
  }

  return {
    ok: true,
    providerId: active.id,
    modelId: creds.modelId,
    tokenCount: response.tokenCount,
    estZarCost: response.estZarCost,
    suggestions: accepted,
    droppedHallucinations: dropped,
  };
}

/**
 * Probe call. Used by the admin "Test" button. Skips the kill-switch
 * + budget gates  the point of the test is to verify creds before
 * either is set. Still requires admin role + an active row.
 */
export async function testActiveProvider(opts: {
  callerUserId: string;
  callerRole: string;
}): Promise<{ ok: true; latencyMs: number } | { ok: false; reason: string }> {
  if (opts.callerRole !== "admin") {
    return { ok: false, reason: "not_admin" };
  }
  const active = await getActiveLlmProvider();
  if (!active) return { ok: false, reason: "no_active" };
  if (!active.credentialsEnc) return { ok: false, reason: "no_credentials" };

  let creds: LlmCredentials;
  try {
    creds = JSON.parse(decryptField(active.credentialsEnc));
  } catch {
    return { ok: false, reason: "no_credentials" };
  }

  const probeCall: LlmProviderCall = {
    apiKey: creds.apiKey,
    modelId: creds.modelId,
    endpointUrl: creds.endpointUrl,
    extraHeaders: creds.extraHeaders,
    syllabusText: "respond with the literal string ok",
    moduleLabel: "probe",
    validSkillSlugs: [],
  };

  const t0 = performance.now();
  try {
    await dispatchToProvider(active.id, probeCall, { probe: true });
    const latencyMs = Math.round(performance.now() - t0);
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error ? classifyError(err) : "other",
    };
  }
}

// ─── internals ─────────────────────────────────────────────────────

type LlmCredentials = {
  apiKey: string;
  modelId: string;
  endpointUrl?: string;
  extraHeaders?: Record<string, string>;
};

async function getActiveLlmProvider() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);
  return rows[0] ?? null;
}

async function loadControlledTaxonomySlugs(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.select({ slug: schema.skills.slug }).from(schema.skills);
  return new Set(rows.map((r) => r.slug));
}

async function dispatchToProvider(
  providerId: string,
  call: LlmProviderCall,
  opts?: { probe?: boolean },
): Promise<LlmProviderResponse> {
  switch (providerId) {
    case "openai":
      return callOpenAi(call, opts);
    case "anthropic":
      return callAnthropic(call, opts);
    case "mistral":
      return callMistral(call, opts);
    case "self_hosted":
      return callSelfHosted(call, opts);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

async function skip(
  callerUserId: string,
  gate: LlmGate,
  syllabusSha256: string,
  providerId: string,
): Promise<void> {
  await logAccess({
    kind: "llm.curriculum.skipped",
    actor: callerUserId,
    subject: providerId,
    meta: { gate, syllabusSha256 },
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Refuse obvious PII markers in the syllabus payload. Not a complete
 * filter  defense-in-depth alongside the admin client-side check
 * and the audit trail. Returns true if the text looks like it might
 * carry PII we don't want crossing the provider boundary.
 */
function looksLikePii(text: string): boolean {
  // RSA ID number: 13 digits in a row.
  if (/\b\d{13}\b/.test(text)) return true;
  // Email-shaped.
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) return true;
  // SA phone-shaped: +27 + 9 digits OR 10 digits starting with 0.
  if (/\+27\d{9}\b/.test(text)) return true;
  if (/\b0\d{9}\b/.test(text)) return true;
  return false;
}

function classifyError(
  err: unknown,
): "auth" | "network" | "rate_limit" | "other" {
  if (!(err instanceof Error)) return "other";
  const msg = err.message.toLowerCase();
  if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("invalid api key")) {
    return "auth";
  }
  if (msg.includes("429") || msg.includes("rate limit")) {
    return "rate_limit";
  }
  if (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound")
  ) {
    return "network";
  }
  return "other";
}
