/**
 * Manual apply of migrations 0050 + 0051 for an environment where
 * `drizzle-kit migrate` didn't pick them up (e.g. a DB whose
 * `__drizzle_migrations` bookkeeping drifted from the journal because it
 * was brought up to date with `db:push`). All statements are idempotent,
 * so running this is safe + repeatable.
 *
 *   npx tsx scripts/heal-search-vectors.mts
 *
 * Targets the DATABASE_URL in .env.local (your dev/Neon DB). It:
 *   - fixes the profiles search-vector trigger (build from NEW.* so the
 *     BEFORE INSERT path no longer produces NULL)  migration 0051
 *   - backfills every existing NULL search_vector                  0051
 *   - adds the search_events(at) index                             0050
 * and prints the NULL-vector count before + after (you want 0 after).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

// Neon (and most hosted Postgres) require TLS. A local non-TLS DB with
// sslmode=disable in the URL opts out.
const ssl = /sslmode=disable/.test(url) ? false : ("require" as const);
const sql = postgres(url, { max: 1, ssl });

const TRIGGER_FN = `
CREATE OR REPLACE FUNCTION sebenza_profiles_search_vector_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
       setweight(to_tsvector('simple', coalesce(NEW.profession, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(NEW.seniority, '')),  'B')
    || setweight(to_tsvector('simple', coalesce(NEW.bio, '')),        'C')
    || setweight(
         to_tsvector('simple', coalesce(NEW.city, '') || ' ' || coalesce(NEW.province, '')),
         'B'
       )
    || setweight(
         to_tsvector('simple', coalesce(
           (SELECT string_agg(s.label, ' ')
              FROM profile_skills ps
              JOIN skills s ON s.slug = ps.skill_slug
             WHERE ps.profile_id = NEW.id),
           ''
         )),
         'A'
       );
  RETURN NEW;
END;
$$;
`;

async function main() {
  const [before] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM profiles
    WHERE search_vector IS NULL AND deleted_at IS NULL
  `;
  console.log(`NULL search_vectors before: ${before?.n ?? "?"}`);

  // 0051  fix the trigger function (so future inserts never go NULL).
  await sql.unsafe(TRIGGER_FN);

  // 0051  backfill existing NULL vectors (rows exist now, so the by-id
  // helper computes the full vector correctly).
  await sql`
    UPDATE profiles
       SET search_vector = sebenza_profile_tsvector(id)
     WHERE search_vector IS NULL
  `;

  // 0050  demand-read index.
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS "search_events_at_idx" ON "search_events" ("at")`,
  );

  const [after] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM profiles
    WHERE search_vector IS NULL AND deleted_at IS NULL
  `;
  console.log(`NULL search_vectors after:  ${after?.n ?? "?"}`);
  console.log(
    after?.n === 0
      ? "✅ Healed  every profile is now searchable + the trigger is fixed going forward."
      : "⚠️  Some vectors are still NULL  check the rows above.",
  );

  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  });
