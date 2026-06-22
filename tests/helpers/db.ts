/**
 * Phase 12 (Task 12.0)  test-database guard + harness entry point.
 *
 * D1 in docs/PHASE_12_PLAN.md: integration + compliance suites run against a
 * DEDICATED, DISPOSABLE Postgres. `db/seed.ts` truncates every table  that
 * behaviour is exactly right for tests and catastrophic against the dev or
 * production database. This guard is the structural protection:
 *
 *   1. Test-DB config lives in `.env.test.local` (gitignored), NOT in
 *      `.env.local`, so the test suites can never silently inherit the
 *      dev DATABASE_URL.
 *   2. The file must set BOTH `SEBENZA_TEST_DB=1` and `DATABASE_URL`.
 *      Missing either → every integration/compliance test fails with a
 *      clear setup message instead of touching any database.
 *
 * Usage (every tests/integration/** and tests/compliance/** file):
 *
 *   import { requireTestDb } from "../helpers/db";
 *   const databaseUrl = requireTestDb(); // throws unless safely configured
 *
 * Session B extends this file with migrate-from-zero + seed-once-per-run
 * orchestration; the guard contract here stays stable.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";

let loaded = false;

export function requireTestDb(): string {
  if (!loaded) {
    // Deliberately ONLY .env.test.local  never .env.local / .env.
    loadEnv({ path: path.resolve(process.cwd(), ".env.test.local") });
    loaded = true;
  }

  if (process.env.SEBENZA_TEST_DB !== "1") {
    throw new Error(
      [
        "Integration/compliance tests need a dedicated test database.",
        "Create .env.test.local at the project root with:",
        "  SEBENZA_TEST_DB=1",
        "  DATABASE_URL=<connection string of a DISPOSABLE test database>",
        "  SEBENZA_ENCRYPTION_KEY=<any 32-byte base64 key, test-only>",
        "The seed TRUNCATES tables  never point this at dev or prod.",
      ].join("\n"),
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "SEBENZA_TEST_DB=1 is set but DATABASE_URL is missing from .env.test.local.",
    );
  }
  return url;
}
