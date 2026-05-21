/**
 * Role + verification guards.
 *
 * Phase 2 (Better Auth) replaces the stub `getSessionUser()` with a real session
 * read. The signatures of `requireRole()` and `requireOrgVerified()` are stable
 * so route handlers/Server Actions don't change.
 *
 * Critical UX Rule §3: no employer accesses talent contact/documents without
 * `auth` AND `orgVerified`. Every PII-touching loader calls `logAccess()` too.
 */
import type { UserRole } from "@/lib/mock/types";

export interface SessionUser {
  id: string;
  role: UserRole;
  orgId: string | null;
  orgVerified: boolean;
}

/** STUB. Phase 2 replaces this with a Better Auth session lookup. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return null;
}

export class AuthorizationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "AuthorizationError";
  }
}

export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("not_authenticated");
  if (user.role !== role && user.role !== "admin") {
    throw new AuthorizationError(`role_required:${role}`);
  }
  return user;
}

export async function requireOrgVerified(): Promise<SessionUser> {
  const user = await requireRole("employer");
  if (!user.orgVerified) throw new AuthorizationError("org_not_verified");
  return user;
}
