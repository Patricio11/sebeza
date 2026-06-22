/**
 * Phase 12 (Task 12.0)  global setup for the integration + compliance
 * projects: migrate-from-zero + seed against the DISPOSABLE test database.
 *
 * Runs once per vitest project invocation, in its own process:
 *
 *   1. D1 guard via `requireTestDb()`  refuses without `.env.test.local`
 *      carrying `SEBENZA_TEST_DB=1`.
 *   2. Programmatic Drizzle migrations (`drizzle-orm/postgres-js/migrator`)
 *      from `db/migrations`  the same journal `drizzle-kit migrate` uses,
 *      so this doubles as a continuous proof that the journal repair holds
 *      (a missing journal entry = failing suite, not a silent skip).
 *   3. `db/seed.ts` via tsx  the truncating seed; the guard above is what
 *      makes that safe.
 *
 * Re-running is idempotent: migrator no-ops on applied entries, seed
 * truncates + re-inserts.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { requireTestDb } from "./db";

export default async function setup(): Promise<void> {
  const url = requireTestDb();

  if (process.env.DATABASE_DRIVER !== "postgres-js") {
    throw new Error(
      "Test DB harness expects DATABASE_DRIVER=postgres-js in .env.test.local " +
        "(the Neon WebSocket driver cannot reach the local Docker Postgres).",
    );
  }

  // ── Migrate from the journal ────────────────────────────────────────────
  const sql = postgres(url, { max: 1 });
  try {
    const db = drizzle(sql);
    await migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), "db/migrations"),
    });
  } finally {
    await sql.end();
  }

  // ── Seed (truncate + insert; same dataset the dev app uses) ────────────
  execSync("npx tsx --tsconfig tsconfig.json db/seed.ts", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
  });
}
