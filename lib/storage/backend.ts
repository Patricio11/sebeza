/**
 * 2026-08  storage backend seam (founder decision: storage must be
 * admin-configurable like the messaging channels, with S3 as the
 * primary target  same posture as the working PayLink Pro setup).
 *
 * Resolution order:
 *   1. An ENABLED `integration_settings` row with channel "storage"
 *      (provider "s3" or "supabase", secrets AES-encrypted at rest).
 *   2. Env fallback: the historical SUPABASE_* vars, unchanged.
 *
 * The DB row is cached in-process for 30s  signed photo URLs render
 * on every profile card and must not cost a DB round-trip each.
 * `invalidateStorageBackendCache()` is called by the admin save /
 * enable actions so changes apply immediately on the instance that
 * made them (and within TTL everywhere else).
 *
 * S3 notes carried over from the proven PayLink implementation:
 *   - `requestChecksumCalculation: "WHEN_REQUIRED"`  the SDK's
 *     checksum query params break presigned browser GETs (403).
 *   - custom `endpoint` + `forcePathStyle` for S3-compatible hosts.
 *   - static keys when provided, default credential chain otherwise.
 *   - ServerSideEncryption AES256 on every put.
 */

import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptField } from "@/lib/crypto";
import { StorageError, isStorageConfigured, BUCKET } from "./supabase";

export type StorageProvider = "s3" | "supabase";
export type StorageSource = "admin" | "env" | "none";

export interface StorageBackend {
  provider: StorageProvider;
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  signedUrl(
    key: string,
    ttlSeconds: number,
    opts?: { width?: number },
  ): Promise<string | null>;
  /** Round-trip probe (write → read → delete) for the admin Test button. */
  test(): Promise<{ ok: boolean; message: string }>;
}

// ─── Builders ────────────────────────────────────────────────────────────────

function s3Backend(
  config: Record<string, string>,
  secrets: Record<string, string>,
): StorageBackend {
  const region = config.region || "af-south-1";
  const bucket = config.bucket || BUCKET;
  const hasStaticKeys = Boolean(secrets.accessKeyId && secrets.secretAccessKey);

  const client = new S3Client({
    region,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    ...(config.endpoint
      ? { endpoint: config.endpoint, forcePathStyle: true }
      : {}),
    ...(hasStaticKeys
      ? {
          credentials: {
            accessKeyId: secrets.accessKeyId!,
            secretAccessKey: secrets.secretAccessKey!,
          },
        }
      : {}),
  });

  return {
    provider: "s3",
    async upload(key, bytes, contentType) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
            ServerSideEncryption: "AES256",
          }),
        );
      } catch (e) {
        throw new StorageError(
          "upload_failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    },
    async remove(key) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        );
      } catch (e) {
        throw new StorageError(
          "delete_failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    },
    async signedUrl(key, ttlSeconds) {
      // Width transforms are a Supabase feature; S3 serves originals.
      try {
        return await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: ttlSeconds },
        );
      } catch {
        return null;
      }
    },
    async test() {
      const key = `__connection_test__/probe-${Date.now()}.txt`;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: "sebenza storage connection test",
            ContentType: "text/plain",
            ServerSideEncryption: "AES256",
          }),
        );
        try {
          await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        } catch (ge) {
          return {
            ok: false,
            message:
              `Write OK, but read (GetObject) failed on "${bucket}": ` +
              `${ge instanceof Error ? ge.message : String(ge)}. Grant s3:GetObject on the bucket objects  signed downloads need it.`,
          };
        }
        let cleaned = true;
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: key }),
          );
        } catch {
          cleaned = false;
        }
        return {
          ok: true,
          message: `Connected to S3 (${region}); write + read on "${bucket}" OK${
            cleaned
              ? "; probe cleaned up."
              : " (probe left  DeleteObject not granted; uploads replace by key, so this only matters for document removal)."
          }`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `S3 test failed: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`,
        };
      }
    },
  };
}

