/**
 * The counter-offer state machine (founder request, 2026-08-22).
 *
 * declined -> offer_made -> accepted / declined(final). The properties
 * worth locking down are the refusals, because every one of them is an
 * anti-harassment rule:
 *
 *   - an offer can only answer a DECLINE, never a fresh invitation;
 *   - one offer per invitation, EVER, including under concurrency;
 *   - a substantive note is required (an empty offer is just a nudge);
 *   - after the offer, the seeker's normal accept/decline both work.
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
import { makeOfferOnInvitation } from "@/lib/employer/invitations";
import { declineInvitation } from "@/lib/seeker/invitations";

const db = getDb();
const INV_ID = "inv_offer-test-1";
const NOTE = "We can move the band up 15% and add two remote days.";

async function resetInvitation(state: "invited" | "declined") {
  await db
    .delete(schema.vacancyInvitations)
    .where(eq(schema.vacancyInvitations.id, INV_ID));
  await db.insert(schema.vacancyInvitations).values({
    id: INV_ID,
    vacancyId: "vac_senior-software-engineer",
    profileId: "prof_lerato-n",
    invitedByUserId: EMPLOYER.id,
    invitedAt: new Date(),
    state,
    ...(state === "declined"
      ? { respondedAt: new Date(), declineReason: "salary_not_competitive" as const }
      : {}),
  });
}

describe("makeOfferOnInvitation", () => {
  beforeAll(() => {
    actAs = EMPLOYER;
  });
  afterAll(async () => {
    await db
      .delete(schema.vacancyInvitations)
      .where(eq(schema.vacancyInvitations.id, INV_ID));
  });

  test("refuses to offer on a fresh invitation", async () => {
    await resetInvitation("invited");
    const res = await makeOfferOnInvitation({ invitationId: INV_ID, note: NOTE });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/answer a decline/i);
  });

  test("refuses a contentless offer", async () => {
    await resetInvitation("declined");
    const res = await makeOfferOnInvitation({ invitationId: INV_ID, note: "ok" });
    expect(res.ok).toBe(false);
  });

  test("offers once, then never again", async () => {
    await resetInvitation("declined");
    const first = await makeOfferOnInvitation({ invitationId: INV_ID, note: NOTE });
    expect(first.ok).toBe(true);

    const [row] = await db
      .select()
      .from(schema.vacancyInvitations)
      .where(eq(schema.vacancyInvitations.id, INV_ID));
    expect(row!.state).toBe("offer_made");
    expect(row!.offerNote).toBe(NOTE);
    expect(row!.offerMadeAt).not.toBeNull();

    // Force the row back to declined WITHOUT clearing offer_made_at,
    // which is exactly the post-second-decline shape. The cap must hold.
    await db
      .update(schema.vacancyInvitations)
      .set({ state: "declined" })
      .where(eq(schema.vacancyInvitations.id, INV_ID));
    const second = await makeOfferOnInvitation({ invitationId: INV_ID, note: NOTE });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.message).toMatch(/already made|final/i);
  });

  test("the seeker can decline the offer, finally", async () => {
    await resetInvitation("declined");
    await db
      .update(schema.vacancyInvitations)
      .set({ state: "offer_made", offerNote: NOTE, offerMadeAt: new Date() })
      .where(eq(schema.vacancyInvitations.id, INV_ID));

    actAs = SEEKER;
    const res = await declineInvitation({
      invitationId: INV_ID,
      reason: "role_not_what_im_looking_for",
    });
    expect(res.ok).toBe(true);
    const [row] = await db
      .select()
      .from(schema.vacancyInvitations)
      .where(eq(schema.vacancyInvitations.id, INV_ID));
    expect(row!.state).toBe("declined");
    // The cap marker survives the final decline: no second offer, ever.
    expect(row!.offerMadeAt).not.toBeNull();
    actAs = EMPLOYER;
  });
});
