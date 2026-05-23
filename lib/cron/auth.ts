/**
 * Phase 8  Shared CRON_SECRET guard for /api/cron/* routes.
 *
 * Vercel Cron sets the `Authorization: Bearer ${CRON_SECRET}` header on
 * every scheduled invocation (per Vercel docs). We require it.
 *
 * `CRON_SECRET` must be set in env (`.env.local` for dev, Vercel project
 * env for prod). If unset we deliberately refuse all requests rather
 * than fail open.
 */

import "server-only";
import { NextResponse } from "next/server";

export function isAuthorizedCron(request: Request):
  | { ok: true }
  | { ok: false; response: NextResponse } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // eslint-disable-next-line no-console
    console.error("[cron] CRON_SECRET is not set  refusing all cron requests.");
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Cron secret not configured." },
        { status: 503 },
      ),
    };
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Unauthorized." },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}
