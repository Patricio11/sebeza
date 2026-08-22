/**
 * Interview scheduling lifecycle (docs/INTERVIEWS_PLAN.md).
 *
 * accepted -> scheduled -> confirmed/declined/cancelled -> attended/
 * no_show. The properties worth locking down:
 *
 *   - interviews are for ACCEPTED invitations only;
 *   - one ACTIVE interview per invitation, enforced by the partial
 *     unique index (the second insert fails at the database);
 *   - cancelling frees the slot for a reschedule;
 *   - attendance is a fact about the past: refused before startsAt;
 *   - the seeker's respond() is owner-scoped (someone else's
 *     interview id is "not found", not "forbidden").
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const EMPLOYER = {
  id: "user_naledi-k",
  email: "naledi.khumalo@discovery.co.za",
  role: "employer",
  orgId: "org_discovery-bank",
  orgRole: "owner",
  orgVerified: true,
};
const SEEKER = { id: "user_lerato-n", email: "lerato-n@example.co.za", role: "seeker" };
const OTHER_SEEKER = { id: "user_someone-else", email: "x@example.co.za", role: "seeker" };

let actAs: { id: string } = EMPLOYER;

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    getSessionUser: vi.fn(async () => actAs),
    verifySession: vi.fn(async () => actAs),
    verifyRole: vi.fn(async () => actAs),
    verifyEmployer: vi.fn(async () => EMPLOYER),
    verifyOrgVerified: vi.fn(async () => EMPLOYER),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  cancelInterview,
  markInterviewAttendance,
  scheduleInterview,
  scheduleInterviewsForVacancy,
} from "@/lib/employer/interviews";
import { respondToInterview } from "@/lib/seeker/interviews";

const db = getDb();
const INV_ID = "inv_interview-test-1";
const VACANCY_ID = "vac_senior-software-engineer";

const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
const DETAILS = {
  startsAtIso: inFiveDays.toISOString(),
  durationMinutes: 45 as const,
  locationKind: "in_person" as const,
  location: "1 Discovery Place, Sandton",
  instructions: "Ask for Naledi at reception.",
};

async function resetInvitation(
  state: "invited" | "accepted" = "accepted",
): Promise<void> {
  await db
    .delete(schema.interviews)
    .where(eq(schema.interviews.invitationId, INV_ID));
  await db
    .delete(schema.vacancyInvitations)
    .where(eq(schema.vacancyInvitations.id, INV_ID));
  await db.insert(schema.vacancyInvitations).values({
    id: INV_ID,
    vacancyId: VACANCY_ID,
    profileId: "prof_lerato-n",
    invitedByUserId: EMPLOYER.id,
    invitedAt: new Date(),
    state,
    ...(state === "accepted" ? { respondedAt: new Date() } : {}),
  });
}

async function loadInterviews() {
  return db
    .select()
    .from(schema.interviews)
    .where(eq(schema.interviews.invitationId, INV_ID));
}

describe("interview lifecycle", () => {
  beforeAll(() => {
    actAs = EMPLOYER;
  });
  afterAll(async () => {
    await db
      .delete(schema.interviews)
      .where(eq(schema.interviews.invitationId, INV_ID));
    await db
      .delete(schema.vacancyInvitations)
      .where(eq(schema.vacancyInvitations.id, INV_ID));
  });

  test("refuses to schedule on a non-accepted invitation", async () => {
    await resetInvitation("invited");
    const res = await scheduleInterview({ invitationId: INV_ID, ...DETAILS });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/accepted/i);
  });

  test("refuses a time in the past", async () => {
    await resetInvitation();
    const res = await scheduleInterview({
      invitationId: INV_ID,
      ...DETAILS,
      startsAtIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/future/i);
  });

  test("schedules once; the partial index blocks a second active interview", async () => {
    await resetInvitation();
    const first = await scheduleInterview({ invitationId: INV_ID, ...DETAILS });
    expect(first.ok).toBe(true);
    const rows = await loadInterviews();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe("scheduled");

    // Second attempt while the first is active: refused, and the
    // refusal came from the DATABASE (the unique index), so two racing
    // tabs cannot double-book.
    const second = await scheduleInterview({ invitationId: INV_ID, ...DETAILS });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.message).toMatch(/already scheduled/i);
    expect(await loadInterviews()).toHaveLength(1);
  });

  test("cancel frees the slot for a reschedule", async () => {
    const [active] = await loadInterviews();
    const cancelled = await cancelInterview({ interviewId: active!.id });
    expect(cancelled.ok).toBe(true);

    const again = await scheduleInterview({ invitationId: INV_ID, ...DETAILS });
    expect(again.ok).toBe(true);
    const rows = await loadInterviews();
    // Reschedule = cancel + new row. The history survives.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.state).sort()).toEqual(["cancelled", "scheduled"]);
  });

  test("bulk scheduling reports the skip honestly", async () => {
    // The only accepted invitee already has an active interview.
    const res = await scheduleInterviewsForVacancy({
      vacancyId: VACANCY_ID,
      ...DETAILS,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.skipped).toBeGreaterThanOrEqual(1);
    }
  });

  test("the seeker can confirm; a stranger cannot even see it", async () => {
    const active = (await loadInterviews()).find((r) => r.state === "scheduled")!;

    // Not the owner: the same non-disclosure shape as invitations.
    actAs = OTHER_SEEKER;
    const denied = await respondToInterview({
      interviewId: active.id,
      response: "confirmed",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.message).toMatch(/not found/i);

    actAs = SEEKER;
    const res = await respondToInterview({
      interviewId: active.id,
      response: "confirmed",
    });
    expect(res.ok).toBe(true);
    const [row] = await db
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, active.id));
    expect(row!.state).toBe("confirmed");
    actAs = EMPLOYER;
  });

  test("attendance is refused before the start time", async () => {
    const active = (await loadInterviews()).find((r) => r.state === "confirmed")!;
    const res = await markInterviewAttendance({
      interviewId: active.id,
      attended: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/afterwards/i);
  });

  test("after the start time, attended closes the loop", async () => {
    const active = (await loadInterviews()).find((r) => r.state === "confirmed")!;
    // Move the interview into the past, as time would.
    await db
      .update(schema.interviews)
      .set({ startsAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(schema.interviews.id, active.id));

    const res = await markInterviewAttendance({
      interviewId: active.id,
      attended: true,
    });
    expect(res.ok).toBe(true);
    const [row] = await db
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, active.id));
    expect(row!.state).toBe("attended");

    // Attendance is terminal: responding or re-marking now fails.
    actAs = SEEKER;
    const late = await respondToInterview({
      interviewId: active.id,
      response: "declined",
    });
    expect(late.ok).toBe(false);
    actAs = EMPLOYER;
  });
});
