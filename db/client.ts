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
import ws from "ws";
import * as schema from "./schema";

// In Node.js the Neon serverless driver needs a WebSocket implementation.
// Edge runtime + the browser provide WebSocket natively; Node 22 has it
// experimentally. We always set `ws` so behaviour is identical across
// runtimes and versions  the only Node-only assumption is that this
// module isn't loaded in the browser (it shouldn't be).
neonConfig.webSocketConstructor = ws;

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Phase 1 uses the mock provider; set SEBENZA_DATA_PROVIDER=mock or provide DATABASE_URL.",
    );
  }
  _pool = new Pool({ connectionString: url });
  _db = drizzle(_pool, { schema });
  return _db;
}

export { schema };
