/**
 * Phase 22.6 ("AI Coach  monitoring")  safety telemetry from the audit log.
 * Counts only  the underlying rows carry counts + timestamps, never seeker
 * content. Surfaced on /admin/llm so an admin can see whether the distress path
 * is firing and whether output moderation is dropping a lot (a prompt-quality
 * signal), and act (e.g. pull the switch) if needed.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export interface CoachTelemetry {
  calls: number;
  distress: number;
  moderationDrops: number;
}

export async function getCoachSafetyTelemetry(): Promise<CoachTelemetry> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT kind, COUNT(*)::int AS n
    FROM audit_log
    WHERE kind IN (
      'seeker.ai_coach.call',
      'seeker.ai_coach.distress',
      'seeker.ai_coach.moderation_drop'
    )
    GROUP BY kind
  `);
  const rows = (result as unknown as { rows: { kind: string; n: number }[] })
    .rows;
  const by = new Map(rows.map((r) => [r.kind, r.n]));
  return {
    calls: by.get("seeker.ai_coach.call") ?? 0,
    distress: by.get("seeker.ai_coach.distress") ?? 0,
    moderationDrops: by.get("seeker.ai_coach.moderation_drop") ?? 0,
  };
}
