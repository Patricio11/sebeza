/**
 * Neon Postgres + Drizzle client.
 *
 * Phase 1 does NOT connect  the dataProvider seam stays on `mock`. This file
 * exists so the moment Phase 4 begins, `lib/data/provider.ts` can flip to `db`
 * and pull queries from `db/queries/*` using this client.
 *
 * Phase 0 task: confirm Neon region + document POPIA cross-border posture before
 * any real PII is written. See ROADMAP.md Task 0.1.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Phase 1 uses the mock provider; set SEBENZA_DATA_PROVIDER=mock or provide DATABASE_URL.",
    );
  }
  _db = drizzle(neon(url), { schema });
  return _db;
}

export { schema };
