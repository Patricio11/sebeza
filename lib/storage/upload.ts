/**
 * Validated uploaders for documents + photos.
 *
 * Rules (Phase 3 plan re-check #6):
 *  - Content-type allow-list (we never trust the browser's Content-Type
 *    header  we sniff magic bytes too)
 *  - Hard size limit (5MB photos, 10MB documents)
 *  - Naming convention: `{userId}/{kind}/{id}.{ext}`
 *  - Rate-limit (5 uploads / 10 min per user) via an in-memory map.
 *    Upstash replaces this in Phase 9.
 *
 * Returns the storage object key on success  callers then write that key
 * to their DB row (e.g. `qualifications.document_storage_key`).
 */

import "server-only";
import { getStorageClient, BUCKET, StorageError } from "./supabase";

const MB = 1024 * 1024;
const DOC_MAX_BYTES = 10 * MB;
const PHOTO_MAX_BYTES = 5 * MB;

const DOC_ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const PHOTO_ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

// ─── Rate limiting (per-user, in-memory; Upstash in Phase 9) ──────────────────

interface RateBucket {
  count: number;
  windowStartedAt: number;
}
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || now - bucket.windowStartedAt > RATE_WINDOW_MS) {
    rateBuckets.set(userId, { count: 1, windowStartedAt: now });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    throw new StorageError("rate_limited", "Too many uploads  try again in a few minutes.");
  }
}

// ─── Magic-byte sniffing ──────────────────────────────────────────────────────

/**
 * Read first 12 bytes and compare against known signatures. Returns the
 * MIME we trust (or null if no match). Caller compares to the claimed type.
 *
 * We don't try to support every format  only the ones in our allow-lists.
 */
function sniffMime(buffer: Uint8Array): string | null {
  // PDF  "%PDF-"
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }
  // JPEG  FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG  89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  // WebP  "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function extFor(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

// ─── Uploaders ────────────────────────────────────────────────────────────────

interface UploadOpts {
  /** Authenticated user id from the session. Scopes paths + rate limits. */
  userId: string;
  /** Stable suffix for the path (e.g. qualification id). */
  id: string;
  /** The File from the multipart Server Action. */
  file: File;
}

export async function uploadDocument(opts: UploadOpts): Promise<{ key: string; mime: string }> {
  return upload({
    ...opts,
    kind: "documents",
    maxBytes: DOC_MAX_BYTES,
    allowed: DOC_ALLOWED,
  });
}

export async function uploadPhoto(opts: UploadOpts): Promise<{ key: string; mime: string }> {
  return upload({
    ...opts,
    kind: "photos",
    maxBytes: PHOTO_MAX_BYTES,
    allowed: PHOTO_ALLOWED,
  });
}

/**
 * Phase 9.10  KYC document uploads on the org-onboarding form.
 * Same magic-byte sniff + rate limit + size cap as `uploadDocument()`;
 * different folder (`{userId}/org-documents/...`) so admin oversight
 * + future cleanup can scope by prefix. Caller passes the Owner's
 * userId  one Owner per org by Phase 9.10 convention.
 */
export async function uploadOrgDocument(
  opts: UploadOpts,
): Promise<{ key: string; mime: string }> {
  return upload({
    ...opts,
    kind: "org-documents",
    maxBytes: DOC_MAX_BYTES,
    allowed: DOC_ALLOWED,
  });
}

/**
 * Phase 9.16  seeker ID document upload (SA ID book/card scan or
 * passport bio page). Lives in its own `{userId}/id-documents/...`
 * folder so admin reviewers can spot it at a glance + so a future
 * KYC-SaaS migration can sweep the prefix when the partnership
 * lands. Same magic-byte sniff + rate limit + size cap as
 * `uploadDocument()`.
 */
export async function uploadIdDocument(
  opts: UploadOpts,
): Promise<{ key: string; mime: string }> {
  return upload({
    ...opts,
    kind: "id-documents",
    maxBytes: DOC_MAX_BYTES,
    allowed: DOC_ALLOWED,
  });
}

/**
 * Phase 11.5.2  personal CV backup upload. PDF only (D2 keeps the
 * scope tight). Same magic-byte sniff + rate limit; smaller 5MB cap
 * so seekers can re-upload often without hitting storage quotas.
 * Lives under `{userId}/cvs/...`  the seeker's own folder, never
 * surfaced to employers.
 */
const CV_MAX_BYTES = 5 * MB;
const CV_ALLOWED = new Set<string>(["application/pdf"]);

export async function uploadCv(
  opts: UploadOpts,
): Promise<{ key: string; mime: string }> {
  return upload({
    ...opts,
    kind: "cvs",
    maxBytes: CV_MAX_BYTES,
    allowed: CV_ALLOWED,
  });
}

async function upload(opts: {
  userId: string;
  id: string;
  file: File;
  kind: "documents" | "photos" | "org-documents" | "id-documents" | "cvs";
  maxBytes: number;
  allowed: Set<string>;
}): Promise<{ key: string; mime: string }> {
  checkRateLimit(opts.userId);

  // Size check before reading bytes.
  if (opts.file.size > opts.maxBytes) {
    const mb = Math.round(opts.maxBytes / MB);
    throw new StorageError("too_large", `File is larger than ${mb} MB.`);
  }

  // Claimed type allow-list.
  if (!opts.allowed.has(opts.file.type)) {
    throw new StorageError(
      "wrong_type",
      `File type "${opts.file.type || "unknown"}" isn't accepted here.`,
    );
  }

  // Read bytes  needed for magic-byte sniff AND for the upload itself.
  const arrayBuffer = await opts.file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const sniffed = sniffMime(bytes.subarray(0, 12));
  if (!sniffed || !opts.allowed.has(sniffed)) {
    throw new StorageError(
      "bad_content",
      "The file's contents don't match its declared type.",
    );
  }
  // Caller's claimed type must match what we sniffed  catches re-encoded
  // payloads (e.g. browser claims JPEG but file is actually a PDF).
  if (sniffed !== opts.file.type) {
    throw new StorageError(
      "bad_content",
      "Mismatched file content  please re-upload.",
    );
  }

  const key = `${opts.userId}/${opts.kind}/${opts.id}.${extFor(sniffed)}`;
  const supabase = getStorageClient();

  const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, {
    contentType: sniffed,
    upsert: true,
  });
  if (error) {
    throw new StorageError("upload_failed", error.message);
  }

  return { key, mime: sniffed };
}

export async function deleteStorageObject(key: string): Promise<void> {
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) {
    throw new StorageError("delete_failed", error.message);
  }
}
