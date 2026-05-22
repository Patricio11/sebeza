/**
 * Signed-URL helpers for reading objects out of the private Supabase bucket.
 *
 * Reads are short-lived (DOCUMENT_URL_TTL = 60s, PHOTO_URL_TTL = 5min).
 * Every callsite that reveals a document SHOULD be wrapped in a `logAccess()`
 * — Redaction Rule + audit trail.
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

export async function signedPhotoUrl(key: string): Promise<string | null> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .createSignedUrl(key, PHOTO_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}
