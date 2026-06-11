/**
 * Per-worker env bootstrap for the integration + compliance projects.
 *
 * `globalSetup` runs in its own process; vitest workers do NOT inherit the
 * env it loads. This setupFile runs inside every worker before any test
 * imports app code, so `getDb()` (lazy) always sees the test DATABASE_URL +
 * DATABASE_DRIVER, and the D1 guard fires here too if someone runs a DB
 * suite without `.env.test.local`.
 */
import { requireTestDb } from "./db";

requireTestDb();
