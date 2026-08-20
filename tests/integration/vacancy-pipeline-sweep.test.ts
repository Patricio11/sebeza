/**
 * G11  the stalled-pipeline sweep only fires when a recruiter is
 * genuinely stuck.
 *
 * The failure mode worth guarding is not "it never fires", it is "it
 * fires while somebody is still deciding", which turns a useful signal
 * into a nag and trains people to ignore us.
 */
import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sweepStalledPipelines } from "@/lib/employer/pipeline-sweep";

describe("sweepStalledPipelines", () => {
  test("scans only open vacancies that declared a headcount", async () => {
    const db = getDb();
    const open = await db
      .select({ id: schema.vacancies.id, positions: schema.vacancies.positions })
      .from(schema.vacancies)
      .where(eq(schema.vacancies.status, "open"));
    const withTarget = open.filter(
      (v) => v.positions != null && v.positions > 0,
    ).length;

    const result = await sweepStalledPipelines();
    expect(result.scanned).toBe(withTarget);
    expect(result.fired).toBeLessThanOrEqual(result.scanned);
  });

  test("never fires for a vacancy with a pending invitation", async () => {
    const db = getDb();
    // Every vacancy that still has someone deciding.
    const pendingRows = await db
      .select({ vacancyId: schema.vacancyInvitations.vacancyId })
      .from(schema.vacancyInvitations)
      .where(eq(schema.vacancyInvitations.state, "invited"));
    const pendingVacancies = new Set(pendingRows.map((r) => r.vacancyId));

    await sweepStalledPipelines();

    const fired = await db
      .select({ subject: schema.auditLog.subject })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.kind, "vacancy.pipeline.stalled"));

    for (const row of fired) {
      expect(
        pendingVacancies.has(row.subject),
        `fired for ${row.subject}, which still has someone pending`,
      ).toBe(false);
    }
  });

  test("is safe to run twice", async () => {
    await expect(sweepStalledPipelines()).resolves.toMatchObject({
      scanned: expect.any(Number),
    });
    await expect(sweepStalledPipelines()).resolves.toMatchObject({
      scanned: expect.any(Number),
    });
  });
});
