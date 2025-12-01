import { ImageResponse } from "next/og"
import { readFile } from "fs/promises"
import { join } from "path"

export const alt = "Image Magnifier Tool"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image() {
  const geistFont = await readFile(join(process.cwd(), "public/images/geist-regular.ttf"))

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        position: "relative",
        fontFamily: "Geist",
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.4,
        }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d4d4d4" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* Magnifier icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: "50%",
            backgroundColor: "white",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "3px solid #e5e5e5",
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#525252"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <circle cx="11" cy="11" r="3" strokeDasharray="2 2" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h1
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#171717",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Image Magnifier
          </h1>
          <p
            style={{
              fontSize: 24,
              color: "#737373",
              margin: 0,
              textAlign: "center",
              maxWidth: 600,
            }}
          >
            Add zoom magnifiers to annotate and highlight image details
          </p>
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 16,
          }}
        >
          {["Drag & Drop", "Resize", "Adjust Zoom", "Export"].map((feature) => (
            <div
              key={feature}
              style={{
                display: "flex",
                backgroundColor: "white",
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 9999,
                fontSize: 16,
                color: "#525252",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e5e5e5",
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 18,
          color: "#a3a3a3",
        }}
      >
        <span>Built with</span>
        <span style={{ color: "#525252", fontWeight: 600 }}>v0</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: geistFont,
          style: "normal",
          weight: 400,
        },
      ],
    },
  )
}
