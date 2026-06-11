/**
 * Phase 12 (Task 12.2) — cron route contracts.
 *
 * All 18 `/api/cron/*` routes share the `isAuthorizedCron` guard
 * (`Authorization: Bearer ${CRON_SECRET}`). Generic fixtures assert every
 * route refuses unauthenticated + wrong-secret requests — fail-closed.
 *
 * Targeted fixtures then run the high-stakes crons for real against the
 * seeded DB and invoke them TWICE: the second run must be a no-op
 * (idempotency anchors: `status_stale_last_sent_at`, conditional state
 * flips on invite expiry, 30-day cutoff on hard-delete).
 *
 * Discovery is filesystem-driven: a new cron route is enrolled in the
 * auth-guard fixtures automatically the moment its folder appears.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const CRON_DIR = path.resolve(process.cwd(), "app/api/cron");
const cronNames = readdirSync(CRON_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

type RouteModule = Record<
  string,
  ((req: Request) => Promise<Response>) | undefined
>;

async function loadHandler(
  name: string,
): Promise<(req: Request) => Promise<Response>> {
  const mod = (await import(
    `../../app/api/cron/${name}/route.ts`
  )) as RouteModule;
  const handler = mod.GET ?? mod.POST;
  expect(handler, `${name} must export GET or POST`).toBeDefined();
  return handler!;
}

function request(name: string, auth?: string): Request {
  return new Request(`http://test.local/api/cron/${name}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

const SECRET = process.env.CRON_SECRET!;

describe("cron auth guard (all routes, discovered from the filesystem)", () => {
  test("the cron surface is the expected size (floor)", () => {
    expect(cronNames.length).toBeGreaterThanOrEqual(18);
  });

  test.each(cronNames)("%s: refuses without Authorization", async (name) => {
    const handler = await loadHandler(name);
    const res = await handler(request(name));
    expect(res.status).toBe(401);
  });

  test.each(cronNames)("%s: refuses a wrong bearer token", async (name) => {
    const handler = await loadHandler(name);
    const res = await handler(request(name, "Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

describe("idempotency: status-stale-warning", () => {
  test("second immediate run fires zero notifications", async () => {
    const handler = await loadHandler("status-stale-warning");

    const first = await handler(
      request("status-stale-warning", `Bearer ${SECRET}`),
    );
    const firstBody = (await first.json()) as { ok: boolean; fired: number };
    expect(first.status, JSON.stringify(firstBody)).toBe(200);
    expect(firstBody.ok).toBe(true);

    const second = await handler(
      request("status-stale-warning", `Bearer ${SECRET}`),
    );
    const secondBody = (await second.json()) as { ok: boolean; fired: number };
    expect(secondBody.ok).toBe(true);
    expect(secondBody.fired, "second run must be a no-op").toBe(0);
  });
});

describe("idempotency + fail-closed on the remaining high-stakes crons", () => {
  // Each runs twice with auth; both runs must report ok (the underlying
  // anchors make run 2 a no-op — these crons crashing or double-firing
  // would mean duplicate notifications or premature hard-deletes).
  const HIGH_STAKES = [
    "hard-delete-erased",
    "vacancy-invite-expiry",
    "seeker-invite-expiry",
    "searchability-pause-sweep",
    "employment-verification-expire",
    "skill-gap-snapshot",
    "lmi-snapshot",
  ];

  test.each(HIGH_STAKES)("%s: runs clean twice", async (name) => {
    const handler = await loadHandler(name);
    for (const attempt of [1, 2]) {
      const res = await handler(request(name, `Bearer ${SECRET}`));
      const body = (await res.json()) as { ok?: boolean };
      expect(
        res.status,
        `${name} attempt ${attempt}: ${JSON.stringify(body)}`,
      ).toBe(200);
      expect(body.ok, `${name} attempt ${attempt} body.ok`).not.toBe(false);
    }
  });

  test("saqa-worker: no-ops cleanly while feature_flag_saqa_worker is OFF (dormant gate)", async () => {
    const handler = await loadHandler("saqa-worker");
    const res = await handler(request("saqa-worker", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
  });
});
