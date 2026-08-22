"use server";

/**
 * Interview responses, seeker side (docs/INTERVIEWS_PLAN.md).
 *
 * Confirm, or say you can't make it (optionally why, in your own
 * words). Both are answers; neither costs anything. The employer is
 * told either way, because a recruiter waiting at reception for
 * someone who said "can't make it" three days ago is a failure of the
 * platform, not of either person.
 */

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyRole } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { notifyOrgMembers } from "@/lib/notifications/server";
import { formatSaDateTime } from "@/lib/interviews/links";

export type SeekerActionResult = { ok: true } | { ok: false; message: string };

const respondSchema = z.object({
  interviewId: z.string().min(1),
  response: z.enum(["confirmed", "declined"]),
  note: z.string().trim().max(200).optional(),
});

export async function respondToInterview(
  input: z.infer<typeof respondSchema>,
): Promise<SeekerActionResult> {
  const session = await verifyRole("seeker");
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid response." };
  }
  const { interviewId, response, note } = parsed.data;

  const db = getDb();
  const rows = await db
    .select({
      id: schema.interviews.id,
      state: schema.interviews.state,
      startsAt: schema.interviews.startsAt,
      organizationId: schema.interviews.organizationId,
      vacancyId: schema.interviews.vacancyId,
      invitationId: schema.interviews.invitationId,
      ownerUserId: schema.profiles.userId,
      seekerDisplayName: schema.profiles.displayName,
      vacancyTitle: schema.vacancies.title,
    })
    .from(schema.interviews)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.interviews.profileId))
    .innerJoin(schema.vacancies, eq(schema.vacancies.id, schema.interviews.vacancyId))
    .where(eq(schema.interviews.id, interviewId))
    .limit(1);
  const row = rows[0];
  // Same non-disclosure shape as invitations: not yours = not found.
  if (!row || row.ownerUserId !== session.id) {
    return { ok: false, message: "Interview not found." };
  }
  if (row.state !== "scheduled" && row.state !== "confirmed") {
    return { ok: false, message: `This interview is already ${row.state}.` };
  }

  const updated = await db
    .update(schema.interviews)
    .set({
      state: response,
      respondedAt: new Date(),
      seekerNote: note?.length ? note : null,
    })
    .where(
      and(
        eq(schema.interviews.id, interviewId),
        inArray(schema.interviews.state, ["scheduled", "confirmed"]),
      ),
    )
    .returning({ id: schema.interviews.id });
  if (updated.length === 0) {
    return { ok: false, message: "The interview changed in the meantime. Refresh and try again." };
  }

  const when = formatSaDateTime(row.startsAt);
  await notifyOrgMembers(row.organizationId, {
    kind: "interview.response",
    title:
      response === "confirmed"
        ? `${row.seekerDisplayName} confirmed the interview for "${row.vacancyTitle}"`
        : `${row.seekerDisplayName} can't make the interview for "${row.vacancyTitle}"`,
    body:
      response === "confirmed"
        ? `${when} (SA time) is confirmed.`
        : `The slot was ${when} (SA time).${note ? ` Their note: "${note}"` : ""} Cancel it on the interviews page and pick a new time.`,
    link: `/employer/interviews`,
    meta: { interviewId, vacancyId: row.vacancyId, response, notePii: !!note },
  });

  await logAccess({
    kind: "interview.response",
    actor: session.id,
    subject: interviewId,
    meta: { vacancyId: row.vacancyId, response },
  });
  revalidatePath("/dashboard/invitations");
  revalidatePath(`/dashboard/invitations/${row.invitationId}`);
  return { ok: true };
}
