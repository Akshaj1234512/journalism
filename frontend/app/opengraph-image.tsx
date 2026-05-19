import { ImageResponse } from "next/og";

/**
 * Dynamic social-share preview image.
 *
 * Next.js auto-generates this at /opengraph-image.png and points the
 * og:image meta at it. Twitter, LinkedIn, Slack, Discord, etc. will all
 * use this card when someone pastes a link to the site.
 */

export const runtime = "edge";
export const alt = "The Red Room — Pre-publication review by AI editors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#FAFAF9", // stone-50
          padding: "96px 110px",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {/* Vertical red rule, mirroring the in-app masthead. */}
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 96,
            bottom: 96,
            width: 6,
            backgroundColor: "#DC2626",
            borderRadius: 3,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 36,
          }}
        >
          <div
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 6,
              color: "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            Pre-publication review
          </div>

          <div
            style={{
              fontSize: 138,
              fontStyle: "italic",
              color: "#0F172A",
              marginTop: 20,
              lineHeight: 1,
              display: "flex",
            }}
          >
            The&nbsp;
            <span style={{ color: "#DC2626" }}>Red Room</span>
          </div>

          <div
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 34,
              color: "#525252",
              marginTop: 36,
              maxWidth: 940,
              lineHeight: 1.3,
            }}
          >
            An independent team of AI editors, reviewing your draft before you publish.
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 56,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {[
              { name: "Anne", color: "#EC4899" },
              { name: "Peter", color: "#0F172A" },
              { name: "Joe", color: "#6366F1" },
              { name: "Clara", color: "#10B981" },
              { name: "Parker", color: "#EF4444" },
              { name: "Sol", color: "#F59E0B" },
            ].map((a) => (
              <div
                key={a.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  border: `1.5px solid ${a.color}`,
                  borderRadius: 999,
                  color: a.color,
                  backgroundColor: "white",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: a.color,
                  }}
                />
                {a.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
