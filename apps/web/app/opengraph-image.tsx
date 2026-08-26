import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalDesk";

// Reuses the exact same mark/colors as `_components/brand-mark.tsx` and
// `globals.css`'s real `--surface`/`--emphasis` tokens — recomposed for a
// standalone image with no ambient `currentColor` context, not a new
// design. Kept in this file rather than importing the component directly:
// `next/og`'s ImageResponse renders through Satori, a constrained JSX/CSS
// subset distinct from the app's own React runtime.
export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        background: "#0d1117",
      }}
    >
      <svg width="120" height="120" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="11" fill="#141b24" />
        <path
          d="M10 25V16.5L18 11l8 5.5V25"
          stroke="#eef3f4"
          strokeWidth="2.2"
        />
        <path d="m13 22 4-4 3 2.5 4-5" stroke="#F6C36B" strokeWidth="2.2" />
      </svg>
      <div style={{ display: "flex", color: "#eef3f4", fontSize: 72 }}>
        {APP_NAME}
      </div>
      <div style={{ display: "flex", color: "#93a1ab", fontSize: 32 }}>
        One page for everything that needs your attention
      </div>
    </div>,
    { ...size },
  );
}
