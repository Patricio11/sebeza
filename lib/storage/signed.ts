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
import { DOCUMENT_URL_TTL, PHOTO_URL_TTL } from "./config";
import { getStorageBackend } from "./backend";
import { photoThumbKey, hasPhotoThumb } from "./keys";

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
    // 2026-08  small renders serve the pre-built 256px WebP thumb
    // (exists for every photo minted by the WebP pipeline). Works the
    // same on S3 and Supabase; legacy jpg/png keys fall through to the
    // main object (with Supabase's on-the-fly transform when available).
    if (options?.width && options.width <= 256 && hasPhotoThumb(key)) {
      const thumb = await backend.signedUrl(photoThumbKey(key), PHOTO_URL_TTL);
      if (thumb) return thumb;
    }
    return await backend.signedUrl(key, PHOTO_URL_TTL, options);
  } catch {
    return null;
  }
}
