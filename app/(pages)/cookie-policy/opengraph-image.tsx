import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "radial-gradient(circle at 30% 40%, #0e2233 0%, #05030d 70%)",
          color: "#e2e2e2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: "#4cd7f6", marginBottom: 24 }}>
          ToolNest AI
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20 }}>
          Cookie Policy
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#9b8da8" }}>
          Minimal cookies, no advertising trackers, full control
        </div>
      </div>
    ),
    { ...size }
  );
}
