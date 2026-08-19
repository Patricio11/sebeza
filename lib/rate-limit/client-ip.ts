import "server-only";
import { headers as nextHeaders } from "next/headers";
import { createHash } from "node:crypto";

/**
 * Phase 32.2.4  resolve the client IP for rate-limit keys.
 *
 * On Vercel `x-forwarded-for` is set by the platform edge and the
 * left-most entry is the real client; on a self-hosted deployment the
 * value is only as trustworthy as the proxy in front of the app, which
 * is why this is used ONLY for rate-limit keying and never for
 * authorisation. A spoofed header lets an attacker spread their own
 * attempts across buckets  it can never let them read another user's
 * data or lock a victim out (the sign-in bucket is keyed per IP
 * precisely so it cannot be aimed at someone else's account).
 *
 * The value is HASHED before it becomes a key: rate-limit keys end up
 * in logs and in the shared limiter store, and a raw IP is personal
 * information under POPIA. A truncated SHA-256 keeps the buckets
 * distinct without retaining the address itself.
 */
export async function clientIpKey(): Promise<string> {
  try {
    const h = await nextHeaders();
    const forwarded = h.get("x-forwarded-for");
    const raw =
      forwarded?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      // No proxy header (local dev, or a direct connection): fall back to
      // a single shared bucket rather than skipping the limit entirely.
      "unknown";
    return createHash("sha256").update(raw).digest("hex").slice(0, 24);
  } catch {
    // `headers()` unavailable (unit-test context): degrade to one
    // shared bucket rather than throwing on a security path.
    return "no-request-context";
  }
}

/**
 * Hash an email for use as a rate-limit key. Same reasoning: keys are
 * not a place to keep identifiers, and the limiter only needs the
 * values to be distinct and stable.
 */
export function emailKey(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
}
