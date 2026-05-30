import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep client JS lean (No-Flash budget: <~150KB on key routes).
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

/**
 * Phase 10.2 (PHASE_10_PLAN.md)  bundle-size analyzer gated behind
 * the `ANALYZE=true` env var. Install once via
 *
 *   npm install --save-dev @next/bundle-analyzer
 *
 * then run
 *
 *   ANALYZE=true npm run build
 *
 * to get an interactive treemap at .next/analyze/client.html. The
 * dynamic import below is no-op when the env var is unset, so this
 * code path costs nothing in normal builds.
 */
function withOptionalBundleAnalyzer(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== "true") return config;
  try {
    // Dynamic require so the package is optional. If it's not
    // installed yet, fall back to the unwrapped config + log a hint.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withBundleAnalyzer = require("@next/bundle-analyzer")({
      enabled: true,
    });
    return withBundleAnalyzer(config);
  } catch {
    console.warn(
      "[next.config] ANALYZE=true set but @next/bundle-analyzer isn't installed. Run `npm install --save-dev @next/bundle-analyzer` first.",
    );
    return config;
  }
}

export default withNextIntl(withOptionalBundleAnalyzer(nextConfig));
