/**
 * Signed-URL helpers for reading objects out of private storage.
 *
 * 2026-08: routed through the storage backend seam (lib/storage/backend)
 * so the admin-configured provider (S3 or Supabase) serves reads too.
 * Reads stay short-lived (DOCUMENT_URL_TTL = 60s, PHOTO_URL_TTL = 5min).
 * Every callsite that reveals a document SHOULD be wrapped in a
 * `logAccess()`  Redaction Rule + audit trail.
 */

import "server-only";
import { DOCUMENT_URL_TTL, PHOTO_URL_TTL } from "./supabase";
import { getStorageBackend } from "./backend";

export async function signedDocumentUrl(key: string): Promise<string | null> {
  try {
    const backend = await getStorageBackend();
    return await backend.signedUrl(key, DOCUMENT_URL_TTL);
  } catch {
    return null;
  }
}

export async function signedPhotoUrl(
  key: string,
  /**
   * Phase 11.5.4  optional width hint. On Supabase the signed URL is
   * decorated with image-transform query params so the provider
   * returns a downscaled variant. S3 serves the original (no
   * transform service)  callers already treat the URL as opaque.
   */
  options?: { width?: number },
): Promise<string | null> {
  try {
    const backend = await getStorageBackend();
    return await backend.signedUrl(key, PHOTO_URL_TTL, options);
  } catch {
    return null;
  }
}
