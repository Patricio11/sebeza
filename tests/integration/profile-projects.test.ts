/**
 * 2026-08-19  "Work & projects" actions, against the real database.
 *
 * Contracts:
 *   - flag OFF → every mutating action refuses
 *   - blocked link schemes + contact-shaped notes are refused
 *   - the 6-project cap holds
 *   - another seeker's project id is never editable (ownership)
 *   - delete removes the row (image sweep is best-effort, mocked here)
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

const SEEKER = { id: "", role: "seeker" as const, email: "andile-z@example.co.za" };
let flagValue = false;

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return { ...original, verifyRole: vi.fn(async () => SEEKER) };
});
vi.mock("@/lib/admin/settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/settings")>();
  return {
    ...original,
    getSetting: vi.fn(async (key: string) =>
      key === "feature_flag_seeker_projects"
        ? flagValue
        : original.getSetting(key as never),
    ),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/storage/upload", () => ({
  uploadProjectImage: vi.fn(async (o: { userId: string; id: string }) => ({
    key: `${o.userId}/project-images/${o.id}.webp`,
    mime: "image/webp",
  })),
  deleteStorageObject: vi.fn(async () => {}),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  addProject,
  updateProject,
  deleteProject,
} from "@/lib/profile/projects";
import { MAX_PROJECTS } from "@/lib/profile/project-links";
import { listProjectsForProfile } from "@/lib/profile/projects-read";

const db = getDb();
let profileId = "";
let otherProjectId = "";

beforeAll(async () => {
  const [me] = await db
    .select({ id: schema.profiles.id, userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, "andile-z"))
    .limit(1);
  profileId = me!.id;
  SEEKER.id = me!.userId;

  // A project owned by SOMEONE ELSE, for the ownership check.
  const [other] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, "lerato-n"))
    .limit(1);
  otherProjectId = "proj_test-other-owner";
  await db.insert(schema.profileProjects).values({
    id: otherProjectId,
    profileId: other!.id,
    title: "Someone else's project",
    contribution: "Not yours to edit.",
  });
});

afterAll(async () => {
  await db
    .delete(schema.profileProjects)
    .where(eq(schema.profileProjects.profileId, profileId));
  await db
    .delete(schema.profileProjects)
    .where(inArray(schema.profileProjects.id, [otherProjectId]));
});

const VALID = {
  title: "Township delivery tracker",
  url: "github.com/andile/tracker",
  contribution: "I built the backend and the SMS notifications.",
  year: 2025,
};

describe("work & projects actions", () => {
  test("flag OFF → refused", async () => {
    flagValue = false;
    const res = await addProject(VALID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/aren't available/);
  });

  test("adds, normalises the link, and reads back", async () => {
    flagValue = true;
    const res = await addProject(VALID);
    expect(res.ok).toBe(true);

    const list = await listProjectsForProfile(profileId);
    const mine = list.find((p) => p.title === VALID.title);
    expect(mine?.url).toBe("https://github.com/andile/tracker");
    expect(mine?.hostname).toBe("github.com");
    expect(mine?.year).toBe(2025);
  });

  test("refuses blocked schemes and contact-shaped notes", async () => {
    const scheme = await addProject({ ...VALID, url: "javascript:alert(1)" });
    expect(scheme.ok).toBe(false);

    const mailto = await addProject({ ...VALID, url: "mailto:me@example.com" });
    expect(mailto.ok).toBe(false);

    const contact = await addProject({
      ...VALID,
      url: "",
      contribution: "Call me on 082 123 4567 for details.",
    });
    expect(contact.ok).toBe(false);
    if (!contact.ok) expect(contact.message).toMatch(/phone numbers/);
  });

  test("caps at MAX_PROJECTS", async () => {
    // One already exists from the add test.
    for (let i = 1; i < MAX_PROJECTS; i++) {
      const r = await addProject({ ...VALID, url: "", title: `Project ${i}` });
      expect(r.ok).toBe(true);
    }
    const overflow = await addProject({ ...VALID, url: "", title: "One too many" });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.message).toMatch(/up to 6 projects/i);
  });

  test("never edits or deletes another seeker's project", async () => {
    const edit = await updateProject({
      ...VALID,
      url: "",
      id: otherProjectId,
      title: "Hijacked",
    });
    expect(edit.ok).toBe(false);

    const del = await deleteProject({ id: otherProjectId });
    expect(del.ok).toBe(false);

    const [still] = await db
      .select({ title: schema.profileProjects.title })
      .from(schema.profileProjects)
      .where(eq(schema.profileProjects.id, otherProjectId));
    expect(still?.title).toBe("Someone else's project");
  });

  test("delete removes the row", async () => {
    const list = await listProjectsForProfile(profileId);
    const target = list[0]!;
    const res = await deleteProject({ id: target.id });
    expect(res.ok).toBe(true);
    const after = await listProjectsForProfile(profileId);
    expect(after.find((p) => p.id === target.id)).toBeUndefined();
  });
});
