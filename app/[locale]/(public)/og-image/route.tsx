/**
 * Phase 33  sitewide default OpenGraph image (PNG, 1200x630).
 *
 * Referenced from the root layout's `openGraph.images` / `twitter.images`,
 * so every public page WITHOUT a richer per-page card (landing, /search,
 * /insights, legal pages) unfurls this branded card on WhatsApp /
 * LinkedIn / X. Profile pages keep their own /p/{handle}/card.
 *
 * Generated (D2 in docs/PHASE_33_SEO_PLAN.md) instead of a static
 * public/og.png the founder would have to design and maintain  the
 * Civic-Editorial branding already lives in code (the profile share
 * card proves the pattern) and text edits stay one-line diffs.
 *
 * Routing note: this lives under app/[locale]/ because the edge proxy
 * rewrites unprefixed paths through next-intl (`/og-image` →
 * `/en/og-image`); a root-level app/og-image/route.tsx would never be
 * reached. Same placement as /p/[handle]/card.
 *
 * Cache: 30 days  the card only changes when this file changes, and a
 * deploy busts the cache anyway.
 */

import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/seo";

// 30 days, pre-computed literal (Next 16 segment-config validator
// rejects arithmetic expressions on `revalidate`).
export const revalidate = 2592000;

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = "#FAF8F4";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5550";
const BRAND = "#0F766E";
const BRAND_STRONG = "#0B5A52";
const HAIRLINE = "#D6CFC4";

// SA flag band  civic identity strip along the bottom edge.
const FLAG = ["#007A4D", "#FFB612", "#DE3831", "#002395", "#000000", "#FFFFFF"];

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: PAPER,
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "22px",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: BRAND_STRONG,
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          <span
            style={{
              // Satori (next/og) only supports flex|block|contents|none
              // "inline-block" throws and 500s the whole image.
              display: "block",
              width: "12px",
              height: "12px",
              borderRadius: "9999px",
              backgroundColor: BRAND,
            }}
          />
          South Africa&apos;s National Talent Platform
        </div>

        {/* Wordmark */}
        <div
          style={{
            marginTop: "56px",
            fontSize: "168px",
            lineHeight: 1,
            color: INK,
            fontFamily: "Georgia, serif",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          Sebenza
        </div>

        {/* Promise line  both sides of the marketplace, honest voice. */}
        <div
          style={{
            marginTop: "36px",
            fontSize: "38px",
            lineHeight: 1.35,
            color: INK_SOFT,
            fontFamily: "Helvetica, Arial, sans-serif",
            maxWidth: "980px",
          }}
        >
          Find skilled people near you, or get found for the work you do.
          Free for job seekers. POPIA-first.
        </div>

        {/* Footer  hairline + host */}
        <div
          style={{
            position: "absolute",
            left: "80px",
            right: "80px",
            bottom: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "24px",
            borderTop: `2px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              fontSize: "24px",
              color: BRAND_STRONG,
              fontFamily: "Helvetica, Arial, sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            {SITE_HOST}
          </div>
          <div
            style={{
              fontSize: "22px",
              color: INK_SOFT,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            Honest by design
          </div>
        </div>

        {/* SA flag band  bottom edge identity strip */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "14px",
            display: "flex",
          }}
        >
          {FLAG.map((c) => (
            <span key={c} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
