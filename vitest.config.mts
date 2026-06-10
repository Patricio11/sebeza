/**
 * Phase 12 (Task 12.0) — Vitest configuration.
 *
 * Three suite families share this config, selected by path filter in the
 * npm scripts (see package.json):
 *
 *   unit         `npm test`              → lib/**\/*.test.ts (colocated, no DB)
 *   integration  `npm run test:integration` → tests/integration/**
 *   compliance   `npm run test:compliance`  → tests/compliance/**
 *
 * The integration + compliance families exercise a REAL Postgres via the
 * harness in `tests/helpers/db.ts`, which refuses to run unless
 * `SEBENZA_TEST_DB=1` (D1 in docs/PHASE_12_PLAN.md) — structural protection
 * against pointing the truncating seed at a dev/prod database.
 *
 * Aliases:
 *   `@/`          mirrors the tsconfig path alias.
 *   `server-only` stubbed to an empty module so server-only library code
 *                 (rate limiter, vacancy-outcome composer, db queries) can
 *                 be imported by node-environment tests.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(root, "tests/helpers/server-only-stub.ts"),
      "@/": `${root}/`,
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
