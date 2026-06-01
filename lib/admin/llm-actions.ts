"use server";

/**
 * Phase 13.3  /admin/llm Server Actions.
 *
 * Provider lifecycle:
 *   configureLlmProvider   write the encrypted credential blob +
 *                          budget. Does NOT activate the row.
 *                          Cross-border providers (openai, anthropic)
 *                          require s.72 acknowledgement in the input.
 *   activateLlmProvider    atomically deactivate all rows + activate
 *                          the named row. The DB partial unique index
 *                          (llm_providers_one_active) is the safety net.
 *   deactivateAllLlmProviders   pause posture; nothing dispatches.
 *   testLlmProvider        send a probe call against the active row's
 *                          credentials  validates without spending.
 *   rotateLlmCredentials   re-encrypt + overwrite the credential blob;
 *                          separate audit kind from configure so the
 *                          ledger surfaces rotations distinctly.
 *
 * Every terminal action writes an audit row. Plaintext credentials
 * never leak  audit meta carries the last-4 fingerprint of the key
 * (SHA-256 of the full key, first 8 hex chars) so the auditor can
 * correlate rotations without seeing the secret.
 */

import { createHash } from "node:crypto";
import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { encryptField } from "@/lib/crypto";
import { logAccess } from "@/lib/audit";
import { verifyAdmin } from "@/lib/auth/dal";
import { testActiveProvider } from "@/lib/llm/curriculum";

export type LlmActionResult =
  | { ok: true; message?: string; latencyMs?: number }
  | { ok: false; message: string };

function ok(extra?: { message?: string; latencyMs?: number }): LlmActionResult {
  return { ok: true, ...(extra ?? {}) };
}
function fail(message: string): LlmActionResult {
  return { ok: false, message };
}

const PROVIDER_IDS = ["openai", "anthropic", "mistral", "self_hosted"] as const;
const CROSS_BORDER_PROVIDERS = new Set(["openai", "anthropic"]);

const configureSchema = z.object({
  providerId: z.enum(PROVIDER_IDS),
  apiKey: z.string().trim().min(1, "API key is required.").max(512),
  modelId: z.string().trim().min(1, "Model id is required.").max(120),
  endpointUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  extraHeaders: z
    .record(z.string(), z.string())
    .optional(),
  monthlyBudgetZar: z
    .number()
    .int()
    .min(0, "Budget cannot be negative.")
    .max(1_000_000, "Budget over R1,000,000 looks like a typo."),
  /** Mandatory true for openai + anthropic. The schema enforces the
   *  cross-product elsewhere. */
  s72Acknowledged: z.boolean().optional(),
});

export async function configureLlmProvider(
  input: z.infer<typeof configureSchema>,
): Promise<LlmActionResult> {
  const session = await verifyAdmin();
  const parsed = configureSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  // Cross-border POPIA s.72 acknowledgement guard.
  if (CROSS_BORDER_PROVIDERS.has(data.providerId) && !data.s72Acknowledged) {
    return fail(
      "Cross-border processing requires POPIA s.72 acknowledgement.",
    );
  }

  // Self-hosted requires an endpoint URL  there's no sensible
  // default for someone's private inference server.
  if (data.providerId === "self_hosted" && !data.endpointUrl) {
    return fail("Self-hosted requires an endpoint URL.");
  }

  const credentialBlob = JSON.stringify({
    apiKey: data.apiKey,
    modelId: data.modelId,
    endpointUrl: data.endpointUrl ?? undefined,
    extraHeaders: data.extraHeaders ?? undefined,
  });
  const credentialsEnc = encryptField(credentialBlob);

  const db = getDb();
  await db
    .update(schema.llmProviders)
    .set({
      credentialsEnc,
      monthlyBudgetZar: data.monthlyBudgetZar,
      configuredBy: session.id,
      configuredAt: new Date(),
      s72AcknowledgedAt: CROSS_BORDER_PROVIDERS.has(data.providerId)
        ? new Date()
        : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.llmProviders.id, data.providerId));

  await logAccess({
    kind: "admin.llm.provider.configured",
    actor: session.id,
    subject: data.providerId,
    meta: {
      modelId: data.modelId,
      monthlyBudgetZar: data.monthlyBudgetZar,
      s72Acknowledged: CROSS_BORDER_PROVIDERS.has(data.providerId),
      keyFingerprint: fingerprint(data.apiKey),
    },
  });

  revalidatePath("/admin/llm");
  return ok({ message: "Provider configured." });
}

const idOnlySchema = z.object({
  providerId: z.enum(PROVIDER_IDS),
});

