/**
 * GET /api/interviews/[id]/ics - the universal add-to-calendar file
 * (docs/INTERVIEWS_PLAN.md). Outlook, Apple Calendar, and everything
 * else that isn't Google opens this; Google gets the template URL.
 *
 * Authorisation: the owning seeker, or any member of the organising
 * org. Anyone else gets the same 404 shape as a missing interview -
 * whether an interview id exists is itself pipeline information.
 */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/dal";
import { buildIcs } from "@/lib/interviews/links";
import { interviewForIcs } from "@/lib/interviews/query";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return new Response("Not found", { status: 404 });

  const row = await interviewForIcs(id);
  if (!row) return new Response("Not found", { status: 404 });

  let allowed = row.ownerUserId === session.id;
  if (!allowed) {
    const member = await getDb()
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, row.organizationId),
          eq(schema.organizationMembers.userId, session.id),
          isNull(schema.organizationMembers.suspendedAt),
        ),
      )
      .limit(1);
    allowed = member.length > 0;
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  // The seeker's file says who's hosting; the employer's says who's
  // coming. Same event, each side's own calendar line.
  const isSeeker = row.ownerUserId === session.id;
  const title = isSeeker
    ? `Interview: ${row.vacancyTitle} at ${row.orgName}`
    : `Interview: ${row.displayName} · ${row.vacancyTitle}`;

  const ics = buildIcs({
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    title,
    location: row.location,
    description: row.instructions ?? "",
    uid: `${row.id}@sebenzasa.com`,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="interview-${row.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
