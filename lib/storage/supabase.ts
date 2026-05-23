/**
 * Server-only Supabase Storage client.
 *
 * Vendor decision (Phase 1.5): Supabase Storage for documents + photos.
 * Used standalone  auth is Better Auth, DB is Neon. Only the Storage feature
 * of Supabase is in play.
 *
 * Why a separate file:
 *  - The service-role key bypasses Row-Level Security and MUST never reach
 *    the browser. `"server-only"` makes a stray client import fail at build
 *    time.
 *  - Single source of truth for bucket name + signed-URL TTL constants.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "sebenza-private";

/** Signed-URL TTL (seconds). Short by design  Critical UX Rule §3. */
export const DOCUMENT_URL_TTL = 60; // 1 min  for direct download / preview
export const PHOTO_URL_TTL = 300; // 5 min  long enough for the public profile render cycle

let _client: SupabaseClient | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getStorageClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. " +
        "The service-role key is on the Supabase dashboard → Project Settings → API → 'service_role'.",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export class StorageError extends Error {
  constructor(public readonly code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export type StorageErrorCode =
  | "not_configured"
  | "too_large"
  | "wrong_type"
  | "bad_content"
  | "upload_failed"
  | "delete_failed"
  | "rate_limited";
