/**
 * Phase 11.4.1  shareable profile summary card (PNG).
 *
 * Returns a 1200x630 PNG rendered server-side from the seeker's
 * public profile data. The image is the canonical OpenGraph
 * preview for WhatsApp / LinkedIn / Slack link unfurls when the
 * seeker shares /p/{handle}/card.
 *
 * Privacy posture: subject to the same redaction rules as the
 * underlying /p/{handle} route  goes through `dataProvider.
 * getProfile(handle)` which already enforces them. A profile
 * Sebenza wouldn't render publicly returns a generic "Profile
 * not available" image (never a stack trace, never an enumeration
 * surface).
 *
 * Cache: 7 days. Static generation is fine  every mutation that
 * matters (display name, profession, top skills, verification) is
 * already tied to revalidatePath('/p/<handle>') in the action that
 * writes it; the card route inherits the same cache key.
 *
 * Anti-pattern guards (per plan):
 *   - No QR code (visual noise; people share the link not the image).
 *   - No tracking pixel (we don't need to know who scanned it).
 *   - No Sebenza CTA visually overpowering the seeker's name
 *     (seeker is the subject, not the platform).
 */

import { ImageResponse } from "next/og";
import { dataProvider } from "@/lib/data/provider";

// 7 days. Pre-computed literal so the segment-config check sees a
// straight numeric  Next 16 segment-config validator rejects
// arithmetic expressions on `revalidate`.
export const revalidate = 604800;

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = "#FAF8F4";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5550";
const BRAND = "#0F766E";
const BRAND_STRONG = "#0B5A52";
const ACCENT = "#C97B3D";
const HAIRLINE = "#D6CFC4";

interface Params {
  params: Promise<{ locale: string; handle: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { handle } = await params;
  const profile = await dataProvider.getProfile(handle);

  if (!profile) {
    return renderUnavailable("Profile not available");
  }

  const topSkills = (profile.topSkills ?? [])
    .slice(0, 3)
    .map((s) => s.name);

  const verified = profile.verification === "verified";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: PAPER,
          display: "flex",
          flexDirection: "column",
          padding: "64px 72px",
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
            fontSize: "20px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: BRAND_STRONG,
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
              backgroundColor: BRAND,
            }}
          />
          Sebenza  South African talent
        </div>

        {/* Display name */}
        <div
          style={{
            marginTop: "48px",
            fontSize: "104px",
            lineHeight: 1.05,
            color: INK,
            fontFamily: "Georgia, serif",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          {profile.displayName}
        </div>

        {/* Profession + location */}
        <div
          style={{
            marginTop: "16px",
            fontSize: "36px",
            color: INK_SOFT,
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          {profile.profession}  {profile.city}, {profile.province}
        </div>

        {/* Top skills */}
        {topSkills.length > 0 && (
          <div
            style={{
              marginTop: "48px",
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {topSkills.map((s) => (
              <span
                key={s}
                style={{
                  padding: "10px 24px",
                  borderRadius: "9999px",
                  border: `2px solid ${INK}`,
                  fontSize: "26px",
                  color: INK,
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Footer  verification + wordmark anchor */}
        <div
          style={{
            position: "absolute",
            left: "72px",
            right: "72px",
            bottom: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "20px",
            borderTop: `2px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "20px",
              fontFamily: "Helvetica, Arial, sans-serif",
              color: verified ? BRAND_STRONG : INK_SOFT,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                borderRadius: "9999px",
                backgroundColor: verified ? BRAND : ACCENT,
              }}
            />
            {verified ? "Sebenza-verified" : "Self-registered"}
          </div>
          <div
            style={{
              fontSize: "22px",
              color: INK_SOFT,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            sebenza.co.za/p/{handle}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}

function renderUnavailable(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: PAPER,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
          color: INK_SOFT,
        }}
      >
        <div
          style={{
            fontSize: "20px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: BRAND_STRONG,
          }}
        >
          Sebenza
        </div>
        <div
          style={{
            marginTop: "24px",
            fontSize: "48px",
            color: INK,
            fontFamily: "Georgia, serif",
          }}
        >
          {message}
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
