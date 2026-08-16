// Builds and serves the app EXACTLY like the E2E harness: production build
// against the disposable Docker test database from .env.test.local. The
// recordings can never touch the real register.
//
//   node docs/social_media/videos/src/serve-app.mjs        (from repo root)
//
// Prereqs: `docker start sebenza-test-pg`, .env.test.local present, DB
// migrated + seeded (any integration/vitest DB run does this).

import { config as loadEnv } from "dotenv";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
loadEnv({ path: path.join(repoRoot, ".env.test.local") });

if (process.env.SEBENZA_TEST_DB !== "1") {
  throw new Error("Refusing to serve: .env.test.local with SEBENZA_TEST_DB=1 is required (never record against the real DB).");
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_DRIVER: "postgres-js",
  SEBENZA_DATA_PROVIDER: "db",
  BETTER_AUTH_URL: "http://localhost:3100",
  EMAIL_TRANSPORT: "console",
  EMAIL_TRANSPORT_STRICT: "false",
  SEBENZA_E2E_HTTP: "1",
};

const build = spawnSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit", env, shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

spawn("npx", ["next", "start", "-p", "3100"], { cwd: repoRoot, stdio: "inherit", env, shell: true });
