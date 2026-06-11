/**
 * Phase 12 — run the journal migrations against a target database.
 *
 *   npx tsx tests/helpers/migrate-cli.ts <database-url>
 *
 * Same programmatic migrator the test harness uses (`global-setup.ts`);
 * exists as a CLI so the schema-drift workflow (compare migrate-from-zero
 * vs `drizzle-kit push` output) is reproducible by hand.
 */
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: npx tsx tests/helpers/migrate-cli.ts <database-url>");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: path.resolve(process.cwd(), "db/migrations"),
    });
    console.log("migrations applied");
  } finally {
    await sql.end();
  }
}

void main();
