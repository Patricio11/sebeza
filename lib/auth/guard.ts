/**
 * Back-compat shim  every guard now lives in `lib/auth/dal.ts`.
 *
 * Why this file still exists:
 *   - Existing code (Phase 2 + Phase 3) imports `getSessionUser`, `requireRole`,
 *     `requireAdmin`, `requireOrgVerified`, `roleHome` from this module.
 *   - Renaming all call-sites in one PR adds noise; this thin re-export
 *     keeps the diff small while the canonical implementation moves to the
 *     Data Access Layer.
 *   - New code MUST import from `@/lib/auth/dal` and use the `verify*` names.
 *
 * Removal: once every call-site is migrated to `verify*`, delete this file.
 */

import "server-only";
export {
  getSessionUser,
  verifySession as requireSession,
  verifyRole as requireRole,
  verifyAdmin as requireAdmin,
  verifyOrgVerified as requireOrgVerified,
  verifyEmployer,
  roleHome,
  type SessionUser,
  type OrgContext,
} from "./dal";

/** Legacy authorization error  kept for any catch blocks that still reference it. */
export class AuthorizationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "AuthorizationError";
  }
}