function supabaseBackend(
  url: string,
  serviceKey: string,
  bucket: string,
): StorageBackend {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    provider: "supabase",
    async upload(key, bytes, contentType) {
      const { error } = await client.storage
        .from(bucket)
        .upload(key, bytes, { contentType, upsert: true });
      if (error) throw new StorageError("upload_failed", error.message);
    },
    async remove(key) {
      const { error } = await client.storage.from(bucket).remove([key]);
      if (error) throw new StorageError("delete_failed", error.message);
    },
    async signedUrl(key, ttlSeconds, opts) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(key, ttlSeconds);
      if (error || !data) return null;
      let signed = data.signedUrl;
      if (opts?.width && opts.width > 0) {
        const sep = signed.includes("?") ? "&" : "?";
        signed = `${signed}${sep}width=${Math.round(opts.width)}&resize=cover`;
      }
      return signed;
    },
    async test() {
      const key = `__connection_test__/probe-${Date.now()}.txt`;
      try {
        const up = await client.storage
          .from(bucket)
          .upload(key, new Blob(["sebenza storage connection test"]), {
            upsert: true,
          });
        if (up.error) {
          return {
            ok: false,
            message: `Supabase upload failed on "${bucket}": ${up.error.message}`,
          };
        }
        let cleaned = true;
        try {
          const rm = await client.storage.from(bucket).remove([key]);
          if (rm.error) cleaned = false;
        } catch {
          cleaned = false;
        }
        return {
          ok: true,
          message: `Connected to Supabase; write on "${bucket}" OK${
            cleaned ? "; probe cleaned up." : " (probe left  delete not permitted)."
          }`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `Supabase test failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  };
}

/** Builder shared by the live resolution path and the admin Test action. */
export function buildStorageBackend(
  provider: StorageProvider,
  config: Record<string, string>,
  secrets: Record<string, string>,
): StorageBackend {
  if (provider === "s3") return s3Backend(config, secrets);
  const url = config.url || "";
  const serviceKey = secrets.serviceKey || "";
  if (!url || !serviceKey) {
    throw new StorageError(
      "not_configured",
      "Supabase storage needs a project URL and a service-role key.",
    );
  }
  return supabaseBackend(url, serviceKey, config.bucket || BUCKET);
}

// ─── Resolution (admin row → env fallback) ───────────────────────────────────

interface ResolvedStorage {
  backend: StorageBackend | null;
  source: StorageSource;
}

const CACHE_TTL_MS = 30_000;
let cache: { at: number; value: ResolvedStorage } | null = null;

export function invalidateStorageBackendCache(): void {
  cache = null;
}

async function resolveUncached(): Promise<ResolvedStorage> {
  // 1. Enabled admin row wins. Never throws: an undecryptable row
  //    degrades to the env path, so a key rotation can't take uploads down.
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.integrationSettings)
      .where(eq(schema.integrationSettings.channel, "storage"))
      .limit(1);
    if (row?.enabled && row.credentialsEnc) {
      const config = (row.config ?? {}) as Record<string, string>;
      const secrets = JSON.parse(decryptField(row.credentialsEnc)) as Record<
        string,
        string
      >;
      const provider: StorageProvider =
        config.provider === "supabase" ? "supabase" : "s3";
      return { backend: buildStorageBackend(provider, config, secrets), source: "admin" };
    }
  } catch {
    // fall through to env
  }

  // 2. Historical env-configured Supabase.
  if (isStorageConfigured()) {
    return {
      backend: supabaseBackend(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        BUCKET,
      ),
      source: "env",
    };
  }

  return { backend: null, source: "none" };
}

async function resolve(): Promise<ResolvedStorage> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const value = await resolveUncached();
  cache = { at: Date.now(), value };
  return value;
}

/** The active backend, or a thrown not_configured StorageError. */
export async function getStorageBackend(): Promise<StorageBackend> {
  const { backend } = await resolve();
  if (!backend) {
    throw new StorageError(
      "not_configured",
      "File storage isn't configured. An admin can set it up under Admin → Integrations → Storage.",
    );
  }
  return backend;
}

/** Hub display only: which source is live + which provider. */
export async function storageStatus(): Promise<{
  source: StorageSource;
  provider: StorageProvider | null;
}> {
  const { backend, source } = await resolve();
  return { source, provider: backend?.provider ?? null };
}
