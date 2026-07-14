/**
 * Phase 29.5  open-redirect guard for `?returnTo=` style round-trips.
 *
 * Only ever returns an INTERNAL app path: it must start with exactly one
 * "/" (rejects protocol-relative "//evil.example"), carry no backslash
 * tricks ("/\evil" parses as protocol-relative in some browsers), no
 * scheme smuggling and no CR/LF header-splitting payloads. Anything
 * suspicious falls back to the caller-supplied safe default.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  if (/[\r\n]/.test(raw)) return fallback;
  if (raw.includes("://")) return fallback;
  return raw;
}
