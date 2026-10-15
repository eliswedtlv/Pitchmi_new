import { ImageResponse } from "next/og"

export const alt = "KillerPitch — Say it like you mean it"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f2f0e9",
          color: "#101113",
          padding: "64px 72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 19,
              background: "#1746ff",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 64 64" fill="none">
              <path
                d="M20 15v34M47 16 26 32M32 27 48 48"
                stroke="#fff"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -2 }}>
            killerpitch
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: -6,
            }}
          >
            <span>Say it like</span>
            <span style={{ color: "#1746ff" }}>you mean it.</span>
          </div>
          <div style={{ display: "flex", fontSize: 25, color: "#535761", letterSpacing: -0.5 }}>
            Rehearse up to 5 minutes · on your own rhythm
          </div>
        </div>
      </div>
    ),
    size,
  )
}
