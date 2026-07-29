/**
 * Phase 34  Self Apply vacancy share card (PNG, 1200x630).
 *
 * The OpenGraph preview for WhatsApp / LinkedIn unfurls of
 * /apply/[token]  the founder's "recruiting poster" moment: role
 * title, employer, location, up to three asked-for skills, Sebenza
 * flag-band footer.
 *
 * Reads through `lib/vacancy/public.ts` (the defined public subset)
 * so the redaction rules hold automatically: no salary, no org ids,
 * nothing the anonymous page itself wouldn't show. Unavailable
 * states render one generic card  same no-enumeration posture as
 * the page.
 *
 * Satori constraints (Phase 33 lessons  they 500 the whole image):
 * no display:inline-block; any element with >1 child node needs
 * explicit display:flex; interleave text via single template strings.
 *
 * Cache: 1 hour  the link dies with the toggle, and a stale preview
 * image for a just-closed vacancy is acceptable for that window (the
 * page itself refuses instantly).
 */

import { ImageResponse } from "next/og";
import { getPublicVacancyByToken } from "@/lib/vacancy/public";
import { SITE_HOST } from "@/lib/seo";

export const revalidate = 3600;

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = "#FAF8F4";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5550";
const BRAND = "#0F766E";
const BRAND_STRONG = "#0B5A52";
const HAIRLINE = "#D6CFC4";
const FLAG = ["#007A4D", "#FFB612", "#DE3831", "#002395", "#000000", "#FFFFFF"];

interface Params {
  params: Promise<{ locale: string; token: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const result = await getPublicVacancyByToken(token);

  if (!result.ok) {
    return renderUnavailable();
  }
  const v = result.vacancy;
  const skills = v.skills.slice(0, 3);

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
              display: "block",
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
              backgroundColor: BRAND,
            }}
          />
          {`Open role · ${v.locationLabel}`}
        </div>

        {/* Vacancy title */}
        <div
          style={{
            marginTop: "44px",
            fontSize: v.title.length > 32 ? "72px" : "92px",
            lineHeight: 1.05,
            color: INK,
            fontFamily: "Georgia, serif",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          {v.title}
        </div>

        {/* Employer line */}
        <div
          style={{
            marginTop: "18px",
            fontSize: "34px",
            color: INK_SOFT,
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          {`${v.orgName} · hiring on Sebenza`}
        </div>

        {/* Skill chips */}
        {skills.length > 0 && (
          <div
            style={{
              marginTop: "40px",
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {skills.map((s) => (
              <span
                key={s.slug}
                style={{
                  padding: "10px 24px",
                  borderRadius: "9999px",
                  border: `2px solid ${INK}`,
                  fontSize: "26px",
                  color: INK,
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            left: "72px",
            right: "72px",
            bottom: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "20px",
            borderTop: `2px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              fontSize: "24px",
              color: BRAND_STRONG,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            Apply free · takes minutes
          </div>
          <div
            style={{
              fontSize: "22px",
              color: INK_SOFT,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            {SITE_HOST}
          </div>
        </div>

        {/* SA flag band */}
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

function renderUnavailable() {
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
          Role not available
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
