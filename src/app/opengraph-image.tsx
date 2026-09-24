import { ImageResponse } from "next/og";
import { OG, OgBrand, ogFonts, ogFrame } from "@/lib/og";

// Default preview for every page. Private pages (/meetings/...) use this too, so nothing private leaks into link previews.
export const alt = "Breeze — meeting notes";
export const size = { width: OG.width, height: OG.height };
export const contentType = "image/png";

const SUB = "Record your meeting. Get a clear summary, a full transcript, and the audio.";

export default async function Image() {
  const fonts = await ogFonts("Good conversations.Clear takeaways.", `MEETING NOTES ${SUB}`);
  return new ImageResponse(
    (
      <div style={ogFrame}>
        <OgBrand />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 22, letterSpacing: 5, color: OG.muted }}>MEETING NOTES</span>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Serif", fontSize: 96, lineHeight: 1, letterSpacing: -1.5 }}>
            <span>Good conversations.</span>
            <span style={{ color: OG.muted }}>Clear takeaways.</span>
          </div>
        </div>
        <span style={{ fontSize: 28, color: OG.muted }}>{SUB}</span>
      </div>
    ),
    { ...size, fonts }
  );
}
