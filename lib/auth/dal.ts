/**
 * Data Access Layer (DAL)  Sebenza's canonical session + authorisation guard.
 *
 * Built per the Next.js authentication guide
 * (https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal):
 *
 *   "We recommend creating a DAL to centralize your data requests and
 *    authorization logic … use React's cache API to memoize the return
 *    value of the function during a React render pass."
 *
 * And Better Auth's own guidance:
 *
 *   "getSessionCookie only checks for the existence of a session cookie;
 *    it does NOT validate it. THIS IS NOT SECURE!"
 *
 * Architecture:
 *
 *   Layer 1  proxy.ts (optional)        : optimistic redirect on cookie absence
 *                                          (UX speed-up, NOT a security boundary)
 *
 *   Layer 2  DAL (this file)            : authoritative validation
 *                                          (`auth.api.getSession` → DB)
 *                                          called at the top of every protected
 *                                          page + by every PII-touching data
 *                                          fetch
 *
 *   Layer 3  Server Actions              : each action calls verifySession()
 *                                          before any mutation  Server Actions
 *                                          are public-facing endpoints
 *
 * **Never call `auth.api.getSession()` directly in app code.** Always go through
 * this DAL so:
 *   - Multiple calls in one render share one DB round-trip (cache())
 *   - The session shape is consistent across the app
 *   - The audit / observability hooks live in one place
 */

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "./server";
import { getDb } from "@/db/client";
import { organizationMembers, organizations } from "@/db/schema";
import type { UserRole } from "@/lib/mock/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: UserRole;
  /** Phase 7 (Task 7.2)  `true` once the user has confirmed their first
      TOTP code. Drives the forced-setup gate for employer/admin roles. */
  twoFactorEnabled: boolean;
}

export interface OrgContext {
  /** organization_members.organization_id */
  orgId: string;
  /** organizations.verification  `"verified"` lets PII flows through */
  verification: "unverified" | "pending" | "verified" | "rejected";
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Session  memoized per render pass via React's cache()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current session user, or `null` if not signed in.
 *
 * Memoised with React's `cache()` so calling it many times during one render
 * (e.g. once in a layout, once in a page, once in a leaf component) costs
 * exactly one Better Auth round-trip. Better Auth additionally has its own
 * 5-min cookieCache for cross-request speed (see `lib/auth/server.ts`).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const headers = await nextHeaders();
    const sess = await auth.api.getSession({ headers });
    if (!sess) return null;

    const u = sess.user as {
      id: string;
      email: string;
      name: string;
      emailVerified: boolean;
      role?: UserRole;
      twoFactorEnabled?: boolean;
    };

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      emailVerified: u.emailVerified,
      role: u.role ?? "seeker",
      twoFactorEnabled: Boolean(u.twoFactorEnabled),
    };
  } catch (e) {
    // Next.js throws `DynamicServerError` (and `NEXT_REDIRECT`) as control-flow
    // signals  `headers()` triggers it during a static prerender so Next knows
    // to mark the route dynamic. We MUST rethrow these or static generation
    // silently treats the page as "not signed in" and redirects to /sign-in
    // at build time.
    if (isNextControlFlowError(e)) throw e;
    // Genuine session-read failures (DB down, cookie parse error) should
    // fail-closed: log and return null so the guards redirect to /sign-in.
    console.error("[dal.getSessionUser] failed:", e);
    return null;
  }
});

function isNextControlFlowError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  // Match Next's DynamicServerError / NEXT_REDIRECT / NEXT_NOT_FOUND signals
  // by the conventional `digest` / `name` shape rather than instanceof  the
  // class isn't a stable public export across Next versions.
  const err = e as { digest?: unknown; name?: unknown; message?: unknown };
  if (typeof err.digest === "string" && err.digest.startsWith("NEXT_")) {
    return true;
  }
  if (
    typeof err.name === "string" &&
    (err.name === "DynamicServerError" || err.name.startsWith("Next"))
  ) {
    return true;
  }
  if (
    typeof err.message === "string" &&
    err.message.includes("Dynamic server usage")
  ) {
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Authoritative guards  call these at the top of every protected page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Require a signed-in user (any role). Redirects to /sign-in on miss.
 * Preserves the original path as `?next=…` for round-trip back after sign-in.
 */
export async function verifySession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.emailVerified) redirect("/verify-email");
  return user;
}

