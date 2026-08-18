import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/**
 * Edge proxy  optimistic auth + next-intl.
 *
 * Per Better Auth's own guidance:
 *
 *   "getSessionCookie only checks for the existence of a session cookie;
 *    it does NOT validate it. THIS IS NOT SECURE!
 *    This is the recommended approach to optimistically redirect users."
 *
 * Per Next.js's own guidance:
 *
 *   "While Proxy can be useful for initial checks, it should not be your
 *    only line of defense in protecting your data."
 *
 * So the proxy here is **UX-only**:
 *  - If there's no session cookie at all → bounce to /sign-in fast at the
 *    Edge (saves a page-render round-trip for the obvious unauth case)
 *  - If there IS a cookie → let the request through; the page's
 *    `verifyRole()` / `verifyAdmin()` call in `lib/auth/dal.ts` does the
 *    authoritative validation against the database
 *
 * The page-level guard is the real security boundary. The proxy could be
 * removed entirely without compromising security  it's a UX nicety.
 */
function isProtected(pathname: string): boolean {
  // Strip the locale prefix if present (`/en/dashboard` → `/dashboard`).
  const withoutLocale = pathname.replace(/^\/(?:en|zu|xh|af)(?=\/|$)/, "");
  return (
    withoutLocale === "/dashboard" ||
    withoutLocale.startsWith("/dashboard/") ||
    withoutLocale === "/employer" ||
    withoutLocale.startsWith("/employer/") ||
    withoutLocale === "/admin" ||
    withoutLocale.startsWith("/admin/") ||
    // Phase 9  gov workspace
    withoutLocale === "/gov" ||
    withoutLocale.startsWith("/gov/")
  );
}

/**
 * Phase 9  Security headers applied to every response.
 *
 * Strict CSP that allows:
 *   - script-src 'self' (plus 'unsafe-inline' for Next's hydration
 *     bootstrap until we wire nonce-based CSP  documented below)
 *   - connect-src 'self' + Supabase + Resend + the configured app URL
 *   - frame-ancestors 'none' (with X-Frame-Options as legacy fallback)
 *   - object-src 'none' (no Flash, no plugins)
 *   - base-uri 'self' (anti-injection)
 *
 * HSTS sticks at 2 years with includeSubDomains + preload  once we
 * cut over to production this is one-way. Permissions-Policy allows
 * camera for OUR OWN origin only (2026-08: the live-selfie check uses
 * getUserMedia on /dashboard/profile; embedded third-party content
 * still can't touch it) and disables microphone / geolocation.
 *
 * NOTE: `'unsafe-inline'` on `script-src` is the standard Next.js
 * starting position because Next emits inline bootstrap scripts. The
 * Phase 9.x hardening pass swaps to nonce-based CSP once we verify
 * nothing legitimate breaks under report-only mode. Tracked at
 * docs/popia/ENCRYPTION_INVENTORY.md "Open items".
 */
function securityHeaders(): Record<string, string> {
  // Phase 32.3.4 (security remediation)  read `SUPABASE_URL`, not
  // `NEXT_PUBLIC_SUPABASE_URL`. The latter is defined NOWHERE
  // (`.env.example`, `.env.local` and `lib/storage/supabase.ts` all use
  // `SUPABASE_URL`), so this ternary always took the wildcard branch and
  // production `connect-src` permitted ANY Supabase project  including
  // an attacker's  as an exfiltration destination. The value is only
  // ever read server-side here, so the NEXT_PUBLIC_ prefix was never
  // needed. The wildcard remains only as a last-resort fallback when
  // storage is genuinely unconfigured (local dev).
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseHost = supabaseUrl
    ? new URL(supabaseUrl).origin
    : "https://*.supabase.co";
  const csp = [
    "default-src 'self'",
    // Phase 26.4 (security audit)  `unsafe-eval` is DEV-ONLY (Turbopack HMR
    // needs eval). Production ships without it, so CSP keeps real teeth as an
    // XSS backstop. `unsafe-inline` stays until the nonce-CSP pre-launch item.
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHost} https://api.resend.com https://api.qrserver.com`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // `upgrade-insecure-requests` is correct in production (always
    // https) but breaks the Phase 12 E2E server, which runs the
    // production build over plain http on localhost  Chromium upgrades
    // same-origin navigations to https:// and fails with
    // ERR_SSL_PROTOCOL_ERROR. SEBENZA_E2E_HTTP=1 is set ONLY by
    // playwright.config.ts; it must never be set in a real deployment.
    ...(process.env.SEBENZA_E2E_HTTP === "1"
      ? []
      : ["upgrade-insecure-requests"]),
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security":
      "max-age=63072000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  const headers = securityHeaders();
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtected(pathname)) {
    // We use Better Auth's default cookie config (no custom `cookiePrefix`
    // in lib/auth/server.ts), so `getSessionCookie(request)` with no opts
    // finds `better-auth.session_token`. Drift here is the bug class that
    // bounces every authenticated user back to /sign-in  see commit history.
    const cookie = getSessionCookie(request);
    if (!cookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return withSecurityHeaders(NextResponse.redirect(url));
    }
  }

  return withSecurityHeaders(intl(request));
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
