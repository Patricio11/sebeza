/**
 * G11  weekly stalled-pipeline sweep.
 *
 * Tells an employer when an open vacancy is still short and there is
 * nobody left to hear from. The decision logic lives in
 * `lib/employer/pipeline-sweep.ts`; this route is auth + plumbing.
 *
 * Auth: `isAuthorizedCron(request)` (Bearer ${CRON_SECRET}), fail-closed
 * when the env var is unset, same as every other cron route.
 *
 * Idempotent by construction: the notification kind carries a 7-day
 * dedupe window keyed per vacancy, so running this twice in a day
 * notifies nobody twice.
 */
import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { sweepStalledPipelines } from "@/lib/employer/pipeline-sweep";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await sweepStalledPipelines();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron:vacancy-pipeline-sweep] failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Sweep failed." },
      { status: 500 },
    );
  }
}
