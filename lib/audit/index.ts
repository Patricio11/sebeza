/**
 * Audit logging — every PII access writes a row to `audit_log`.
 *
 * POPIA-First Rule + Redaction Rule (TO_START_EVERY_SESSION.md §4, §5): any
 * code path that reads or exposes special-category PII MUST call
 * `logAccess()`. Search, profile-view, contact reveal, document download,
 * analytics export, consent change, sign-in / sign-up / sign-out — all of
 * them.
 *
 * Persistence:
 *   - When `DATABASE_URL` is set (Phase 2+), `logAccess()` inserts a row
 *     into the `audit_log` table. The admin viewer reads from that table.
 *   - When `DATABASE_URL` is absent (mock-only dev), it falls back to the
 *     in-memory ring buffer so demos still surface events in `/admin`.
 *   - We always push to the ring buffer as a "tail" cache (cheap, useful
 *     for the dev /admin live view).
 */

import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";

export type AuditKind =
  | "search.profiles"
  | "profile.view"
  | "profile.contact.reveal"
  | "profile.document.download"
  | "analytics.export"
  | "auth.signin"
  | "auth.signup"
  | "auth.signout"
  | "consent.grant"
  | "consent.revoke"
  // Phase 3 — self-edit events on the seeker dashboard.
  | "profile.update"
  | "profile.skills.update"
  | "profile.status.update"
  | "profile.status.reconfirm"
  | "profile.national_id.update"
  | "profile.national_id.remove"
  | "profile.experience.add"
  | "profile.experience.update"
  | "profile.experience.delete"
  | "profile.qualification.add"
  | "profile.qualification.delete"
  | "profile.qualification.document.upload"
  | "profile.photo.upload"
  | "profile.photo.remove";

export interface AuditEvent {
  kind: AuditKind;
  /** "anonymous" | userId | "system" — never raw IP/email here. */
  actor: string;
  /** The thing being accessed: a handle, an orgId, a documentId, etc. */
  subject?: string;
  meta?: Record<string, unknown>;
  at: string;
}

const RING_SIZE = 200;
const ring: AuditEvent[] = [];

function dbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function logAccess(
  input: Omit<AuditEvent, "at">,
): Promise<void> {
  const event: AuditEvent = { ...input, at: new Date().toISOString() };

  // Tail buffer for dev /admin live view + the fallback when no DB is wired.
  ring.push(event);
  if (ring.length > RING_SIZE) ring.shift();

  if (dbAvailable()) {
    try {
      const db = getDb();
      await db.insert(auditLog).values({
        id: `aud_${randomUUID()}`,
        kind: event.kind,
        actor: event.actor,
        subject: event.subject ?? null,
        meta: event.meta ?? null,
        at: new Date(event.at),
      });
    } catch (e) {
      // POPIA: an audit-log write failing must NEVER break the request path.
      // The ring buffer carries the event regardless; in production a separate
      // alerting hook (Phase 9 Sentry) catches the drift.
      // eslint-disable-next-line no-console
      console.error("[audit] DB write failed (logged to ring buffer only):", e);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[audit]", event.kind, event.actor, event.subject ?? "");
  }
}

/** Ring-buffer tail. Useful when no DB is wired (mock-only dev). */
export function recentAuditEvents(limit = 50): AuditEvent[] {
  return ring.slice(-limit).reverse();
}

/**
 * Recent events from the audit_log table. Used by `/admin/audit-log` when a
 * DB is wired up. Falls back to the ring buffer when no DB is configured.
 */
export async function recentAuditEventsFromDb(limit = 50): Promise<AuditEvent[]> {
  if (!dbAvailable()) return recentAuditEvents(limit);
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.at))
      .limit(limit);
    return rows.map((r) => ({
      kind: r.kind as AuditKind,
      actor: r.actor,
      subject: r.subject ?? undefined,
      meta: (r.meta as Record<string, unknown>) ?? undefined,
      at: r.at.toISOString(),
    }));
  } catch {
    return recentAuditEvents(limit);
  }
}
