/**
 * Vendor-neutral storage constants + the error type.
 *
 * 2026-08-20: replaced `lib/storage/supabase.ts`. Storage is S3 (or any
 * S3-compatible host), configured by an admin on /admin/integrations
 * with credentials encrypted in the database. Nothing here knows about
 * a specific vendor: `lib/storage/backend.ts` is the only file that
 * talks to a provider SDK.
 */

/** Default bucket name when the admin config doesn't name one. */
export const BUCKET = process.env.STORAGE_BUCKET ?? "sebenza-private";

/** Signed-URL TTLs (seconds). Short by design: Critical UX Rule §3. */
export const DOCUMENT_URL_TTL = 60; // direct download / preview
export const PHOTO_URL_TTL = 300; // long enough for a profile render cycle

export type StorageErrorCode =
  | "not_configured"
  | "too_large"
  | "wrong_type"
  | "bad_content"
  | "upload_failed"
  | "delete_failed"
  | "rate_limited";

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
