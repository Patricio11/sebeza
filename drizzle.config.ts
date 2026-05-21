import type { Config } from "drizzle-kit";

// Phase 1 placeholder. Phase 4 enables migrations against Neon.
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
