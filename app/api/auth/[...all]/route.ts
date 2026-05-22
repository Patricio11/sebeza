/**
 * Better Auth catch-all handler.
 *
 * Mounts Better Auth's REST endpoints at /api/auth/* — sign-in, sign-up,
 * verification, password-reset, session, sign-out, all delegated here.
 *
 * Server Actions in `lib/auth/actions.ts` use the same `auth` instance for
 * server-side calls (no HTTP roundtrip), so the API route is mostly for
 * Better Auth's own callback URLs (e.g. verify-email link clicks).
 */

import { auth } from "@/lib/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