export async function activateLlmProvider(
  input: z.infer<typeof idOnlySchema>,
): Promise<LlmActionResult> {
  const session = await verifyAdmin();
  const parsed = idOnlySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid provider id.");

  const db = getDb();

  // Refuse activation if credentials are not configured. The
  // dispatcher's Gate 2 would catch it later anyway, but failing
  // here gives the admin a clearer error.
  const row = await db
    .select({
      credentialsEnc: schema.llmProviders.credentialsEnc,
      monthlyBudgetZar: schema.llmProviders.monthlyBudgetZar,
    })
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.id, parsed.data.providerId))
    .limit(1);
  if (!row[0]?.credentialsEnc) {
    return fail("Configure the provider before activating.");
  }

  // Capture the currently-active id for the audit row.
  const priorActive = await db
    .select({ id: schema.llmProviders.id })
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);

  // Two writes inside a transaction: deactivate all OTHER rows,
  // then activate this one. The partial unique index is the safety
  // net  if the transaction races against another admin, the
  // second commit aborts with a constraint error rather than
  // silently double-activating.
  await db.transaction(async (tx) => {
    await tx
      .update(schema.llmProviders)
      .set({ active: false, updatedAt: new Date() })
      .where(ne(schema.llmProviders.id, parsed.data.providerId));
    await tx
      .update(schema.llmProviders)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(schema.llmProviders.id, parsed.data.providerId));
  });

  await logAccess({
    kind: "admin.llm.provider.activated",
    actor: session.id,
    subject: parsed.data.providerId,
    meta: {
      previousActiveProviderId: priorActive[0]?.id ?? null,
    },
  });

  revalidatePath("/admin/llm");
  revalidatePath("/admin/curriculum");
  return ok({ message: "Provider activated." });
}

export async function deactivateAllLlmProviders(): Promise<LlmActionResult> {
  const session = await verifyAdmin();
  const db = getDb();

  const prior = await db
    .select({ id: schema.llmProviders.id })
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);

  await db
    .update(schema.llmProviders)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(schema.llmProviders.active, true));

  await logAccess({
    kind: "admin.llm.provider.deactivated",
    actor: session.id,
    subject: prior[0]?.id ?? "n/a",
    meta: { reason: "admin_pause" },
  });

  revalidatePath("/admin/llm");
  revalidatePath("/admin/curriculum");
  return ok({ message: "All providers deactivated." });
}

export async function testLlmProvider(): Promise<LlmActionResult> {
  const session = await verifyAdmin();
  const result = await testActiveProvider({
    callerUserId: session.id,
    callerRole: "admin",
  });

  if (result.ok) {
    await logAccess({
      kind: "admin.llm.provider.tested",
      actor: session.id,
      subject: "active",
      meta: { ok: true, latencyMs: result.latencyMs },
    });
    return ok({
      message: `Provider responded in ${result.latencyMs} ms.`,
      latencyMs: result.latencyMs,
    });
  }

  await logAccess({
    kind: "admin.llm.provider.tested",
    actor: session.id,
    subject: "active",
    meta: { ok: false, errorCategory: result.reason },
  });
  return fail(`Test failed: ${result.reason}`);
}

const rotateSchema = z.object({
  providerId: z.enum(PROVIDER_IDS),
  newApiKey: z.string().trim().min(1, "New API key is required.").max(512),
});

export async function rotateLlmCredentials(
  input: z.infer<typeof rotateSchema>,
): Promise<LlmActionResult> {
  const session = await verifyAdmin();
  const parsed = rotateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const db = getDb();
  const row = await db
    .select({ credentialsEnc: schema.llmProviders.credentialsEnc })
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.id, parsed.data.providerId))
    .limit(1);
  if (!row[0]?.credentialsEnc) {
    return fail("Configure the provider before rotating credentials.");
  }

  // Decrypt to preserve the existing modelId / endpointUrl /
  // extraHeaders; only the apiKey changes on rotation.
  let existing: {
    apiKey: string;
    modelId: string;
    endpointUrl?: string;
    extraHeaders?: Record<string, string>;
  };
  try {
    const { decryptField } = await import("@/lib/crypto");
    existing = JSON.parse(decryptField(row[0].credentialsEnc));
  } catch {
    return fail(
      "Existing credentials could not be decrypted  reconfigure first.",
    );
  }

  const credentialsEnc = encryptField(
    JSON.stringify({
      apiKey: parsed.data.newApiKey,
      modelId: existing.modelId,
      endpointUrl: existing.endpointUrl,
      extraHeaders: existing.extraHeaders,
    }),
  );

  await db
    .update(schema.llmProviders)
    .set({ credentialsEnc, updatedAt: new Date() })
    .where(eq(schema.llmProviders.id, parsed.data.providerId));

  await logAccess({
    kind: "admin.llm.credentials.rotated",
    actor: session.id,
    subject: parsed.data.providerId,
    meta: { keyFingerprint: fingerprint(parsed.data.newApiKey) },
  });

  revalidatePath("/admin/llm");
  return ok({ message: "Credentials rotated." });
}

function fingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 8);
}
