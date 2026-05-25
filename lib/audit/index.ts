/**
 * Audit logging  every PII access writes a row to `audit_log`.
 *
 * POPIA-First Rule + Redaction Rule (TO_START_EVERY_SESSION.md §4, §5): any
 * code path that reads or exposes special-category PII MUST call
 * `logAccess()`. Search, profile-view, contact reveal, document download,
 * analytics export, consent change, sign-in / sign-up / sign-out  all of
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
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

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
  // Phase 3  self-edit events on the seeker dashboard.
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
  | "profile.photo.remove"
  // Phase 5  employer reveal flow + placement + org tooling.
  | "profile.contact.request"
  | "placement.confirm"
  | "placement.delete"
  // Phase 7.5  seeker self-reported placement (softer signal,
  // excluded from official analytics + outcomes dataset).
  | "placement.self_report"
  | "profile.shortlist.add"
  | "profile.shortlist.remove"
  | "search.saved"
  | "search.saved.run"
  | "search.saved.delete"
  | "pool.create"
  | "pool.delete"
  // Phase 7  admin actions (moderation, verification, taxonomy, users, settings).
  | "report.flag"
  | "report.close"
  | "account.suspend"
  | "account.restore"
  | "account.erase"
  | "verification.approve"
  | "verification.reject"
  | "org.approve"
  | "org.reject"
  | "taxonomy.add"
  | "taxonomy.remove"
  | "setting.update"
  // Phase 7 (Task 7.2)  admin escape hatch when a user loses device + codes.
  | "account.2fa.reset"
  // Phase 8  nightly cron tombstones (system-of-record proof of erasure).
  | "account.hard_delete"
  // Phase 8  self-service erasure path (seeker /dashboard/privacy).
  | "account.self_erase"
  // Phase 8  POPIA data-export download.
  | "account.data_export"
  // Phase 8  KYC verification lifecycle.
  | "kyc.verify"
  | "kyc.revoke"
  // Phase 8  SAQA worker lifecycle.
  | "verification.approve.saqa"
  | "verification.reject.saqa"
  | "verification.approve.manual_override"
  // Phase 9.7.5  employer self-view (Your hiring on Sebenza).
  // Self-data read, logged for symmetry  the employer sees their own
  // org's placement nationality mix; logging it means every analytics
  // surface, even self-views, leaves a trail. Pairs with the gov
  // gov.employer_mix.lookup audit kind below so the 9.7.7 oversight
  // log can correlate self-views with regulator inquiries.
  | "employer.own_mix.view"
  // Phase 9.7.6  per-employer governed lookup. Highest-sensitivity
  // surface of Phase 9.7. Ships dormant behind
  // `feature_flag_employer_mix_lookup`. EVERY call writes this row
  // (lookup found-or-not, above-or-below floor)  the audit trail
  // is the trust mechanism that makes the surface defensible. Meta
  // carries `reason`, `inputMethod`, `placementCount`, `aboveFloor`,
  // `floor`, `orgFound` for the 9.7.7 oversight log.
  | "gov.employer_mix.lookup"
  // Phase 9.8  vacancies + invite lifecycle. Org-private vacancy
  // operations + per-invite traceability for accept / decline / expire
  // patterns. `subject` is the vacancy id; meta carries the lifecycle
  // delta + (for invite events) the profile id + (for decline) the
  // response reason. The invite.skip event captures non-consented
  // skips per D5  per-seeker reason in the audit log, never in UI.
  | "vacancy.create"
  | "vacancy.update"
  | "vacancy.status.change"
  | "vacancy.invite"
  | "vacancy.invite.skip"
  | "vacancy.invite.withdraw"
  | "vacancy.invite.expire"
  | "vacancy.response"
  // Phase 9.10  employer KYC / org-vetting lifecycle. Replaces the
  // dormant `feature_flag_kyc_provider` partnership path with admin-
  // mediated vetting. `subject` is the organisation id; meta carries
  // the doc count on submit, the reviewer's user id on review actions,
  // and the rejection reason or admin note when applicable. The
  // break-glass `verification.manual-grant` flips `emailVerified`
  // server-side without auto-signing-in the user.
  | "org.submit"
  | "org.review.approve"
  | "org.review.reject"
  | "org.review.request-changes"
  | "org.documents.upload"
  | "org.verification.resend"
  | "verification.manual-grant";

export interface AuditEvent {
  kind: AuditKind;
  /** "anonymous" | userId | "system"  never raw IP/email here. */
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

export interface AuditQueryOpts {
  limit?: number;
  /** Exact-match on `audit_log.kind`. */
  kind?: AuditKind | null;
  /** Substring match against actor OR subject (handle / userId / orgId). */
  actor?: string;
}

/**
 * Recent events from the audit_log table. Used by `/admin/audit-log` when a
 * DB is wired up. Falls back to the ring buffer when no DB is configured.
 */
export async function recentAuditEventsFromDb(
  opts: AuditQueryOpts | number = {},
): Promise<AuditEvent[]> {
  // Backwards-compat: callers that pass a bare `limit` number still work.
  const normalized: AuditQueryOpts =
    typeof opts === "number" ? { limit: opts } : opts;
  const limit = Math.min(normalized.limit ?? 50, 10_000);

  if (!dbAvailable()) return recentAuditEvents(limit);
  try {
    const db = getDb();

    const where = [] as Array<ReturnType<typeof sql>>;
    if (normalized.kind) {
      where.push(eq(auditLog.kind, normalized.kind));
    }
    const trimmed = (normalized.actor ?? "").trim();
    if (trimmed) {
      where.push(
        or(
          ilike(auditLog.actor, `%${trimmed}%`),
          ilike(auditLog.subject, `%${trimmed}%`),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(auditLog)
      .where(where.length > 0 ? and(...where) : undefined)
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
