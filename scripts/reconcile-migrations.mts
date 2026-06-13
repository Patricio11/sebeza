/**
 * Reconcile `drizzle.__drizzle_migrations` with the journal so
 * `drizzle-kit migrate` works correctly again.
 *
 * Context: this dev DB's schema is fully at head (every migration applied
 * via db:push during the Phase-12 journal recovery + the heal script), but
 * the drizzle bookkeeping table only recorded up to migration 0027 and
 * carried 11 stale hashes (0001-0011 were edited to be idempotent during
 * the recovery, changing their content). drizzle-kit migrate therefore
 * couldn't reconcile and applied nothing.
 *
 * Fix = BOOKKEEPING ONLY. We do NOT re-run migration SQL (several aren't
 * idempotent  e.g. 0028's CREATE TYPE  and the structures already exist).
 * We rebuild __drizzle_migrations to exactly mirror the journal: one row
 * per entry with (hash = sha256 of the .sql file, created_at = the journal
 * `when`). drizzle's hash scheme is sha256 of the raw file content  the
 * diagnostic confirmed this matches the rows it already had.
 *
 * Safe: transactional; touches only the bookkeeping table, never the
 * schema/data. Guards that the schema really is at head before running.
 *
 *   npx tsx scripts/reconcile-migrations.mts
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

  // ── Guard: the schema must already be at head (heal script run) ──────────
  const [fn] = await sql<{ fixed: boolean }[]>`
    SELECT (pg_get_functiondef('sebenza_profiles_search_vector_fn()'::regprocedure) LIKE '%NEW.profession%') AS fixed
  `;
  const [nulls] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM profiles WHERE search_vector IS NULL AND deleted_at IS NULL
  `;
  if (!fn?.fixed || (nulls?.n ?? 1) !== 0) {
    console.error(
      "❌ Schema isn't at head yet (trigger fixed = " +
        `${fn?.fixed}, NULL vectors = ${nulls?.n}). Run heal-search-vectors.mts first.`,
    );
    await sql.end();
    process.exit(1);
  }

  // ── Build the canonical (hash, when) set from the journal ────────────────
  const rows = journal.entries.map((e) => {
    const content = readFileSync(
      path.resolve("db/migrations", `${e.tag}.sql`),
      "utf8",
    );
    const hash = createHash("sha256").update(content).digest("hex");
    return { hash, when: e.when, tag: e.tag };
  });

  const [before] = await sql<{ n: number; mx: string | null }[]>`
    SELECT count(*)::int AS n, max(created_at)::text AS mx FROM drizzle.__drizzle_migrations
  `;
  console.log(
    `before: ${before?.n} rows, max created_at ${before?.mx} (drizzle thought it was here)`,
  );

  // ── Rebuild the bookkeeping table, transactionally ───────────────────────
  await sql.begin(async (tx) => {
    await tx`TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY`;
    for (const r of rows) {
      await tx`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${r.hash}, ${r.when})
      `;
    }
  });

  const [after] = await sql<{ n: number; mx: string | null }[]>`
    SELECT count(*)::int AS n, max(created_at)::text AS mx FROM drizzle.__drizzle_migrations
  `;
  console.log(`after:  ${after?.n} rows, max created_at ${after?.mx}`);
  console.log(
    after?.n === journal.entries.length
      ? `\n✅ Reconciled  __drizzle_migrations now mirrors the journal (${after?.n} entries, head = ${rows[rows.length - 1]?.tag}). 'npm run db:migrate' will be a clean no-op, and future migrations will apply normally.`
      : "\n⚠️  Row count mismatch  inspect before continuing.",
  );

  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Failed (transaction rolled back):", e);
    process.exit(1);
  });
