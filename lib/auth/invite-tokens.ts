/**
 * Phase 9.17  signed-token helper for seeker-invitation links.
 *
 * Shape: `<base64url(payload)>.<base64url(hmac)>` where payload is a
 * JSON object `{ id, exp }` (inviteId + Unix-seconds expiry). HMAC is
 * SHA-256 over the encoded-payload string, keyed by
 * `SEBENZA_INVITE_SIGNING_SECRET`.
 *
 * Properties we care about:
 *
 *   - **Opaque**: the email never appears in the URL. Only the
 *     server-side `inviteId` does, and that's a random uuid-ish text
 *     id with no semantic content.
 *   - **Tamper-detect**: any byte flipped in the payload breaks the
 *     HMAC; the verifier returns `bad_signature`.
 *   - **Self-describing expiry**: the expiry is part of the signed
 *     payload, so we don't have to round-trip to the database to know
 *     whether a token is past its TTL.
 *   - **Single-use**: enforced at the DB layer (the row's `state`
 *     flips from `pending` once the seeker accepts/declines), not by
 *     the token itself. That's a deliberate choice  signed tokens
 *     can't be revoked without a DB lookup anyway, so making the row
 *     state the source of truth is the simplest honest design.
 *
 * Same shape as the password-reset tokens Phase 8 ships, but kept in
 * its own module + with its own signing key so a leak of one doesn't
 * give an attacker the other.
 */

// NOTE: server-only convention enforced by `node:crypto` itself
// any client-side import will hard-fail at the bundler. We skip the
// `import "server-only"` declaration so vitest can load this module
// directly without an extra resolver alias.
import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_KEY = "SEBENZA_INVITE_SIGNING_SECRET";

function getSecret(): Buffer {
  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new Error(
      `${ENV_KEY} is not set. Seeker-invitation tokens require a signing secret.`,
    );
  }
  // Accept either base64 or a long passphrase  we don't enforce a
  // specific format; HMAC tolerates any byte length.
  return Buffer.from(raw, "utf8");
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  // Re-add padding so Buffer.from accepts it.
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  );
}

function hmac(payload: string): Buffer {
  return createHmac("sha256", getSecret()).update(payload).digest();
}

export function signInviteToken(inviteId: string, expiresAt: Date): string {
  const payload = JSON.stringify({
    id: inviteId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  const encoded = b64urlEncode(payload);
  const sig = b64urlEncode(hmac(encoded));
  return `${encoded}.${sig}`;
}

export type TokenVerification =
  | { ok: true; inviteId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyInviteToken(token: string): TokenVerification {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [encodedPayload, encodedSig] = token.split(".");
  if (!encodedPayload || !encodedSig) {
    return { ok: false, reason: "malformed" };
  }

  let givenSig: Buffer;
  try {
    givenSig = b64urlDecode(encodedSig);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expectedSig = hmac(encodedPayload);
  if (
    givenSig.length !== expectedSig.length ||
    !timingSafeEqual(givenSig, expectedSig)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  let parsed: { id?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(b64urlDecode(encodedPayload).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const id = parsed.id;
  const exp = parsed.exp;
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "malformed" };
  }
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return { ok: false, reason: "malformed" };
  }
  if (exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, inviteId: id };
}
