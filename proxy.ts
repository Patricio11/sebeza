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
    withoutLocale.startsWith("/admin/")
  );
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
      return NextResponse.redirect(url);
    }
  }

  return intl(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
