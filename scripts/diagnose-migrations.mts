/**
 * READ-ONLY diagnostic for the dev DB's drizzle migration bookkeeping.
 * Changes nothing. Compares `drizzle.__drizzle_migrations` against the
 * journal so we can see exactly why `drizzle-kit migrate` skipped the new
 * migrations, then design a precise reconciliation.
 *
 *   npx tsx scripts/diagnose-migrations.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL not set in .env.local");
  process.exit(1);
}
const ssl = /sslmode=disable/.test(url) ? false : ("require" as const);
const sql = postgres(url, { max: 1, ssl });

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function main() {
  const journal = JSON.parse(
    readFileSync(path.resolve("db/migrations/meta/_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  // What drizzle has recorded as applied.
  let dbRows: { hash: string; created_at: string }[] = [];
  try {
    dbRows = (await sql<{ hash: string; created_at: string }[]>`
      SELECT hash, created_at::text FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `) as unknown as { hash: string; created_at: string }[];
  } catch (e) {
    console.log("⚠️  Could not read drizzle.__drizzle_migrations:", String(e));
  }

  const appliedHashes = new Set(dbRows.map((r) => r.hash));
  const maxCreatedAt = dbRows.length
    ? Math.max(...dbRows.map((r) => Number(r.created_at)))
    : 0;

  console.log(`\n__drizzle_migrations rows: ${dbRows.length}`);
  console.log(`max created_at recorded:   ${maxCreatedAt}`);
  console.log(
    `journal entries:           ${journal.entries.length} (idx 0..${journal.entries.length - 1})\n`,
  );

  console.log("idx  when            tag                                          hash?  when>max?");
  for (const e of journal.entries) {
    const file = path.resolve("db/migrations", `${e.tag}.sql`);
    let hashKnown = false;
    try {
      const content = readFileSync(file, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      hashKnown = appliedHashes.has(hash);
    } catch {
      hashKnown = false;
    }
    const byTime = e.when > maxCreatedAt;
    // drizzle-orm migrator applies an entry when `entry.when > max(created_at)`.
    console.log(
      `${String(e.idx).padStart(3)}  ${String(e.when).padEnd(14)}  ${e.tag.padEnd(44)}  ${hashKnown ? "yes" : "NO "}    ${byTime ? "WOULD-APPLY" : "skip"}`,
    );
  }

  // Actual schema/data state we care about.
  const [idx] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'search_events_at_idx') AS exists
  `;
  const [fn] = await sql<{ fixed: boolean }[]>`
    SELECT (pg_get_functiondef('sebenza_profiles_search_vector_fn()'::regprocedure) LIKE '%NEW.profession%') AS fixed
  `;
  const [nulls] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM profiles WHERE search_vector IS NULL AND deleted_at IS NULL
  `;

  console.log(`\nsearch_events_at_idx exists:        ${idx?.exists}`);
  console.log(`search-vector trigger fn fixed:     ${fn?.fixed}`);
  console.log(`profiles with NULL search_vector:   ${nulls?.n}`);

  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  });
