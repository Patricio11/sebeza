/**
 * Signed-URL helpers for reading objects out of the private Supabase bucket.
 *
 * Reads are short-lived (DOCUMENT_URL_TTL = 60s, PHOTO_URL_TTL = 5min).
 * Every callsite that reveals a document SHOULD be wrapped in a `logAccess()`
 *  Redaction Rule + audit trail.
 */

import "server-only";
import {
  getStorageClient,
  BUCKET,
  DOCUMENT_URL_TTL,
  PHOTO_URL_TTL,
} from "./supabase";

export async function signedDocumentUrl(key: string): Promise<string | null> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .createSignedUrl(key, DOCUMENT_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function signedPhotoUrl(
  key: string,
  /**
   * Phase 11.5.4  optional width hint. When set, the signed URL is
   * decorated with Supabase image-transform query params so the
   * provider returns a downscaled variant. Saves bandwidth on small
   * viewports (mobile avatars at ~64px display don't need the
   * full-size original). Resolution-density aware variants should be
   * computed at the call site (e.g. 64 * DPR).
   *
   * Supabase Storage's `?width=N&resize=cover` is honoured for image
   * objects; non-image keys pass through unchanged.
   */
  options?: { width?: number },
): Promise<string | null> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .createSignedUrl(key, PHOTO_URL_TTL);
  if (error || !data) return null;
  let url = data.signedUrl;
  if (options?.width && options.width > 0) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}width=${Math.round(options.width)}&resize=cover`;
  }
  return url;
}
