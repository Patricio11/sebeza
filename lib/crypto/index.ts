/**
 * Field-level encryption for special-category PII (notably national IDs).
 *
 * POPIA-First Rule (TO_START_EVERY_SESSION.md §4): ID numbers are encrypted
 * at rest with AES-256-GCM and NEVER displayed back. This module exposes the
 * primitives. Storage rule: `nationalIdEnc` column stores the output of
 * `encryptField()` — a single base64 string carrying iv ‖ ciphertext ‖ tag.
 *
 * Key management:
 * - Phase 1: key comes from `SEBENZA_ENCRYPTION_KEY` env (base64, 32 bytes).
 * - Phase 8/9: rotates via KMS; old keys remain decryptable via a key-id prefix.
 *
 * This implementation uses Node's built-in `crypto` (no extra dependency).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard
const KEY_ID = "v1"; // bump on rotation; payloads carry this prefix

function getKey(): Buffer {
  const raw = process.env.SEBENZA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SEBENZA_ENCRYPTION_KEY is not set. PII encryption requires a 32-byte base64 key.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `SEBENZA_ENCRYPTION_KEY must be 32 bytes (base64-decoded). Got ${key.length}.`,
    );
  }
  return key;
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Wire format: keyId.base64(iv || ct || tag)
  return `${KEY_ID}.${Buffer.concat([iv, ct, tag]).toString("base64")}`;
}

export function decryptField(payload: string): string {
  const sep = payload.indexOf(".");
  if (sep === -1) throw new Error("Encrypted payload missing key id prefix.");
  const keyId = payload.slice(0, sep);
  const body = Buffer.from(payload.slice(sep + 1), "base64");
  if (keyId !== KEY_ID) {
    // In Phase 8 this looks up the legacy key. For Phase 1 we fail loudly.
    throw new Error(`Unknown encryption key id: ${keyId}`);
  }
  const iv = body.subarray(0, IV_LEN);
  const tag = body.subarray(body.length - 16);
  const ct = body.subarray(IV_LEN, body.length - 16);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * Helper for dev-only key generation. Print to stdout, never log.
 * Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
 */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
