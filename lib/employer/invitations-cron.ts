/**
 * Phase 9.8.4  cron-only invitation helpers.
 *
 * NOT a `"use server"` module on purpose: exporting an async function
 * from `"use server"` exposes it as a Server Action invokable by any
 * client component that imports it. The expiry logic must only ever
 * be reachable from the `/api/cron/vacancy-invite-expiry` route,
 * which is itself guarded by `isAuthorizedCron()` (Bearer
 * CRON_SECRET).
 *
 * Caller contract: the cron route reads candidate rows + invokes
 * `expireInvitationFromCron` per row. The function performs the
 * conditional state flip atomically (only if still `invited`), then
 * fires the two notifications + the audit row. Idempotent: a row that
 * has already moved past `invited` (e.g. seeker responded between
 * read and write) is a no-op.
 */

import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { logAccess } from "@/lib/audit";
import { createNotification, notifyOrgMembers } from "@/lib/notifications/server";

export interface ExpireArgs {
  invitationId: string;
  vacancyId: string;
  vacancyTitle: string;
  organizationId: string;
  orgName: string;
  seekerUserId: string;
  seekerDisplayName: string;
  inviteExpiryDays: number | null;
}

export async function expireInvitationFromCron(
  args: ExpireArgs,
): Promise<boolean> {
  const db = getDb();

  // Conditional update: only flip if still `invited`. If a seeker
  // responded between the cron's read and write, leave the row alone.
  const result = await db
    .update(schema.vacancyInvitations)
    .set({ state: "expired", respondedAt: new Date() })
    .where(
      and(
        eq(schema.vacancyInvitations.id, args.invitationId),
        eq(schema.vacancyInvitations.state, "invited"),
      ),
    )
    .returning({ id: schema.vacancyInvitations.id });

  if (result.length === 0) return false;

  // Seeker notification  polite. Does not blame anyone.
  await createNotification({
    userId: args.seekerUserId,
    kind: "vacancy.invite.expired",
    title: `Your invitation from ${args.orgName} expired`,
    body: `The invite for "${args.vacancyTitle}" expired without a response. The role may have been filled  no action required.`,
    meta: { invitationId: args.invitationId, vacancyId: args.vacancyId },
  });

  // Employer fan-out  useful, names the seeker so they can follow
  // up if appropriate. notifyOrgMembers honours per-user prefs.
  await notifyOrgMembers(args.organizationId, {
    kind: "vacancy.invite.unanswered",
    title: `${args.seekerDisplayName} didn't respond in time`,
    body:
      `Your invite to "${args.vacancyTitle}" expired ` +
      (args.inviteExpiryDays
        ? `after the ${args.inviteExpiryDays}-day window you set.`
        : `with no response.`),
    link: `/employer/vacancies/${args.vacancyId}`,
    meta: { invitationId: args.invitationId, vacancyId: args.vacancyId },
  });

  await logAccess({
    kind: "vacancy.invite.expire",
    actor: "cron:vacancy-invite-expiry",
    subject: args.invitationId,
    meta: { orgId: args.organizationId, vacancyId: args.vacancyId },
  });

  return true;
}
