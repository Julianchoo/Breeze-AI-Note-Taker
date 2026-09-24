import { ImageResponse } from "next/og";
import { getSharedMeeting } from "@/lib/meetings";
import { OG, OgBrand, ogFonts, ogFrame } from "@/lib/og";

export const alt = "Shared meeting notes from Breeze";
export const size = { width: OG.width, height: OG.height };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const meeting = await getSharedMeeting((await params).token);
  const title = meeting.title.length > 90 ? `${meeting.title.slice(0, 89)}…` : meeting.title;
  const date = new Date(meeting.createdAt).toLocaleDateString("en-US", { dateStyle: "long" });
  const minutes = `${Math.max(1, Math.round(meeting.durationSeconds / 60))} min`;
  const sections = [meeting.summary && "AI summary", meeting.chunks && "Recording", meeting.segments && "Transcript"].filter((s): s is string => !!s);
  const fonts = await ogFonts(title, `SHARED MEETING NOTES ${date} ${minutes} AI summary Recording Transcript ·`);
  return new ImageResponse(
    (
      <div style={ogFrame}>
        <OgBrand />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 22, letterSpacing: 5, color: OG.muted }}>SHARED MEETING NOTES</span>
          <span style={{ fontFamily: "Serif", fontSize: title.length > 45 ? 68 : 84, lineHeight: 1.05, letterSpacing: -1 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: OG.muted }}>
          <span>{date} · {minutes}</span>
          {sections.map((s) => (
            <span key={s} style={{ marginLeft: 6, padding: "6px 18px", borderRadius: 999, border: `2px solid ${OG.border}`, color: OG.fg, fontSize: 22 }}>
              {s}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
