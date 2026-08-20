/**
 * 2026-08  storage backend seam (founder decision: storage must be
 * admin-configurable like the messaging channels, on S3  same posture
 * as the working PayLink Pro setup).
 *
 * Storage is S3 (or any S3-compatible host). The ONLY source is an
 * ENABLED `integration_settings` row with channel "storage", whose
 * credentials are AES-encrypted at rest and managed on
 * /admin/integrations. There is no env fallback and no second vendor:
 * Supabase Storage was removed on 2026-08-20 (founder decision) after
 * every stored object was confirmed to live in S3.
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
import { StorageError, BUCKET } from "./config";

export type StorageProvider = "s3";
export type StorageSource = "admin" | "none";

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

/** Builder shared by the live resolution path and the admin Test action. */
export function buildStorageBackend(
  _provider: StorageProvider,
  config: Record<string, string>,
  secrets: Record<string, string>,
): StorageBackend {
  return s3Backend(config, secrets);
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
      return { backend: buildStorageBackend("s3", config, secrets), source: "admin" };
    }
  } catch {
    // An undecryptable row must not take uploads down with a crash;
    // it degrades to "not configured" and the admin sees it on the hub.
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

/**
 * True when ANY storage provider is available (admin config OR the env
 * fallback). 2026-08-20: read paths used to gate on the Supabase-only
 * `isStorageConfigured()`, so once live storage moved to S3 every
 * profile photo silently rendered as initials. Ask the SEAM, never a
 * single vendor's env vars.
 */
export async function isStorageAvailable(): Promise<boolean> {
  const { backend } = await resolve();
  return backend !== null;
}

/** Hub display only: which source is live + which provider. */
export async function storageStatus(): Promise<{
  source: StorageSource;
  provider: StorageProvider | null;
}> {
  const { backend, source } = await resolve();
  return { source, provider: backend?.provider ?? null };
}
