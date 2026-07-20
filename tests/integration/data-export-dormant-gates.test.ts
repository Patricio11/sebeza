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

describe("Phase 31  ID/passport COLLECTION gate (dormant by default)", () => {
  afterAll(async () => {
    // Restore the launch default so suite order never matters.
    await setSetting("feature_flag_id_verification_enabled", "false");
  });

  test("flag OFF (default): every collection endpoint refuses BEFORE validation", async () => {
    await setSetting("feature_flag_id_verification_enabled", "false");
    const { changeNationalId } = await import("@/lib/profile/actions");
    const { uploadIdDocument, submitMyIdForVerification } = await import(
      "@/lib/kyc/actions"
    );

    // Deliberately garbage inputs  the gate must refuse before the
    // validators even run (the endpoint doesn't execute, not "executes
    // then errors").
    const change = await changeNationalId({ idNumber: "0000000000000" });
    expect(change.ok).toBe(false);
    if (!change.ok) expect(change.message).toMatch(/disabled/i);

    const upload = await uploadIdDocument(new FormData());
    expect(upload.ok).toBe(false);
    if (!upload.ok) expect(upload.message).toMatch(/disabled/i);

    const submit = await submitMyIdForVerification();
    expect(submit.ok).toBe(false);
    if (!submit.ok) expect(submit.message).toMatch(/disabled/i);
  });

  test("removal is NEVER gated  erasing your own ID works with the flag OFF", async () => {
    await setSetting("feature_flag_id_verification_enabled", "false");
    const { removeNationalId } = await import("@/lib/profile/actions");
    const res = await removeNationalId();
    // Either it succeeds, or it fails for a non-gate reason  the
    // "disabled" refusal must never appear on a removal path.
    if (!res.ok) expect(res.message).not.toMatch(/disabled/i);
  });

  test("flag ON: the gate opens and ordinary validation takes over", async () => {
    await setSetting("feature_flag_id_verification_enabled", "true");
    const { changeNationalId } = await import("@/lib/profile/actions");
    const res = await changeNationalId({ idNumber: "0000000000000" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Refused by the SA-ID checksum validator now, NOT the gate.
      expect(res.message).not.toMatch(/disabled/i);
    }
  });

  test("(b)+(e): nationality analytics emit ONLY the two classes — never a raw country label", async () => {
    // Phase 31 plan assertions (b) + (e): the analytics derive
    // nationality_class from `is_citizen` in SQL and must never surface
    // a raw country label in any cell or export row.
    const { supplyByNationalityQuery, statusMixByNationalityQuery } =
      await import("@/db/queries/nationality");
    const supply = await supplyByNationalityQuery();
    const status = await statusMixByNationalityQuery();

    const classes = [
      ...supply.cells.map((c) => c.nationality_class),
      ...status.cells.map((c) => c.nationality_class),
    ];
    // The k=10 suppression may legitimately leave ZERO cells on the small
    // seeded DB — that's the k-anonymity guarantee doing its job, so we
    // assert over whatever survives rather than demanding survivors.
    for (const c of classes) {
      expect(["sa_citizen", "foreign_national"]).toContain(c);
    }
    // Belt-and-braces: no country-label string anywhere in either payload
    // (the seed stores labels like "South African" / "Zimbabwean" on the
    // legacy display column — they must never reach the analytics shape).
    const dump = JSON.stringify({ supply, status });
    expect(dump).not.toMatch(/South African|Zimbabwean|Nigerian|Mozambican|Congolese/);
  });

  test("structural guard: no granular immigration-status field exists anywhere", async () => {
    // Phase 31 scope discipline: the system uses TWO classes
    // (is_citizen), nothing finer. Asylum/refugee/permit/PR capture is
    // sensitive, unused, and explicitly out of scope  this guard makes
    // quiet scope-creep a failing test.
    const { getTableColumns } = await import("drizzle-orm");
    const schemaModule = await import("@/db/schema");
    const banned = /asylum|refugee|permit|visa|immigration/i;
    for (const [tableName, table] of Object.entries(schemaModule)) {
      let columns: Record<string, unknown> | undefined;
      try {
        columns = getTableColumns(table as never);
      } catch {
        continue; // not a table export (enum, relation, type)
      }
      if (!columns) continue; // non-table export returns undefined
      for (const columnName of Object.keys(columns)) {
        expect(
          banned.test(columnName),
          `granular immigration-status column "${columnName}" on "${tableName}"`,
        ).toBe(false);
      }
    }
  });
});
