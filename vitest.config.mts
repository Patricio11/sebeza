/**
 * Phase 12 (Task 12.0)  Vitest configuration.
 *
 * Three projects:
 *
 *   unit         `npm test`                  lib/**\/*.test.ts  pure logic, no DB
 *   integration  `npm run test:integration`  tests/integration/**  our Server
 *                Actions + queries against a real seeded Postgres (no external
 *                systems; see docs/PHASE_12_PLAN.md terminology note)
 *   compliance   `npm run test:compliance`   tests/compliance/**  the 29-assertion
 *                runtime suite + forbidden-key payload checks
 *
 * The integration + compliance projects run migrate-from-zero + seed via
 * `tests/helpers/global-setup.ts` against the DISPOSABLE test database in
 * `.env.test.local`, and refuse to start unless `SEBENZA_TEST_DB=1` (D1 guard 
 * the truncating seed must never touch dev/prod). They run files sequentially:
 * suites share one seeded database, so parallel files would race on writes.
 *
 * Aliases:
 *   `@/`          mirrors the tsconfig path alias.
 *   `server-only` stubbed to an empty module so server-only library code is
 *                 importable from node-environment tests.
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
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/helpers/setup-env.ts"],
          globalSetup: ["tests/helpers/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: "compliance",
          include: ["tests/compliance/**/*.test.ts"],
          setupFiles: ["tests/helpers/setup-env.ts"],
          globalSetup: ["tests/helpers/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
