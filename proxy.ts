import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/**
 * Route-group authentication guard.
 *
 * For paths inside `(seeker)/dashboard`, `(employer)/employer`, and
 * `(admin)/admin`, we check the session cookie's presence in the Edge runtime
 * (fast O(1) — no DB hit). Missing cookie → redirect to /sign-in?next=<path>.
 *
 * Full role verification happens in Server Components via `requireRole()` /
 * `requireAdmin()` / `requireOrgVerified()` (`lib/auth/guard.ts`). The proxy
 * only blocks the obviously-unauthenticated case; the full check still runs
 * server-side so a forged cookie can't slip past.
 */
function isProtected(pathname: string): boolean {
  // Strip the locale prefix if present (`/en/dashboard` → `/dashboard`).
  const withoutLocale = pathname.replace(
    /^\/(?:en|zu|xh|af)(?=\/|$)/,
    "",
  );
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
