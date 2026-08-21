import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * 2026-08-21  the sharp/libvips production outage.
   *
   * Every route whose bundle touches lib/storage/upload.ts (the WebP
   * pipeline: profile photos, project images, selfies, KYC docs, org
   * vetting) 500'd on Vercel with ERR_DLOPEN_FAILED: libvips-cpp.so
   * not found. That broke /admin/verifications outright and was the
   * true root cause of the /dashboard/profile sign-out failures.
   *
   * Why: sharp's native binary loads libvips via dlopen at runtime,
   * not via require(), so Vercel's output file tracing never sees the
   * dependency and leaves `@img/sharp-libvips-linux-x64/**` out of the
   * function bundle. Locally node_modules is complete, so it never
   * reproduces off Vercel. Confirmed against the build's own
   * page.js.nft.json: 93 sharp files traced, zero libvips.
   *
   * Both key spellings are kept deliberately: the route matcher is a
   * glob, and a key that fails to match is a silent no-op, which is
   * exactly how this class of bug ships. A few MB per function is the
   * price of photos that upload.
   */
  outputFileTracingIncludes: {
    "**": ["./node_modules/@img/**/*"],
    "/**": ["./node_modules/@img/**/*"],
  },
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
          // API responses are data, never a document: a restrictive
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
