/**
 * Neon Postgres + Drizzle client.
 *
 * Uses the WebSocket Pool driver (`drizzle-orm/neon-serverless`) NOT
 * the HTTP one-shot driver. The HTTP driver is fast for single-statement
 * reads but does NOT support transactions  every `db.transaction(...)`
 * site (sign-up profile insert, 9.11 mark-as-filled batch, 9.12
 * completion upsert, profile skill updates) needs Pool to function.
 * Symptom of regressing this: "No transactions support in neon-http
 * driver" at runtime in /sign-up/seeker step 3 (PHASE_2_SMOKE_TEST
 * 2026-05-25).
 *
 * Connection lifecycle: single Pool, lazy-initialised, module-scoped.
 * On Vercel each serverless function gets its own warm instance; the
 * Pool's connection caching covers the warm window. Neon scales-to-
 * zero on the DB side handles cold starts.
 *
 * Phase 0 task: confirm Neon region + document POPIA cross-border
 * posture before any real PII is written. See ROADMAP.md Task 0.1.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import ws from "ws";
import * as schema from "./schema";

// In Node.js the Neon serverless driver needs a WebSocket implementation.
// Edge runtime + the browser provide WebSocket natively; Node 22 has it
// experimentally. We always set `ws` so behaviour is identical across
// runtimes and versions  the only Node-only assumption is that this
// module isn't loaded in the browser (it shouldn't be).
neonConfig.webSocketConstructor = ws;

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;
let _pool: Pool | null = null;

/**
 * Driver seam (Phase 12 / AWS runbook).
 *
 * `DATABASE_DRIVER=postgres-js` switches to the standard TCP driver
 * (`postgres` + `drizzle-orm/postgres-js`). Two consumers:
 *   - Phase 12 integration/compliance tests against a local Docker
 *     Postgres (the Neon WebSocket driver can't reach plain Postgres).
 *   - The AWS Cape Town `af-south-1` migration (`docs/AWS_MIGRATION_RUNBOOK.md`)
 *     plans exactly this swap for RDS/Aurora — flipping the env var is
 *     the cutover, no code change.
 *
 * The two drizzle instances expose the same query/transaction API; the
 * cast keeps a single exported type so call sites stay driver-agnostic.
 * Default (env var unset) remains the Neon WebSocket Pool driver.
 */
function createDb(url: string): Db {
  if (process.env.DATABASE_DRIVER === "postgres-js") {
    const client = postgres(url);
    const db = drizzlePostgresJs(client, { schema });
    // Parameter shim: drizzle's postgres-js driver init overwrites the
    // client's date/timestamp PARSERS *and SERIALIZERS* with an identity
    // function (drizzle-orm/postgres-js/driver.js `transparentParser`) so
    // its own column mappers own the decoding. That breaks raw `sql`
    // fragments that bind a JS Date (e.g. the cron sweeps'
    // `sql\`${col} < ${cutoff}\``): the identity serializer hands the Date
    // object straight to the wire encoder, which throws "argument must be
    // of type string … received an instance of Date". The Neon driver
    // stringifies Dates internally, which is why production never sees
    // this. Patch the SERIALIZER side only (param → wire) to stringify
    // Dates; parsers stay drizzle's identity so result decoding is
    // untouched. Must run AFTER drizzle's constructor (it would clobber).
    const dateAwareSerializer = (v: unknown): unknown =>
      v instanceof Date ? v.toISOString() : v;
    const serializers = (
      client as unknown as {
        options: { serializers: Record<number, (v: unknown) => unknown> };
      }
    ).options.serializers;
    for (const oid of [1184, 1114, 1082, 1083, 1182, 1185, 1115, 1231]) {
      serializers[oid] = dateAwareSerializer;
    }
    // Result-shape shim: the Neon driver's `db.execute()` resolves to
    // `{ rows: [...] }`; postgres-js resolves to the row array itself.
    // Call sites across the codebase read `.rows`, so alias the array
    // onto itself — both access patterns work, no call site changes.
    const originalExecute = db.execute.bind(db);
    (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute =
      async (q: unknown) => {
        const result = (await originalExecute(
          q as Parameters<typeof originalExecute>[0],
        )) as Record<string, unknown>[] & { rows?: unknown };
        if (Array.isArray(result) && result.rows === undefined) {
          result.rows = result;
        }
        return result;
      };
    return db as unknown as Db;
  }
  _pool = new Pool({ connectionString: url });
  return drizzle(_pool, { schema });
}

export function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Phase 1 uses the mock provider; set SEBENZA_DATA_PROVIDER=mock or provide DATABASE_URL.",
    );
  }
  _db = createDb(url);
  return _db;
}

export { schema };
