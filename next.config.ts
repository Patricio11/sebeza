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
  /**
   * Phase 32.3.6 (security remediation)  security headers for `/api/**`.
   *
   * `proxy.ts` sets the full header set (CSP, HSTS, frame-ancestors,
   * nosniff, referrer-policy…) but its matcher deliberately EXCLUDES
   * `api`, so every route under `app/api/**` shipped bare  including
   * the POPIA data export (the single richest PII payload in the app),
   * the six gov CSV exports and the two admin exports.
   *
   * `nosniff` is the load-bearing one here: without it a browser may
   * content-sniff a user-influenced JSON/CSV body into something
   * executable. These are set in `next.config.ts` rather than by
   * widening the proxy matcher so the auth handler's own request
   * handling stays untouched.
   */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // API responses are data, never a document — a restrictive
          // sandbox costs nothing and blocks any attempt to render one.
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'; sandbox",
          },
        ],
      },
    ];
  },
};

/**
 * Phase 10.6 (PHASE_10_LAUNCH_PLAN.md)  bundle-size analyzer gated behind
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
