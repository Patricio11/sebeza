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
import sharp from "sharp";
import { StorageError } from "./supabase";
import { getStorageBackend } from "./backend";
import { photoThumbKey, hasPhotoThumb } from "./keys";

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
  // Legacy Word .doc  OLE compound file, D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1
  ) {
    return "application/msword";
  }
  // Word .docx  ZIP container, PK 03 04. Any ZIP matches this  for the
  // private CV backup (never parsed, never served to others, claimed
  // type must ALSO be docx) that's a proportionate check.
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
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
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
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
 * Phase 11.5.2  personal CV backup upload. PDF or Word (founder
 * decision 2026-08: .doc/.docx joined PDF; photo/scan uploads stay
 * rejected  a CV should be a document, not a picture of one). Same
 * magic-byte sniff + rate limit; smaller 5MB cap so seekers can
 * re-upload often without hitting storage quotas. Lives under
 * `{userId}/cvs/...`  the seeker's own folder, never surfaced to
 * employers.
 */
const CV_MAX_BYTES = 5 * MB;
const CV_ALLOWED = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

  const backend = await getStorageBackend();

  // 2026-08  photos are RE-ENCODED to WebP before storage (founder
  // decision). Three wins: 30-50% smaller files (No-Flash rule),
  // EXIF/GPS metadata stripped (phone photos geotag  POPIA), and we
  // never store the user's original bytes (a re-encode neutralises
  // malformed images). A 256px thumb ships alongside so S3  which has
  // no transform service  still serves small avatars cheaply.
  // Documents are deliberately untouched: KYC/qualification files are
  // evidentiary and must stay byte-for-byte as submitted.
  if (opts.kind === "photos") {
    const key = `${opts.userId}/photos/${opts.id}.webp`;
    let main: Buffer;
    let thumb: Buffer;
    try {
      // .rotate() applies the EXIF orientation BEFORE metadata is
      // dropped, so portrait phone shots don't land sideways.
      const base = sharp(bytes, { limitInputPixels: 50_000_000 }).rotate();
      main = await base
        .clone()
        .resize({ width: PHOTO_MAX_DIM, height: PHOTO_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      thumb = await base
        .clone()
        .resize({ width: PHOTO_THUMB_DIM, height: PHOTO_THUMB_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      throw new StorageError(
        "bad_content",
        "That image couldn't be processed  please try a different photo.",
      );
    }
    await backend.upload(key, new Uint8Array(main), "image/webp");
    await backend.upload(photoThumbKey(key), new Uint8Array(thumb), "image/webp");
    return { key, mime: "image/webp" };
  }

  const key = `${opts.userId}/${opts.kind}/${opts.id}.${extFor(sniffed)}`;
  await backend.upload(key, bytes, sniffed);

  return { key, mime: sniffed };
}

/** Longest edge stored for the main photo  profile display never needs more. */
const PHOTO_MAX_DIM = 1600;
const PHOTO_THUMB_DIM = 256;

export async function deleteStorageObject(key: string): Promise<void> {
  const backend = await getStorageBackend();
  await backend.remove(key);
  // Photos carry a derived thumb  sweep it with the main object.
  if (hasPhotoThumb(key)) {
    try {
      await backend.remove(photoThumbKey(key));
    } catch {
      // Best-effort: legacy keys have no thumb; an orphan is harmless.
    }
  }
}
