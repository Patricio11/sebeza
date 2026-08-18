/**
 * 2026-08  admin hard-delete for organisations + taxonomy label edits,
 * against the real database.
 *
 * Delete contracts:
 *   - typed-name confirmation is re-checked server-side
 *   - an org with confirmed placements can NEVER be deleted
 *     (Placement-Truth: hire records feed national statistics)
 *   - a clean delete removes the org row and everything hanging off it
 *     (members, vacancies, documents, seeker invitations) while member
 *     USER accounts survive
 *
 * Taxonomy edit contracts:
 *   - label changes land; the slug (PK, referenced as text by profiles
 *     and vacancies) never changes
 *   - unknown slugs are refused, not upserted
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const ADMIN = {
  id: "user_sebenza-admin",
  role: "admin" as const,
  email: "admin@sebenzasa.com",
};

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return {
    ...original,
    verifyAdmin: vi.fn(async () => ADMIN),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { deleteOrganization } from "@/lib/admin/org-vetting";
import { updateProfession, updateSkill } from "@/lib/admin/taxonomy";

const db = getDb();

const ORG_ID = `org_test-delete-${randomUUID().slice(0, 8)}`;
const ORG_NAME = "Duplicate Test Org (delete me)";

async function seedOrg() {
  const anyUser = (
    await db.select({ id: schema.appUser.id }).from(schema.appUser).limit(1)
  )[0];
  const anyProfile = (
    await db.select({ id: schema.profiles.id }).from(schema.profiles).limit(1)
  )[0];
  const anyProfession = (
    await db
      .select({ slug: schema.professions.slug })
      .from(schema.professions)
      .limit(1)
  )[0];
  if (!anyUser || !anyProfile || !anyProfession) {
    throw new Error("Seed data missing (user / profile / profession).");
  }

  await db.insert(schema.organizations).values({
    id: ORG_ID,
    name: ORG_NAME,
    verification: "verified",
  });
  await db.insert(schema.organizationMembers).values({
    id: `om_${randomUUID()}`,
    organizationId: ORG_ID,
    userId: anyUser.id,
    role: "owner",
  });
  await db.insert(schema.vacancies).values({
    id: `vac_${randomUUID()}`,
    organizationId: ORG_ID,
    createdByUserId: anyUser.id,
    title: "Test vacancy",
    professionSlug: anyProfession.slug,
  });
  await db.insert(schema.organizationDocuments).values({
    id: `doc_${randomUUID()}`,
    organizationId: ORG_ID,
    kind: "other",
    originalName: "test.pdf",
    storageKey: `${anyUser.id}/org-documents/test-${randomUUID().slice(0, 8)}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 123,
    uploadedByUserId: anyUser.id,
  });
  await db.insert(schema.seekerInvitations).values({
    id: `si_${randomUUID()}`,
    organizationId: ORG_ID,
    invitedByUserId: anyUser.id,
    email: "invitee@example.co.za",
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return { user: anyUser, profile: anyProfile };
}

afterAll(async () => {
  // Belt-and-braces: if an assertion failed mid-flight, sweep the org.
  await db
    .delete(schema.placements)
    .where(eq(schema.placements.organizationId, ORG_ID));
  await db
    .delete(schema.seekerInvitations)
    .where(eq(schema.seekerInvitations.organizationId, ORG_ID));
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, ORG_ID));
});

describe("deleteOrganization", () => {
  test("full lifecycle: name check, placement refusal, clean cascade", async () => {
    const { user, profile } = await seedOrg();

    // (1) wrong confirmation name  refused.
    const wrongName = await deleteOrganization({
      orgId: ORG_ID,
      confirmName: "Wrong Name",
    });
    expect(wrongName.ok).toBe(false);

    // (2) unknown org  refused.
    const unknown = await deleteOrganization({
      orgId: "org_does-not-exist",
      confirmName: "whatever",
    });
    expect(unknown.ok).toBe(false);

    // (3) with a confirmed placement  refused even with the right name.
    const placementId = `pl_${randomUUID()}`;
    await db.insert(schema.placements).values({
      id: placementId,
      profileId: profile.id,
      organizationId: ORG_ID,
      role: "Test role",
      city: "Cape Town",
    });
    const withPlacement = await deleteOrganization({
      orgId: ORG_ID,
      confirmName: ORG_NAME,
    });
    expect(withPlacement.ok).toBe(false);
    if (!withPlacement.ok) {
      expect(withPlacement.message).toContain("placement");
    }
    await db
      .delete(schema.placements)
      .where(eq(schema.placements.id, placementId));

    // (4) clean delete  org + dependents gone, member USER survives.
    const res = await deleteOrganization({
      orgId: ORG_ID,
      confirmName: ORG_NAME,
    });
    expect(res.ok).toBe(true);

    const orgLeft = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, ORG_ID));
    expect(orgLeft).toHaveLength(0);
    const membersLeft = await db
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.organizationId, ORG_ID));
    expect(membersLeft).toHaveLength(0);
    const vacanciesLeft = await db
      .select({ id: schema.vacancies.id })
      .from(schema.vacancies)
      .where(eq(schema.vacancies.organizationId, ORG_ID));
    expect(vacanciesLeft).toHaveLength(0);
    const docsLeft = await db
      .select({ id: schema.organizationDocuments.id })
      .from(schema.organizationDocuments)
      .where(eq(schema.organizationDocuments.organizationId, ORG_ID));
    expect(docsLeft).toHaveLength(0);
    const invitesLeft = await db
      .select({ id: schema.seekerInvitations.id })
      .from(schema.seekerInvitations)
      .where(eq(schema.seekerInvitations.organizationId, ORG_ID));
    expect(invitesLeft).toHaveLength(0);

    const userSurvives = await db
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, user.id));
    expect(userSurvives).toHaveLength(1);
  });
});

describe("taxonomy label edits", () => {
  test("updateSkill changes the label, keeps the slug, refuses unknowns", async () => {
    const slug = `test-edit-skill-${randomUUID().slice(0, 8)}`;
    await db.insert(schema.skills).values({ slug, label: "Before" });
    try {
      const res = await updateSkill({ slug, label: "After Edit" });
      expect(res.ok).toBe(true);
      const row = (
        await db
          .select({ label: schema.skills.label })
          .from(schema.skills)
          .where(eq(schema.skills.slug, slug))
      )[0];
      expect(row?.label).toBe("After Edit");

      const unknown = await updateSkill({
        slug: "test-no-such-skill",
        label: "Nope",
      });
      expect(unknown.ok).toBe(false);
      const upserted = await db
        .select({ slug: schema.skills.slug })
        .from(schema.skills)
        .where(eq(schema.skills.slug, "test-no-such-skill"));
      expect(upserted).toHaveLength(0);
    } finally {
      await db.delete(schema.skills).where(eq(schema.skills.slug, slug));
    }
  });

  test("updateProfession changes the label only", async () => {
    const slug = `test-edit-prof-${randomUUID().slice(0, 8)}`;
    await db.insert(schema.professions).values({ slug, label: "Before" });
    try {
      const res = await updateProfession({ slug, label: "After Edit" });
      expect(res.ok).toBe(true);
      const row = (
        await db
          .select({ label: schema.professions.label })
          .from(schema.professions)
          .where(eq(schema.professions.slug, slug))
      )[0];
      expect(row?.label).toBe("After Edit");
    } finally {
      await db
        .delete(schema.professions)
        .where(eq(schema.professions.slug, slug));
    }
  });
});
