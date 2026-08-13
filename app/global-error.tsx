"use client";

/**
 * Last-resort error boundary (docs/ERROR_PAGES_404_PLAN.md).
 *
 * Renders ONLY when the root layout itself crashes, replacing it
 * entirely, which means Tailwind/globals.css may never load. So this
 * page is styled inline, carries its own html/body, and keeps the
 * brand recognisable with system fonts: paper background, ink text,
 * the flag stripe, a serif headline, and one honest retry button.
 * No translations either (next-intl lives in the crashed layout);
 * plain English is the safe floor.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#FAF8F4",
          color: "#1A1A1A",
          fontFamily:
            "Georgia, 'Times New Roman', serif",
          minHeight: "100vh",
        }}
      >
        {/* Flag stripe */}
        <div style={{ display: "flex", height: 3 }} aria-hidden="true">
          <div style={{ flex: 3, background: "#0F766E" }} />
          <div style={{ flex: 2, background: "#C97B3D" }} />
          <div style={{ flex: 1, background: "#B4362A" }} />
        </div>
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "96px 20px" }}>
          <p
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#0B5A52",
              margin: 0,
            }}
          >
            Sebenza · something broke on our side
          </p>
          <h1
            style={{
              fontSize: "clamp(2.2rem, 8vw, 4rem)",
              lineHeight: 1.02,
              margin: "16px 0 0",
              fontWeight: 400,
            }}
          >
            We hit an unexpected error.
          </h1>
          <p
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 16,
              lineHeight: 1.6,
              color: "#5A5550",
              maxWidth: 480,
              marginTop: 20,
            }}
          >
            It has been logged on our side. Trying again usually fixes it;
            if it keeps happening, email popia@sebenzasa.com
            {error.digest ? ` and mention the code ${error.digest}` : ""}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 28,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "#FAF8F4",
              background: "#1A1A1A",
              border: "1px solid #1A1A1A",
              borderRadius: 9999,
              padding: "12px 26px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
