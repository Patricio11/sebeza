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
  // Phase 11.3.1  pause-searchability lifecycle. Pause is a state on
  // the existing searchability consent, not a new purpose (D1). Three
  // kinds: manual pause, manual unpause, cron-driven auto-expiry.
  | "consent.searchability.paused"
  | "consent.searchability.unpaused"
  | "consent.searchability.pause_expired"
  // Phase 11.3.2  seeker-private employer block lifecycle. The
  // employer NEVER sees these rows (privacy invariant D2).
  | "seeker.block.added"
  | "seeker.block.removed"
  // Phase 11.3.3  invitation reports. Distinct from `report.flag`
  // (which targets a profile)  invite reports point at an org +
  // invitation. Same admin queue.
  | "moderation.invite_report.created"
  // Phase 11.4.2  follow-employer lifecycle. Private to the seeker;
  // the employer never sees these rows in their org's audit log.
  | "seeker.follow.added"
  | "seeker.follow.removed"
  // Phase 11.4.4  SMS / WhatsApp dispatch outcomes. `.sent` fires
  // on actual provider success; `.skipped` fires when one of the
  // multi-gates refused; `.failed` fires on provider error.
  | "notification.sms.sent"
  | "notification.sms.skipped"
  | "notification.sms.failed"
  | "notification.whatsapp.sent"
  | "notification.whatsapp.skipped"
  | "notification.whatsapp.failed"
  // Phase 11.4.4  phone-verification flow + admin allowlist mgmt.
  | "phone.verification.sent"
  | "phone.verification.confirmed"
  | "phone.verification.cleared"
  | "admin.sms_allowlist.added"
  | "admin.sms_allowlist.removed"
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
  // Phase 9.22  current-employment self-edit. Meta carries the
  // before/after employerOrgId so the audit trail captures the
  // change. The seeker's "Other" submission has its own audit kind
  // (taxonomy.suggestion.submit) and shouldn't be double-logged here.
  | "profile.employment.update"
  // Phase 9.23  opt-in employment verification lifecycle. Meta
  // carries `contact_email_hash` (SHA-256) instead of the raw email
  // so the audit trail proves consent existed at submission without
  // persisting third-party PII (D0 in the plan).
  | "employment.verification.request"
  | "employment.verification.contact_verified"
  | "employment.verification.contact_declined"
  | "employment.verification.contact_disputed"
  | "employment.verification.expired"
  | "employment.verification.superseded"
  | "employment.verification.withdrawn"
  | "profile.qualification.add"
  | "profile.qualification.delete"
  | "profile.qualification.document.upload"
  | "profile.photo.upload"
  | "profile.photo.remove"
  // Phase 5  employer reveal flow + placement + org tooling.
  | "profile.contact.request"
  | "placement.confirm"
  | "placement.delete"
  // Phase 9.20 T2  lifecycle ledger events. `status.check` is a
  // status confirmation (subject = profileId, meta carries the
  // checkId + the boolean + the PII-flagged optional note). `note.
  // update` writes when an org member edits the durable internal
  // note; the meta carries both the new content (PII-flagged) and
  // a `noteCleared` boolean for clear-to-NULL operations.
  | "placement.status.check"
  | "placement.status.check_due"
  | "placement.note.update"
  // Phase 9.20 Tier 3  the structured departure event. `subject` is
  // the profileId; meta carries departureDate + category + the
  // PII-flagged optional note. Per D4: the *category* is captured;
  // the *reason* (performance, misconduct, etc.) is deliberately not.
  | "placement.departed"
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
  // Phase 9.19 D8  the gentle reminder cron writes one row per
  // nudge sent, keyed by `subject = invitationId` so re-runs can see
  // an invite has already been nudged (cap: one per invite ever).
  | "vacancy.invite.followup"
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
  | "verification.manual-grant"
  // Phase 9.11  vacancy-outcome loop. Mark-as-filled now captures
  // who was hired (batch of 1..N placements in one transaction) +
  // fans out the not-selected growth notification. `subject` is the
  // vacancy id; meta carries the placement ids + the not-selected
  // recipient count.
  | "org.vacancy.filled.batch"
  | "org.vacancy.filled.no-placement"
  | "search.outside-hire-lookup"
  | "vacancy.outcome.other-hired"
  // Phase 9.12  the learning loop. Seeker-private events that capture
  // the accept / start / complete / abandon transitions on a
  // `learning_items` row. Abandon meta carries the reason + (when
  // present) the optional 200-char note  PII-flagged for any future
  // export. Per D5 the related cross-kind notification cap (see
  // `learning.nudge` vs `vacancy.outcome.other-hired`) is enforced
  // cron-side; the audit row itself is always written.
  | "learning.accept"
  | "learning.start"
  // Phase 17 ("The Climb")  self-paced progress checkpoint (0..100) on an
  // active item. Meta carries progressPercent; feeds future stall analytics.
  | "learning.progress"
  // Phase 17 ("AI Career Coach", flag-gated)  a seeker-facing LLM call
  // (interview practice) succeeded; meta carries token/cost, never the prompt
  // text. `.skipped` records a gate that closed (flag/provider/budget/PII).
  | "seeker.ai_coach.call"
  | "seeker.ai_coach.skipped"
  | "learning.complete"
  | "learning.abandon"
  // Phase 11.2.1  click-through to the provider's enrolment page from
  // a `<LearningPathCard>`. Subject = the learning path title (mock data
  // doesn't have a stable id; the title + provider identify it well
  // enough for editorial review). Meta carries `provider` + `providerKind`
  // + `url` so the audit row is self-contained.
  | "learning_path.opened"
  // Phase 18.1 ("Living Learning Catalog")  seeker reviewed a learning path
  // (would-recommend + optional blocker). Subject = learning_paths.id; meta
  // carries wouldRecommend + hasBlocker (never the blocker text  PII-flagged).
  | "learning_path.reviewed"
  // Phase 18.2  admin editorial action on a learning path. Subject =
  // learning_paths.id; meta.action ∈ create|update|verify|delete|restore.
  | "admin.learning_path.edit"
  // Phase 19 ("Custom Skills")  seeker added / removed a self-described skill
  // outside the taxonomy. Subject = profile_skills_custom.id; meta carries the
  // normalized label (the demand signal), never anything sensitive.
  | "profile.custom_skill.add"
  | "profile.custom_skill.remove"
  // Phase 19.2  admin promoted a frequent custom label to a canonical skill
  // slug, migrating existing custom rows. Subject = the new skills.slug.
  | "admin.custom_skill.canonicalize"
  // Phase 20  admin added / removed a skill-prerequisite edge. Subject =
  // skill_slug; meta carries prereqSkillSlug + action (add|remove).
  | "admin.skill_prereq.edit"
  // Phase 11.2.2  seeker swapped a cost-abandoned learning item for a
  // free alternative. Subject = the original learning_items.id; meta
  // carries `originalSkillSlug`, `newPathTitle`, `newProvider`.
  | "learning.swapped_to_free"
  // Phase 11.2.4  parking-lot lifecycle. Pre-`accepted` state for
  // seekers who flagged interest without committing. Subject = the
  // learning_items.id; meta carries `skillSlug` + (on promote) the
  // resulting state.
  | "learning.interested"
  | "learning.interested.promote"
  // Phase 9.15  taxonomy suggestion queue. `subject` is the suggestion id;
  // `meta` carries kind + customText + (for resolve actions) targetSlug +
  // backfilledRows. Submit fires on user submission; promote/merge/reject
  // fire on admin resolution from /admin/taxonomy/suggestions.
  | "taxonomy.suggestion.submit"
  | "taxonomy.suggestion.promote"
  | "taxonomy.suggestion.merge"
  | "taxonomy.suggestion.reject"
  // Phase 9.16  admin-mediated seeker ID verification. `subject` is the
  // seeker's profile id; meta carries the document storage key on
  // upload, the reviewer's user id on review actions, and the
  // rejection reason when applicable. Mirrors the org.review.* shape
  // from Phase 9.10 so admin oversight tooling can treat both queues
  // identically.
  | "kyc.document.upload"
  | "kyc.review.approve"
  | "kyc.review.reject"
  // Phase 9.17  employer-initiated seeker invitations. `subject` is
  // the seeker_invitations.id. Meta carries:
  //   send       { email, name?, profession?, note? (pii), dedupe?,
  //                resend?, blockedBy? }
  //   accept     { profileId, signupCompletedAt }
  //   decline    { reason? }
  //   withdraw   {}
  //   expire     {}  fired by the nightly cron, actor = "system"
  //   reported   { reason?, reporterIp? }  no auth required, the
  //                token IS the proof of identity for the report
  | "org.seeker_invite.send"
  | "org.seeker_invite.accept"
  | "org.seeker_invite.decline"
  | "org.seeker_invite.withdraw"
  | "org.seeker_invite.expire"
  | "org.seeker_invite.reported"
  // Phase 11.1.4  seeker achievement badge awarded. Idempotent at the
  // table layer (UNIQUE(profile_id, slug)); the audit row is the
  // historical record  one per badge per profile.
  | "achievement.awarded"
  // ──────────────────────────────────────────────────────────────────────
  // Phase 13.3  admin-managed LLM provider configuration + dispatch.
  //
  // Provider lifecycle on /admin/llm. `subject` is the provider id
  // ('openai' | 'anthropic' | 'mistral' | 'self_hosted'). Meta:
  //   configured   { modelId, monthlyBudgetZar, s72Acknowledged }
  //   activated    { previousActiveProviderId? }
  //   deactivated  { reason? }
  //   tested       { ok: boolean, latencyMs?: number,
  //                  errorCategory?: 'auth' | 'network' | 'rate_limit' | 'other' }
  //   rotated      { keyFingerprintHash }  separate kind because
  //                credential-rotation is the load-bearing security
  //                event the auditor cares about distinctly.
  | "admin.llm.provider.configured"
  | "admin.llm.provider.activated"
  | "admin.llm.provider.deactivated"
  | "admin.llm.provider.tested"
  | "admin.llm.credentials.rotated"
  // Per-LLM-call dispatch trace. `subject` is the active provider id;
  // meta carries:
  //   suggest   { tokenCount, suggestionCount, syllabusSha256,
  //               estZarCost, modelId }
  //   skipped   { gate: 'no_active' | 'kill_switch' | 'no_credentials'
  //                       | 'budget_exhausted' | 'budget_zero'
  //                       | 'not_admin' | 'payload_unsafe' }
  //   failed    { errorCategory, modelId }
  // `subject = "n/a"` is acceptable for skipped reasons where no
  // active provider exists yet.
  | "llm.curriculum.suggest"
  | "llm.curriculum.skipped"
  | "llm.curriculum.failed"
  // Budget alert. Fires when total_spend_zar crosses 80% of
  // monthly_budget_zar. `subject` is provider id; meta:
  //   { spentZar, budgetZar, percent }
  | "admin.llm.budget.alert"
  // Editorial-catalogue lifecycle on /admin/curriculum. `subject` is
  // the module_skills.id. Meta:
  //   approved   { moduleSlug, skillSlug, confidence,
  //                fromSource: 'llm_suggested' | 'manual' }
  //   rejected   { moduleSlug, skillSlug, reason? }
  //   edited     { moduleSlug, skillSlug,
  //                changedFields: ('confidence' | 'module_label' | 'institution')[] }
  | "admin.curriculum.module_skill.approved"
  | "admin.curriculum.module_skill.rejected"
  | "admin.curriculum.module_skill.edited"
  // Phase 13.4  student-declared milestones on /dashboard/grow.
  // `subject` is the milestone id; meta:
  //   added    { kind, occurredOn }
  //   removed  { kind }
  | "student.milestone.added"
  | "student.milestone.removed";

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
