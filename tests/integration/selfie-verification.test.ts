/**
 * 2026-08  live-selfie verification (docs/SELFIE_VERIFICATION_PLAN.md),
 * against the real database.
 *
 * Contracts:
 *   - flag OFF → both actions refuse
 *   - challenge: two DISTINCT gestures; one-time use; must be the caller's
 *   - completion stamps selfie_verified_at, flips the 9.14 roll-up to
 *     `verified`, and the same challenge can never complete twice
 *   - qualification evidence uploads are retired (endpoint refuses)
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

const SEEKER = {
  id: "",
  role: "seeker" as const,
  email: "andile-z@example.co.za",
};
let flagValue = false;

vi.mock("@/lib/auth/dal", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/dal")>();
  return { ...original, verifyRole: vi.fn(async () => SEEKER) };
});
vi.mock("@/lib/auth/guard", () => ({
  getSessionUser: vi.fn(async () => SEEKER),
}));
vi.mock("@/lib/admin/settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/settings")>();
  return {
    ...original,
    getSetting: vi.fn(async (key: string) =>
      key === "feature_flag_selfie_verification"
        ? flagValue
        : original.getSetting(key as never),
    ),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
// The WebP pipeline has its own tests; here the capture just "lands".
vi.mock("@/lib/storage/upload", () => ({
  uploadPhoto: vi.fn(async (o: { userId: string }) => ({
    key: `${o.userId}/photos/avatar.webp`,
    mime: "image/webp",
  })),
  deleteStorageObject: vi.fn(async () => {}),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  startSelfieVerification,
  completeSelfieVerification,
} from "@/lib/profile/selfie";
import { uploadQualificationDocument } from "@/lib/profile/qualifications";

const db = getDb();
let profileId = "";
let originalVerification = "";
let originalPhoto: string | null = null;

beforeAll(async () => {
  const [row] = await db
    .select({
      id: schema.profiles.id,
      userId: schema.profiles.userId,
      verification: schema.profiles.verification,
      photo: schema.profiles.profilePhotoUrl,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, "andile-z"))
    .limit(1);
  if (!row) throw new Error("seed profile andile-z missing");
  profileId = row.id;
  SEEKER.id = row.userId;
  originalVerification = row.verification;
  originalPhoto = row.photo;
});

afterAll(async () => {
  await db
    .update(schema.profiles)
    .set({
      selfieVerifiedAt: null,
      verification: originalVerification as "unverified",
      profilePhotoUrl: originalPhoto,
    })
    .where(eq(schema.profiles.id, profileId));
  await db
    .delete(schema.selfieChallenges)
    .where(eq(schema.selfieChallenges.userId, SEEKER.id));
});

function captureForm(challengeId: string): FormData {
  const form = new FormData();
  form.set("challengeId", challengeId);
  form.set("file", new File([new Uint8Array([1, 2, 3])], "selfie.jpg", { type: "image/jpeg" }));
  return form;
}

describe("live-selfie verification", () => {
  test("flag OFF → refused", async () => {
    flagValue = false;
    const start = await startSelfieVerification();
    expect(start.ok).toBe(false);
    const complete = await completeSelfieVerification(captureForm("sc_x"));
    expect(complete.ok).toBe(false);
  });

  test("full flow: challenge → complete → verified; challenge single-use", async () => {
    flagValue = true;

    const start = await startSelfieVerification();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    expect(start.gestures).toHaveLength(2);
    expect(start.gestures[0]).not.toBe(start.gestures[1]);

    // A foreign / unknown challenge id never completes.
    const wrong = await completeSelfieVerification(captureForm("sc_not-mine"));
    expect(wrong.ok).toBe(false);

    const done = await completeSelfieVerification(captureForm(start.challengeId));
    expect(done.ok).toBe(true);

    const [profile] = await db
      .select({
        selfieAt: schema.profiles.selfieVerifiedAt,
        verification: schema.profiles.verification,
        photo: schema.profiles.profilePhotoUrl,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, profileId));
    expect(profile?.selfieAt).toBeTruthy();
    expect(profile?.verification).toBe("verified");
    expect(profile?.photo).toBe(`${SEEKER.id}/photos/avatar.webp`);

    // Replay of the same challenge is refused.
    const replay = await completeSelfieVerification(captureForm(start.challengeId));
    expect(replay.ok).toBe(false);
  });
});

describe("qualification evidence retirement", () => {
  test("uploadQualificationDocument refuses with the self-declared message", async () => {
    const form = new FormData();
    form.set("qualificationId", "qual_whatever");
    form.set("file", new File([new Uint8Array([1])], "cert.pdf", { type: "application/pdf" }));
    const res = await uploadQualificationDocument(form);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("self-declared");
  });
});
