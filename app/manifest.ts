import type { MetadataRoute } from "next";

/**
 * Phase 28  PWA web-app manifest. Served at /manifest.webmanifest and
 * auto-linked into <head> by Next's metadata-file convention (applies to
 * every route, including the [locale] tree  the middleware matcher
 * excludes dotted paths, so this never gets locale-redirected).
 *
 * `display: "standalone"` + the icon set below is what makes Android/iOS
 * offer "Add to Home Screen" as an app-like install. Colors are the
 * Civic Editorial paper tokens so the OS splash screen matches the app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sebenza — South African talent platform",
    short_name: "Sebenza",
    description:
      "Find skilled people near you. Get found for the work you do. POPIA-compliant, freshness-weighted talent data for South Africa.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f0",
    theme_color: "#fbf8f0",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
