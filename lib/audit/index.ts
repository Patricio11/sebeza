/**
 * Audit logging — every PII access writes a row.
 *
 * POPIA-First Rule + Redaction Rule (TO_START_EVERY_SESSION.md §4, §5):
 * any code path that reads or exposes special-category PII MUST call
 * `logAccess()`. Search, profile-view, contact reveal, document download,
 * analytics export — all of them. The admin audit-log viewer (Phase 7) reads
 * from the same table.
 *
 * Phase 1: writes to console + an in-memory ring buffer (so the admin shell
 * can show recent events on the demo). Phase 4 wires this to the `audit_log`
 * Drizzle table; the signature does not change.
 */

export type AuditKind =
  | "search.profiles"
  | "profile.view"
  | "profile.contact.reveal"
  | "profile.document.download"
  | "analytics.export"
  | "auth.signin"
  | "auth.signup"
  | "consent.grant"
  | "consent.revoke";

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

export async function logAccess(
  input: Omit<AuditEvent, "at">,
): Promise<void> {
  const event: AuditEvent = { ...input, at: new Date().toISOString() };
  ring.push(event);
  if (ring.length > RING_SIZE) ring.shift();
  // Phase 4: persist to Postgres via Drizzle. For now, stdout for visibility.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[audit]", event.kind, event.actor, event.subject ?? "");
  }
}

export function recentAuditEvents(limit = 50): AuditEvent[] {
  return ring.slice(-limit).reverse();
}
