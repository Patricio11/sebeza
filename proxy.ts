import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/**
 * Edge proxy — optimistic auth + next-intl.
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
 * removed entirely without compromising security — it's a UX nicety.
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
    // Phase 9 — gov workspace
    withoutLocale === "/gov" ||
    withoutLocale.startsWith("/gov/")
  );
}

/**
 * Phase 9 — Security headers applied to every response.
 *
 * Strict CSP that allows:
 *   - script-src 'self' (plus 'unsafe-inline' for Next's hydration
 *     bootstrap until we wire nonce-based CSP — documented below)
 *   - connect-src 'self' + Supabase + Resend + the configured app URL
 *   - frame-ancestors 'none' (with X-Frame-Options as legacy fallback)
 *   - object-src 'none' (no Flash, no plugins)
 *   - base-uri 'self' (anti-injection)
 *
 * HSTS sticks at 2 years with includeSubDomains + preload — once we
 * cut over to production this is one-way. Permissions-Policy disables
 * camera / microphone / geolocation by default (we don't use them).
 *
 * NOTE: `'unsafe-inline'` on `script-src` is the standard Next.js
 * starting position because Next emits inline bootstrap scripts. The
 * Phase 9.x hardening pass swaps to nonce-based CSP once we verify
 * nothing legitimate breaks under report-only mode. Tracked at
 * docs/popia/ENCRYPTION_INVENTORY.md "Open items".
 */
function securityHeaders(): Record<string, string> {
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : "https://*.supabase.co";
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHost} https://api.resend.com https://api.qrserver.com`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security":
      "max-age=63072000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
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
    // bounces every authenticated user back to /sign-in — see commit history.
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
