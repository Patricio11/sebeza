/**
 * Recruiter vs direct employer + client linkage + congrats-accept
 * (docs/RECRUITER_CLIENT_PLAN.md).
 *
 * The properties worth locking down:
 *   - an agency vacancy MUST name its client (linked org or typed name);
 *   - a linked client must be picker-visible (registered or verified);
 *   - direct employers cannot smuggle client fields onto a vacancy;
 *   - accepting a congrats invite from a DIRECT employer links the new
 *     profile's employer AND logs the placement (vacancy attached);
 *   - accepting one from an AGENCY links the LINKED client org only,
 *     and never auto-logs a placement.
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

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    verifyEmployer: vi.fn(async () => EMPLOYER),
    verifyOrgVerified: vi.fn(async () => EMPLOYER),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { createVacancy } from "@/lib/employer/vacancies";
import { acceptSeekerInvitation } from "@/lib/auth/actions";
import { signInviteToken } from "@/lib/auth/invite-tokens";
import { __resetRateLimiterForTests } from "@/lib/rate-limit/memory";
import type { ConsentPurpose } from "@/lib/consent";

const db = getDb();
const ORG = "org_discovery-bank";
const CLIENT_ORG = "org_rc-test-client";
const STAMP = Date.now();

async function setOrgKind(kind: "direct_employer" | "recruitment_agency") {
  await db
    .update(schema.organizations)
    .set({ orgKind: kind })
    .where(eq(schema.organizations.id, ORG));
}

const BASE_VACANCY = {
  title: "RC Test Placement Role",
  professionSlug: "software-developer",
  provinceSlug: "gauteng",
  skillSlugs: [],
  workAvailability: [],
} as const;

const createdVacancies: string[] = [];
const createdEmails: string[] = [];

async function makeVacancy(extra: Record<string, unknown> = {}) {
  const res = await createVacancy({ ...BASE_VACANCY, ...extra } as never);
  if (res.ok) createdVacancies.push(res.vacancyId);
  return res;
}

function seekerPayload(email: string) {
  return {
    fullName: "Congrats Testperson",
    email,
    dateOfBirth: "1995-05-05",
    nationality: "ZA",
    password: "a-perfectly-fine-password-1",
    grantedConsents: ["searchability"] as ConsentPurpose[],
    termsAccepted: true as const,
    profession: "Software Developer",
    province: "gauteng",
    status: "open_to_work" as const,
    academic: null,
  };
}

async function makeCongratsInvite(input: {
  id: string;
  email: string;
  congratsRole: string | null;
  congratsVacancyId: string | null;
}): Promise<string> {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.insert(schema.seekerInvitations).values({
    id: input.id,
    organizationId: ORG,
    invitedByUserId: EMPLOYER.id,
    email: input.email,
    congratsRole: input.congratsRole,
    congratsVacancyId: input.congratsVacancyId,
    expiresAt,
  });
  return signInviteToken(input.id, expiresAt);
}

async function profileByEmail(email: string) {
  const rows = await db
    .select({
      profileId: schema.profiles.id,
      userId: schema.profiles.userId,
      currentEmployerOrgId: schema.profiles.currentEmployerOrgId,
    })
    .from(schema.profiles)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.profiles.userId))
    .where(sql`lower(${schema.appUser.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

beforeAll(async () => {
  __resetRateLimiterForTests();
  // A picker-visible client org for the agency scenarios.
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, CLIENT_ORG));
  await db.insert(schema.organizations).values({
    id: CLIENT_ORG,
    name: "RC Client Holdings",
    country: "South Africa",
    origin: "sebenza_registered",
    verification: "unverified",
  });
});

afterAll(async () => {
  await setOrgKind("direct_employer");
  // Tear down everything the suite created, children first: the
  // invite rows hold an accepted_profile_id FK, so they go before the
  // profiles they point at.
  await db.delete(schema.seekerInvitations).where(
    inArray(schema.seekerInvitations.id, [
      `inv_rc-direct-${STAMP}`,
      `inv_rc-agency-${STAMP}`,
    ]),
  );
  for (const email of createdEmails) {
    const p = await profileByEmail(email);
    if (p) {
      await db
        .delete(schema.placements)
        .where(eq(schema.placements.profileId, p.profileId));
      await db
        .delete(schema.profiles)
        .where(eq(schema.profiles.id, p.profileId));
      await db.delete(schema.appUser).where(eq(schema.appUser.id, p.userId));
    }
  }
  if (createdVacancies.length > 0) {
    await db
      .delete(schema.vacancies)
      .where(inArray(schema.vacancies.id, createdVacancies));
  }
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, CLIENT_ORG));
});

describe("agency vacancy validation", () => {
  test("an agency must name its client", async () => {
    await setOrgKind("recruitment_agency");
    const res = await makeVacancy();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/hiring company/i);
  });

  test("a typed client name is enough; a linked org snapshots its name", async () => {
    await setOrgKind("recruitment_agency");
    const typed = await makeVacancy({ clientName: "Off-Platform Client CC" });
    expect(typed.ok).toBe(true);

    const linked = await makeVacancy({ clientOrgId: CLIENT_ORG });
    expect(linked.ok).toBe(true);
    if (linked.ok) {
      const [row] = await db
        .select({
          clientOrgId: schema.vacancies.clientOrgId,
          clientName: schema.vacancies.clientName,
        })
        .from(schema.vacancies)
        .where(eq(schema.vacancies.id, linked.vacancyId));
      expect(row!.clientOrgId).toBe(CLIENT_ORG);
      expect(row!.clientName).toBe("RC Client Holdings");
    }
  });

  test("a bogus client link is refused, not silently dropped", async () => {
    await setOrgKind("recruitment_agency");
    const res = await makeVacancy({ clientOrgId: "org_does-not-exist" });
    expect(res.ok).toBe(false);
  });

  test("direct employers cannot smuggle client fields", async () => {
    await setOrgKind("direct_employer");
    const res = await makeVacancy({
      clientName: "Should Be Nulled",
      clientContact: "secret@nowhere.co.za",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const [row] = await db
        .select({
          clientName: schema.vacancies.clientName,
          clientContact: schema.vacancies.clientContact,
        })
        .from(schema.vacancies)
        .where(eq(schema.vacancies.id, res.vacancyId));
      expect(row!.clientName).toBeNull();
      expect(row!.clientContact).toBeNull();
    }
  });
});

describe("congrats-invite accept linkage", () => {
  test("direct employer: employment linked AND placement logged with the vacancy", async () => {
    await setOrgKind("direct_employer");
    const vac = await makeVacancy();
    expect(vac.ok).toBe(true);
    const vacancyId = vac.ok ? vac.vacancyId : "";

    const email = `rc-direct-${STAMP}@example.co.za`;
    createdEmails.push(email);
    const token = await makeCongratsInvite({
      id: `inv_rc-direct-${STAMP}`,
      email,
      congratsRole: "RC Test Placement Role",
      congratsVacancyId: vacancyId,
    });

    const res = await acceptSeekerInvitation({
      token,
      ...seekerPayload(email),
    } as never);
    expect(res.ok).toBe(true);

    const p = await profileByEmail(email);
    expect(p).not.toBeNull();
    expect(p!.currentEmployerOrgId).toBe(ORG);

    const placs = await db
      .select({
        organizationId: schema.placements.organizationId,
        vacancyId: schema.placements.vacancyId,
        role: schema.placements.role,
        source: schema.placements.source,
      })
      .from(schema.placements)
      .where(eq(schema.placements.profileId, p!.profileId));
    expect(placs).toHaveLength(1);
    expect(placs[0]!.organizationId).toBe(ORG);
    expect(placs[0]!.vacancyId).toBe(vacancyId);
    expect(placs[0]!.source).toBe("employer_confirmed");
  });

  test("agency: linked client becomes the employer; NO auto-placement", async () => {
    await setOrgKind("recruitment_agency");
    const vac = await makeVacancy({ clientOrgId: CLIENT_ORG });
    expect(vac.ok).toBe(true);
    const vacancyId = vac.ok ? vac.vacancyId : "";

    const email = `rc-agency-${STAMP}@example.co.za`;
    createdEmails.push(email);
    const token = await makeCongratsInvite({
      id: `inv_rc-agency-${STAMP}`,
      email,
      congratsRole: "RC Test Placement Role",
      congratsVacancyId: vacancyId,
    });

    const res = await acceptSeekerInvitation({
      token,
      ...seekerPayload(email),
    } as never);
    expect(res.ok).toBe(true);

    const p = await profileByEmail(email);
    expect(p).not.toBeNull();
    // The AGENCY is never the employer; the linked client is.
    expect(p!.currentEmployerOrgId).toBe(CLIENT_ORG);

    const placs = await db
      .select({ id: schema.placements.id })
      .from(schema.placements)
      .where(eq(schema.placements.profileId, p!.profileId));
    expect(placs).toHaveLength(0);
  });
});
