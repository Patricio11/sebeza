/**
 * Interview reads, both sides. `server-only` (not "use server"): these
 * are page loaders, and exporting them as actions would mint public
 * endpoints for data that must stay org- or owner-scoped.
 */

import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export type InterviewState =
  | "scheduled"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "attended"
  | "no_show";

export interface InterviewRow {
  id: string;
  invitationId: string;
  vacancyId: string;
  vacancyTitle: string;
  profileId: string;
  handle: string;
  displayName: string;
  startsAt: Date;
  durationMinutes: number;
  locationKind: "in_person" | "video" | "phone";
  location: string;
  instructions: string | null;
  state: InterviewState;
  seekerNote: string | null;
}

const baseSelect = {
  id: schema.interviews.id,
  invitationId: schema.interviews.invitationId,
  vacancyId: schema.interviews.vacancyId,
  vacancyTitle: schema.vacancies.title,
  profileId: schema.interviews.profileId,
  handle: schema.profiles.handle,
  displayName: schema.profiles.displayName,
  startsAt: schema.interviews.startsAt,
  durationMinutes: schema.interviews.durationMinutes,
  locationKind: schema.interviews.locationKind,
  location: schema.interviews.location,
  instructions: schema.interviews.instructions,
  state: schema.interviews.state,
  seekerNote: schema.interviews.seekerNote,
};

/** Every interview for an org, oldest-upcoming first. The agenda page
 *  slices this into needs-attendance / upcoming / recent itself. */
export async function listInterviewsForOrg(
  organizationId: string,
): Promise<InterviewRow[]> {
  const db = getDb();
  const rows = await db
    .select(baseSelect)
    .from(schema.interviews)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.interviews.profileId))
    .innerJoin(schema.vacancies, eq(schema.vacancies.id, schema.interviews.vacancyId))
    .where(eq(schema.interviews.organizationId, organizationId))
    .orderBy(asc(schema.interviews.startsAt));
  return rows as InterviewRow[];
}

/** Active (scheduled|confirmed) interviews per invitation for one
 *  vacancy, keyed for the pipeline panel's chips. */
export async function activeInterviewsByInvitation(
  vacancyId: string,
): Promise<Record<string, { id: string; startsAt: string; state: "scheduled" | "confirmed" }>> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.interviews.id,
      invitationId: schema.interviews.invitationId,
      startsAt: schema.interviews.startsAt,
      state: schema.interviews.state,
    })
    .from(schema.interviews)
    .where(
      and(
        eq(schema.interviews.vacancyId, vacancyId),
        inArray(schema.interviews.state, ["scheduled", "confirmed"]),
      ),
    );
  const out: Record<
    string,
    { id: string; startsAt: string; state: "scheduled" | "confirmed" }
  > = {};
  for (const r of rows) {
    out[r.invitationId] = {
      id: r.id,
      startsAt: r.startsAt.toISOString(),
      state: r.state as "scheduled" | "confirmed",
    };
  }
  return out;
}

/** The seeker's view of one invitation's interview: the active one if
 *  any, else the most recent, so a cancellation is still explained. */
export async function interviewForInvitationOwnedBy(
  invitationId: string,
  ownerUserId: string,
): Promise<InterviewRow | null> {
  const db = getDb();
  const rows = await db
    .select({ ...baseSelect, ownerUserId: schema.profiles.userId })
    .from(schema.interviews)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.interviews.profileId))
    .innerJoin(schema.vacancies, eq(schema.vacancies.id, schema.interviews.vacancyId))
    .where(eq(schema.interviews.invitationId, invitationId))
    .orderBy(asc(schema.interviews.createdAt));
  const owned = rows.filter((r) => r.ownerUserId === ownerUserId);
  if (owned.length === 0) return null;
  const active = owned.find((r) => r.state === "scheduled" || r.state === "confirmed");
  return (active ?? owned[owned.length - 1]!) as InterviewRow;
}

/** ICS authorisation: the row plus who may download it. */
export async function interviewForIcs(interviewId: string): Promise<
  | (InterviewRow & { organizationId: string; ownerUserId: string; orgName: string })
  | null
> {
  const db = getDb();
  const rows = await db
    .select({
      ...baseSelect,
      organizationId: schema.interviews.organizationId,
      ownerUserId: schema.profiles.userId,
      orgName: schema.organizations.name,
    })
    .from(schema.interviews)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.interviews.profileId))
    .innerJoin(schema.vacancies, eq(schema.vacancies.id, schema.interviews.vacancyId))
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.interviews.organizationId),
    )
    .where(eq(schema.interviews.id, interviewId))
    .limit(1);
  return (rows[0] as never) ?? null;
}
