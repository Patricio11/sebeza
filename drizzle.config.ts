import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// drizzle-kit doesn't auto-load .env.local  load it explicitly so
// `npm run db:generate / db:migrate / db:push / db:studio` work the same
// way the running app does.
loadEnv({ path: ".env.local" });
loadEnv(); // also load .env if present (no override)

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
