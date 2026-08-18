/**
 * 2026-08  storage backend seam (lib/storage/backend), against the real
 * database.
 *
 * Contracts:
 *   - resolution order: ENABLED admin "storage" row → env Supabase →
 *     not_configured (thrown as a friendly StorageError)
 *   - a disabled admin row does NOT win (enable is explicit)
 *   - buildStorageBackend("supabase") without url/serviceKey refuses
 *   - the admin save action validates the storage config shape
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
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
import { encryptField } from "@/lib/crypto";
import {
  buildStorageBackend,
  getStorageBackend,
  invalidateStorageBackendCache,
  storageStatus,
} from "@/lib/storage/backend";
import { saveIntegration } from "@/lib/admin/integrations";
import { StorageError } from "@/lib/storage/supabase";

const db = getDb();

const savedEnv = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

async function deleteStorageRow() {
  await db
    .delete(schema.integrationSettings)
    .where(eq(schema.integrationSettings.channel, "storage"));
  invalidateStorageBackendCache();
}

beforeAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await deleteStorageRow();
});

afterAll(async () => {
  if (savedEnv.url) process.env.SUPABASE_URL = savedEnv.url;
  if (savedEnv.key) process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.key;
  await deleteStorageRow();
});

describe("storage backend resolution", () => {
  test("nothing configured → none + friendly StorageError", async () => {
    const status = await storageStatus();
    expect(status.source).toBe("none");
    await expect(getStorageBackend()).rejects.toThrowError(StorageError);
    await expect(getStorageBackend()).rejects.toThrow(/Integrations/);
  });

  test("a DISABLED admin row does not win", async () => {
    await db.insert(schema.integrationSettings).values({
      channel: "storage",
      enabled: false,
      credentialsEnc: encryptField(
        JSON.stringify({ accessKeyId: "AKIATEST", secretAccessKey: "shhh" }),
      ),
      config: { provider: "s3", bucket: "sebenza-test", region: "af-south-1" },
    });
    invalidateStorageBackendCache();

    const status = await storageStatus();
    expect(status.source).toBe("none");
  });

  test("an ENABLED admin S3 row wins and builds an S3 backend", async () => {
    await db
      .update(schema.integrationSettings)
      .set({ enabled: true })
      .where(eq(schema.integrationSettings.channel, "storage"));
    invalidateStorageBackendCache();

    const status = await storageStatus();
    expect(status.source).toBe("admin");
    expect(status.provider).toBe("s3");

    const backend = await getStorageBackend();
    expect(backend.provider).toBe("s3");
    // Presigning is local crypto (no network)  a signed URL must mint.
    const url = await backend.signedUrl("probe/x.pdf", 60);
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain("sebenza-test");
    expect(url).toContain("X-Amz-Signature=");

    await deleteStorageRow();
  });

  test("env Supabase is the fallback when set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    invalidateStorageBackendCache();

    const status = await storageStatus();
    expect(status.source).toBe("env");
    expect(status.provider).toBe("supabase");

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    invalidateStorageBackendCache();
  });

  test("supabase builder refuses missing url / service key", () => {
    expect(() =>
      buildStorageBackend("supabase", { bucket: "b" }, {}),
    ).toThrowError(StorageError);
  });
});

describe("saveIntegration storage validation", () => {
  afterAll(deleteStorageRow);

  test("rejects a non-URL endpoint, accepts a clean S3 config", async () => {
    const bad = await saveIntegration(
      "storage",
      { provider: "s3", bucket: "sebenza-private", endpoint: "not-a-url" },
      { accessKeyId: "AKIATEST", secretAccessKey: "shhh" },
    );
    expect(bad.ok).toBe(false);

    const good = await saveIntegration(
      "storage",
      {
        provider: "s3",
        bucket: "sebenza-private",
        region: "af-south-1",
        endpoint: "",
        url: "",
      },
      { accessKeyId: "AKIATEST", secretAccessKey: "shhh" },
    );
    expect(good.ok).toBe(true);

    // Saved but not enabled  configuring never auto-enables.
    const [row] = await db
      .select()
      .from(schema.integrationSettings)
      .where(eq(schema.integrationSettings.channel, "storage"));
    expect(row?.enabled).toBe(false);
    expect(row?.credentialsEnc).toBeTruthy();
  });
});
