"use server";

/**
 * Phase 11.3.1  pause-searchability Server Actions.
 *
 * Three states on the seeker's `searchability` consent row:
 *
 *   active   state='granted' AND pausedUntil IS NULL
 *   paused   state='granted' AND pausedUntil > now()
 *   off      state IN ('none','revoked')
 *
 * Pause is a temporal modifier on the existing consent (D1), not a
 * new consent purpose. The seeker stays in the system; their record
 * is intact; existing relationships hold. They just don't appear in
 * `/search` and employers can't send them new invites.
 *
 * Auto-expiry: the cron at `app/api/cron/searchability-pause-sweep`
 * clears `paused_until` rows whose pause has passed and writes
 * `consent.searchability.pause_expired` audit rows.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/server";

export type PauseResult =
  | { ok: true }
  | { ok: false; message: string };

const VALID_DURATIONS_DAYS = new Set([30, 90, 180, 365]);
const REASON_MAX = 200;

export interface PauseInput {
  /** Days from now until auto-unpause. Must be one of 30 / 90 / 180 / 365. */
  durationDays: number;
  /** Optional 200-char free-text  PII-flagged in audit (not surfaced to
   *  employers; pause is private). */
  reason?: string;
}

/**
 * Set the searchability pause. Requires a granted searchability consent
 * row (you can't pause something that isn't on). Cron-aware  the
 * cron's WHERE clause and the search query both read `paused_until`
 * directly, so the action just sets the column and revalidates.
 */
export async function pauseSearchability(
  input: PauseInput,
): Promise<PauseResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };
  if (!VALID_DURATIONS_DAYS.has(input.durationDays)) {
    return {
      ok: false,
      message: "Pick a pause duration of 1, 3, 6, or 12 months.",
    };
  }
  const note = (input.reason ?? "").trim();
  if (note.length > REASON_MAX) {
    return {
      ok: false,
      message: `Reason can't exceed ${REASON_MAX} characters.`,
    };
  }

  const db = getDb();
  const existing = await db
    .select({
      id: schema.consents.id,
      state: schema.consents.state,
    })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, session.id),
        eq(schema.consents.purpose, "searchability"),
      ),
    )
    .limit(1);
  const row = existing[0];
  if (!row || row.state !== "granted") {
    return {
      ok: false,
      message:
        "Turn searchability on first  pause only applies while you're on.",
    };
  }

  const now = new Date();
  const until = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

  await db
    .update(schema.consents)
    .set({
      pausedAt: now,
      pausedUntil: until,
      pausedReason: note.length > 0 ? note : null,
    })
    .where(eq(schema.consents.id, row.id));

  await logAccess({
    kind: "consent.searchability.paused",
    actor: session.id,
    subject: row.id,
    meta: {
      durationDays: input.durationDays,
      pausedUntil: until.toISOString(),
      seekerAuthoredFreeText: note.length > 0,
    },
  });

  await createNotification({
    userId: session.id,
    kind: "consent.searchability.paused",
    title: "Searchability paused",
    body: `You won't appear in employer search until ${until.toISOString().slice(0, 10)}. Unpause any time from Privacy.`,
    link: "/dashboard/privacy",
    meta: { pausedUntil: until.toISOString() },
  });

  revalidatePath("/dashboard/privacy");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Lift the pause manually. Audit-logs as
 * `consent.searchability.unpaused`. Idempotent  a row with no
 * pause set is a no-op.
 */
export async function unpauseSearchability(): Promise<PauseResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, message: "Not signed in." };

  const db = getDb();
  const existing = await db
    .select({
      id: schema.consents.id,
      pausedUntil: schema.consents.pausedUntil,
    })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, session.id),
        eq(schema.consents.purpose, "searchability"),
      ),
    )
    .limit(1);
  const row = existing[0];
  if (!row) return { ok: true };

  await db
    .update(schema.consents)
    .set({ pausedAt: null, pausedUntil: null, pausedReason: null })
    .where(eq(schema.consents.id, row.id));

  if (row.pausedUntil) {
    await logAccess({
      kind: "consent.searchability.unpaused",
      actor: session.id,
      subject: row.id,
      meta: { previousPausedUntil: row.pausedUntil.toISOString() },
    });
  }

  revalidatePath("/dashboard/privacy");
  revalidatePath("/dashboard");
  return { ok: true };
}

export interface PauseStateRead {
  /** When set, the seeker is paused until this date. */
  pausedUntil: string | null;
  pausedAt: string | null;
  pausedReason: string | null;
}

/**
 * Read the current pause state for the signed-in seeker. Used by the
 * privacy page to render the `<SearchabilityPauseControl>`. Returns a
 * nullish shape when no row exists  treat as "not paused" everywhere.
 */
export async function readMyPauseState(): Promise<PauseStateRead> {
  const session = await getSessionUser();
  if (!session) {
    return { pausedUntil: null, pausedAt: null, pausedReason: null };
  }
  const db = getDb();
  const rows = await db
    .select({
      pausedUntil: schema.consents.pausedUntil,
      pausedAt: schema.consents.pausedAt,
      pausedReason: schema.consents.pausedReason,
    })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, session.id),
        eq(schema.consents.purpose, "searchability"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { pausedUntil: null, pausedAt: null, pausedReason: null };
  }
  return {
    pausedUntil: row.pausedUntil?.toISOString() ?? null,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    pausedReason: row.pausedReason ?? null,
  };
}

// Silence the "unused import" lint while we keep randomUUID available
// for future per-pause-event tracking. Cheap and self-documenting.
void randomUUID;
