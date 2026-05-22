/**
 * Role + verification guards backed by Better Auth.
 *
 * Critical UX Rule §3 (TO_START_EVERY_SESSION.md): no employer accesses
 * talent contact / documents without `auth` AND `orgVerified`. Every
 * PII-touching loader calls `logAccess()`.
 *
 * Usage in Server Components and Server Actions:
 *
 *     const me = await requireRole("seeker"); // throws/redirects on miss
 *     const me = await requireOrgVerified();  // employer + org verified
 *
 * Phase 7 hardens this with 2FA enforcement.
 */

import "server-only";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { auth } from "./server";
import { getDb } from "@/db/client";
import { eq, and, isNull } from "drizzle-orm";
import { organizationMembers, organizations } from "@/db/schema";
import type { UserRole } from "@/lib/mock/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: UserRole;
  /** Convenience: looked up lazily for employer users. */
  orgId?: string | null;
  orgVerified?: boolean;
}

/**
 * Returns the current session user, or `null` if not signed in.
 * Cheap to call repeatedly within a request — Better Auth's cookieCache
 * resolves most calls without a DB roundtrip.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const headers = await nextHeaders();
  const sess = await auth.api.getSession({ headers });
  if (!sess) return null;

  const u = sess.user as {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    role?: UserRole;
  };

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerified,
    role: u.role ?? "seeker",
  };
}

export class AuthorizationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "AuthorizationError";
  }
}

/**
 * Require a signed-in user with the given role.
 *  - Not signed in → redirect to /sign-in (with `?next=` preserved by the caller).
 *  - Wrong role → redirect to the user's own dashboard.
 *  - Email not verified → redirect to /verify-email.
 *  - Admin is allowed everywhere (a strict admin guard is a separate helper).
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.emailVerified) redirect("/verify-email");
  if (user.role !== role && user.role !== "admin") {
    // Wrong role for this surface — send them to their own dashboard.
    redirect(roleHome(user.role));
  }
  return user;
}

/**
 * Require a signed-in admin (no role-fallthrough — admin is admin only here).
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.emailVerified) redirect("/verify-email");
  if (user.role !== "admin") redirect(roleHome(user.role));
  return user;
}

/**
 * Require a signed-in employer whose organization is verified. Returns the
 * session user with `orgId` and `orgVerified` populated.
 *
 * Phase 5 + the contact-reveal flow rely on this.
 */
export async function requireOrgVerified(): Promise<SessionUser> {
  const user = await requireRole("employer");
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
  if (!row) throw new AuthorizationError("org_not_found");
  if (row.verification !== "verified") {
    throw new AuthorizationError("org_not_verified");
  }
  return { ...user, orgId: row.orgId, orgVerified: true };
}

export function roleHome(role: UserRole): "/dashboard" | "/employer" | "/admin" {
  if (role === "employer") return "/employer";
  if (role === "admin") return "/admin";
  return "/dashboard";
}
