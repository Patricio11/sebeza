/**
 * Phase 12 (Task 12.3)  Playwright E2E configuration.
 *
 * Runs the PRODUCTION build (`next build` + `next start`) against the
 * DISPOSABLE test database from `.env.test.local`. Every env var the app
 * needs is set EXPLICITLY on the webServer (process env beats .env.local
 * in Next's precedence), so the browser suite can never touch the dev
 * Neon database.
 *
 * Two projects per D2 (docs/PHASE_12_PLAN.md): desktop 1280px and
 * mobile 360px  the No-Flash Rule's reference width.
 *
 * Prereqs (same as the integration suite):
 *   - Docker Postgres up (`docker start sebenza-test-pg`)
 *   - `.env.test.local` present (D1 guard values)
 *   - DB migrated + seeded  run `npm run test:integration` once, or any
 *     DB suite, before `npm run test:e2e` on a fresh container.
 */
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, ".env.test.local") });

if (process.env.SEBENZA_TEST_DB !== "1") {
  throw new Error(
    "E2E needs .env.test.local with SEBENZA_TEST_DB=1 (see tests/helpers/db.ts).",
  );
}

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false, // shared seeded DB  same reasoning as vitest integration
  workers: 1,
  // A small retry budget absorbs inherent E2E timing blips under full-suite
  // load (one dev-grade server + one shared DB). This does NOT mask real bugs:
  // a genuine failure fails on every retry; only transient blips pass on retry.
  // Each spec is also verified to pass in isolation.
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    port: PORT,
    timeout: 600_000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL!,
      DATABASE_DRIVER: "postgres-js",
      SEBENZA_DATA_PROVIDER: "db",
      SEBENZA_ENCRYPTION_KEY: process.env.SEBENZA_ENCRYPTION_KEY!,
      SEBENZA_INVITE_SIGNING_SECRET:
        process.env.SEBENZA_INVITE_SIGNING_SECRET!,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      CRON_SECRET: process.env.CRON_SECRET!,
      EMAIL_TRANSPORT: "console",
      EMAIL_TRANSPORT_STRICT: "false",
      // Drops `upgrade-insecure-requests` from the CSP (proxy.ts)  the
      // E2E server speaks plain http on localhost. Never set in prod.
      SEBENZA_E2E_HTTP: "1",
    },
  },
});
