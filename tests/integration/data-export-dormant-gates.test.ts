/**
 * Phase 12 (Task 12.2)  POPIA data export + the dormant-by-default gates.
 *
 * Data export (§23): the JSON dump must carry the national ID ONLY as
 * `v1.` ciphertext  never plaintext  and must audit-log the export.
 *
 * Dormant gates  the only "external integration" testing this phase does
 * (docs/PHASE_12_PLAN.md terminology note): no provider is ever called;
 * we prove the gates STAY CLOSED with the flags off, and that the inner
 * gates hold even when the platform flag is opened:
 *   - LLM six-gate dispatcher (13.3): non-admin / kill-switch / PII
 *     payload / no-active-provider all refuse in documented order.
 *   - Messaging dispatch (11.4.4): platform flag OFF refuses before any
 *     user data is read; with the flag on, the per-user channel gate
 *     still refuses for a user who never opted in.
 *   - KYC resolution: flag OFF always resolves the mock verifier.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";

const SEEKER = {
  id: "user_andile-z",
  role: "seeker" as const,
  email: "andile-z@example.co.za",
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => SEEKER),
    verifySession: vi.fn(async () => SEEKER),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import { GET as dataExport } from "@/app/api/dashboard/data-export/route";
import { suggestModuleSkills } from "@/lib/llm/curriculum";
import { dispatchMessage } from "@/lib/messaging/dispatch";
import { resolveIdentityVerifier } from "@/lib/kyc/provider";
import { mockIdentityVerifier } from "@/lib/kyc/mock";

const db = getDb();

async function setSetting(key: string, valueJson: string): Promise<void> {
  await db.execute(
    sql`INSERT INTO platform_settings (key, value) VALUES (${key}, ${valueJson}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = ${valueJson}::jsonb`,
  );
}

describe("POPIA §23 data export", () => {
  test("national ID appears ONLY as v1. ciphertext; export is audit-logged", async () => {
    const res = await dataExport();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const dump = JSON.stringify(body);

    // Nothing shaped like a raw 13-digit SA ID anywhere in the dump.
    expect(dump).not.toMatch(/\b\d{13}\b/);

    // If the seeded profile carries an encrypted ID, it must wear the
    // key-id prefix (same contract the id-encryption-mandatory
    // compliance assertion pins on the DB side).
    const encMatches = dump.match(/"nationalIdEnc":"([^"]+)"/g) ?? [];
    for (const m of encMatches) {
      expect(m).toContain('"nationalIdEnc":"v1.');
    }

    const audit = (await db.execute(
      sql`SELECT id FROM audit_log
          WHERE kind = 'account.data_export' AND actor = ${SEEKER.id}`,
    )) as unknown as { rows: Array<{ id: string }> };
    expect(audit.rows.length, "export must audit-log").toBeGreaterThan(0);
  });
});

describe("LLM six-gate dispatcher (13.3)  gates stay closed", () => {
  const base = {
    callerUserId: "user_admin",
    syllabusText: "Module CS101: data structures, algorithms, SQL basics.",
    moduleLabel: "CS101",
  };

  afterAll(async () => {
    await setSetting("feature_flag_llm_curriculum_enabled", "false");
  });

  test("non-admin caller refused before anything else", async () => {
    const res = await suggestModuleSkills({
      ...base,
      callerRole: "seeker",
    } as Parameters<typeof suggestModuleSkills>[0]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_admin");
  });

  test("kill-switch OFF refuses an admin", async () => {
    await setSetting("feature_flag_llm_curriculum_enabled", "false");
    const res = await suggestModuleSkills({
      ...base,
      callerRole: "admin",
    } as Parameters<typeof suggestModuleSkills>[0]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("kill_switch");
  });

  test("PII-shaped payload refused even with the kill-switch ON", async () => {
    await setSetting("feature_flag_llm_curriculum_enabled", "true");
    const res = await suggestModuleSkills({
      ...base,
      callerRole: "admin",
      syllabusText:
        "Student 9202204720082 enrolled; contact andile-z@example.co.za.",
    } as Parameters<typeof suggestModuleSkills>[0]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("payload_unsafe");
  });

  test("no active provider (seed default) refuses a clean admin request", async () => {
    await setSetting("feature_flag_llm_curriculum_enabled", "true");
    const res = await suggestModuleSkills({
      ...base,
      callerRole: "admin",
    } as Parameters<typeof suggestModuleSkills>[0]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("no_active");
  });

  test("every refusal above left an llm.curriculum.skipped audit trail", async () => {
    const audit = (await db.execute(
      sql`SELECT meta->>'gate' AS gate FROM audit_log WHERE kind = 'llm.curriculum.skipped'`,
    )) as unknown as { rows: Array<{ gate: string }> };
    const gates = audit.rows.map((r) => r.gate);
    for (const expected of [
      "not_admin",
      "kill_switch",
      "payload_unsafe",
      "no_active",
    ]) {
      expect(gates, `audit trail for gate ${expected}`).toContain(expected);
    }
  });
});

describe("messaging dispatch (11.4.4)  six gates", () => {
  afterAll(async () => {
    await setSetting("feature_flag_sms_channel_enabled", "false");
  });

  test("platform flag OFF refuses before any user data is read", async () => {
    await setSetting("feature_flag_sms_channel_enabled", "false");
    const res = await dispatchMessage({
      channel: "sms",
      userId: SEEKER.id,
      kind: "test",
      body: "phase12",
    } as Parameters<typeof dispatchMessage>[0]);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("platform_flag_off");
  });

  test("flag ON: the per-user channel gate still refuses a non-opted-in user", async () => {
    await setSetting("feature_flag_sms_channel_enabled", "true");
    // Neutralise quiet hours (start === end → window disabled) so the
    // fixture is deterministic regardless of wall-clock time.
    await setSetting("feature_flag_sms_quiet_hours_start", "0");
    await setSetting("feature_flag_sms_quiet_hours_end", "0");

    const res = await dispatchMessage({
      channel: "sms",
      userId: SEEKER.id,
      kind: "test",
      body: "phase12",
    } as Parameters<typeof dispatchMessage>[0]);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("channel_off_for_user");
  });
});

describe("KYC provider resolution  dormant path", () => {
  test("flag OFF resolves the mock verifier (admin-mediated path carries KYC)", async () => {
    const verifier = await resolveIdentityVerifier();
    expect(verifier).toBe(mockIdentityVerifier);
  });
});