/**
 * Require a signed-in user with the given role. Admins are allowed everywhere
 * (a stricter admin-only gate lives in `verifyAdmin()`).
 *
 *   const me = await verifyRole("seeker"); // throws/redirects on miss
 */
export async function verifyRole(role: UserRole): Promise<SessionUser> {
  const user = await verifySession();
  if (user.role !== role && user.role !== "admin") {
    redirect(roleHome(user.role));
  }
  await enforceTwoFactorSetup(user);
  return user;
}

/**
 * Strict admin guard. No role fall-through  admin only.
 */
export async function verifyAdmin(): Promise<SessionUser> {
  const user = await verifySession();
  if (user.role !== "admin") redirect(roleHome(user.role));
  await enforceTwoFactorSetup(user);
  return user;
}

/**
 * Phase 9  Government / policy / SETA-partner workspace gate.
 *
 * Admins are allowed (operational override); everyone else gets
 * redirected to their own role home. The `/gov` route group is
 * always behind this guard.
 *
 * Note: enforceTwoFactorSetup gates gov + admin alike  POPIA-grade
 * accounts should never sign in without a second factor.
 */
export async function verifyGov(): Promise<SessionUser> {
  const user = await verifySession();
  if (user.role !== "gov" && user.role !== "admin") {
    redirect(roleHome(user.role));
  }
  await enforceTwoFactorSetup(user);
  return user;
}

/**
 * Phase 7 (Task 7.2)  Forced 2FA enrollment gate for employer + admin.
 *
 * Seekers are not in scope (they use Sebenza on low-end mobile data;
 * forcing TOTP would lock out the user-base the platform exists for).
 * Employers + admins control PII access, so 2FA is non-negotiable
 * once the `feature_flag_2fa_enforced` platform setting is on.
 *
 * If the flag is on and they haven't enrolled yet, bounce them to
 * `/setup-2fa`. The setup page itself calls `verifySession()` (not
 * `verifyRole`), so it doesn't loop.
 */
async function enforceTwoFactorSetup(user: SessionUser): Promise<void> {
  if (user.role === "seeker") return;
  if (user.twoFactorEnabled) return;
  // Lazy-load to avoid pulling the platform-settings module into the
  // seeker hot path. `getSetting` is React-cached per render.
  const { getSetting } = await import("@/lib/admin/settings");
  const enforced = await getSetting<boolean>("feature_flag_2fa_enforced");
  if (!enforced) return;
  redirect("/setup-2fa");
}

/**
 * Require an employer whose organisation is verified.
 *
 * Unverified org → redirect to `/employer/organisation` so the seeker / admin
 * journey doesn't crash the page with an error. The org-verification page
 * already carries the "submit for verification" CTA + status badge.
 *
 * Returns the session user plus the resolved organisation context.
 */
export async function verifyOrgVerified(): Promise<
  SessionUser & OrgContext
> {
  const user = await verifyRole("employer");
  const db = getDb();
  const rows = await db
    .select({
      orgId: organizationMembers.organizationId,
      verification: organizations.verification,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        isNull(organizationMembers.suspendedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  // Phase 9.10  redirect to the actionable onboarding surface
  // (KYC docs + admin review) instead of the static /organisation
  // settings page. The unverified employer can actually do
  // something there.
  if (!row) redirect("/employer/onboarding");
  if (row.verification !== "verified") {
    redirect("/employer/onboarding");
  }
  return {
    ...user,
    orgId: row.orgId,
    verification: row.verification as OrgContext["verification"],
  };
}

/**
 * Require an employer (verified or not) AND return the org context so pages
 * that need to show the unverified-banner can pick it up. Use this for org-
 * owned settings pages, *not* for PII reveal flows (those use
 * `verifyOrgVerified` above).
 */
export async function verifyEmployer(): Promise<SessionUser & Partial<OrgContext>> {
  const user = await verifyRole("employer");
  const db = getDb();
  const rows = await db
    .select({
      orgId: organizationMembers.organizationId,
      verification: organizations.verification,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        isNull(organizationMembers.suspendedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return user;
  return {
    ...user,
    orgId: row.orgId,
    verification: row.verification as OrgContext["verification"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function roleHome(
  role: UserRole,
): "/dashboard" | "/employer" | "/admin" | "/gov" {
  if (role === "employer") return "/employer";
  if (role === "admin") return "/admin";
  if (role === "gov") return "/gov";
  return "/dashboard";
}
