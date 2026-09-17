import { ImageResponse } from "next/og";

export const alt = "TYSHEE — Considered pieces, made slowly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F1EB",
          color: "#141414",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 128, letterSpacing: 40, fontWeight: 400 }}>TYSHEE</div>
        <div style={{ marginTop: 28, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#8A8478", fontFamily: "Helvetica, Arial, sans-serif" }}>
          Considered pieces, made slowly
        </div>
      </div>
    ),
    size,
  );
}
